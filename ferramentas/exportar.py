"""exportar.py: tira uma foto do /auto deste PC para dentro do repositório.

Copia skills, funcionários, tarefa do prédio, ganchos, configurações (sem segredos)
e a lista do kit. Caminhos da pasta do usuário viram marcadores ({{HOME}} etc.),
que o instalar.py troca pela pasta do PC novo.

Uso: python ferramentas/exportar.py
"""
import json
import os
import re
import shutil
import subprocess
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
HOME = Path.home()
CLAUDE = HOME / ".claude"
MAX_ARQUIVO = 5_000_000  # arquivos maiores voltam pelo kit (ex.: exemplos do officecli)
PULAR_PASTAS = {"node_modules", ".git", "__pycache__", ".venv", "venv", ".pytest_cache"}
SEGREDO = re.compile(r"(key|token|secret|senha|password|client[-_]?id|auth)", re.I)


def marcadores(texto: str) -> str:
    h = str(HOME)  # C:\Users\Fulano
    fwd = h.replace("\\", "/")
    posix = "/" + fwd[0].lower() + fwd[2:] if re.match(r"^[A-Za-z]:", fwd) else fwd
    trocas = [
        (h.replace("\\", "\\\\"), "{{HOME_WIN2}}"),
        (h, "{{HOME_WIN}}"),
        (fwd, "{{HOME}}"),
        (posix, "{{HOME_POSIX}}"),
    ]
    for antigo, novo in trocas:
        texto = re.sub(re.escape(antigo), lambda _m: novo, texto, flags=re.I)
    # Endereço privado da Tailscale é dado pessoal.
    return re.sub(r"[a-z0-9-]+\.tail[0-9a-f]+\.ts\.net", "<seu-pc>.<sua-tailnet>.ts.net", texto)


def copiar_arquivo(origem: Path, destino: Path) -> None:
    destino.parent.mkdir(parents=True, exist_ok=True)
    dados = origem.read_bytes()
    try:
        texto = dados.decode("utf-8")
    except UnicodeDecodeError:
        destino.write_bytes(dados)
        return
    destino.write_text(marcadores(texto), encoding="utf-8", newline="")


def copiar_pasta(origem: Path, destino: Path, pulados: list) -> int:
    if destino.exists():
        shutil.rmtree(destino)
    n = 0
    # followlinks: as skills muapi são atalhos para ~/.agents/skills
    for raiz, pastas, arquivos in os.walk(origem, followlinks=True):
        pastas[:] = [p for p in pastas if p not in PULAR_PASTAS]
        for nome in arquivos:
            arq = Path(raiz) / nome
            if nome.endswith((".pyc", ".log")) or nome.startswith(".env"):
                continue
            try:
                tam = arq.stat().st_size
            except OSError:
                continue
            rel = arq.relative_to(origem)
            if tam > MAX_ARQUIVO:
                pulados.append(f"{origem.name}/{rel.as_posix()} ({tam // 1_000_000} MB)")
                continue
            copiar_arquivo(arq, destino / rel)
            n += 1
    return n


def mascarar(obj, chave=""):
    """Troca valores sensíveis por marcadores {{NOME}} que o instalador pede ou deixa vazio."""
    if isinstance(obj, dict):
        return {k: mascarar(v, k) for k, v in obj.items()}
    if isinstance(obj, list):
        return [mascarar(v, chave) for v in obj]
    if isinstance(obj, str) and SEGREDO.search(chave) and not obj.isdigit():
        return "{{" + re.sub(r"\W", "_", chave.upper()) + "}}"
    return obj


def exportar_settings() -> None:
    s = json.loads((CLAUDE / "settings.json").read_text(encoding="utf-8-sig"))
    s = mascarar(s)
    texto = marcadores(json.dumps(s, ensure_ascii=False, indent=2))
    (REPO / "claude" / "settings.template.json").write_text(texto + "\n", encoding="utf-8")


def exportar_mcp() -> None:
    d = json.loads((HOME / ".claude.json").read_text(encoding="utf-8-sig"))
    servidores = {}
    for nome, cfg in d.get("mcpServers", {}).items():
        cfg = dict(cfg)
        env = dict(cfg.get("env") or {})
        env.pop("PATH", None)  # PATH é de cada máquina
        if env or "env" in cfg:
            cfg["env"] = env
        servidores[nome] = mascarar(cfg)
    texto = marcadores(json.dumps(servidores, ensure_ascii=False, indent=2))
    (REPO / "claude" / "mcp-servers.template.json").write_text(texto + "\n", encoding="utf-8")


def exportar_codex() -> None:
    cfg = HOME / ".codex" / "config.toml"
    if not cfg.exists():
        return
    linhas = cfg.read_text(encoding="utf-8").splitlines()
    # Só o topo (perfil padrão, sandbox do Windows) e os perfis auto-leitura/auto-escrita.
    saida, dentro = [], True
    for linha in linhas:
        if linha.startswith("["):
            dentro = linha.startswith(("[windows]", "[permissions."))
        if dentro and not linha.startswith("notify"):
            saida.append(linha)
    destino = REPO / "codex" / "config.template.toml"
    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_text(marcadores("\n".join(saida)) + "\n", encoding="utf-8")


def exportar_kit() -> None:
    base = HOME / "claude-repos"
    linhas = ["# pasta (dentro de ~/claude-repos) | endereço | commit"]
    for pasta in sorted(base.glob("*/*/.git")) + sorted(base.glob("*/.git")):
        repo = pasta.parent
        def git(*a):
            return subprocess.run(["git", "-C", str(repo), *a], capture_output=True, text=True).stdout.strip()
        url = git("remote", "get-url", "origin")
        if url:
            linhas.append(f"{repo.relative_to(base).as_posix()}|{url}|{git('rev-parse', 'HEAD')}")
    (REPO / "kit").mkdir(exist_ok=True)
    (REPO / "kit" / "repos.txt").write_text("\n".join(linhas) + "\n", encoding="utf-8")
    for nome in ("install_all.sh", "INSTALL_REPORT.md"):
        if (base / nome).exists():
            copiar_arquivo(base / nome, REPO / "kit" / nome)


def exportar_predio() -> None:
    v2 = HOME / "auto-projetos" / "2026-10-27-predio-3d-auto-v2"
    pulados: list = []
    if (v2 / "site").exists():
        copiar_pasta(v2 / "site", REPO / "predio" / "site", pulados)
        for lixo in ("public/data", ".vercel"):
            shutil.rmtree(REPO / "predio" / "site" / lixo, ignore_errors=True)
    for nome in ("spec.md", "spec-temas.md", "spec-andar-v2.md", "LEIA-ME.md"):
        if (v2 / nome).exists():
            copiar_arquivo(v2 / nome, REPO / "predio" / "docs" / nome)
    ponte = HOME / ".config" / "predio-ponte.json"
    if ponte.exists():
        cfg = json.loads(ponte.read_text(encoding="utf-8-sig"))
        exemplo = {"url": cfg.get("url", ""), "token": "{{PREDIO_TOKEN}}"}
        (REPO / "config").mkdir(exist_ok=True)
        (REPO / "config" / "predio-ponte.example.json").write_text(
            json.dumps(exemplo, indent=2) + "\n", encoding="utf-8")


def exportar_memoria() -> None:
    destino = REPO / "claude" / "memoria"
    if destino.exists():
        shutil.rmtree(destino)
    for pasta in (CLAUDE / "projects").glob("*/memory"):
        for arq in pasta.glob("auto-*.md"):
            copiar_arquivo(arq, destino / arq.name)


def main() -> None:
    pulados: list = []
    dest = REPO / "claude"
    contagem = {}
    for nome in ("skills", "agents", "agents-reserva", "security-guidance"):
        if (CLAUDE / nome).exists():
            contagem[nome] = copiar_pasta(CLAUDE / nome, dest / nome, pulados)
    tarefa = CLAUDE / "scheduled-tasks" / "predio-pedidos"
    if tarefa.exists():
        contagem["tarefa"] = copiar_pasta(tarefa, dest / "scheduled-tasks" / "predio-pedidos", pulados)
    if (CLAUDE / "CLAUDE.md").exists():
        copiar_arquivo(CLAUDE / "CLAUDE.md", dest / "CLAUDE.global.md")
    exportar_settings()
    exportar_mcp()
    exportar_codex()
    exportar_kit()
    exportar_predio()
    exportar_memoria()
    (dest / "PULADOS.txt").write_text(
        "Arquivos grandes demais para o git (voltam pelo kit):\n" + "\n".join(pulados) + "\n",
        encoding="utf-8")
    print("exportado:", contagem, "| pulados:", len(pulados))


if __name__ == "__main__":
    main()
