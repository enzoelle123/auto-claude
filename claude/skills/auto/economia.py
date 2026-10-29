"""Economia de tokens do /auto: mede e reduz o contexto fixo que plugins e agentes ocupam.

Tudo é reversível: antes de mudar, salva backup em ~/.claude/backups/auto-economia/.

Comandos:
  status                      plugins ligados, agentes ativos/reserva e tokens fixos estimados
  plugins --manter a,b,c      desliga todo plugin fora da lista (núcleo do /auto já incluso)
  plugins --ligar a,b         religa plugins específicos
  agentes --manter "A","B"    move os outros funcionários para ~/.claude/agents-reserva/
  agentes --chamar "Nome"     imprime o briefing de um funcionário da reserva (para usar com Agent general-purpose)
  agentes --ligar "A","B"     traz funcionários da reserva de volta
  ajustes                     aplica as configurações oficiais de economia (conferidas na doc em 16/10/2026)
  restaurar                   desfaz o último passo (settings.json e agentes); repetir volta mais um passo
As mudanças valem a partir da próxima conversa.
"""
import datetime, glob, json, os, re, shutil, sys, tempfile

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
sys.stderr.reconfigure(encoding='utf-8', errors='replace')

HOME = os.path.expanduser('~')
CLAUDE = os.path.join(HOME, '.claude')
SETTINGS = os.path.join(CLAUDE, 'settings.json')
AGENTS = os.path.join(CLAUDE, 'agents')
RESERVA = os.path.join(CLAUDE, 'agents-reserva')
BACKUPS = os.path.join(CLAUDE, 'backups', 'auto-economia')

# Plugins que o /auto cita em SKILL.md e references/, mais o security-guidance
# (hook de segurança): nunca desligar. Hoje nenhum plugin é desligado (decisão do cliente em 16/10/2026).
NUCLEO = {
    'ecc', 'superpowers', 'watch', 'marketing-skills', 'pw', 'youtube-full', 'pulse', 'product-skills',
    'karpathy-coder', 'deep-research', 'video-content-strategist', 'roast', 'research-ops-skills',
    'research-orchestrator', 'landing', 'grill-me', 'executive-mentor', 'engineering-skills', 'claude-mem',
    'security-guidance',
}
AUSENTE = object()


def tokens(texto):
    return len(texto) / 3.6


def descricao(path):
    try:
        t = open(path, encoding='utf-8', errors='ignore').read(6000)
    except OSError:
        return ''
    m = re.search(r'^---\s*(.*?)\n---', t, re.S)
    return m.group(1) if m else ''


def custo_agente(path):
    """Tokens que o agente ocupa na lista do Agent tool (nome + descrição)."""
    fm = descricao(path)
    d = re.search(r'^description:\s*(.*?)(?=^\w[\w-]*:|\Z)', fm, re.S | re.M)
    return tokens(nome_agente(path) + (d.group(1) if d else ''))


def nome_agente(path):
    m = re.search(r'^name:\s*(.+)$', descricao(path), re.M)
    return (m.group(1).strip().strip('"\'') if m else os.path.splitext(os.path.basename(path))[0])


def ler_settings():
    with open(SETTINGS, encoding='utf-8') as f:
        return json.load(f)


def gravar_settings(d):
    # Grava num temporário e troca de uma vez: uma falha no meio nunca deixa o settings.json pela metade.
    fd, tmp = tempfile.mkstemp(dir=CLAUDE, prefix='settings.', suffix='.tmp')
    try:
        with os.fdopen(fd, 'w', encoding='utf-8') as f:
            json.dump(d, f, ensure_ascii=False, indent=2)
        os.replace(tmp, SETTINGS)
    except BaseException:
        os.unlink(tmp)
        raise


def nomes_md(pasta):
    return sorted(os.path.basename(p) for p in glob.glob(os.path.join(pasta, '*.md')))


def backup():
    # Nome com microssegundos e criação exclusiva: duas operações seguidas nunca dividem a mesma pasta.
    pasta = os.path.join(BACKUPS, datetime.datetime.now().strftime('%Y%m%d-%H%M%S-%f'))
    os.makedirs(pasta)
    shutil.copy2(SETTINGS, os.path.join(pasta, 'settings.json'))
    for arquivo, origem in (('agentes-ativos.json', AGENTS), ('agentes-reserva.json', RESERVA)):
        with open(os.path.join(pasta, arquivo), 'w', encoding='utf-8') as f:
            json.dump(nomes_md(origem), f, indent=1)
    print('backup:', pasta)
    return pasta


def registrar_depois(pasta):
    """Guarda o settings.json logo após a operação: o restaurar só desfaz o que ela mudou."""
    shutil.copy2(SETTINGS, os.path.join(pasta, 'depois.json'))


def mesclar(antes, depois, atual, prefixo=''):
    """Desfaz em `atual` só as chaves que a operação mudou (antes != depois) e que ninguém mexeu desde então.
    Chave alterada depois da operação é mantida e devolvida como conflito."""
    conflitos = []
    for k in set(antes) | set(depois) | set(atual):
        a, d, c = antes.get(k, AUSENTE), depois.get(k, AUSENTE), atual.get(k, AUSENTE)
        if a == d:
            continue
        if isinstance(d, dict) and isinstance(c, dict) and (isinstance(a, dict) or a is AUSENTE):
            # Bloco criado pela operação (ex.: env): mescla por dentro tratando o "antes" como vazio.
            conflitos += mesclar(a if isinstance(a, dict) else {}, d, c, f'{prefixo}{k}.')
            if a is AUSENTE and not c:
                atual.pop(k, None)
        elif c == d:
            if a is AUSENTE:
                atual.pop(k, None)
            else:
                atual[k] = a
        else:
            conflitos.append(prefixo + k)
    return conflitos


def mover(origem, pasta_destino):
    """Move sem sobrescrever: se já existir um arquivo com o mesmo nome no destino, não mexe e avisa."""
    destino = os.path.join(pasta_destino, os.path.basename(origem))
    if os.path.exists(destino):
        print(f'  aviso: {os.path.basename(origem)} já existe em {pasta_destino}; nada foi movido')
        return False
    shutil.move(origem, destino)
    return True


def lista(arg):
    return [x.strip().strip('"\'') for x in arg.split(',') if x.strip()]


def status():
    d = ler_settings()
    ligados = sorted(k.split('@')[0] for k, v in d.get('enabledPlugins', {}).items() if v)
    desligados = sorted(k.split('@')[0] for k, v in d.get('enabledPlugins', {}).items() if not v)
    ativos = glob.glob(os.path.join(AGENTS, '*.md'))
    reserva = glob.glob(os.path.join(RESERVA, '*.md'))
    t_ag = sum(custo_agente(p) for p in ativos)
    print(f'Plugins ligados: {len(ligados)} | desligados: {len(desligados)}')
    print(f'Funcionários ativos: {len(ativos)} (≈{t_ag:,.0f} tokens fixos por conversa) | na reserva: {len(reserva)}')
    print(f'Plugins ligados fora do núcleo do /auto: {len([p for p in ligados if p not in NUCLEO])} (decisão de 16/10/2026: ficam ligados)')
    print('Núcleo do /auto desligado (atenção):', ', '.join(p for p in desligados if p in NUCLEO) or 'nenhum')


def plugins(manter=None, ligar=None):
    d = ler_settings()
    ep = d.setdefault('enabledPlugins', {})
    conhecidos = {k.split('@')[0] for k in ep}
    desconhecidos = [n for n in (manter or []) + (ligar or []) if n not in conhecidos]
    if desconhecidos:
        sys.exit('Plugin(s) não encontrado(s): ' + ', '.join(desconhecidos) + '. Nada foi alterado.')
    pasta = backup()
    if manter is not None:
        manter = set(manter) | NUCLEO
        for k in ep:
            if k.split('@')[0] not in manter:
                ep[k] = False
    for nome in ligar or []:
        for k in ep:
            if k.split('@')[0] == nome:
                ep[k] = True
    gravar_settings(d)
    registrar_depois(pasta)
    status()


def agentes(manter=None, ligar=None):
    # Nome escrito errado em --manter mandaria quase todos para a reserva: recusa antes de qualquer mudança.
    existentes = {nome_agente(p).lower() for p in glob.glob(os.path.join(AGENTS, '*.md')) + glob.glob(os.path.join(RESERVA, '*.md'))}
    desconhecidos = [n for n in (manter or []) + (ligar or []) if n.lower() not in existentes]
    if desconhecidos:
        sys.exit('Funcionário(s) não encontrado(s): ' + ', '.join(desconhecidos) + '. Nada foi alterado.')
    os.makedirs(RESERVA, exist_ok=True)
    pasta = backup()
    if manter is not None:
        alvo = {m.lower() for m in manter}
        for p in glob.glob(os.path.join(AGENTS, '*.md')):
            if nome_agente(p).lower() not in alvo:
                mover(p, RESERVA)
    for nome in ligar or []:
        for p in glob.glob(os.path.join(RESERVA, '*.md')):
            if nome_agente(p).lower() == nome.lower():
                mover(p, AGENTS)
    registrar_depois(pasta)
    status()


# Conferidas em code.claude.com/docs/en/settings-reference e /env-vars (16/10/2026).
AJUSTES = {
    'bashOutputMaxChars': 15000,       # saída de terminal acima disso vai para arquivo (prévia de 2.000 caracteres)
    'promptSuggestionEnabled': False,  # sem requisição extra para sugerir o próximo prompt
}
AJUSTES_ENV = {
    'CLAUDE_CODE_SUBAGENT_MODEL': 'sonnet',  # funcionários em Sonnet; o Gerente revisor é chamado com model "opus"
    'MAX_MCP_OUTPUT_TOKENS': '15000',        # resultado de MCP acima disso vai para arquivo
}


def ajustes():
    d = ler_settings()
    pasta = backup()
    d.update(AJUSTES)
    d.setdefault('env', {}).update(AJUSTES_ENV)
    gravar_settings(d)
    registrar_depois(pasta)
    for k, v in {**AJUSTES, **AJUSTES_ENV}.items():
        print(f'  {k} = {v}')


def chamar(nome):
    for p in glob.glob(os.path.join(RESERVA, '*.md')) + glob.glob(os.path.join(AGENTS, '*.md')):
        if nome_agente(p).lower() == nome.lower():
            texto = open(p, encoding='utf-8').read()
            print(re.sub(r'^---.*?\n---\s*', '', texto, count=1, flags=re.S))
            return
    sys.exit(f'Funcionário não encontrado: {nome}')


def restaurar():
    pastas = sorted(p for p in glob.glob(os.path.join(BACKUPS, '*')) if os.path.isdir(p) and not p.endswith('.usado'))
    if not pastas:
        sys.exit('Nenhum backup em ' + BACKUPS)
    ultima = pastas[-1]
    # Valida o backup inteiro antes de mexer em qualquer coisa.
    try:
        with open(os.path.join(ultima, 'settings.json'), encoding='utf-8') as f:
            json.load(f)
        with open(os.path.join(ultima, 'agentes-ativos.json'), encoding='utf-8') as f:
            ativos = set(json.load(f))
        reserva_json = os.path.join(ultima, 'agentes-reserva.json')  # backups antigos (antes de 16/10 01:30) não têm
        reserva = set(json.load(open(reserva_json, encoding='utf-8'))) if os.path.exists(reserva_json) else set()
        antes = json.load(open(os.path.join(ultima, 'settings.json'), encoding='utf-8'))
        depois_json = os.path.join(ultima, 'depois.json')
        depois = json.load(open(depois_json, encoding='utf-8')) if os.path.exists(depois_json) else None
        atual = ler_settings()
    except (OSError, ValueError) as e:
        sys.exit(f'Backup incompleto ou corrompido em {ultima}: {e}. Nada foi alterado.')
    # Guarda o estado de agora antes de mexer: nada se perde nem com restauração errada.
    shutil.copy2(SETTINGS, os.path.join(ultima, 'settings-antes-de-restaurar.json'))
    with open(os.path.join(ultima, 'agentes-antes-de-restaurar.json'), 'w', encoding='utf-8') as f:
        json.dump({'ativos': nomes_md(AGENTS), 'reserva': nomes_md(RESERVA)}, f, indent=1)
    if depois is None:
        print('  aviso: backup sem depois.json; settings.json volta inteiro (estado de agora salvo no backup)')
        gravar_settings(antes)
    else:
        conflitos = mesclar(antes, depois, atual)
        gravar_settings(atual)
        for c in conflitos:
            print(f'  mantido (mudou depois da operação): {c}')
    os.makedirs(RESERVA, exist_ok=True)
    # Volta a distribuição nos dois sentidos; agentes que não existiam no backup ficam onde estão.
    for p in glob.glob(os.path.join(RESERVA, '*.md')):
        if os.path.basename(p) in ativos:
            mover(p, AGENTS)
    for p in glob.glob(os.path.join(AGENTS, '*.md')):
        if os.path.basename(p) in reserva:
            mover(p, RESERVA)
    # O backup usado vira histórico: o próximo "restaurar" volta um passo antes.
    os.rename(ultima, ultima + '.usado')
    print('restaurado de', ultima)
    status()


def opcoes(args, validas):
    """Lê --opção valor; recusa opção desconhecida ou sem valor antes de qualquer backup."""
    if len(args) % 2:
        sys.exit(f'Falta valor em: {" ".join(args)}\n{__doc__}')
    opt = dict(zip(args[0::2], args[1::2]))
    errado = [k for k in opt if k not in validas]
    vazio = [k for k, v in opt.items() if not v.strip() or v.startswith('--')]
    if errado or vazio or not opt:
        sys.exit(f'Opções inválidas ({", ".join(errado + vazio) or "nenhuma"}).\n{__doc__}')
    return opt


def main():
    a = sys.argv[1:]
    if not a or a[0] == 'status':
        return status()
    if a[0] == 'plugins':
        opt = opcoes(a[1:], ('--manter', '--ligar'))
        return plugins(lista(opt['--manter']) if '--manter' in opt else None, lista(opt.get('--ligar', '')))
    if a[0] == 'agentes':
        opt = opcoes(a[1:], ('--manter', '--ligar', '--chamar'))
        if '--chamar' in opt:
            return chamar(opt['--chamar'])
        return agentes(lista(opt['--manter']) if '--manter' in opt else None, lista(opt.get('--ligar', '')))
    if a[0] == 'ajustes':
        return ajustes()
    if a[0] == 'restaurar':
        return restaurar()
    print(__doc__)


if __name__ == '__main__':
    main()
