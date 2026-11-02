"""publicar_comercial.py: prepara as versões comerciais para a venda.

1. Gera o THIRD_PARTY.md (créditos e licenças do que o instalador baixa).
2. Procura segredos e dados pessoais nos dois pacotes; para se achar algo.
3. Com --zip, gera ~/Projetos/dist/<pacote>-<versão>.zip a partir do último commit (git archive).

Uso: python ferramentas/publicar_comercial.py [--zip]
"""
import re
import subprocess
import sys
from pathlib import Path

PROJ = Path.home() / "Projetos"
PACOTES = [PROJ / "auto-empresa", PROJ / "auto-empresa-codex"]
COMPONENTES = PROJ / "auto-empresa" / "config" / "componentes.txt"
FORA = PROJ / "auto-empresa" / "config" / "componentes-fora.txt"

PADROES = {
    "chave OpenAI/Anthropic": r"(?<![A-Za-z0-9-])sk-(?:ant-|proj-)?[A-Za-z0-9_\-]{20,}",
    "token GitHub": r"gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,}",
    "chave AWS": r"AKIA[0-9A-Z]{16}",
    "chave Google": r"AIza[0-9A-Za-z_\-]{35}",
    "JWT": r"eyJ[A-Za-z0-9_\-]{15,}\.eyJ[A-Za-z0-9_\-]{15,}\.[A-Za-z0-9_\-]{10,}",
    "chave privada": r"-----BEGIN [A-Z ]*PRIVATE KEY-----\s*[A-Za-z0-9+/=]{40}",
    "dado pessoal": r"(?i)enzo|kali|99freelas|beny alle|travaoscroll|arlequim|pucpr|predio-auto\.vercel"
                    r"|tail95cf23|desktop-0lndd24|kali-acab|sprengoski|novela|central dos canais|canais-dark"
                    r"|central_canais|tailscale|rtx 3060|predio-3d-auto-v",
}


def third_party(pacote: Path) -> None:
    linhas = ["# Componentes de terceiros", "",
              "O /auto **não inclui** código de terceiros. O instalador baixa cada componente da fonte",
              "original, no seu computador, e cada um segue a licença do próprio autor.", "",
              "| Componente | Fonte | Licença |", "|---|---|---|",
              "| agency-agents (282 funcionários) | https://github.com/msitarzewski/agency-agents | MIT |"]
    if "codex" not in pacote.name:
        for l in COMPONENTES.read_text(encoding="utf-8").splitlines():
            if l and not l.startswith("#"):
                pasta, url, _commit, lic = l.split("|")
                linhas.append(f"| {pasta.split('/')[-1]} | {url.removesuffix('.git')} | {lic} |")
        linhas += ["", "Os plugins do Claude Code são instalados pelo próprio Claude Code, a partir dos",
                   "marketplaces públicos listados em `config/settings.recomendado.json`.", "",
                   "## Não instalados automaticamente", "",
                   "Estes não têm licença ou têm licença que restringe uso comercial ou redistribuição.",
                   "Se quiser usar, instale por conta própria e confira a licença:", ""]
        for l in FORA.read_text(encoding="utf-8").splitlines():
            if "|" in l:
                linhas.append(f"- {l.split('|')[1].removesuffix('.git')}")
    (pacote / "THIRD_PARTY.md").write_text("\n".join(linhas) + "\n", encoding="utf-8")


def verificar(pacote: Path) -> list:
    achados = []
    for arq in pacote.rglob("*"):
        if not arq.is_file() or ".git" in arq.parts or arq.name == "THIRD_PARTY.md":
            continue
        try:
            texto = arq.read_text(encoding="utf-8")
        except (UnicodeDecodeError, OSError):
            continue
        for nome, padrao in PADROES.items():
            for m in re.finditer(padrao, texto):
                n = texto.count("\n", 0, m.start()) + 1
                achados.append(f"{pacote.name}/{arq.relative_to(pacote).as_posix()}:{n}: {nome}: {m.group(0)[:16]}")
    return achados


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    achados = []
    for p in PACOTES:
        third_party(p)
        achados += verificar(p)
    for a in achados:
        print(a)
    print(f"verificar: {len(achados)} achado(s)")
    if achados:
        return 1
    if "--zip" in sys.argv:
        dist = PROJ / "dist"
        dist.mkdir(exist_ok=True)
        for p in PACOTES:
            versao = (p / "VERSION").read_text(encoding="utf-8").strip()
            saida = dist / f"{p.name}-{versao}.zip"
            subprocess.run(["git", "-C", str(p), "archive", "--format=zip",
                            f"--prefix={p.name}/", "-o", str(saida), "HEAD"], check=True)
            print("zip:", saida)
    return 0


if __name__ == "__main__":
    sys.exit(main())
