"""Um comando só para abrir qualquer pedido do /auto.

Uso:
  python auto.py - <<'FIM'          (recomendado: o texto vai pela entrada, sem problema com aspas, $ ou crase)
  <o que o cliente digitou depois de /auto>
  FIM
  python auto.py "<texto>"          (também funciona)

Faz, nesta ordem:
 1. Reparos (Codex, rea, Bun, claude-mem, Python do uv, Chroma): uma linha "reparos: ok" ou só o que não está ok.
 2. Decide o modo, sem o cliente usar palavra especial. "Cobertura" = fração das palavras do assunto
    (o pedido sem verbos de continuar e sem palavras vazias) que aparecem no projeto mais parecido:
    - vazio, ou só verbo de continuar ("continua aí", "o que falta?") -> o projeto mais recente:
      CONTINUAR se falta algo nele, senão FECHADO
    - verbo de continuar + cobertura >= 0.6                          -> CONTINUAR esse projeto
    - cobertura >= 0.6 sem verbo, ou entre 0.5 e 0.6                 -> DUVIDA (perguntar uma vez)
    - o resto                                                         -> NOVO
 3. Sugere a pasta: NOVO -> ~/auto-projetos/<hoje>-<slug>; CONTINUAR -> a mesma pasta se o projeto
    está em andamento (sem painel.py init) ou <hoje>-<base>-vN se já foi entregue (N pedido, como
    "v3", é respeitado se for maior que o próximo livre).
 4. Mostra o projeto relacionado: pedido, prompt final, o que falta e riscos anotados.
"""
import datetime, os, re, sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
sys.stderr.reconfigure(encoding='utf-8', errors='replace')
sys.stdin.reconfigure(encoding='utf-8', errors='replace')  # o heredoc da Etapa 0 manda UTF-8; em cp1252 "narração" virava "narraa"
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import projetos  # noqa: E402
import reparos  # noqa: E402

# Verbos de continuar. "segue/seguir" ficaram de fora: "app para seguir treinos" não é continuação.
CONTINUAR = set(('continuar continue continua continuando termina termine terminar terminando pendencia pendencias '
                 'falta faltou faltando refaz refazer refaca ajusta ajuste ajustar ajustes corrige corrigir corrija '
                 'conserta consertar arruma arrumar melhora melhore melhorar melhorias versao retoma retome retomar '
                 'prossegue prosseguir finaliza finalize finalizar').split())
VERSAO = re.compile(r'^v(\d+)$')
DE_NOVO = re.compile(r'\bde novo\b')
FORTE, MEDIA = 0.6, 0.5
RAIZ_PREDIO = os.path.join(os.path.expanduser('~'), 'auto-projetos')
SAIDA_PREDIO = os.path.join(RAIZ_PREDIO, '_predio')  # predio.html, mapa.json, mapa.md e link.txt (fora dos andares)


def tokens(texto):
    return re.findall(r'[a-z0-9]+', projetos.norm(texto))


def quer_continuar(texto):
    return bool(CONTINUAR & set(tokens(texto))) or bool(DE_NOVO.search(projetos.norm(texto))) \
        or any(VERSAO.match(t) for t in tokens(texto))


def assunto_de(texto):
    """O pedido sem verbos de continuar, sem "de novo" e sem "vN": "faz de novo a vinheta" -> "faz a vinheta"."""
    return ' '.join(t for t in tokens(DE_NOVO.sub(' ', projetos.norm(texto)))
                    if t not in CONTINUAR and not VERSAO.match(t))


def versao_pedida(texto):
    return max([int(m.group(1)) for t in tokens(texto) for m in [VERSAO.match(t)] if m] or [0])


def entregue(d):
    return any(s.get('nome') == 'documentacao' and s.get('status') == 'feito'
               for s in (d.get('setores') or []) if isinstance(s, dict))


def hoje():
    return f'{datetime.date.today():%Y-%m-%d}'


def slug(texto):
    return '-'.join(projetos.palavras_de(texto))[:40].strip('-') or 'pedido'


def livre(nome):
    """Primeiro nome de pasta que não existe: nome, nome-2, nome-3..."""
    base, n = os.path.join(projetos.RAIZ, nome), 2
    caminho = base
    while os.path.exists(caminho):
        caminho, n = f'{base}-{n}', n + 1
    return caminho


def proxima_versao(pasta, pedida=0):
    """2026-10-16-claude-gpt-v2 -> <hoje>-claude-gpt-v3 (ou a versão pedida, se for maior)."""
    nome = re.sub(r'^\d{4}-\d{2}-\d{2}-', '', os.path.basename(pasta))
    base = re.sub(r'-v\d+$', '', nome)
    # Só pastas "<data>-<base>-vN": "outro-site-loja-v7" não conta para "site-loja".
    padrao = re.compile(rf'^\d{{4}}-\d{{2}}-\d{{2}}-{re.escape(base)}-v(\d+)$')
    versoes = [int(m.group(1)) for p in os.listdir(projetos.RAIZ) for m in [padrao.match(p)] if m]
    return livre(f'{hoje()}-{base}-v{max(versoes + [1, pedida - 1]) + 1}')


def pasta_continuar(pasta, d, pedida=0):
    if entregue(d):
        return proxima_versao(pasta, pedida), 'projeto já entregue: pasta nova da próxima versão (com painel.py init)'
    return pasta, 'projeto em andamento: MESMA pasta, NÃO rode painel.py init (use fase/usa/nota/build)'


def mais_recente(pedida=0):
    todos = projetos.projetos()
    if not todos:
        print('modo: NOVO (nenhum projeto anterior; pergunte o que o cliente quer fazer)')
        return
    pasta, d = todos[0]
    if projetos.o_que_falta(pasta, d):
        destino, nota = pasta_continuar(pasta, d, pedida)
        print(f'modo: CONTINUAR o projeto mais recente\npasta: {destino}\n  ({nota})')
    else:
        print('modo: FECHADO (o projeto mais recente não tem nada faltando: proponha 2 ou 3 melhorias com a '
              'opção "outra coisa"; se o cliente pedir outra coisa, rode o auto.py de novo com o texto dele)\n'
              'pasta se continuar: ' + proxima_versao(pasta, pedida))
    print('--- projeto ---')
    projetos.mostrar(pasta, d)


def predio():
    """Regenera o prédio 3D e o mapa.md (memória compacta dos projetos) e diz onde estão."""
    import subprocess
    script = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'predio', 'predio.py')
    if not os.path.exists(script):
        return
    # O prédio nunca pode derrubar o /auto: falha ou demora vira uma linha de aviso.
    try:
        r = subprocess.run([sys.executable, script, '--raiz', RAIZ_PREDIO, '--saida', SAIDA_PREDIO],
                           capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=60)
    except Exception as e:
        print(f'predio: falhou ({type(e).__name__})')
        return
    if r.returncode:
        ultima = ((r.stderr or r.stdout or '').strip().splitlines() or ['sem saída'])[-1]
        print(f'predio: falhou ({ultima[:200]})')
        return
    link = os.path.join(SAIDA_PREDIO, 'link.txt')
    link = open(link, encoding='utf-8').read().strip() if os.path.exists(link) else 'sem link (publique predio.html)'
    print(f'predio: {os.path.join(SAIDA_PREDIO, "mapa.md")} (leia antes de buscar chats)  link: {link}\n'
          f'  republique {os.path.join(SAIDA_PREDIO, "predio.html")} agora (Artifact, mesmo file_path, sem capabilities)')
    # Site da Vercel (https://predio-auto.vercel.app): manda o mapa e traz os pedidos feitos pelo celular.
    ponte = os.path.join(os.path.dirname(script), 'ponte.py')
    if os.path.exists(ponte):
        try:
            # sincronizar.py manda mapa, temas e fichas dos dashboards (só o que mudou) e traz edições feitas no site.
            sinc = os.path.join(os.path.dirname(script), 'sincronizar.py')
            m = subprocess.run([sys.executable, sinc], capture_output=True, text=True, encoding='utf-8',
                               errors='replace', timeout=180)
            linhas_sinc = [l for l in m.stdout.splitlines() if l.startswith(('sync:', 'erro:'))]
            print('site: ' + ('\n  '.join(linhas_sinc) or 'sincronização sem resposta'))
            r = subprocess.run([sys.executable, ponte, 'pedidos'], capture_output=True, text=True,
                               encoding='utf-8', errors='replace', timeout=20)
            # Ponte com erro não pode virar "0 novos": pedidos do cliente sumiriam sem aviso.
            if r.returncode:
                print('pedidos do site: ponte falhou (' + ((r.stdout or r.stderr).strip()[:150] or 'sem saída')
                      + '); confira antes de dizer que não há pedidos')
                return
            linhas = [l for l in r.stdout.splitlines() if '|' in l]
            print(f'pedidos do site: {len(linhas)} novo(s)' + ''.join('\n  ' + l for l in linhas)
                  + ('\n  (assuma com: python predio/ponte.py status <id> "em andamento"; no fim, "feito" e uma resposta;'
                     ' antes de qualquer ação externa, confirme com o cliente no chat)' if linhas else ''))
        except Exception as e:
            print(f'pedidos do site: ponte falhou ({type(e).__name__})')


def ler_texto():
    if sys.argv[1:] == ['-']:
        return sys.stdin.read().strip()
    return ' '.join(sys.argv[1:]).strip()


def main():
    texto = re.sub(r'^--plano\b\s*', '', ler_texto())  # o --plano muda as etapas, não o pedido

    problemas = [l for l in reparos.verificar(True) if not l.endswith(': ok')]
    print('reparos: ' + ('ok' if not problemas else '\n  '.join([''] + problemas).lstrip('\n ')))
    predio()

    assunto, pedida = assunto_de(texto), versao_pedida(texto)
    if not projetos.palavras_de(assunto):
        # "/auto", "/auto continua aí", "/auto o que falta?", "/auto de novo": o projeto mais recente.
        if texto and not quer_continuar(texto):
            print(f'modo: NOVO\npasta: {livre(f"{hoje()}-{slug(texto)}")}  (criar com painel.py init)')
            return
        return mais_recente(pedida)

    achado = projetos.melhor(assunto)
    cobertura = achado[3] if achado else 0
    n = len(projetos.palavras_de(assunto))
    # Uma palavra só em comum não basta ("logo da padaria" x vinheta com logo), a não ser que o assunto
    # seja uma palavra só ("continuar a vinheta").
    solido = achado is not None and (round(cobertura * n) >= 2 or n == 1)
    # Assunto de uma palavra que aparece uma vez só ("melhora o app"): pergunta em vez de retomar.
    certeiro = solido and (n > 1 or achado[2] >= 2)
    novo = livre(f'{hoje()}-{slug(texto)}')
    if certeiro and cobertura >= FORTE and quer_continuar(texto):
        pasta, d = achado[:2]
        destino, nota = pasta_continuar(pasta, d, pedida)
        print(f'modo: CONTINUAR\npasta: {destino}\n  ({nota})')
    elif solido and cobertura >= MEDIA:
        pasta, d = achado[:2]
        destino, _ = pasta_continuar(pasta, d, pedida)
        print(f'modo: DUVIDA (o pedido parece com "{projetos.campo(d, "titulo")}": {cobertura:.0%} das palavras). '
              f'Pergunte uma vez: continuar esse projeto ou começar um novo?\n'
              f'pasta se continuar: {destino}\npasta se novo: {novo}')
    else:
        print(f'modo: NOVO\npasta: {novo}  (criar com painel.py init)')
        return
    print('--- projeto ---')
    projetos.mostrar(pasta, d)


if __name__ == '__main__':
    main()
