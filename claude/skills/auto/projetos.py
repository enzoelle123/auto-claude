"""Projetos anteriores do /auto: para retomar sem o cliente escrever prompt.

Uso:
  python projetos.py                 o projeto mais recente e o que falta nele (= ultimo)
  python projetos.py ultimo
  python projetos.py buscar "termos"  o projeto que melhor casa com os termos e o que falta nele
  python projetos.py lista [N]        os N projetos mais recentes (padrão 8), uma linha cada

"O que falta" junta: setores não feitos no painel, critérios "- [ ]" do prompt-final.md e os itens das
seções Pendências/Pendente/O que falta dos arquivos em entregas/. A seção Riscos aparece à parte, como
informação (não mantém o projeto aberto). Saída curta de propósito (economia de tokens).
"""
import glob, json, os, re, sys, unicodedata

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
sys.stderr.reconfigure(encoding='utf-8', errors='replace')

RAIZ = os.path.join(os.path.expanduser('~'), 'auto-projetos')
SECOES = re.compile(r'^(#{2,3})\s*(pend[eê]ncias?|pendente|o que falta)', re.I)
RISCOS = re.compile(r'^(#{2,3})\s*(riscos?)', re.I)
TITULO = re.compile(r'^(#{1,6})\s')
ITEM = re.compile(r'^\s*(?:[-*+]|\d+[.)])\s+')  # "- ", "* ", "+ ", "1. ", "1) "
MAX_ITENS = 12


def norm(s):
    return ''.join(c for c in unicodedata.normalize('NFD', str(s).lower()) if unicodedata.category(c) != 'Mn')


def projetos():
    """Pastas com painel.json, da mais recente para a mais antiga (pela data de atualização do painel)."""
    itens = []
    for pj in glob.glob(os.path.join(RAIZ, '*', 'painel.json')):
        pasta = os.path.dirname(pj)
        if os.path.basename(pasta).startswith('teste'):
            continue
        try:
            d = json.load(open(pj, encoding='utf-8-sig'))  # -sig: aceita painel salvo com BOM
        except (OSError, ValueError):
            continue
        if not isinstance(d, dict):
            continue
        itens.append((str(d.get('atualizado') or ''), pasta, d))
    return [(p, d) for _, p, d in sorted(itens, key=lambda x: x[0], reverse=True)]


def ler(caminho):
    try:
        return open(caminho, encoding='utf-8', errors='replace').read()
    except OSError:
        return ''


def linha_auto(pasta):
    """Primeira linha "/auto ..." do prompt-final.md (o pedido já otimizado)."""
    for l in ler(os.path.join(pasta, 'prompt-final.md')).splitlines():
        if l.strip().startswith('/auto '):
            return l.strip()
    return ''


def o_que_falta(pasta, d):
    status = {s.get('nome'): s.get('status') for s in (d.get('setores') or []) if isinstance(s, dict)}
    # Projeto entregue (Documentação feita): setor parado foi pulado de propósito (pedido pequeno), não falta.
    entregue = status.get('documentacao') == 'feito'
    falta = [] if entregue else [f'setor {n}: {s}' for n, s in status.items() if s not in ('feito', 'pulado')]
    falta += [l.strip()[6:].strip() for l in ler(os.path.join(pasta, 'prompt-final.md')).splitlines()
              if l.strip().startswith('- [ ]')]
    return unicos(falta + itens_de_secao(pasta, SECOES))


def riscos(pasta):
    """Riscos anotados: informação para o cliente, não tarefa (não mantêm o projeto aberto)."""
    return unicos(itens_de_secao(pasta, RISCOS))


def unicos(itens):
    vistos, saida = set(), []
    for f in itens:
        if f and f not in vistos:
            vistos.add(f)
            saida.append(f)
    return saida


def itens_de_secao(pasta, secao):
    itens = []
    for arq in sorted(glob.glob(os.path.join(pasta, 'entregas', '*.md'))):
        nivel, codigo = 0, False  # nivel > 0: dentro de uma seção procurada, daquele nível
        for l in ler(arq).splitlines():
            if l.lstrip().startswith('```'):
                codigo = not codigo
                continue
            if codigo:
                continue
            t, s = TITULO.match(l), secao.match(l)
            if s:
                nivel = len(s.group(1))
                continue
            if t and len(t.group(1)) <= nivel:  # subtítulo mais fundo (####) não encerra a seção
                nivel = 0
            if not nivel or not ITEM.match(l):
                continue
            item = ITEM.sub('', l).strip()
            # Feito ([x]), riscado (~~) ou marcado "(resolvido" não conta mais.
            if item.lower().startswith('[x]') or '~~' in item or '(resolvid' in norm(item):
                continue
            itens.append(re.sub(r'^\[ \]\s*', '', item))
    return itens


def mostrar(pasta, d):
    print(f'Projeto: {campo(d, "titulo")}  ({os.path.basename(pasta)}, atualizado {campo(d, "atualizado") or "?"})')
    print(f'Pasta: {pasta}')
    print(f'Pedido original: {campo(d, "pedido")[:300]}')
    auto = linha_auto(pasta)
    if auto:
        print(f'Prompt final: {auto[:400]}')
    falta = o_que_falta(pasta, d)
    print('O que falta:' + ('' if falta else ' nada registrado (projeto fechado)'))
    for f in falta[:MAX_ITENS]:
        print(f'  - {f[:220]}')
    if len(falta) > MAX_ITENS:
        print(f'  ... e mais {len(falta) - MAX_ITENS} (veja prompt-final.md e entregas/)')
    risco = riscos(pasta)
    if risco:
        print('Riscos anotados (informação, não tarefa):')
        for r in risco[:5]:
            print(f'  - {r[:220]}')
    if d.get('log'):
        ultimo = d['log'][-1]
        print(f'Último registro: {(ultimo.get("texto") if isinstance(ultimo, dict) else ultimo)!s:.200}')


def campo(d, k):
    return str(d.get(k) or '')  # "titulo": null não pode derrubar a busca


VAZIAS = set('de da do das dos pra pras pro pros para por o a os as um uma uns umas e com que no na nos nas num numa '
              'em ao aos me meu minha meus minhas eu voce sobre ser ter tem vai esse essa isso este esta aquele '
              'aquela mais muito bem faz faca fazer quero queria preciso agora ai la aqui onde parou favor projeto '
              'ultimo tudo coisa entao ok bora vamos quando como porque qual quais sempre todo toda todos todas '
              'cada so tambem ja'.split())


def palavras_de(termos):
    # Separa por letras e números: "falta?" -> "falta", "reels," -> "reels". Aceita "ia" e "v2".
    return [w for w in re.findall(r'[a-z0-9]+', norm(termos)) if len(w) > 1 and w not in VAZIAS]


def casa(w, texto):
    # Começo de palavra: 'ia' não casa 'mídia', mas 'reel' casa 'reels'. Plural simples sai do termo
    # ('vinhetas' -> 'vinheta') para achar o singular também. Palavra de 5+ letras casa também dentro de
    # nome colado ('sense' em 'colorsense'), onde o risco de falso acerto é pequeno.
    w = w[:-1] if len(w) > 3 and w.endswith('s') else w
    if len(w) >= 5:
        return texto.count(w)
    return len(re.findall(r'\b' + re.escape(w), texto))


def melhor(termos):
    """(pasta, painel, pontos, cobertura): cobertura = fração das palavras do pedido que aparecem no projeto.
    Empate: fica o mais recente (a lista já vem do mais novo para o mais velho)."""
    palavras = palavras_de(termos)
    if not palavras:
        return None
    achado = None
    for pasta, d in projetos():
        texto = norm(' '.join([os.path.basename(pasta), campo(d, 'titulo'), campo(d, 'pedido'), linha_auto(pasta)]))
        contagem = [casa(w, texto) for w in palavras]
        pontos, cobertura = sum(contagem), sum(1 for c in contagem if c) / len(palavras)
        # Primeiro a cobertura (quanto do pedido bate), depois as ocorrências; empate fica o mais recente.
        if pontos and (achado is None or (cobertura, pontos) > (achado[3], achado[2])):
            achado = (pasta, d, pontos, cobertura)
    return achado


def buscar(termos):
    if not palavras_de(termos):
        sys.exit('Termo curto demais para buscar. Use pelo menos uma palavra com 2 letras ou mais.')
    achado = melhor(termos)
    return achado[:2] if achado else None


def main():
    a = sys.argv[1:]
    modo = a[0] if a else 'ultimo'
    todos = projetos()
    if not todos:
        sys.exit(f'Nenhum projeto em {RAIZ}.')
    if modo == 'ultimo':
        return mostrar(*todos[0])
    if modo == 'lista':
        n = int(a[1]) if len(a) > 1 and a[1].isdigit() else 8
        for pasta, d in todos[:n]:
            print(f'{campo(d, "atualizado") or "?"}  {os.path.basename(pasta)}  |  {campo(d, "titulo")}')
        return
    if modo == 'buscar':
        if len(a) < 2:
            sys.exit('Uso: python projetos.py buscar "termos"')
        achado = buscar(' '.join(a[1:]))
        if not achado:
            sys.exit(f'Nenhum projeto casa com: {" ".join(a[1:])}. Veja: python projetos.py lista')
        return mostrar(*achado)
    print(__doc__)


if __name__ == '__main__':
    main()
