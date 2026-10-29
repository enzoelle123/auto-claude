"""Painel ao vivo do /auto.

Mantém <pasta>/painel.json e gera <pasta>/painel.html (publicado como Artifact pelo Claude).

Comandos:
  init  <pasta> "<titulo>" "<pedido>"            cria o projeto e o painel
  fase  <pasta> <setor> <pendente|ativo|feito|pulado>
  usa   <pasta> <setor> <tipo> "<nome>" "<motivo>"   registra ferramenta (tipo: skill|comando|plugin|agente|mcp|terminal|web|instalacao|chat)
  nota  <pasta> <reunioes|pesquisa|qualidade|decisoes> "<texto>"
  conc  <pasta> "<nome>" "<url>" "<fortes>" "<fracos>" "<como superar>"
  proto <pasta> "<titulo>" "<link ou caminho>" ["<descricao>"]
  log   <pasta> "<texto>"
  build <pasta>                                   gera painel.html
Setores: diretoria, pesquisa, criacao, producao, qualidade, ferramentas, documentacao
"""
import json, os, sys, html, datetime

sys.stdout.reconfigure(encoding='utf-8', errors='replace')  # terminal do Windows (cp1252) quebra acentos

SETORES = [
    ('diretoria', 'Diretoria'), ('pesquisa', 'Pesquisa de mercado'), ('criacao', 'Criação'),
    ('producao', 'Produção'), ('qualidade', 'Qualidade'), ('ferramentas', 'Ferramentas'),
    ('documentacao', 'Documentação'),
]
NOMES = dict(SETORES)


def agora():
    return datetime.datetime.now().strftime('%Y-%m-%dT%H:%M')


def carregar(pasta):
    with open(os.path.join(pasta, 'painel.json'), encoding='utf-8') as f:
        return json.load(f)


def salvar(pasta, d):
    with open(os.path.join(pasta, 'painel.json'), 'w', encoding='utf-8') as f:
        json.dump(d, f, ensure_ascii=False, indent=1)


def e(s):
    return html.escape(str(s or ''))


def link(s):
    s = str(s or '')
    if s.startswith('http'):
        return f'<a href="{e(s)}">{e(s)}</a>'
    return f'<code>{e(s)}</code>'


CSS = """
:root{--bg:#F3F6F7;--panel:#FFF;--ink:#12202A;--muted:#566874;--line:#D5DEE3;--clip:#0B7F70;--clip-soft:#DDF1EE;--play:#C98A00;--play-soft:#FBF0D3;--ok:#1E7A3C;--ok-soft:#E1F3E6;--off:#6B7780;--off-soft:#E9EEF1;--code:#EAF0F2;
--fd:"Bricolage Grotesque","Segoe UI",system-ui,sans-serif;--fb:"IBM Plex Sans","Segoe UI",system-ui,sans-serif;--fm:"IBM Plex Mono",ui-monospace,Consolas,monospace}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#0F171C;--panel:#162229;--ink:#E4ECEF;--muted:#94A7B2;--line:#27363F;--clip:#3CC3AE;--clip-soft:#123A36;--play:#F0B83A;--play-soft:#3A2E10;--ok:#5BD08A;--ok-soft:#143322;--off:#9AA8B1;--off-soft:#212E36;--code:#1C2B33;color-scheme:dark}}
:root[data-theme="dark"]{--bg:#0F171C;--panel:#162229;--ink:#E4ECEF;--muted:#94A7B2;--line:#27363F;--clip:#3CC3AE;--clip-soft:#123A36;--play:#F0B83A;--play-soft:#3A2E10;--ok:#5BD08A;--ok-soft:#143322;--off:#9AA8B1;--off-soft:#212E36;--code:#1C2B33;color-scheme:dark}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.55 var(--fb)}
.w{max-width:1100px;margin:0 auto;padding-inline:18px;padding-block:24px 60px;display:flex;flex-direction:column;gap:28px}
h1{font:800 clamp(1.7rem,4vw,2.5rem)/1.1 var(--fd);margin:0;text-wrap:balance}h2{font:800 1.3rem/1.2 var(--fd);margin:0}
.ey{font:500 12px var(--fm);letter-spacing:.12em;text-transform:uppercase;color:var(--clip)}p{margin:0;max-width:75ch}.mut{color:var(--muted)}
code{font:.88em var(--fm);background:var(--code);padding:1px 5px;border-radius:4px;overflow-wrap:anywhere}a{color:var(--clip);overflow-wrap:anywhere}
.track{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px}@media(max-width:760px){.track{grid-template-columns:repeat(2,minmax(0,1fr))}}
.st{padding:10px;border-top:4px solid var(--line);background:var(--off-soft);border-radius:0 0 6px 6px;display:flex;flex-direction:column;gap:2px;min-width:0}
.st b{font:600 .92rem var(--fd)}.st span{font:11px var(--fm);color:var(--muted)}
.st.ativo{border-top-color:var(--play);background:var(--play-soft)}.st.feito{border-top-color:var(--clip);background:var(--clip-soft)}
section{display:flex;flex-direction:column;gap:10px}.box{overflow-x:auto;border:1px solid var(--line);border-radius:8px;background:var(--panel)}
table{border-collapse:collapse;width:100%;font-size:13.5px;min-width:620px}th,td{text-align:left;padding:8px 10px;border-bottom:1px solid var(--line);vertical-align:top}
th{font:500 11px var(--fm);letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}tr:last-child td{border-bottom:0}
.chip{display:inline-block;font:500 11px var(--fm);padding:2px 8px;border-radius:99px;background:var(--off-soft);color:var(--off);white-space:nowrap}
ul{margin:0;padding-left:20px;display:flex;flex-direction:column;gap:5px}
.stats{display:flex;flex-wrap:wrap;gap:18px;font:13px var(--fm);color:var(--muted)}.stats b{font:800 1.4rem var(--fd);color:var(--ink);display:block}
.protos{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:10px}.protos div{background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:10px 12px;display:flex;flex-direction:column;gap:4px;min-width:0}
"""


def build(pasta):
    d = carregar(pasta)
    st = {s['nome']: s['status'] for s in d['setores']}
    track = ''.join(
        f'<div class="st {e(st.get(k, "pendente"))}"><b>{e(n)}</b><span>{e(st.get(k, "pendente"))}</span></div>'
        for k, n in SETORES)
    ferr = d['ferramentas']
    tipos = {}
    for f in ferr:
        tipos[f['tipo']] = tipos.get(f['tipo'], 0) + 1
    stats = ''.join(f'<div><b>{v}</b>{e(k)}</div>' for k, v in sorted(tipos.items(), key=lambda x: -x[1]))
    rows = ''.join(
        f'<tr><td>{e(f["hora"][11:])}</td><td>{e(NOMES.get(f["setor"], f["setor"]))}</td><td><span class="chip">{e(f["tipo"])}</span></td><td><code>{e(f["nome"])}</code></td><td>{e(f["motivo"])}</td></tr>'
        for f in reversed(ferr)) or '<tr><td colspan="5" class="mut">Nenhuma ferramenta usada ainda.</td></tr>'

    def lista(k, vazio):
        itens = d.get(k, [])
        if not itens:
            return f'<p class="mut">{vazio}</p>'
        return '<ul>' + ''.join(f'<li><span class="mut">{e(i["hora"][11:])}</span> {e(i["texto"])}</li>' for i in itens) + '</ul>'

    conc = ''.join(
        f'<tr><td><b>{e(c["nome"])}</b><br>{link(c["url"])}</td><td>{e(c["fortes"])}</td><td>{e(c["fracos"])}</td><td>{e(c["superar"])}</td></tr>'
        for c in d['concorrentes']) or '<tr><td colspan="4" class="mut">Pesquisa ainda não começou.</td></tr>'
    protos = ''.join(
        f'<div><b>{e(p["titulo"])}</b>{link(p["link"])}<span class="mut">{e(p.get("descricao", ""))}</span></div>'
        for p in d['prototipos']) or '<p class="mut">Nenhum protótipo ainda.</p>'
    log = ''.join(f'<li><span class="mut">{e(l["hora"][11:])}</span> {e(l["texto"])}</li>' for l in reversed(d['log'][-40:]))
    ativo = next((NOMES[s['nome']] for s in d['setores'] if s['status'] == 'ativo'), 'aguardando')
    page = f"""<title>Painel {e(d['titulo'])}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,800&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>{CSS}</style>
<div class="w">
<header style="display:flex;flex-direction:column;gap:8px"><span class="ey">/auto · empresa virtual · atualizado {e(d['atualizado'][11:])}</span><h1>{e(d['titulo'])}</h1>
<p class="mut">Pedido: {e(d['pedido'])}</p><p>Setor ativo agora: <b>{e(ativo)}</b></p></header>
<section><h2>Linha de produção</h2><div class="track">{track}</div></section>
<section><h2>Ferramentas usadas ({len(ferr)})</h2><div class="stats">{stats}</div>
<div class="box"><table><thead><tr><th>Hora</th><th>Setor</th><th>Tipo</th><th>Ferramenta</th><th>Por quê</th></tr></thead><tbody>{rows}</tbody></table></div></section>
<section><h2>Reuniões e decisões</h2>{lista('reunioes', 'Nenhuma reunião ainda.')}{lista('decisoes', '')}</section>
<section><h2>Pesquisa de mercado</h2>{lista('pesquisa', 'Sem achados ainda.')}
<div class="box"><table><thead><tr><th>Concorrente</th><th>Pontos fortes</th><th>Pontos fracos</th><th>Como superar</th></tr></thead><tbody>{conc}</tbody></table></div></section>
<section><h2>Protótipos</h2><div class="protos">{protos}</div></section>
<section><h2>Qualidade e testes</h2>{lista('qualidade', 'Nada testado ainda.')}</section>
<section><h2>Diário</h2><ul>{log}</ul></section>
</div>"""
    with open(os.path.join(pasta, 'painel.html'), 'w', encoding='utf-8') as f:
        f.write(page)
    print(os.path.join(pasta, 'painel.html'))


def main():
    a = sys.argv[1:]
    if len(a) < 2:
        print(__doc__)
        return
    cmd, pasta = a[0], a[1]
    if cmd == 'init':
        # Retomar projeto em andamento (/auto continuar) não pode zerar diário, decisões e setores.
        if os.path.exists(os.path.join(pasta, 'painel.json')):
            print(f'painel.json já existe em {pasta}: nada foi zerado. Para retomar, use fase/usa/nota e build.')
            return
        os.makedirs(pasta, exist_ok=True)
        for sub in ('pesquisa', 'prototipos', 'entregas'):
            os.makedirs(os.path.join(pasta, sub), exist_ok=True)
        d = {'titulo': a[2], 'pedido': a[3], 'criado': agora(), 'atualizado': agora(),
             'setores': [{'nome': k, 'status': 'pendente'} for k, _ in SETORES],
             'ferramentas': [], 'reunioes': [], 'decisoes': [], 'pesquisa': [], 'qualidade': [],
             'concorrentes': [], 'prototipos': [], 'log': [{'hora': agora(), 'texto': 'Projeto criado.'}]}
        salvar(pasta, d)
        build(pasta)
        return
    d = carregar(pasta)
    h = agora()
    if cmd == 'fase':
        for s in d['setores']:
            if s['nome'] == a[2]:
                s['status'] = a[3]
        d['log'].append({'hora': h, 'texto': f'{NOMES.get(a[2], a[2])}: {a[3]}'})
    elif cmd == 'usa':
        d['ferramentas'].append({'hora': h, 'setor': a[2], 'tipo': a[3], 'nome': a[4], 'motivo': a[5] if len(a) > 5 else ''})
    elif cmd == 'nota':
        d.setdefault(a[2], []).append({'hora': h, 'texto': a[3]})
    elif cmd == 'conc':
        d['concorrentes'].append({'nome': a[2], 'url': a[3], 'fortes': a[4], 'fracos': a[5], 'superar': a[6]})
    elif cmd == 'proto':
        d['prototipos'].append({'titulo': a[2], 'link': a[3], 'descricao': a[4] if len(a) > 4 else ''})
    elif cmd == 'log':
        d['log'].append({'hora': h, 'texto': a[2]})
    elif cmd != 'build':
        print('Comando desconhecido:', cmd)
        return
    d['atualizado'] = h
    salvar(pasta, d)
    build(pasta)
    if cmd == 'fase':
        ao_vivo(pasta, a[2], 'fase', a[3], NOMES.get(a[2], a[2]))
    elif cmd == 'usa':
        ao_vivo(pasta, a[2], a[3], a[4], a[5] if len(a) > 5 else '')


def ao_vivo(pasta, setor, tipo, nome, motivo):
    """Manda a ação ao prédio da Vercel sem esperar: rede lenta ou ponte desligada não atrasam o /auto."""
    ponte = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'predio', 'ponte.py')
    if not os.path.exists(ponte):
        return
    import subprocess
    flags = getattr(subprocess, 'CREATE_NO_WINDOW', 0)
    subprocess.Popen([sys.executable, ponte, 'evento', os.path.basename(os.path.normpath(pasta)), setor, tipo, nome, motivo],
                     stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, creationflags=flags)


if __name__ == '__main__':
    main()
