"""Modelo local do /auto (28/10/2026): Ollama + qwen3.5:4b na RTX 3060 (6 GB), grátis, sem internet e sem limite.

Para tarefas curtas e simples: títulos, resumos, classificar, traduzir, extrair campos. Não use para código
grande, checagem de fatos ou decisões (aí é Claude ou GPT). Medido: ~80 tokens/s; o 1º uso carrega o modelo (~1 min).
O Nanbeige 4.3 33B do reel não cabe nesta máquina (Q4_K_M = 20,8 GB; disco e VRAM insuficientes).

Uso:
  python local.py "<pedido>" [--arquivo A ...] [--modelo qwen3.5:4b] [--linhas 20] [--pensar]
  python local.py status
Em Python: from local import perguntar; perguntar("...")  -> texto (ou levanta RuntimeError)
"""
import json, os, shutil, subprocess, sys, time
from urllib.request import Request, urlopen

URL = "http://127.0.0.1:11434"
MODELO = "qwen3.5:4b"
OLLAMA = os.path.join(os.environ.get("LOCALAPPDATA", ""), "Programs", "Ollama", "ollama.exe")
MAX_ANEXO = 40_000  # caracteres por anexo (o contexto do modelo pequeno é limitado)
SEGREDOS = (".env", ".pem", ".key", "credentials", "secret", "token", "auth.json", "id_rsa")


def _get(caminho, timeout=5):
    with urlopen(URL + caminho, timeout=timeout) as r:
        return json.loads(r.read())


def ligado():
    try:
        _get("/api/version", 2)
        return True
    except Exception:
        return False


def ligar():
    if ligado():
        return
    exe = OLLAMA if os.path.exists(OLLAMA) else shutil.which("ollama")
    if not exe:
        raise RuntimeError("Ollama não instalado (winget install --id Ollama.Ollama -e)")
    subprocess.Popen([exe, "serve"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                     creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
    for _ in range(30):
        time.sleep(1)
        if ligado():
            return
    raise RuntimeError("o Ollama não respondeu em 30 s")


def perguntar(pedido, arquivos=(), modelo=MODELO, pensar=False, timeout=600):
    partes = [pedido]
    for a in arquivos:
        if any(s in os.path.basename(a).lower() for s in SEGREDOS):
            raise RuntimeError(f"anexo recusado (parece segredo): {a}")
        with open(a, encoding="utf-8", errors="replace") as f:
            partes.append(f"\n--- {os.path.basename(a)} ---\n{f.read()[:MAX_ANEXO]}")
    ligar()
    corpo = json.dumps({"model": modelo, "prompt": "\n".join(partes), "stream": False, "think": pensar,
                        "options": {"temperature": 0.4}}).encode()
    with urlopen(Request(URL + "/api/generate", data=corpo, headers={"Content-Type": "application/json"}), timeout=timeout) as r:
        d = json.loads(r.read())
    texto = (d.get("response") or "").strip()
    if not texto:
        raise RuntimeError("o modelo local devolveu resposta vazia")
    return texto


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    a = sys.argv[1:]
    if not a:
        print(__doc__)
        return 2
    if a[0] == "status":
        try:
            ligar()
            nomes = [m["name"] for m in _get("/api/tags").get("models", [])]
            print(f"ollama {_get('/api/version').get('version')} | modelos: {', '.join(nomes) or 'nenhum'}")
            return 0
        except Exception as e:
            print(f"Ollama indisponível: {e}")
            return 1
    arquivos, modelo, linhas, pedido = [], MODELO, 0, []
    i = 0
    while i < len(a):
        if a[i] == "--arquivo":
            arquivos.append(a[i + 1]); i += 2
        elif a[i] == "--modelo":
            modelo = a[i + 1]; i += 2
        elif a[i] == "--linhas":
            linhas = int(a[i + 1]); i += 2
        elif a[i] == "--pensar":
            i += 1
        else:
            pedido.append(a[i]); i += 1
    try:
        texto = perguntar(" ".join(pedido), arquivos, modelo, "--pensar" in a)
    except Exception as e:
        print(f"[local] erro: {e}")
        return 1
    saida = texto.splitlines()
    print("\n".join(saida[:linhas] if linhas else saida))
    return 0


if __name__ == "__main__":
    sys.exit(main())
