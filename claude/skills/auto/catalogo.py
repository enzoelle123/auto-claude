"""Inventory every installed skill, command and agent into catalogo.json (run after installing anything)."""
import json, os, re, glob

HOME = os.path.expanduser('~')
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'catalogo.json')


def front(path):
    try:
        txt = open(path, encoding='utf-8', errors='replace').read()
    except OSError:
        return {}
    m = re.match(r'^---\s*\n(.*?)\n---', txt, re.S)
    if not m:
        return {}
    fm, data, key = m.group(1), {}, None
    for line in fm.splitlines():
        km = re.match(r'^([A-Za-z_-]+):\s*(.*)$', line)
        if km and not line.startswith(' '):
            key, val = km.group(1), km.group(2).strip()
            data[key] = val
        elif key and line.strip():
            data[key] = (data[key] + ' ' + line.strip()).strip()
    for k, v in data.items():
        v = v.strip()
        if v in ('>', '|', '>-', '|-'):
            v = ''
        v = re.sub(r'^[>|]-?\s+', '', v)
        if len(v) > 1 and v[0] == v[-1] and v[0] in '"\'':
            v = v[1:-1]
        data[k] = v.replace("''", "'")
    return data


items = []


def add(plugin, kind, name, desc):
    desc = re.sub(r'\s+', ' ', desc or '').strip()
    if len(desc) > 260:
        desc = desc[:257].rstrip() + '...'
    items.append({'p': plugin, 't': kind, 'n': name, 'd': desc})


# standalone skills
for sk in sorted(glob.glob(os.path.join(HOME, '.claude', 'skills', '*', 'SKILL.md'))):
    fm = front(sk)
    add('', 'skill', fm.get('name') or os.path.basename(os.path.dirname(sk)), fm.get('description', ''))

# standalone agents (agency-agents and others in ~/.claude/agents)
for ag in sorted(glob.glob(os.path.join(HOME, '.claude', 'agents', '*.md'))):
    fm = front(ag)
    add('', 'agente', fm.get('name') or os.path.splitext(os.path.basename(ag))[0], fm.get('description', ''))

# reserva de funcionários (fora do contexto para economizar tokens; contratar via economia.py agentes --chamar)
for ag in sorted(glob.glob(os.path.join(HOME, '.claude', 'agents-reserva', '*.md'))):
    fm = front(ag)
    add('reserva', 'agente', fm.get('name') or os.path.splitext(os.path.basename(ag))[0], fm.get('description', ''))

# installed plugins
reg = os.path.join(HOME, '.claude', 'plugins', 'installed_plugins.json')
installed = json.load(open(reg, encoding='utf-8')).get('plugins', {})
for pid, entries in sorted(installed.items()):
    plugin = pid.split('@')[0]
    root = entries[0].get('installPath') if entries else None
    if not root or not os.path.isdir(root):
        continue
    for sk in sorted(glob.glob(os.path.join(root, '**', 'SKILL.md'), recursive=True)):
        if 'node_modules' in sk or os.sep + '.' in sk.replace(root, ''):
            continue
        fm = front(sk)
        nm = fm.get('name') or os.path.basename(os.path.dirname(sk))
        add(plugin, 'skill', nm, fm.get('description', ''))
    for cm in sorted(glob.glob(os.path.join(root, 'commands', '**', '*.md'), recursive=True)):
        fm = front(cm)
        add(plugin, 'comando', os.path.splitext(os.path.basename(cm))[0], fm.get('description', ''))
    for ag in sorted(glob.glob(os.path.join(root, 'agents', '**', '*.md'), recursive=True)):
        fm = front(ag)
        add(plugin, 'agente', fm.get('name') or os.path.splitext(os.path.basename(ag))[0], fm.get('description', ''))

# CLIs, apps e referências do kit em ~/claude-repos: vêm da seção "## KIT" do rotas.md
# (tabela | Ferramenta | Tipo | O que faz | Quando usar | Como chamar |); as skills do kit já entraram acima.
ROTAS = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'references', 'rotas.md')
try:
    kit = open(ROTAS, encoding='utf-8').read().split('\n## KIT', 1)[1].split('\n## ', 1)[0]
except (OSError, IndexError):
    kit = ''
for linha in kit.splitlines():
    cols = [c.strip() for c in linha.strip().strip('|').split('|')]
    if len(cols) != 5 or cols[1] not in ('cli', 'app', 'referência'):
        continue
    nome, tipo, faz, quando, cmd = cols
    add('kit', tipo, nome.strip('`*'), f'{faz} Quando usar: {quando}')
    items[-1]['c'] = cmd.replace('`', '')

# de-duplicate (same plugin+kind+name)
seen, uniq = set(), []
for it in items:
    k = (it['p'], it['t'], it['n'])
    if k not in seen:
        seen.add(k)
        uniq.append(it)
json.dump(uniq, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False)
from collections import Counter
print(len(uniq), Counter(i['t'] for i in uniq))
print(Counter(i['p'] or '(avulsa)' for i in uniq).most_common(12))
