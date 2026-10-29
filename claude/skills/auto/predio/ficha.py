"""Monta a ficha de um projeto /auto sem dependências externas."""

import argparse
import base64
import io
from datetime import datetime
import json
from pathlib import Path
import re
import sys

from fontes import coletar

LIMITE = 200 * 1024
SENSIVEL = re.compile(r'api.?key|private_key|access_key|secret_key|pwd|passwd|client.?secret|token|cookie|password|senha|secret|credentials?|authorization|browser|navegador|user.?data|perfil.?chrome', re.I)
VALOR_SENSIVEL = re.compile(
    r'(?i)(?:authorization\s*:\s*(?:basic|bearer)\s+\S+|bearer\s+\S+|(?:token|cookie|senha|password|secret|api[_-]?key|private_key|access_key|secret_key|pwd|passwd|credentials?)\s*[:=]\s*\S+'
    r'|[A-Z]:[\\/][^\n]*?(?:navegadores|user data|profiles?|chrome|edge|firefox)[^\n]*'
    r'|(?:/home/|/Users/)[^\n]*(?:chrome|firefox|browser)[^\n]*)')
CAMINHO_NAVEGADOR = re.compile(r'(?i)(?:[\w.:-]+[\\/])*(?:navegadores|user[ _-]?data|browser[ _-]?profiles)(?:[\\/][^\s`"<>]*)?[\\/]?')

EMAIL = re.compile(r'(?<![\w/.:-])[\w.+-]+@[\w-]+(?:\.[\w-]+)+', re.I)
TOKEN = re.compile(r'(?<![\w-])(?:xox[abprs]-[A-Za-z0-9-]+|(?:AKIA|ASIA)[0-9A-Z]{16}(?![0-9A-Z])|sk-ant-[A-Za-z0-9_-]+|sk-[A-Za-z0-9_-]+|ghp_[A-Za-z0-9_]+|github_pat_[A-Za-z0-9_]+|eyJ[A-Za-z0-9_-]*(?:\.[A-Za-z0-9_-]+){1,2}|AIza[A-Za-z0-9_-]+)')
CAMINHO_LOCAL = re.compile(r'''(?<![^\s"'(])(?:[A-Z]:[\\/](?![\\/])|/[a-z]/Users/|/(?:home|Users|root)/|\\\\[^\\\s]+\\)[^\r\n`"'<>|)]*''', re.I)
URL_HTTP = re.compile(r'''(https?://[^\s<>"'`]+)''', re.I)


def limpar(valor, nivel=0):
    """Evita transportar credenciais acidentais também nos campos livres."""
    if nivel > 12:
        return None
    if isinstance(valor, dict):
        return {str(k)[:120]: limpar(v, nivel + 1) for k, v in list(valor.items())[:200]
                if not SENSIVEL.search(str(k))}
    if isinstance(valor, list):
        return [limpar(v, nivel + 1) for v in valor[:200]]
    if isinstance(valor, str):
        valor = ''.join(trecho if URL_HTTP.fullmatch(trecho) else
                        EMAIL.sub('[e-mail omitido]', CAMINHO_LOCAL.sub('[caminho omitido]', trecho))
                        for trecho in URL_HTTP.split(valor))
        valor = TOKEN.sub('[omitido]', valor)
        return CAMINHO_NAVEGADOR.sub('[omitido]', VALOR_SENSIVEL.sub('[omitido]', valor))[:2000]
    return valor


def ler_texto(pasta, relativo):
    caminho = pasta / relativo
    try:
        caminho.resolve().relative_to(pasta.resolve())
        with caminho.open('rb') as stream:
            return stream.read(1024 * 1024).decode('utf-8-sig', errors='replace')
    except (OSError, ValueError):
        return ''


def ler_json(pasta, relativo):
    try:
        dados = json.loads(ler_texto(pasta, relativo))
        return limpar(dados) if isinstance(dados, dict) else {}
    except (ValueError, RecursionError):
        return {}


def lista(valor):
    return valor if isinstance(valor, list) else []


def miniaturas(pasta, entregas):
    """Miniaturas locais opcionais; limites incluem o custo do data URI/base64."""
    try:
        from PIL import Image, ImageOps
    except ImportError:
        return
    grupos = {}
    for item in entregas:
        caminho = Path(item['caminho'])
        if caminho.suffix.lower() not in {'.jpg', '.jpeg', '.png', '.webp'}:
            continue
        base = re.sub(r'-(capa|folha)$', '', caminho.with_suffix('').as_posix(), flags=re.I)
        anterior = grupos.get(base)
        if anterior is None or caminho.stem.lower().endswith('-capa'):
            grupos[base] = item
    imagens = sorted(grupos.values(), key=lambda e: e['data'], reverse=True)[:24]
    total = 0
    for item in imagens:
        try:
            arquivo = (pasta / item['caminho']).resolve()
            arquivo.relative_to(pasta)
            with Image.open(arquivo) as original:
                base = ImageOps.exif_transpose(original).convert('RGB')
            # Capas verticais detalhadas passam de 12 KB a 240 px: reduz qualidade e largura até caber.
            uri = None
            for largura, qualidade in ((240, 60), (240, 45), (200, 40), (160, 35)):
                imagem = base.resize((largura, max(1, round(base.height * largura / base.width))))
                buffer = io.BytesIO()
                imagem.save(buffer, format='WEBP', quality=qualidade)
                candidata = 'data:image/webp;base64,' + base64.b64encode(buffer.getvalue()).decode('ascii')
                if len(candidata) <= 12 * 1024:
                    uri = candidata
                    break
            if uri is None:
                continue  # só esta capa fica sem miniatura
            tamanho = len(uri.encode('ascii'))
            if total + tamanho > 150 * 1024:
                break
            item['miniatura'] = uri
            total += tamanho
        except (OSError, ValueError, Image.DecompressionBombError):
            continue


def editoriais(pasta, entregas, central):
    roteiros = []
    for item in sorted(entregas, key=lambda e: e['data'], reverse=True):
        caminho = Path(item['caminho'])
        if caminho.suffix.lower() != '.md':
            continue
        texto = ler_texto(pasta, caminho)
        # Roteiros identificados pelo nome, seção ou vídeo associado.
        if not ('roteiro' in caminho.stem.lower() or re.search(r'gancho|^#+\s+roteiro', texto, re.I | re.M)
                or any((pasta / caminho.with_suffix(ext)).is_file() for ext in ('.mp4', '.webm', '.mov', '.mkv'))):
            continue
        titulo = re.search(r'^#\s+(.+)$', texto, re.M)
        gancho = re.search(r'(?:^#+\s+(?:\d+[.)]?\s*)?Gancho[^\n]*\n|^\*\*Gancho:?\*\*\s*:?|^Gancho:)\s*([^#]+?)(?=\n\s*#|\Z)', texto, re.I | re.M)
        # Entregas antigas possuem legenda em vez de uma seção de gancho.
        if not gancho:
            gancho = re.search(r'^##\s+Legenda\s*\n([^#]+)', texto, re.M)
        frase = re.split(r'(?<=[.!?])\s+', gancho[1].strip(), maxsplit=1)[0] if gancho else ''
        roteiros.append(dict(titulo=titulo[1].strip() if titulo else caminho.stem, resumo=frase))
        if len(roteiros) == 30:
            break
    titulos = [{k: v.get(k, '') for k in ('titulo', 'canal', 'status')}
               for v in lista(central.get('videos')) if isinstance(v, dict)]
    return roteiros, titulos


def montar(pasta):
    pasta = Path(pasta).resolve()
    if not pasta.is_dir():
        raise ValueError('pasta de projeto inexistente')
    painel = ler_json(pasta, 'painel.json')
    extra = ler_json(pasta, 'dashboard.json')
    prompt = ler_texto(pasta, 'prompt-final.md')
    leia = ler_texto(pasta, 'LEIA-ME.md')
    criterios = [dict(texto=limpar(m[2].strip()), feito=m[1].lower() == 'x')
                 for m in re.finditer(r'^\s*[-*]\s+\[([ xX])\]\s+(.+)$', prompt, re.M)]
    pendencias = [c['texto'] for c in criterios if not c['feito']]
    for m in re.finditer(r'^\s*[-*]\s+\[ \]\s+(.+)$', leia, re.M):
        texto = limpar(m[1].strip())
        if texto not in pendencias:
            pendencias.append(texto)
    setores = painel.get('setores', {})
    if isinstance(setores, list):
        setores = {s['nome']: {k: v for k, v in s.items() if k != 'nome'}
                   for s in setores if isinstance(s, dict) and isinstance(s.get('nome'), str)}
    if not isinstance(setores, dict):
        setores = {}
    etapas = [dict(nome=nome, itens=[dict(titulo=nome, status=(dados.get('status', 'pendente')
                        if isinstance(dados, dict) else str(dados)))])
              for nome, dados in setores.items()]
    entregas = []
    raiz = pasta / 'entregas'
    if raiz.is_dir() and not raiz.is_symlink():
        for arquivo in sorted(raiz.rglob('*')):
            if len(entregas) >= 200:
                break
            try:
                arquivo.resolve().relative_to(pasta)
                relativo = arquivo.relative_to(pasta).as_posix()
                if not arquivo.is_file() or SENSIVEL.search(relativo) or arquivo.suffix.lower() in {
                        '.key', '.pem', '.p12', '.pfx', '.netrc', '.npmrc'} or any(
                        p.startswith('.env') for p in arquivo.parts):
                    continue
                info = arquivo.stat()
                ext = arquivo.suffix.lower()
                tipo = ('imagem' if ext in {'.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'} else
                        'video' if ext in {'.mp4', '.webm', '.mov', '.mkv'} else
                        'audio' if ext in {'.mp3', '.wav', '.ogg', '.m4a'} else 'arquivo')
                entregas.append(dict(nome=arquivo.name, caminho=relativo, tipo=tipo,
                    tamanho=info.st_size, data=datetime.fromtimestamp(info.st_mtime).astimezone().isoformat(timespec='seconds')))
            except (OSError, ValueError):
                continue
    pesquisa = lista(painel.get('pesquisa'))[:]
    for arquivo in sorted((pasta / 'pesquisa').glob('*.md'))[:200]:
        texto = ler_texto(pasta, arquivo.relative_to(pasta))
        titulo = re.search(r'^#\s+(.+)$', texto, re.M)
        pesquisa.append(dict(titulo=limpar(titulo[1] if titulo else arquivo.stem),
                             caminho=arquivo.relative_to(pasta).as_posix()))
    resumo = painel.get('resumo') or painel.get('pedido')
    if not resumo:
        resumo = next((s.strip() for s in leia.splitlines() if s.strip() and not s.startswith('#')), '')
    status = painel.get('status')
    if not isinstance(status, str):
        concluidos = all(isinstance(s, dict) and s.get('status') in {'feito', 'pulado'} for s in setores.values())
        status = 'feito' if setores and concluidos else 'em andamento'
    ficha = dict(gerado=datetime.now().astimezone().isoformat(timespec='seconds'),
        pasta=pasta.name, titulo=painel.get('titulo') or pasta.name, resumo=resumo,
        status=status, setores=setores,
        kpis=extra.get('kpis') if isinstance(extra.get('kpis'), list) else [
            dict(rotulo='Entregas', valor=len(entregas)),
            dict(rotulo='Critérios concluídos', valor=sum(c['feito'] for c in criterios), meta=len(criterios)),
            dict(rotulo='Pendências', valor=len(pendencias), tom='alerta' if pendencias else 'ok')],
        etapas=extra.get('etapas') if isinstance(extra.get('etapas'), list) else etapas,
        criterios=criterios, pendencias=pendencias, entregas=entregas,
        decisoes=lista(painel.get('decisoes')), reunioes=lista(painel.get('reunioes')),
        pesquisa=pesquisa, concorrentes=lista(painel.get('concorrentes')),
        ferramentas=lista(painel.get('ferramentas')), linha_tempo=lista(painel.get('log')),
        externo=coletar(pasta), extra=extra)
    central = ficha['externo'].get('central', {})
    if isinstance(central.get('videos'), list) and not (pasta / 'dashboard.json').exists():
        nomes = ['Roteiro/produção', 'Revisão', 'Aprovado', 'Agendado/Reenviar', 'Postado']
        ficha['etapas'] = [dict(nome=nome, itens=[]) for nome in nomes]
        for video in central['videos']:
            if not isinstance(video, dict):
                continue
            estados = list(video.get('status_por_plataforma', {}).values())
            if estados and all(s == 'postado' for s in estados):
                indice = 4
            elif any(s in {'erro', 'agendado', 'postando', 'postado'} for s in estados):
                indice = 3
            elif video.get('status') == 'aprovado' or 'aprovado' in estados:
                indice = 2
            elif video.get('status') == 'revisao' or 'revisao' in estados:
                indice = 1
            else:
                indice = 0
            ficha['etapas'][indice]['itens'].append(dict(video))
        ficha['calendario'] = lista(central.get('calendario'))
        # O tema de vídeo existente consulta extra.agenda.
        ficha['extra']['agenda'] = ficha['calendario']
    if central:
        ficha['extra']['roteiros'], ficha['extra']['titulos'] = editoriais(pasta, entregas, central)
    ficha = limpar(ficha)
    miniaturas(pasta, ficha['entregas'])
    # Cortar primeiro as miniaturas mais antigas, preservando os dados textuais.
    for item in reversed(sorted(ficha['entregas'], key=lambda e: e['data'], reverse=True)):
        if len(serializar(ficha)) <= LIMITE:
            break
        item.pop('miniatura', None)
    # Manter a ficha válida mesmo em projetos com um histórico grande.
    while len(serializar(ficha)) > LIMITE:
        candidatos = []

        def visitar(valor):
            if isinstance(valor, dict):
                for v in valor.values():
                    visitar(v)
            elif isinstance(valor, list) and valor:
                candidatos.append(valor)
                for v in valor:
                    visitar(v)
        visitar(ficha)
        if not candidatos:
            raise ValueError('ficha excede 200 KB; reduza dashboard.json')
        maior = max(candidatos, key=lambda v: len(serializar(v)))
        del maior[len(maior) // 2:]
    return ficha


def serializar(dados):
    return (json.dumps(dados, ensure_ascii=False, indent=2, allow_nan=False) + '\n').encode('utf-8')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('pasta')
    parser.add_argument('--saida')
    args = parser.parse_args()
    try:
        conteudo = serializar(montar(args.pasta))
        if args.saida:
            destino = Path(args.saida)
            destino.parent.mkdir(parents=True, exist_ok=True)
            destino.write_bytes(conteudo)
        else:
            sys.stdout.buffer.write(conteudo)
        return 0
    except (OSError, ValueError, TypeError, RecursionError):
        print('ficha: não foi possível gerar; confira a pasta e os arquivos JSON', file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.stderr.reconfigure(encoding='utf-8')
    sys.exit(main())
