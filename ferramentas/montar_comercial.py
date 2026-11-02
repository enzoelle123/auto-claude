"""montar.py: gera a versão comercial a partir do /auto instalado neste PC.

Copia o código do /auto (~/.claude/skills/auto) para:
  - auto-empresa/skill/auto          (Claude Code)
  - auto-empresa-codex/skills/auto   (Codex; só os scripts comuns, o SKILL.md de lá é próprio)
trocando caminhos e dados pessoais por genéricos. Para no fim se sobrar algo pessoal.

Uso (no PC do autor): python ferramentas/montar_comercial.py
Depois: python ferramentas/publicar_comercial.py (verifica, gera THIRD_PARTY e o .zip)
"""
import re
import shutil
import sys
from pathlib import Path

AQUI = Path.home() / "Projetos" / "auto-empresa"
CODEX = Path.home() / "Projetos" / "auto-empresa-codex"
ORIGEM = Path.home() / ".claude" / "skills" / "auto"
PREDIO_SITE = Path.home() / "Projetos" / "auto-claude" / "predio"
TAREFA = Path.home() / ".claude" / "scheduled-tasks" / "predio-pedidos" / "SKILL.md"

# Gerados no PC de cada cliente: não vão no pacote.
# LEIA-ME: diário do autor; .agents e skills-lock.json: skills de terceiros que o site usou no desenvolvimento.
FORA = {"catalogo.json", "__pycache__", "central_canais.py", "LEIA-ME.md", ".agents", ".claude", "skills-lock.json"}
# Scripts que o Codex usa do mesmo jeito.
COMUNS = ["auto.py", "painel.py", "projetos.py", "local.py", "predio"]

PESSOAL = re.compile(r"enzo|kali|99freelas|beny|travaoscroll|arlequim|pucpr|novela|"
                     r"predio-auto\.vercel|enzoelle|tail95cf23|desktop-0lndd24|kali-acab|"
                     r"central dos canais|canais-dark|tailscale|rtx 3060|predio-3d-auto-v", re.I)
# Componentes sem licença ou com restrição (config/componentes-fora.txt): as rotas não podem dizê-los prontos.
RESTRITOS = re.compile(r"easyedits|easy-edits|/remotion-|remotion-skills|voicestudio|opencut|buttercut|"
                       r"apify/agent-skills|apify__agent-skills|vercel-labs/agent-skills|karpathy-skills", re.I)

TROCAS = [
    # Caminhos fixos da pasta do autor -> pasta de quem instalou.
    (r'Path\(r(["\'])C:\\Users\\Enzo alle\\(.+?)\1\)', r'(Path.home() / r"\2")'),
    (r"C:\\Users\\Enzo alle\\", r"~\\"),
    (r"C:\\Users\\Enzo alle\b", "~"),
    (r"C:/Users/Enzo alle/", "~/"),
    (r"/c/Users/Enzo alle/", "~/"),
    # Site do prédio do autor -> o do cliente (opcional).
    (r"(?:https://)?predio-auto\.vercel\.app/?", "<site do prédio>"),
    (r"\(<site do prédio>, v2 de 27/10/2026\)", "(o site do prédio, opcional: ver predio/site no pacote)"),
    (r"\(por grupo, ex\. `kali`\)", "(por grupo)"),
    (r"\(ex\.: o chat do repositório do Kali\)", "(ex.: o chat de outro repositório)"),
    (r" \(Kali: só PR; quem publica é o dono\)", ""),
    (r"cliente \(Enzo\)", "cliente"),
    # Decisões datadas do autor viram regras do produto.
    (r"\*\*Sempre junto ao GPT\*\* \(decisão do cliente em 27/10/2026\)",
     "**Junto ao GPT quando o Codex estiver logado** (`python gpt.py status`; sem ele, o Claude faz tudo sozinho)"),
    (r"\*\*Apps de criação locais primeiro\*\* \(decisão do cliente em 17/10/2026: grátis e completos\)",
     "**Apps de criação locais primeiro, quando instalados** (`instalar.py --completo`; grátis e completos)"),
    (r" ?\(decisão do cliente(?: em|,) \d\d/\d\d/\d{4}\)", ""),
    # Centrais de projetos do autor (Central dos Canais pela Tailscale) não fazem parte do produto.
    (r" Projeto com central própria:[^\n]*?libere o host na central\.", ""),
    (r"Central dos Canais", "Painel externo"),
    (r"primeira `fontes/central_canais\.py`, ativa quando existir `<projeto>/central/estado\.json`",
     "por exemplo `fontes/central.py` (o nome vira a chave: o painel do tema lê `externo.central`), "
     "com uma função `coletar(pasta)` que devolve um dicionário"),
    (r"'central' if nome == 'central_canais' else nome", "nome"),
    (r"central_canais", "minha_fonte"),
    (r"funciona com a Tailscale ligada no celular", "abre a central do projeto (precisa estar acessível pelo celular)"),
    (r" na RTX 3060 \(6 GB\)", " (testado numa GPU NVIDIA de 6 GB)"),
    (r"RTX 3060", "GPU NVIDIA de 6 GB"),
    # CapCut é opcional no produto (conectores não vêm instalados).
    (r"montagem final sempre no conector `capcut`", "montagem final no conector `capcut` quando ele estiver conectado (opcional)"),
    (r"continua no conector `capcut`", "continua no conector `capcut`, se conectado"),
    (r"## Estado das ferramentas \(pré-requisitos\)\n",
     "## Estado das ferramentas (pré-requisitos)\n\n> \"pronto\" = testado com o kit completo. No seu PC, `python buscar.py \"<nome>\"` "
     "diz o que está instalado; conectores do CapCut e apps de voz/vídeo são opcionais (`instalar.py --completo` e configuração à parte).\n"),
]
LINHAS_FORA = re.compile(r"kali|travaoscroll|canais-dark|predio-3d-auto-v", re.I)  # linhas de projetos do autor
# Rotas que usam ferramentas de projetos do autor (Central dos Canais), fora do pacote.
SECOES_FORA = ("### V13.", "### P10.")


def limpar(texto: str, nome: str) -> str:
    for de, para in TROCAS:
        texto = re.sub(de, para, texto)
    if nome.endswith(".md"):
        saida, pulando = [], False
        for l in texto.split("\n"):
            if l.startswith("#"):
                pulando = l.startswith(SECOES_FORA)
            if pulando or LINHAS_FORA.search(l):
                continue
            if nome == "rotas.md" and RESTRITOS.search(l):
                continue
            saida.append(l)
        texto = "\n".join(saida)
    return texto


def copiar(origem: Path, destino: Path, so=None) -> list:
    if destino.exists():
        shutil.rmtree(destino)
    sobras = []
    for arq in sorted(origem.rglob("*")):
        rel = arq.relative_to(origem)
        if not arq.is_file() or FORA & set(rel.parts) or arq.suffix == ".pyc":
            continue
        if so and rel.parts[0] not in so:
            continue
        alvo = destino / rel
        alvo.parent.mkdir(parents=True, exist_ok=True)
        try:
            texto = limpar(arq.read_text(encoding="utf-8"), arq.name)
        except UnicodeDecodeError:
            shutil.copy2(arq, alvo)
            continue
        alvo.write_text(texto, encoding="utf-8", newline="")
        for n, linha in enumerate(texto.split("\n"), 1):
            if PESSOAL.search(linha):
                sobras.append(f"{alvo.relative_to(destino.parent.parent)}:{n}: {linha.strip()[:100]}")
    return sobras


def main() -> int:
    # central_canais.py (fonte de um projeto do autor) fica fora; o carregador de fontes vai.
    sobras = copiar(ORIGEM, AQUI / "skill" / "auto")
    sobras += copiar(PREDIO_SITE / "site", AQUI / "predio" / "site")
    # Das specs, só o contrato dos temas; as outras contam o projeto do autor.
    docs = AQUI / "predio" / "docs"
    shutil.rmtree(docs, ignore_errors=True)
    docs.mkdir(parents=True)
    (docs / "spec-temas.md").write_text(
        limpar((PREDIO_SITE / "docs" / "spec-temas.md").read_text(encoding="utf-8"), "spec-temas.md"), encoding="utf-8")
    if TAREFA.exists():
        (AQUI / "tarefas").mkdir(exist_ok=True)
        texto = limpar(TAREFA.read_text(encoding="utf-8"), "SKILL.md")
        (AQUI / "tarefas" / "predio-pedidos.md").write_text(texto, encoding="utf-8")
    for pasta in (docs, AQUI / "tarefas"):
        for arq in pasta.glob("*.md"):
            for n, linha in enumerate(arq.read_text(encoding="utf-8").split("\n"), 1):
                if PESSOAL.search(linha):
                    sobras.append(f"{arq.relative_to(AQUI)}:{n}: {linha.strip()[:100]}")
    if CODEX.exists():
        scripts = CODEX / "skills" / "auto" / "scripts"
        sobras += copiar(ORIGEM, scripts, so=set(COMUNS))
        ref = CODEX / "skills" / "auto" / "references"
        ref.mkdir(parents=True, exist_ok=True)
        corpo = limpar((ORIGEM / "references" / "agencia.md").read_text(encoding="utf-8"), "agencia.md")
        corpo = corpo[corpo.index("## Quem chamar"):]  # o cabeçalho original explica o jeito do Claude
        cabecalho = ("# Especialistas do /auto (agency-agents)\n\n"
                     "282 perfis (fonte: github.com/msitarzewski/agency-agents, MIT), instalados em `~/.agents/auto-agencia`.\n"
                     "Contrate com `python extras/equipe.py contratar \"<Nome>\" \"<briefing>\" --cd <pasta>` "
                     "(nome exato da coluna Nome); procure com `equipe.py buscar \"<tema>\"`.\n"
                     "Registre: `painel.py usa \"<pasta>\" <setor> especialista \"<Nome>\" \"<tarefa>\"`.\n\n")
        (ref / "agencia.md").write_text(cabecalho + corpo, encoding="utf-8")
        # Os reparos do Claude (claude-mem, MCP rea, ponte do GPT) não existem no Codex.
        (scripts / "reparos.py").write_text(
            '"""Reparos: no Codex não há nada a consertar no início do /auto."""\n\n\n'
            "def verificar(consertar=True):\n    return []\n", encoding="utf-8")
    for s in sobras:
        print("pessoal:", s)
    print(f"montar: {len(sobras)} sobra(s) pessoal(is)")
    return 1 if sobras else 0


if __name__ == "__main__":
    sys.exit(main())
