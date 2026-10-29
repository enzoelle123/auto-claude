"""Busca no catálogo de skills/comandos/agentes instalados.

Uso: python buscar.py "palavras-chave" [--top N] [--tipo skill|comando|agente|cli|app|referência]
Aceita português: traduz termos comuns para o inglês das descrições.
"""
import json, os, re, sys, unicodedata

# Terminal do Windows usa cp1252: sem isto, descrições com acento/japonês quebram o print.
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

HERE = os.path.dirname(os.path.abspath(__file__))

PT_EN = {
    'video': ['video'], 'videos': ['video'], 'edicao': ['edit', 'editing'], 'editar': ['edit'],
    'legenda': ['caption', 'subtitle'], 'legendas': ['caption', 'subtitle'], 'corte': ['cut', 'clip'],
    'cortes': ['cut', 'clip'], 'miniatura': ['thumbnail'], 'thumbnail': ['thumbnail'], 'capa': ['thumbnail', 'cover'],
    'animacao': ['animation', 'motion'], 'vinheta': ['intro', 'title', 'motion'], 'musica': ['music', 'audio'],
    'audio': ['audio'], 'voz': ['voice', 'tts'], 'narracao': ['voiceover', 'narration', 'tts'],
    'imagem': ['image'], 'imagens': ['image'], 'foto': ['photo', 'image'], 'roteiro': ['script'],
    'anuncio': ['ad', 'ads'], 'post': ['post', 'social'], 'redes': ['social'], 'instagram': ['instagram'],
    'youtube': ['youtube'], 'shorts': ['shorts'], 'reels': ['reels', 'shorts', 'vertical'],
    'teste': ['test'], 'testes': ['test'], 'erro': ['error', 'bug', 'debug'], 'bug': ['bug', 'debug'],
    'revisao': ['review'], 'revisar': ['review'], 'seguranca': ['security'], 'banco': ['database'],
    'site': ['website', 'web', 'landing'], 'pagina': ['page', 'landing'], 'app': ['app'],
    'planejar': ['plan'], 'plano': ['plan'], 'documentacao': ['docs', 'documentation'],
    'desempenho': ['performance'], 'pesquisa': ['research'], 'marketing': ['marketing'],
    'email': ['email'], 'apresentacao': ['slides', 'presentation', 'deck'], 'planilha': ['spreadsheet', 'xlsx'],
    'logo': ['logo'], 'marca': ['brand'], 'tela': ['ui', 'screen'], 'design': ['design'],
    'raspar': ['scrape', 'scraper'], 'coletar': ['scrape', 'extract'], 'navegador': ['browser'],
    'reversa': ['reverse'], 'engenharia': ['engineering'], 'dublagem': ['dubla', 'dubbing', 'translation'],
    'dublar': ['dubla', 'dubbing'], 'traduzir': ['traduz', 'translation'], 'traducao': ['traduz', 'translation'], 'clonar': ['clone', 'cloning'], 'documento': ['document', 'docs', 'word'],
    'agenda': ['calendar'], 'jogo': ['game'], 'desenho': ['vector', 'cad', 'drawing'],
    'tarefa': ['task'], 'tarefas': ['task'], 'redesenhar': ['redesign'], 'generico': ['generic', 'slop'],
}


def norm(s):
    s = unicodedata.normalize('NFKD', s.lower())
    return ''.join(c for c in s if not unicodedata.combining(c))


def main():
    args = sys.argv[1:]
    if not args:
        print(__doc__)
        return
    top, tipo, words = 15, None, []
    i = 0
    while i < len(args):
        if args[i] == '--top' and i + 1 < len(args):
            top = int(args[i + 1]); i += 2; continue
        if args[i] == '--tipo' and i + 1 < len(args):
            tipo = args[i + 1]; i += 2; continue
        words.append(args[i]); i += 1
    terms = []
    for w in re.findall(r'[\w-]+', norm(' '.join(words))):
        if len(w) < 3:
            continue
        terms.append(w)
        terms.extend(PT_EN.get(w, []))
    terms = list(dict.fromkeys(terms))
    data = json.load(open(os.path.join(HERE, 'catalogo.json'), encoding='utf-8'))
    scored = []
    for it in data:
        if tipo and it['t'] != tipo:
            continue
        name = norm(it['p'] + ' ' + it['n'])
        desc = norm(it['d'])
        score = 0
        for t in terms:
            if t in name:
                score += 3
            if re.search(r'\b' + re.escape(t), desc):
                score += 1
        if score and it['p'] == 'kit':
            score += 3  # apps e CLIs locais e grátis do kit vêm antes dos pagos (decisão do cliente, 17/10/2026)
        if score:
            scored.append((score, it))
    scored.sort(key=lambda x: -x[0])
    if not scored:
        print('Nada encontrado para:', ' '.join(words))
        return
    for score, it in scored[:top]:
        if it['p'] == 'reserva':
            inv = f'agente {it["n"]} (reserva: python economia.py agentes --chamar "{it["n"]}")'
        elif it.get('c'):
            inv = f'{it["n"]} → {it["c"]}'
        else:
            inv = ('agente ' if it['t'] == 'agente' else '/') + (it['p'] + ':' if it['p'] else '') + it['n']
        print(f"{inv}  [{it['t']}] ({score})\n    {it['d'][:200]}")


if __name__ == '__main__':
    main()
