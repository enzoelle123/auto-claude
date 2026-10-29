"""instalar.py: instala o /auto completo num PC novo (ou atualiza um PC que já tem).

Faz sozinho:
  1. copia skills, funcionários (agents e reserva), ganchos de segurança e a tarefa do prédio
     para ~/.claude, trocando os marcadores {{HOME}} pela pasta deste usuário;
  2. junta configurações, plugins, marketplaces e servidores MCP ao que já existe (nunca apaga);
  3. adiciona os perfis do GPT (auto-leitura / auto-escrita) ao ~/.codex/config.toml;
  4. clona o kit (skills, CLIs, apps, MCPs de edição) em ~/claude-repos na versão fixada;
  5. instala os plugins com o CLI `claude`, quando ele existe;
  6. regenera o catálogo do /auto e lista o que só o dono pode fazer (logins e senhas).

Antes de mexer, guarda cópia do que vai mudar em ~/.claude/backups/auto-instalar-<data>.

Uso:
  python ferramentas/instalar.py              # tudo, menos os builds pesados dos apps
  python ferramentas/instalar.py --completo   # também roda kit/install_all.sh (vários GB)
  python ferramentas/instalar.py --sem-kit    # só o /auto e as configurações
  python ferramentas/instalar.py --teste <pasta>  # instala numa pasta falsa no lugar de ~
"""
import argparse
import datetime
import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
PENDENCIAS: list = []


def say(msg: str) -> None:
    print(f"==> {msg}", flush=True)


def marcadores(home: Path) -> dict:
    h = str(home)
    fwd = h.replace("\\", "/")
    posix = "/" + fwd[0].lower() + fwd[2:] if re.match(r"^[A-Za-z]:", fwd) else fwd
    return {"{{HOME_WIN2}}": h.replace("\\", "\\\\"), "{{HOME_WIN}}": h,
            "{{HOME}}": fwd, "{{HOME_POSIX}}": posix}


def render(texto: str, trocas: dict) -> str:
    for k, v in trocas.items():
        texto = texto.replace(k, v)
    return texto


def copiar_pasta(origem: Path, destino: Path, trocas: dict, backup: Path) -> int:
    """Copia arquivo a arquivo; o que já existe e vai mudar vai antes para o backup."""
    n = 0
    for arq in origem.rglob("*"):
        if not arq.is_file():
            continue
        alvo = destino / arq.relative_to(origem)
        dados = arq.read_bytes()
        try:
            dados = render(dados.decode("utf-8"), trocas).encode("utf-8")
        except UnicodeDecodeError:
            pass
        if alvo.exists():
            if alvo.read_bytes() == dados:
                continue
            copia = backup / alvo.relative_to(destino.parent)
            copia.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(alvo, copia)
        alvo.parent.mkdir(parents=True, exist_ok=True)
        alvo.write_bytes(dados)
        n += 1
    return n


def ler_json(p: Path) -> dict:
    if not p.exists():
        return {}
    return json.loads(p.read_text(encoding="utf-8-sig") or "{}")


def gravar_json(p: Path, dados: dict, backup: Path) -> None:
    if p.exists() and json.loads(p.read_text(encoding="utf-8-sig") or "{}") == dados:
        return
    if p.exists():
        backup.mkdir(parents=True, exist_ok=True)
        shutil.copy2(p, backup / p.name)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(dados, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def tem_marcador(obj) -> bool:
    return "{{" in json.dumps(obj)


def juntar_settings(home: Path, trocas: dict, backup: Path) -> None:
    modelo = json.loads(render((REPO / "claude" / "settings.template.json").read_text(encoding="utf-8"), trocas))
    alvo = home / ".claude" / "settings.json"
    atual = ler_json(alvo)
    for chave, valor in modelo.items():
        if isinstance(valor, dict) and chave != "hooks":
            base = atual.setdefault(chave, {})
            for k, v in valor.items():
                if k not in base and not tem_marcador(v):
                    base[k] = v
        elif chave not in atual and not tem_marcador(valor):
            atual[chave] = valor
    gravar_json(alvo, atual, backup)
    say(f"settings.json: {len(atual.get('enabledPlugins', {}))} plugins, "
        f"{len(atual.get('extraKnownMarketplaces', {}))} marketplaces")


def juntar_mcp(home: Path, trocas: dict, backup: Path) -> None:
    modelo = json.loads(render((REPO / "claude" / "mcp-servers.template.json").read_text(encoding="utf-8"), trocas))
    alvo = home / ".claude.json"
    atual = ler_json(alvo)
    servidores = atual.setdefault("mcpServers", {})
    novos = []
    for nome, cfg in modelo.items():
        if nome in servidores:
            continue
        # Cabeçalho/variável com segredo: entra sem ele; o dono preenche depois.
        for campo in ("env", "headers"):
            sujos = [k for k, v in (cfg.get(campo) or {}).items() if "{{" in str(v)]
            for k in sujos:
                cfg[campo].pop(k)
                PENDENCIAS.append(f"MCP {nome}: preencher {campo}.{k} em ~/.claude.json")
        servidores[nome] = cfg
        novos.append(nome)
    gravar_json(alvo, atual, backup)
    say(f"MCPs novos: {', '.join(novos) or 'nenhum (já estavam)'}")


def juntar_codex(home: Path, trocas: dict, backup: Path) -> None:
    modelo = REPO / "codex" / "config.template.toml"
    if not modelo.exists():
        return
    alvo = home / ".codex" / "config.toml"
    atual = alvo.read_text(encoding="utf-8") if alvo.exists() else ""
    if "[permissions.auto-leitura]" in atual:
        say("Codex: perfis do /auto já existem")
        return
    if alvo.exists():
        backup.mkdir(parents=True, exist_ok=True)
        shutil.copy2(alvo, backup / "codex-config.toml")
        # Do modelo, só os perfis: o topo do config atual é do dono.
        texto = render(modelo.read_text(encoding="utf-8"), trocas)
        texto = texto[texto.index("[permissions."):] if "[permissions." in texto else ""
        if "default_permissions" not in atual:
            atual = 'default_permissions = "auto-leitura"\n' + atual
        novo = atual.rstrip() + "\n\n" + texto
    else:
        novo = render(modelo.read_text(encoding="utf-8"), trocas)
    alvo.parent.mkdir(parents=True, exist_ok=True)
    alvo.write_text(novo, encoding="utf-8")
    say("Codex: perfis auto-leitura e auto-escrita adicionados")


def clonar_kit(home: Path) -> None:
    base = home / "claude-repos"
    linhas = [l for l in (REPO / "kit" / "repos.txt").read_text(encoding="utf-8").splitlines()
              if l and not l.startswith("#")]
    ok = falhas = 0
    for i, linha in enumerate(linhas, 1):
        pasta, url, commit = linha.split("|")
        destino = base / pasta
        if (destino / ".git").exists():
            ok += 1
            continue
        print(f"  [{i}/{len(linhas)}] {pasta}", flush=True)
        destino.parent.mkdir(parents=True, exist_ok=True)
        r = subprocess.run(["git", "-c", "core.longpaths=true", "clone", "--filter=blob:none",
                            "-c", "core.longpaths=true", "-q", url, str(destino)])
        if r.returncode == 0:
            subprocess.run(["git", "-C", str(destino), "checkout", "-q", commit],
                           stderr=subprocess.DEVNULL)
            ok += 1
        else:
            falhas += 1
            PENDENCIAS.append(f"kit: não clonou {url}")
    for nome in ("install_all.sh",):
        if (REPO / "kit" / nome).exists():
            shutil.copy2(REPO / "kit" / nome, base / nome)
    say(f"kit: {ok} repositórios prontos, {falhas} falhas")


def instalar_plugins(home: Path) -> None:
    claude = shutil.which("claude")
    if not claude:
        PENDENCIAS.append("plugins: abra o Claude Code e aceite os marketplaces (ou instale o CLI `claude` e rode de novo)")
        return
    s = ler_json(home / ".claude" / "settings.json")
    for nome, m in s.get("extraKnownMarketplaces", {}).items():
        src = m.get("source", {})
        alvo = src.get("repo") or src.get("path")
        if alvo:
            subprocess.run([claude, "plugin", "marketplace", "add", alvo],
                           capture_output=True, text=True)
    instalados = 0
    for plugin, ligado in s.get("enabledPlugins", {}).items():
        if ligado:
            r = subprocess.run([claude, "plugin", "install", plugin], capture_output=True, text=True)
            instalados += r.returncode == 0
    say(f"plugins: {instalados} instalados/confirmados pelo CLI")


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser()
    ap.add_argument("--completo", action="store_true", help="também roda kit/install_all.sh (apps, vários GB)")
    ap.add_argument("--sem-kit", action="store_true", help="não clona o kit em ~/claude-repos")
    ap.add_argument("--teste", help="instala dentro desta pasta no lugar da pasta do usuário")
    a = ap.parse_args()

    home = Path(a.teste).resolve() if a.teste else Path.home()
    trocas = marcadores(home)
    data = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
    backup = home / ".claude" / "backups" / f"auto-instalar-{data}"

    faltam = [p for p in ("git", "node", "npm") if not shutil.which(p)]
    if faltam:
        PENDENCIAS.append(f"instalar: {', '.join(faltam)} (no Windows: winget install Git.Git OpenJS.NodeJS.LTS)")

    say(f"instalando o /auto em {home}")
    origem = REPO / "claude"
    for nome in ("skills", "agents", "agents-reserva", "security-guidance", "scheduled-tasks"):
        if (origem / nome).exists():
            n = copiar_pasta(origem / nome, home / ".claude" / nome, trocas, backup)
            say(f"{nome}: {n} arquivos novos ou atualizados")
    n = copiar_pasta(origem / "memoria", home / ".claude" / "auto-memoria", trocas, backup)
    say(f"memória do /auto: {n} arquivos em ~/.claude/auto-memoria")
    global_md = home / ".claude" / "CLAUDE.md"
    if not global_md.exists() and (origem / "CLAUDE.global.md").exists():
        global_md.write_text(render((origem / "CLAUDE.global.md").read_text(encoding="utf-8"), trocas), encoding="utf-8")

    juntar_settings(home, trocas, backup)
    juntar_mcp(home, trocas, backup)
    juntar_codex(home, trocas, backup)

    ponte = home / ".config" / "predio-ponte.json"
    exemplo = REPO / "config" / "predio-ponte.example.json"
    if not ponte.exists() and exemplo.exists():
        ponte.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(exemplo, ponte)
        PENDENCIAS.append("prédio: colar o token da ponte em ~/.config/predio-ponte.json (campo token)")
    (home / "auto-projetos" / "_predio").mkdir(parents=True, exist_ok=True)

    if not a.sem_kit:
        clonar_kit(home)
        if a.completo:
            say("kit completo: rodando install_all.sh (demora)")
            subprocess.run(["bash", str(home / "claude-repos" / "install_all.sh")],
                           env={**os.environ, "AUTO_DIR": str(home / "claude-repos")})
        else:
            PENDENCIAS.append("apps pesados (ComfyUI, VoxCPM, YuE, Crafting apps...): rode de novo com --completo quando quiser")

    if not a.teste:
        instalar_plugins(home)
        cat = home / ".claude" / "skills" / "auto" / "catalogo.py"
        if cat.exists():
            subprocess.run([sys.executable, str(cat)], capture_output=True)
            say("catálogo do /auto regenerado")

    PENDENCIAS.extend([
        "GPT: npm i -g @openai/codex  e depois  codex login  (conta ChatGPT)",
        "claude-mem: claude auth login  (o reparos.py do /auto ajeita o resto)",
        "MCPs com login (github, vercel, supabase, sentry): /mcp dentro do Claude Code",
        "Google Workspace: gws auth setup  |  Apify: npx apify-cli login",
        "tarefa do prédio: peça ao Claude 'crie a tarefa agendada predio-pedidos a cada 30 min' (arquivo já está em ~/.claude/scheduled-tasks)",
    ])
    print("\n/auto instalado. Backup do que mudou:", backup if backup.exists() else "nada mudou")
    print("\nSó o dono pode fazer (logins e senhas):")
    for p in PENDENCIAS:
        print("  -", p)
    print("\nPronto: abra o Claude Code e digite /auto")


if __name__ == "__main__":
    main()
