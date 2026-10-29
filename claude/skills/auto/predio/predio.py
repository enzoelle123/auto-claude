"""Gera o mapa compacto e a página do prédio /auto, sem dependências externas."""

import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import re
import sys


RAIZ_PADRAO = Path(r"{{HOME_WIN}}\auto-projetos")
PASTA_SCRIPT = Path(__file__).resolve().parent
SETORES = (
    "diretoria", "pesquisa", "criacao", "producao", "qualidade",
    "ferramentas", "documentacao",
)
STATUS_SETORES = {"pendente", "ativo", "feito", "pulado"}
CHECKBOX = re.compile(r"^\s*-\s+\[([ xX])\]\s*(.*)$")
MARCADOR = "/*__MAPA__*/null"


def texto(valor, limite=None):
    """Mantém os resumos em uma linha, inclusive quando a fonte é multilinha."""
    valor = " ".join(str(valor if valor is not None else "").split())
    return valor if limite is None else valor[:limite]


def limitar_palavras(valor, limite=200):
    valor = texto(valor)
    if len(valor) <= limite:
        return valor
    trecho = valor[:limite]
    if not valor[limite].isspace():
        trecho = trecho.rsplit(" ", 1)[0] if " " in trecho else ""
    return trecho.rstrip()


def limpar_markdown(valor):
    valor = re.sub(r"!?\[([^\]]*)\]\([^)]*\)", r"\1", texto(valor))
    return texto(valor.replace("`", "").replace("**", "").replace("__", ""))


def resumir(conteudo, pedido):
    cerca = None
    for original in conteudo.splitlines():
        linha = original.strip()
        marcador = re.match(r"^(`{3,}|~{3,})", linha)
        if marcador:
            token = marcador[1]
            if cerca is None:
                cerca = token
            elif token[0] == cerca[0] and len(token) >= len(cerca):
                cerca = None
            continue
        if cerca or original.startswith(("    ", "\t")):
            continue
        if not linha or re.match(r"^(#|[-*+]\s|\d+[.)]\s|\||>|[-*_]{3,}\s*$)", linha):
            continue
        if "|" in linha or re.fullmatch(r"(?:!?\[[^\]]*\]\([^)]*\)|<[^>]+>|https?://\S+)", linha):
            continue
        if re.match(r"^\[[^\]]+\]:", linha):
            continue
        frase = limpar_markdown(linha)
        if any(letra.isalpha() for letra in frase):
            return limitar_palavras(frase)
    return limitar_palavras(limpar_markdown(pedido))


def registros(valor):
    return [item for item in valor if isinstance(item, dict)] if isinstance(valor, list) else []


def ler_texto(caminho):
    return caminho.read_text(encoding="utf-8-sig")


def ler_opcional(caminho):
    try:
        return ler_texto(caminho)
    except FileNotFoundError:
        return None
    except (OSError, UnicodeError) as erro:
        print(f"Aviso: não foi possível ler {caminho}: {erro}", file=sys.stderr)
        return None


def chave_criacao(andar):
    """Ordena datas ISO com ou sem fuso; usa a data da pasta como alternativa."""
    for valor in (andar["criado"], andar["pasta"][:10]):
        try:
            data = datetime.fromisoformat(valor)
            if data.tzinfo is None:
                data = data.replace(tzinfo=timezone.utc)
            return (data.timestamp(), andar["pasta"])
        except (ValueError, TypeError, OverflowError, OSError):
            pass
    return (float("-inf"), andar["pasta"])


def montar_andar(pasta, painel):
    setores = dict.fromkeys(SETORES, "pendente")
    for setor in registros(painel.get("setores")):
        nome = texto(setor.get("nome"))
        status = texto(setor.get("status"))
        if nome in setores and status in STATUS_SETORES:
            setores[nome] = status

    prompt = ler_opcional(pasta / "prompt-final.md")
    pendencias = []
    if prompt is not None:
        for linha in prompt.splitlines():
            checkbox = CHECKBOX.match(linha)
            if checkbox and checkbox[1] == " ":
                pendencias.append(texto(checkbox[2], 160))

    if "ativo" in setores.values():
        status = "andamento"
    elif prompt is not None:
        status = "pendencias" if pendencias else "entregue"
    else:
        status = "andamento"

    leia_me = ler_opcional(pasta / "LEIA-ME.md") or ""
    resumo = resumir(leia_me, painel.get("pedido"))
    ferramentas = registros(painel.get("ferramentas"))
    mesas = {}
    for setor in SETORES:
        ultimas = [item for item in ferramentas if item.get("setor") == setor][-3:]
        mesas[setor] = [
            texto(f"{texto(item.get('tipo'))} · {texto(item.get('nome'))}: "
                  f"{texto(item.get('motivo'))}", 120)
            for item in ultimas
        ]
    decisoes = registros(painel.get("decisoes"))
    log = registros(painel.get("log"))
    andar = {
        "n": 0,
        "pasta": pasta.name,
        "titulo": texto(painel.get("titulo")) or pasta.name,
        "resumo": resumo,
        "pedido": texto(painel.get("pedido"), 240),
        "criado": texto(painel.get("criado")),
        "atualizado": texto(painel.get("atualizado")),
        "status": status,
        "pendencias": pendencias[:6],
        "setores": setores,
        "mesas": mesas,
        "decisoes": [texto(item.get("texto"), 160) for item in decisoes[-5:]],
        "ultimo": texto(log[-1].get("texto"), 160) if log else "",
        "contagem": {
            "ferramentas": len(ferramentas),
            "gpt": sum(texto(item.get("tipo")).casefold() == "gpt" for item in ferramentas),
            "agentes": sum(texto(item.get("tipo")).casefold() == "agente" for item in ferramentas),
        },
    }
    try:
        central = json.loads(ler_texto(pasta / "central.json"))
        if (isinstance(central, dict)
                and isinstance(central.get("nome"), str) and central["nome"].strip()
                and isinstance(central.get("url"), str) and central["url"].strip()):
            andar["central"] = {"nome": central["nome"], "url": central["url"]}
    except (OSError, UnicodeError, ValueError):
        pass
    return andar


def montar_mapa(raiz):
    andares = []
    for pasta in raiz.iterdir():
        if not pasta.is_dir() or pasta.name.casefold().startswith("teste-"):
            continue
        caminho = pasta / "painel.json"
        if not caminho.is_file():
            continue
        try:
            painel = json.loads(ler_texto(caminho))
            if not isinstance(painel, dict):
                raise ValueError("o painel deve conter um objeto JSON")
        except (OSError, UnicodeError, ValueError) as erro:
            print(f"Aviso: painel ignorado em {pasta.name}: {erro}", file=sys.stderr)
            continue
        andares.append(montar_andar(pasta, painel))
    andares.sort(key=chave_criacao)
    for numero, andar in enumerate(andares, start=1):
        andar["n"] = numero
    return {"gerado": datetime.now().astimezone().isoformat(timespec="seconds"),
            "andares": andares}


def gerar(raiz, saida):
    mapa = montar_mapa(raiz)
    serializado = json.dumps(mapa, ensure_ascii=False, separators=(",", ":"))
    # Os limites da especificação são tetos. Reduzir só os textos resumidos
    # permite cumprir a meta em UTF-8 sem perder andares, eventos ou contagens.
    limite = 160
    while len(serializado.encode("utf-8")) >= 60_000 and limite > 40:
        limite = max(40, limite - 10)
        for andar in mapa["andares"]:
            for campo in ("resumo", "pedido", "ultimo"):
                andar[campo] = (limitar_palavras(andar[campo], limite) if campo == "resumo"
                                else texto(andar[campo], limite))
            for campo in ("pendencias", "decisoes"):
                andar[campo] = [texto(item, limite) for item in andar[campo]]
            for setor, ferramentas in andar["mesas"].items():
                andar["mesas"][setor] = [texto(item, limite) for item in ferramentas]
        serializado = json.dumps(mapa, ensure_ascii=False, separators=(",", ":"))
    saida.mkdir(parents=True, exist_ok=True)
    caminho_json = saida / "mapa.json"
    caminho_md = saida / "mapa.md"
    caminho_json.write_text(serializado, encoding="utf-8")
    linhas = [
        f"{andar['n']}. {andar['titulo']} [{andar['status']}] {andar['pasta']}"
        f" — pendências: {'; '.join(andar['pendencias']) or 'nenhuma'}"
        for andar in mapa["andares"]
    ]
    linhas.append(f"Total: {len(mapa['andares'])} andares.")
    caminho_md.write_text("\n".join(linhas) + "\n", encoding="utf-8")
    gerados = [str(caminho_json), str(caminho_md)]
    template = ler_opcional(PASTA_SCRIPT / "template.html")
    aviso = ""
    if template is None:
        aviso = "; aviso: pulou o predio.html (template.html ausente ou ilegível)"
    elif MARCADOR not in template:
        aviso = f"; aviso: pulou o predio.html (template.html sem {MARCADOR})"
    else:
        caminho_html = saida / "predio.html"
        caminho_html.write_text(
            template.replace(MARCADOR, serializado.replace("<", "\\u003c")),  # cobre </script> e <!--
            encoding="utf-8",
        )
        gerados.append(str(caminho_html))
    tamanho = caminho_json.stat().st_size
    if tamanho >= 60_000:
        aviso += "; aviso: mapa.json atingiu a meta de 60 KB"
    print(f"Gerados: {', '.join(gerados)}; {len(mapa['andares'])} andares; "
          f"mapa.json: {tamanho} bytes{aviso}")
    return mapa


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--raiz", type=Path, default=RAIZ_PADRAO)
    parser.add_argument("--saida", type=Path, default=PASTA_SCRIPT)
    argumentos = parser.parse_args()
    if not argumentos.raiz.is_dir():
        parser.error(f"a raiz não é uma pasta: {argumentos.raiz}")
    try:
        gerar(argumentos.raiz, argumentos.saida)
    except OSError as erro:
        parser.exit(1, f"Erro ao gerar o prédio: {erro}\n")


if __name__ == "__main__":
    main()
