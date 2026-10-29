"""Sincroniza o prédio e projetos /auto usando somente a biblioteca padrão."""

import argparse
from datetime import datetime, timedelta
from contextlib import redirect_stdout, redirect_stderr
import hashlib
import io
import json
from pathlib import Path
import sys
import tempfile

for _fluxo in (sys.stdout, sys.stderr):
    if hasattr(_fluxo, 'reconfigure'):
        _fluxo.reconfigure(encoding='utf-8', errors='replace')

RAIZ = Path(r'{{HOME_WIN}}\auto-projetos')
ESTADO = Path(r'{{HOME_WIN}}\.config\predio-sync.json')


def hash_dados(dados):
    return hashlib.sha256(json.dumps(dados, sort_keys=True, ensure_ascii=False,
                                    separators=(',', ':'), allow_nan=False).encode('utf-8')).hexdigest()


def sincronizar(raiz, forcar=False):
    erros = []
    contagens = {'temas': 0, 'fichas': 0}
    mapa_ok = False
    estado = {}
    alterado = False

    def passo(nome, acao):
        try:
            # Saídas das dependências podem incluir caminhos ou detalhes da rede.
            with redirect_stdout(io.StringIO()), redirect_stderr(io.StringIO()):
                resultado = acao()
            print(nome + ': ok')
            return True, resultado
        except (Exception, SystemExit):
            erros.append(nome + ': falha na operação')
            print(nome + ': erro')
            return False, None

    ok, modulos = passo('módulos', carregar_modulos)
    if ok:
        ponte, ficha, tema, predio = modulos
        raiz = Path(raiz).resolve()
        saida = raiz / '_predio'

        def ler_estado():
            if not ESTADO.exists():
                return {}
            dados = json.loads(ESTADO.read_text(encoding='utf-8'))
            if not isinstance(dados, dict):
                raise ValueError()
            return dados

        _, lido = passo('cache leitura', ler_estado)
        estado = lido if isinstance(lido, dict) else {}

        def enviar(args):
            if ponte.executar(args) != 0:
                raise OSError()

        gerou, _ = passo('mapa geração', lambda: predio.gerar(raiz, saida))
        if gerou:
            mapa_ok, _ = passo('mapa envio', lambda: enviar(['mapa', str(saida / 'mapa.json')]))
        _, projetos = passo('projetos leitura', lambda: sorted(raiz.iterdir()))
        for indice, pasta in enumerate(projetos or [], 1):
            elegivel, incluir = passo(f'projeto {indice} leitura', lambda: (
                pasta.is_dir() and (pasta / 'painel.json').is_file()))
            if not elegivel or not incluir:
                continue
            chave = str(pasta.resolve())
            avisos_tema = []
            def baixar_tema():
                # Diretório novo evita confundir um 404 com download anterior.
                with tempfile.TemporaryDirectory(dir=raiz) as temporario:
                    remoto = Path(temporario) / 'tema.json'
                    enviar(['tema-baixar', pasta.name, str(remoto)])
                    if not remoto.exists():
                        return None
                    bruto = remoto.read_bytes()
                    dados, _ = tema.validar(json.loads(bruto.decode('utf-8-sig')), len(bruto))
                    digest = hash_dados(dados)
                    local = pasta / 'tema.json'
                    if digest != estado.get(chave + '|tema') or not local.exists():
                        if local.exists():
                            instante = datetime.now()
                            existentes = sorted(pasta.glob('tema.json.????????-??????.bak'))
                            if existentes:
                                try:
                                    ultimo = datetime.strptime(existentes[-1].name, 'tema.json.%Y%m%d-%H%M%S.bak')
                                    instante = max(instante, ultimo + timedelta(seconds=1))
                                except ValueError:
                                    pass
                            backup = local.with_name(instante.strftime('tema.json.%Y%m%d-%H%M%S.bak'))
                            while backup.exists():
                                instante += timedelta(seconds=1)
                                backup = local.with_name(instante.strftime('tema.json.%Y%m%d-%H%M%S.bak'))
                            backup.write_bytes(local.read_bytes())
                            backups = sorted(pasta.glob('tema.json.????????-??????.bak'), reverse=True)
                            for antigo in backups[5:]:
                                antigo.unlink()
                            avisos_tema.append(f'aviso: tema de {pasta.name} editado no site; versão do PC guardada em {backup.name}')
                        local.write_text(json.dumps(dados, ensure_ascii=False, allow_nan=False), encoding='utf-8')
                        return digest
                    return None

            baixou, remoto_digest = passo(f'projeto {indice} tema download', baixar_tema)
            for aviso in avisos_tema:
                print(aviso)
            if remoto_digest is not None:
                estado[chave + '|tema'] = remoto_digest
                alterado = True
            if baixou and not (pasta / 'tema.json').exists():
                continue
            for tipo in ('tema', 'ficha'):
                if tipo == 'tema' and (not baixou or remoto_digest is not None):
                    continue
                nome = f'projeto {indice} {tipo}'

                def preparar():
                    if tipo == 'tema':
                        with (pasta / 'tema.json').open('rb') as arquivo:
                            bruto = arquivo.read(tema.LIMITE + 1)
                        dados, _ = tema.validar(json.loads(bruto.decode('utf-8-sig')), len(bruto))
                        comparavel = dados
                    else:
                        dados = ficha.montar(pasta)
                        comparavel = {k: v for k, v in dados.items() if k != 'gerado'}
                    return dados, hash_dados(comparavel)

                valido, preparado = passo(nome + ' geração/validação', preparar)
                if not valido:
                    continue
                dados, digest = preparado
                cache_chave = chave + '|' + tipo
                if not forcar and estado.get(cache_chave) == digest:
                    print(nome + ': sem mudança')
                    continue

                def publicar():
                    destino = saida / 'sync' / pasta.name / (tipo + '.json')
                    destino.parent.mkdir(parents=True, exist_ok=True)
                    destino.write_text(json.dumps(dados, ensure_ascii=False, allow_nan=False), encoding='utf-8')
                    enviar([tipo, pasta.name, str(destino)])

                enviado, _ = passo(nome + ' envio', publicar)
                if enviado:
                    estado[cache_chave] = digest
                    alterado = True
                    contagens['temas' if tipo == 'tema' else 'fichas'] += 1
        if alterado:
            def salvar():
                ESTADO.parent.mkdir(parents=True, exist_ok=True)
                temporario = ESTADO.with_name(ESTADO.name + '.tmp')
                temporario.write_text(json.dumps(estado, ensure_ascii=False), encoding='utf-8')
                temporario.replace(ESTADO)
            passo('cache gravação', salvar)
    print(f"sync: mapa {'ok' if mapa_ok else 'erro'} | temas {contagens['temas']} | fichas {contagens['fichas']} | erros {len(erros)}")
    for erro in erros:
        print('erro: ' + erro)
    return 1 if erros else 0


def carregar_modulos():
    import ponte
    import ficha
    import tema
    import predio
    return ponte, ficha, tema, predio


def main(argumentos=None):
    try:
        parser = argparse.ArgumentParser(description=__doc__)
        parser.add_argument('--raiz', type=Path, default=RAIZ)
        parser.add_argument('--forcar', action='store_true')
        args = parser.parse_args(argumentos)
        return sincronizar(args.raiz, args.forcar)
    except (Exception, SystemExit) as erro:
        if isinstance(erro, SystemExit) and erro.code == 0:
            return 0
        print('sync: mapa erro | temas 0 | fichas 0 | erros 1')
        print('erro: execução: falha na operação ou argumentos inválidos')
        return 1


if __name__ == '__main__':
    main()
