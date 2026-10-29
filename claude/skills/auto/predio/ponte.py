"""Ponte opcional entre o PC /auto e a API do prédio (somente stdlib)."""

from datetime import datetime
import json
from pathlib import Path
import sys
import subprocess
from urllib.error import HTTPError

# Quem importa a ponte com a saída redirecionada (sincronizar.py usa StringIO) não tem reconfigure.
for _fluxo in (sys.stdout, sys.stderr):
    if hasattr(_fluxo, 'reconfigure'):
        _fluxo.reconfigure(encoding='utf-8', errors='replace')
from urllib.parse import urlsplit, urlencode
from urllib.request import Request, urlopen


CONFIG = Path(r"{{HOME_WIN}}\.config\predio-ponte.json")
STATUS = {"em andamento", "feito", "recusado"}


def linha(valor):
    return " ".join(str(valor).split())


def enviar(requisicao):
    """Envia por urllib, com fallback de curl para falhas de transporte."""
    from urllib.error import HTTPError
    try:
        with urlopen(requisicao, timeout=15) as resposta:
            return resposta.read()
    except HTTPError:
        raise
    except OSError:
        # O Bearer passa pelo stdin, nunca pela linha de comando do processo.
        def escapar(valor):
            return valor.replace('\\', '\\\\').replace('"', '\\"').replace('\n', '\\n').replace('\r', '\\r')
        config = ['url = "' + escapar(requisicao.full_url) + '"',
                  'request = "' + requisicao.get_method() + '"']
        for nome, valor in requisicao.header_items():
            config.append('header = "' + escapar(nome + ': ' + valor) + '"')
        if requisicao.data is not None:
            config.append('data-binary = "' + escapar(requisicao.data.decode('utf-8')) + '"')
        resultado = subprocess.run(['curl.exe', '--silent', '--show-error', '--fail',
            '--max-time', '15', '--config', '-'], input=('\n'.join(config) + '\n').encode('utf-8'),
            capture_output=True, timeout=20, check=True)
        return resultado.stdout


def executar(argumentos):
    comando = argumentos[0] if argumentos else ""
    try:
        config = json.loads(CONFIG.read_text(encoding="utf-8-sig"))
        url, token = config["url"].rstrip("/"), config["token"]
        partes = urlsplit(url)
        if partes.scheme != 'https' and not (
                partes.scheme == 'http' and partes.hostname in {'localhost', '127.0.0.1'}):
            print('ponte: desligada (url precisa ser https)')
            return 0 if comando == 'evento' else 1
        if (partes.scheme not in {"https", "http"} or not partes.netloc
                or partes.query or partes.fragment or partes.username
                or not isinstance(token, str) or not token.strip()):
            raise ValueError()
    except Exception:
        print("ponte: desligada (configuração ausente ou inválida)")
        return 0 if comando == "evento" else 1

    try:
        dados = None
        if comando == "mapa" and len(argumentos) == 2:
            dados = json.loads(Path(argumentos[1]).read_text(encoding="utf-8-sig"))
            metodo, rota = "PUT", "/api/mapa"
        elif comando == "tema-baixar" and len(argumentos) == 3:
            metodo, rota = "GET", "/api/tema?" + urlencode({"pasta": argumentos[1]})
        elif comando in {"tema", "ficha"} and len(argumentos) == 3:
            limite = (30 if comando == "tema" else 200) * 1024
            with Path(argumentos[2]).open('rb') as arquivo:
                bruto = arquivo.read(limite + 1)
            if len(bruto) > limite:
                raise ValueError()
            dados = json.loads(bruto.decode('utf-8-sig'))
            if not isinstance(dados, dict):
                raise ValueError()
            if comando == "tema":
                from tema import validar
                dados, avisos = validar(dados, len(bruto))
                for aviso in avisos:
                    print('ponte: aviso: ' + aviso, file=sys.stderr)
            metodo, rota = "PUT", "/api/" + comando + "?" + urlencode({"pasta": argumentos[1]})
        elif comando == "evento" and len(argumentos) == 6:
            dados = dict(zip(("pasta", "setor", "tipo", "nome", "motivo"), argumentos[1:]))
            dados["hora"] = datetime.now().astimezone().isoformat(timespec="seconds")
            metodo, rota = "POST", "/api/estado"
        elif comando == "pedidos" and len(argumentos) == 1:
            metodo, rota = "GET", "/api/pedidos?status=novo"
        elif comando == "status" and len(argumentos) in {3, 4} and argumentos[2] in STATUS:
            dados = {"id": argumentos[1], "status": argumentos[2]}
            if len(argumentos) == 4:
                dados["resposta"] = argumentos[3]
            metodo, rota = "PATCH", "/api/pedidos"
        else:
            print('ponte: uso: mapa <arquivo> | tema <pasta> <arquivo> | tema-baixar <pasta> <arquivo> | ficha <pasta> <arquivo> | evento <pasta> <setor> <tipo> <nome> <motivo> | pedidos | status <id> "em andamento|feito|recusado" [resposta]')
            return 0 if comando == "evento" else 1
        corpo = json.dumps(dados, ensure_ascii=False).encode("utf-8") if dados is not None else None
        if comando in {"tema", "ficha"}:
            corpo = json.dumps(dados, ensure_ascii=False, separators=(',', ':'), allow_nan=False).encode('utf-8')
            if len(corpo) > limite:
                raise ValueError()
        requisicao = Request(url + rota, data=corpo, method=metodo,
                             headers={"Authorization": "Bearer " + token,
                                      "Content-Type": "application/json"})
        try:
            conteudo = enviar(requisicao)
        except HTTPError as erro:
            if comando == 'tema-baixar' and erro.code == 404:
                print('ponte: sem tema')
                return 0
            raise
        if comando == 'tema-baixar':
            from tema import validar
            dados, _ = validar(json.loads(conteudo.decode('utf-8-sig')), len(conteudo))
            Path(argumentos[2]).write_text(json.dumps(dados, ensure_ascii=False, allow_nan=False), encoding='utf-8')
            print('ponte: ok')
        elif comando == "pedidos":
            pedidos = json.loads(conteudo)
            if isinstance(pedidos, dict):
                pedidos = pedidos["pedidos"]
            if not isinstance(pedidos, list):
                raise ValueError()
            for pedido in pedidos:
                print(" | ".join(linha(pedido.get(campo, ""))[:200] if campo == "texto"
                                 else linha(pedido.get(campo, ""))
                                 for campo in ("id", "andar", "pasta", "texto")))
        else:
            print("ponte: ok")
        return 0
    except Exception:
        # Não expor URLs, cabeçalhos ou exceções que possam conter o token.
        print("ponte: desligada (falha na operação ou rede indisponível)")
        return 0 if comando == "evento" else 1


def main(argumentos=None):
    return executar(sys.argv[1:] if argumentos is None else argumentos)


if __name__ == "__main__":
    sys.exit(main())
