"""verificar.py: procura segredos e caminhos pessoais antes de enviar o repositório.

Sai com código 1 se achar algo. Uso: python ferramentas/verificar.py
"""
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
PADROES = {
    "chave OpenAI/Anthropic": r"(?<![A-Za-z0-9-])sk-(?:ant-|proj-)?[A-Za-z0-9_\-]{20,}",
    "token GitHub": r"gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,}",
    "chave AWS": r"AKIA[0-9A-Z]{16}",
    "chave Google": r"AIza[0-9A-Za-z_\-]{35}",
    "token Slack": r"xox[baprs]-[A-Za-z0-9-]{10,}",
    "JWT": r"eyJ[A-Za-z0-9_\-]{15,}\.eyJ[A-Za-z0-9_\-]{15,}\.[A-Za-z0-9_\-]{10,}",
    "chave privada": r"-----BEGIN [A-Z ]*PRIVATE KEY-----\s*[A-Za-z0-9+/=]{40}",
    "token Vercel/Upstash atribuído": r"(?i)(UPSTASH_REDIS_REST_TOKEN|VERCEL_TOKEN|SENHA_SITE)\s*[=:]\s*['\"]?[A-Za-z0-9_\-]{16,}",
    "pasta do usuário sem marcador": re.escape(str(Path.home())).replace("\\\\", r"[\\/]+"),
}
IGNORAR = {"verificar.py"}


def main() -> int:
    achados = []
    for arq in REPO.rglob("*"):
        if not arq.is_file() or ".git" in arq.parts or arq.name in IGNORAR:
            continue
        try:
            texto = arq.read_text(encoding="utf-8")
        except (UnicodeDecodeError, OSError):
            continue
        for nome, padrao in PADROES.items():
            for m in re.finditer(padrao, texto, flags=re.I if "pasta" in nome else 0):
                linha = texto.count("\n", 0, m.start()) + 1
                achados.append(f"{arq.relative_to(REPO).as_posix()}:{linha}: {nome}: {m.group(0)[:12]}…")
    for a in achados:
        print(a)
    print(f"verificar: {len(achados)} achado(s)")
    return 1 if achados else 0


if __name__ == "__main__":
    sys.exit(main())
