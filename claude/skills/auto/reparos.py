"""Reparos automáticos do /auto: caminhos que mudam quando o Windows ou o app atualizam algo.

Uso:
  python reparos.py            confere e conserta tudo (silencioso quando está tudo certo)
  python reparos.py status     só mostra o estado, sem mudar nada
Rode com o Bash em timeout 600000: reinstalar o Codex baixa ~445 MB (e o rea-agents, ~256 MB).

Cobre:
  codex       o Codex CLI mora na pasta do Node do WinGet (com a versão no nome). Quando o Node atualiza,
              o app aberto continua com o PATH antigo: este script acha o Node mais novo do WinGet, põe na
              frente do PATH (só deste processo) e reinstala a versão testada se o Codex não rodar.
  bun         o claude-mem procura o Bun em ~/.bun/bin/bun.exe; mantém ali um link fixo para o Bun do WinGet
              (só se o arquivo for nosso: uma instalação oficial do Bun em ~/.bun não é tocada).
  claude-mem  o claude-mem chama o Haiku pelo claude.exe do app, que fica em
              %APPDATA%/Claude/claude-code/<versão>/<hash>/claude.exe e muda a cada atualização do app.
              Mantém ~/.claude-mem/bin/claude.exe como link fixo para a versão mais nova, aponta
              CLAUDE_CODE_PATH para ele e confere o login (claude auth login).
  rea         o MCP `rea` (rea-agents) fica no ~/.claude.json com o caminho do node.exe e do rea.mjs da pasta do
              Node do WinGet. Quando o Node muda, o caminho morre: acha o Node novo (como no codex), reinstala
              a versão testada do rea-agents se ela sumiu junto e roda `rea-agents setup --client claude_code`
              (primeiro com --dry-run). Não edita o ~/.claude.json à mão.
  python-uv   no app Claude (MSIX) os Pythons do uv moram no armazenamento virtual
              %LOCALAPPDATA%/Packages/Claude_pzs8sxrjxfjjc/LocalCache/Roaming/uv/python. A junction de versão
              menor (cpython-3.13-windows-x86_64-none) que o uv cria aponta para o caminho lógico
              %APPDATA%/uv/python/..., que não resolve ("Missing expected target directory", astral-sh/uv#19622).
              Refaz a junction com mklink /J apontando para a pasta física do LocalCache.
  chroma      a busca semântica do claude-mem precisa do chroma-mcp com pydantic<2.12.
Links fixos (hard links) não precisam de administrador e continuam funcionando mesmo se o app
apagar a versão antiga.
"""
import datetime, glob, json, os, re, shutil, stat, subprocess, sys, tempfile, time

INICIO = time.monotonic()  # o /auto roda isto num Bash de 600 s: dois downloads grandes na mesma rodada não cabem

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
sys.stderr.reconfigure(encoding='utf-8', errors='replace')

HOME = os.path.expanduser('~')
LOCAL = os.environ.get('LOCALAPPDATA', '')
CODEX_VERSAO = '0.163.0'
TIMEOUT_INSTALAR = 480
WINGET = os.path.join(LOCAL, 'Microsoft', 'WinGet', 'Packages')
BUN_WINGET = os.path.join(WINGET, 'Oven-sh.Bun_Microsoft.Winget.Source_8wekyb3d8bbwe', 'bun-windows-x64', 'bun.exe')
BUN_FIXO = os.path.join(HOME, '.bun', 'bin', 'bun.exe')
BUN_MARCA = os.path.join(HOME, '.bun', 'bin', '.link-do-auto')  # prova de que o bun.exe dali é o nosso link
CLAUDE_VERSOES = os.path.join(os.environ.get('APPDATA', ''), 'Claude', 'claude-code')
CLAUDE_FIXO = os.path.join(HOME, '.claude-mem', 'bin', 'claude.exe')
MEM_DIR = os.path.join(HOME, '.claude-mem')
MEM_SETTINGS = os.path.join(MEM_DIR, 'settings.json')
CHROMA = ['chroma-mcp==0.2.6', '--with', 'onnxruntime>=1.20', '--with', 'protobuf<7', '--with', 'pydantic<2.12']
VERSAO = re.compile(r'^\d+(\.\d+)*$')  # só versões estáveis (2.1.299); ignora 2.1.300-beta e afins
REA_VERSAO = '6.5.0'
CLAUDE_JSON = os.path.join(os.environ.get('CLAUDE_CONFIG_DIR') or HOME, '.claude.json')  # o mesmo que o rea usa
UV_PYTHON = (os.environ.get('UV_PYTHON_INSTALL_DIR')  # caminho lógico: é por ele que o uv abre
             or os.path.join(os.environ.get('APPDATA', ''), 'uv', 'python'))
LOCALCACHE = os.path.join(LOCAL, 'Packages', 'Claude_pzs8sxrjxfjjc', 'LocalCache')
LINK_MENOR = re.compile(r'^cpython-(\d+\.\d+)((?:\+\w+)?-.+)$')  # cpython-3.13-windows-x86_64-none (e +freethreaded)
PASTA_PATCH = re.compile(r'^cpython-(\d+\.\d+)\.(\d+)((?:\+\w+)?-.+)$')  # cpython-3.13.15-windows-x86_64-none
# Variáveis do app: com elas o claude.exe avulso tenta a autenticação do app em vez do próprio login.
VARS_DO_APP = ('ANTHROPIC_BASE_URL', 'CLAUDE_CODE_ENTRYPOINT', 'CLAUDE_CODE_CHILD_SESSION',
               'CLAUDE_CODE_SDK_HAS_HOST_AUTH_REFRESH')


def rodar(cmd, timeout=60, env=None):
    p = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, encoding='utf-8',
                         errors='replace', env=env)
    try:
        out, err = p.communicate(timeout=timeout)
        return subprocess.CompletedProcess(cmd, p.returncode, out, err)
    except subprocess.TimeoutExpired:
        # npm.cmd -> cmd.exe -> node.exe: matar só o cmd.exe deixaria o node rodando e segurando a saída.
        if os.name == 'nt':
            subprocess.run(['taskkill', '/PID', str(p.pid), '/T', '/F'], capture_output=True)
        else:
            p.kill()
        p.communicate()
        return subprocess.CompletedProcess(cmd, 124, '', f'tempo esgotado ({timeout} s)')


def num(v):
    return tuple(int(x) for x in re.findall(r'\d+', v))


def mesmo_arquivo(a, b):
    try:
        return os.path.samefile(a, b)
    except OSError:
        return False


def religar(alvo, fonte):
    """Troca `alvo` por um hard link de `fonte` (ou cópia, se estiverem em discos diferentes).
    Troca atômica: nunca fica sem arquivo. Se o alvo estiver em uso (exe rodando), o Windows recusa a troca:
    o arquivo atual continua valendo e a troca fica para a próxima execução."""
    os.makedirs(os.path.dirname(alvo), exist_ok=True)
    tmp = f'{alvo}.{os.getpid()}.novo'  # nome único: duas execuções juntas não se atrapalham
    try:
        try:
            os.link(fonte, tmp)
        except OSError:
            shutil.copy2(fonte, tmp)
        try:
            os.replace(tmp, alvo)
        except PermissionError:
            return False
        return True
    finally:
        if os.path.exists(tmp):
            os.unlink(tmp)


def ler_json(caminho):
    with open(caminho, encoding='utf-8-sig') as f:  # -sig: aceita arquivo salvo com BOM por editores
        return json.load(f)


def gravar_json(caminho, dados):
    fd, tmp = tempfile.mkstemp(dir=os.path.dirname(caminho), suffix='.tmp')
    try:
        with os.fdopen(fd, 'w', encoding='utf-8') as f:
            json.dump(dados, f, ensure_ascii=False, indent=2)
        os.replace(tmp, caminho)
    finally:
        if os.path.exists(tmp):
            os.unlink(tmp)


# ---------- Codex ----------

def node_mais_novo():
    """Pasta do Node mais novo instalado pelo WinGet (a que tem node.exe e npm.cmd)."""
    pastas = [d for d in glob.glob(os.path.join(WINGET, 'OpenJS.NodeJS*', 'node-v*-win-x64'))
              if os.path.exists(os.path.join(d, 'node.exe')) and os.path.exists(os.path.join(d, 'npm.cmd'))]
    return max(pastas, key=lambda d: num(os.path.basename(d))) if pastas else None


def garantir_node():
    """Com o app aberto depois de o WinGet atualizar o Node, o PATH herdado aponta para a pasta antiga.
    Põe a pasta do Node mais novo na frente do PATH deste processo (e dos filhos dele)."""
    if shutil.which('node') and shutil.which('npm'):
        return
    pasta = node_mais_novo()
    if pasta:
        os.environ['PATH'] = pasta + os.pathsep + os.environ.get('PATH', '')


def comando_codex():
    """Comando do Codex sem passar pelo cmd.exe (codex.CMD reinterpreta & | ^ em caminhos), ou None."""
    garantir_node()
    exe = shutil.which('codex')
    if not exe:
        return None
    if exe.lower().endswith('.cmd'):
        js = os.path.join(os.path.dirname(exe), 'node_modules', '@openai', 'codex', 'bin', 'codex.js')
        node = shutil.which('node')
        if not (node and os.path.exists(js)):
            return None  # .cmd órfão (pasta antiga sem node.exe): conta como ausente
        return [node, js]
    return [exe]


def codex_funciona():
    cmd = comando_codex()
    return bool(cmd) and rodar(cmd + ['--version']).returncode == 0


def codex(consertar):
    if codex_funciona():
        return 'codex: ok'
    npm = shutil.which('npm')
    if not consertar or not npm:
        return 'codex: AUSENTE' + ('' if npm else ' (sem npm: feche e reabra o app depois de atualizar o Node)')
    r = rodar([npm, 'install', '-g', f'@openai/codex@{CODEX_VERSAO}'], timeout=TIMEOUT_INSTALAR)
    if r.returncode != 0 or not codex_funciona():
        return f'codex: FALHOU ao reinstalar ({(r.stderr or r.stdout).strip()[-200:]})'
    return f'codex: reinstalado {CODEX_VERSAO} (o login em ~/.codex continua valendo)'


# ---------- MCP rea ----------

def rea_mortos():
    """Caminhos do MCP `rea` no ~/.claude.json que não existem mais ([] = tudo vivo; None = rea não registrado)."""
    try:
        cfg = ler_json(CLAUDE_JSON)
    except (OSError, ValueError):
        return None  # arquivo ausente ou no meio de uma gravação do app: confere na próxima
    srv = (cfg.get('mcpServers') or {}).get('rea') if isinstance(cfg, dict) else None
    if not isinstance(srv, dict):
        return None
    partes = [srv.get('command')] + list(srv.get('args') or [])
    return [p for p in partes if isinstance(p, str) and os.path.isabs(p) and not os.path.exists(p)]


def comando_rea():
    """rea-agents pelo node + rea.mjs (sem cmd.exe, como no codex), ou None. O node é o da mesma pasta,
    porque o setup grava no MCP o caminho do node que o rodou."""
    garantir_node()
    exe = shutil.which('rea-agents')
    if not exe:
        return None
    if not exe.lower().endswith('.cmd'):
        return [exe]
    pasta = os.path.dirname(exe)
    js = os.path.join(pasta, 'node_modules', 'rea-agents', 'scripts', 'rea.mjs')
    node = os.path.join(pasta, 'node.exe')
    node = node if os.path.exists(node) else shutil.which('node')
    return [node, js] if node and os.path.exists(js) else None


def setup_rea(cmd, *extra):
    r = rodar(cmd + ['setup', '--client', 'claude_code', '--yes', '--format', 'json', *extra], timeout=180)
    try:
        d = json.loads(r.stdout)
    except ValueError:
        d = None
    if not isinstance(d, dict):
        return {'status': f'sem resposta, código {r.returncode}', 'remediation': (r.stderr or r.stdout).strip()[-150:]}
    return d


def rea(consertar):
    mortos = rea_mortos()
    if not mortos:
        return 'rea: ok'
    if not consertar:
        return f'rea: MCP aponta para caminho que não existe ({mortos[0]})'
    cmd, extra = comando_rea(), ''
    if not cmd:  # o rea-agents morava na pasta do Node antigo e sumiu com ela
        npm = shutil.which('npm')
        if not npm:
            return 'rea: MCP quebrado e sem npm (feche e reabra o app depois de atualizar o Node)'
        if time.monotonic() - INICIO > 60:  # o Codex acabou de reinstalar: mais 256 MB podem estourar o Bash
            return 'rea: MCP quebrado; reinstalar o rea-agents (~256 MB) fica para o próximo /auto (esta rodada já usou o tempo)'
        r = rodar([npm, 'install', '-g', f'rea-agents@{REA_VERSAO}'], timeout=TIMEOUT_INSTALAR)
        cmd = comando_rea()
        if r.returncode != 0 or not cmd:
            return f'rea: FALHOU ao reinstalar rea-agents ({(r.stderr or r.stdout).strip()[-200:]})'
        extra = f', rea-agents {REA_VERSAO} reinstalado'
    # Primeiro o plano: só aplica se ele mexer apenas no Claude Code (registro do MCP e a skill do rea).
    plano = setup_rea(cmd, '--dry-run')
    ids = [a.get('id', '') for a in plano.get('plannedActions') or [] if isinstance(a, dict)]
    if plano.get('status') != 'planned' or 'configure_client:claude_code' not in ids:
        motivo = str(plano.get('remediation') or '')[:150]
        return f'rea: MCP quebrado, setup não planejou o conserto ({plano.get("status")}{": " + motivo if motivo else ""}); nada alterado'
    fora = [i for i in ids if not i.endswith(':claude_code')]
    if fora:
        return (f'rea: MCP quebrado, mas o setup também mexeria em {", ".join(fora)}; nada alterado '
                '(veja com: rea-agents setup --client claude_code --dry-run)')
    feito = setup_rea(cmd)
    # rea_mortos() None logo depois = o app regravando o arquivo; o setup já disse que configurou.
    if 'configured_claude_code' not in (feito.get('appliedActions') or []) or rea_mortos():
        return f'rea: FALHOU no setup ({feito.get("status")}: {str(feito.get("remediation") or "")[:150]})'
    versao = re.search(r'node-v[\d.]+', cmd[0])
    return f'rea: MCP religado ao {versao[0] if versao else cmd[0]}{extra} (vale numa sessão nova ou pelo /mcp)'


# ---------- Bun ----------

def bun(consertar):
    if not os.path.exists(BUN_WINGET):
        return 'bun: ok' if os.path.exists(BUN_FIXO) else 'bun: AUSENTE (winget install Oven-sh.Bun)'
    if mesmo_arquivo(BUN_FIXO, BUN_WINGET):
        return 'bun: ok'
    if os.path.exists(BUN_FIXO) and not os.path.exists(BUN_MARCA):
        return 'bun: ok'  # instalação própria do Bun em ~/.bun (não é o nosso link): não mexo
    if not consertar:
        return 'bun: link desatualizado'
    if not religar(BUN_FIXO, BUN_WINGET):
        return 'bun: em uso, troca adiada (o atual segue valendo)'
    open(BUN_MARCA, 'w').close()
    return 'bun: link atualizado'


# ---------- claude-mem ----------

def login_claude():
    """True/False pelo `auth status`; None se não deu para conferir (tempo esgotado ou saída estranha)."""
    env = {k: v for k, v in os.environ.items() if k not in VARS_DO_APP}
    r = rodar([CLAUDE_FIXO, 'auth', 'status'], env=env)
    try:
        return json.loads(r.stdout).get('loggedIn') is True
    except ValueError:
        return None


def claude_mem(consertar):
    versoes = [p for p in glob.glob(os.path.join(CLAUDE_VERSOES, '*', '*', 'claude.exe'))
               if VERSAO.match(os.path.basename(os.path.dirname(os.path.dirname(p))))]
    if not versoes:
        return 'claude-mem: claude.exe do app não encontrado em ' + CLAUDE_VERSOES
    # Mais nova pela versão; empate (hashes diferentes da mesma versão): a de data mais recente.
    novo = max(versoes, key=lambda p: (num(os.path.basename(os.path.dirname(os.path.dirname(p)))), os.path.getmtime(p)))
    try:
        cfg = ler_json(MEM_SETTINGS)
    except (OSError, ValueError):
        return 'claude-mem: sem ~/.claude-mem/settings.json legível'
    if not isinstance(cfg, dict):
        return 'claude-mem: ~/.claude-mem/settings.json inesperado (não é objeto); nada alterado'
    ok_link = mesmo_arquivo(CLAUDE_FIXO, novo)
    ok_cfg = cfg.get('CLAUDE_CODE_PATH') == CLAUDE_FIXO
    if not (ok_link and ok_cfg):
        if not consertar:
            return 'claude-mem: ' + ('link desatualizado' if not ok_link else 'CLAUDE_CODE_PATH não aponta para o link')
        if not ok_link and not religar(CLAUDE_FIXO, novo):
            return 'claude-mem: claude.exe em uso, troca adiada (o atual segue valendo)'
        if not ok_cfg:
            cfg['CLAUDE_CODE_PATH'] = CLAUDE_FIXO
            gravar_json(MEM_SETTINGS, cfg)
    # Sem login o claude-mem falha calado ("SDK authentication failed"): este é o aviso.
    login = login_claude() if os.path.exists(CLAUDE_FIXO) else True
    if login is None:
        return 'claude-mem: não consegui conferir o login do claude.exe avulso (auth status sem resposta)'
    if not login:
        return f'claude-mem: SEM LOGIN no claude.exe avulso (o cliente roda: & "{CLAUDE_FIXO}" auth login)'
    try:
        saude = ler_json(os.path.join(MEM_DIR, 'observer-health.json'))
        pausa = saude.get('quotaCooldown') or {}
        if pausa.get('active') and pausa.get('until', 0) / 1000 > datetime.datetime.now().timestamp():
            ate = datetime.datetime.fromtimestamp(pausa['until'] / 1000).strftime('%H:%M')
            return f'claude-mem: pausado até {ate} (limite de uso da assinatura; não é defeito)'
        # Pausa por limite que já acabou: o contador só zera no próximo sucesso, então não é falha de verdade.
        if saude.get('consecutiveFailures') and saude.get('lastErrorKind') != 'quota_exhausted':
            return f'claude-mem: {saude["consecutiveFailures"]} falhas seguidas ({str(saude.get("lastErrorMessage"))[:120]})'
    except (OSError, ValueError, AttributeError, TypeError):
        pass
    if ok_link and ok_cfg:
        return 'claude-mem: ok'
    return f'claude-mem: claude.exe ligado à versão {os.path.basename(os.path.dirname(os.path.dirname(novo)))}'


# ---------- Pythons do uv no app MSIX ----------

def e_junction(p):
    """Junction do NTFS (o que o mklink /J cria). os.path.isjunction só existe a partir do Python 3.12."""
    try:
        return os.lstat(p).st_reparse_tag == stat.IO_REPARSE_TAG_MOUNT_POINT
    except (OSError, AttributeError):
        return False


def no_localcache(p):
    """Onde o app MSIX guarda de fato uma pasta nova criada em `p`, ou None se `p` estiver fora do AppData."""
    for raiz, nome in ((os.environ.get('APPDATA', ''), 'Roaming'), (LOCAL, 'Local')):
        try:
            rel = os.path.relpath(p, raiz) if raiz else '..'
        except ValueError:  # outro disco
            continue
        if rel != '..' and not rel.startswith('..' + os.sep):
            return os.path.normpath(os.path.join(LOCALCACHE, nome, rel))
    return None


UV_PYTHON_APP = no_localcache(UV_PYTHON)  # ...\LocalCache\Roaming\uv\python


def link_uv_quebrado(nome):
    """O uv abre o Python pelo caminho lógico; pelo LocalCache a mesma junction pode parecer boa (testado 17/10)."""
    return not os.path.exists(os.path.join(UV_PYTHON, nome, 'python.exe'))


def pasta_uv_certa(nome, nomes, antigo):
    """Pasta física (no LocalCache) para a junction `nome`: a mesma versão para onde ela apontava, se estiver lá
    com python.exe; senão o patch mais novo da mesma versão menor e variante. None se não houver nenhuma."""
    m = LINK_MENOR.match(nome)
    opcoes = {}
    for n in nomes:
        p = PASTA_PATCH.match(n)
        pasta = os.path.join(UV_PYTHON_APP, n)
        if (p and p[1] == m[1] and p[3] == m[2] and not os.path.islink(pasta) and not e_junction(pasta)
                and os.path.exists(os.path.join(pasta, 'python.exe'))):
            opcoes[n] = pasta
    if not opcoes:
        return None
    return opcoes.get(antigo) or opcoes[max(opcoes, key=lambda n: int(PASTA_PATCH.match(n)[2]))]


def python_uv(consertar):
    if not (UV_PYTHON_APP and os.path.isdir(UV_PYTHON_APP)):
        return 'python-uv: ok'  # fora do app MSIX, uv fora do AppData ou sem Pythons do uv: nada a consertar
    nomes = sorted(os.listdir(UV_PYTHON_APP))
    avisos, feitos = [], []
    for nome in nomes:
        link, m = os.path.join(UV_PYTHON_APP, nome), LINK_MENOR.match(nome)
        if not (m and e_junction(link)):
            continue
        # Fora do app o caminho lógico não mostra o LocalCache: dali não dá para julgar esta junction.
        if not os.path.lexists(os.path.join(UV_PYTHON, nome)) or not link_uv_quebrado(nome):
            continue
        try:
            antigo = os.path.basename(os.readlink(link))
        except OSError:
            antigo = ''
        alvo = pasta_uv_certa(nome, nomes, antigo)
        if not alvo:
            versao = m[1] + ('t' if m[2].startswith('+freethreaded') else '')
            avisos.append(f'{nome} quebrada e sem pasta com python.exe no LocalCache '
                          f'(nada alterado; reinstale: uv python install {versao} --reinstall)')
            continue
        if not consertar:
            avisos.append(f'{nome} quebrada')
            continue
        try:
            os.rmdir(link)  # numa junction, apaga só o link; a pasta para onde ela aponta fica intacta
        except OSError as e:
            avisos.append(f'{nome}: não consegui apagar a junction ({e.strerror})')
            continue
        r = rodar(['cmd', '/c', 'mklink', '/J', link, alvo])
        if r.returncode != 0 or link_uv_quebrado(nome):
            avisos.append(f'{nome}: FALHOU ao refazer (rode: cmd /c mklink /J "{link}" "{alvo}")')
            continue
        feitos.append(f'{nome} -> {os.path.basename(alvo)}')
    if avisos:
        return 'python-uv: ' + '; '.join(avisos + [f'refeita {f}' for f in feitos])
    if feitos:
        return 'python-uv: junction refeita (' + ', '.join(feitos) + ')'
    return 'python-uv: ok'


# ---------- Chroma ----------

def chroma_falhou_no_log():
    """O claude-mem roda o chroma por uvx com os argumentos dele; se mudarem, o log é quem conta."""
    logs = sorted(glob.glob(os.path.join(MEM_DIR, 'logs', 'claude-mem-*.log')))
    if not logs:
        return False
    # Só linhas em que CHROMA_MCP é o componente do log: o claude-mem também grava o texto dos comandos
    # Bash das sessões, e um grep por "[CHROMA_MCP] failed" viraria um falso alarme (achado do Gerente).
    evento = re.compile(r'^\[[^\]]+\] \[\w+\s*\] \[CHROMA_MCP\] ')
    with open(logs[-1], encoding='utf-8', errors='replace') as f:
        eventos = [l for l in f if evento.match(l) and ('Connected' in l or 'failed' in l)]
    return bool(eventos) and 'failed' in eventos[-1]


def chroma(consertar):
    """A busca semântica do claude-mem (chroma-mcp 0.2.6) quebra com pydantic >= 2.12 (eval_type_backport).
    Com a ferramenta instalada pelo uv com pydantic fixo, o uvx do claude-mem passa a funcionar (testado 16/10/2026)."""
    uv = shutil.which('uv')
    if not uv:
        return 'chroma: uv ausente (busca semântica do claude-mem desligada na prática)'
    r = rodar([uv, 'tool', 'dir'])
    # Confere o pydantic de verdade instalado no ambiente da ferramenta, não só o nome dela.
    pyd = glob.glob(os.path.join(r.stdout.strip(), 'chroma-mcp', 'Lib', 'site-packages', 'pydantic-*.dist-info'))
    versao = num(os.path.basename(pyd[0]))[:2] if pyd else None
    if versao and versao < (2, 12):
        if chroma_falhou_no_log():
            return 'chroma: ferramenta ok, mas a última conexão do claude-mem falhou (veja ~/.claude-mem/logs)'
        return 'chroma: ok'
    if not consertar:
        return 'chroma: ferramenta ausente ou com pydantic incompatível'
    r = rodar([uv, 'tool', 'install', '--force', '--python', '3.13', *CHROMA], timeout=TIMEOUT_INSTALAR)
    return 'chroma: reinstalado (pydantic<2.12)' if r.returncode == 0 else f'chroma: FALHOU ({r.stderr.strip()[-200:]})'


def verificar(consertar=True):
    linhas = []
    # rea depois do codex (reaproveita o Node achado por ele); python_uv antes do chroma (que usa o Python 3.13 do uv).
    for f in (codex, rea, bun, claude_mem, python_uv, chroma):
        try:  # falha num reparo não impede os outros
            linhas.append(f(consertar))
        except Exception as e:
            linhas.append(f'{f.__name__}: ERRO {type(e).__name__}: {e}')
    return linhas


def main():
    consertar = not (len(sys.argv) > 1 and sys.argv[1] == 'status')
    linhas = verificar(consertar)
    # Silencioso quando está tudo certo: o /auto chama isto no início e não deve gastar contexto à toa.
    if not consertar or any(not l.endswith(': ok') for l in linhas):
        print('\n'.join(linhas))


if __name__ == '__main__':
    main()
