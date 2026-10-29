"""Projeção pública do estado da Central; nunca exporta o estado bruto."""

import ast
from datetime import datetime, timedelta
import json
from pathlib import Path
import re
from urllib.parse import urlsplit, urlunsplit

PLATAFORMAS = ('youtube', 'tiktok', 'instagram')
STATUS = {'pendente', 'postando', 'agendado', 'postado', 'erro'}
HOSTS = {'youtube.com', 'www.youtube.com', 'youtu.be', 'tiktok.com',
         'www.tiktok.com', 'instagram.com', 'www.instagram.com'}


def texto_publico(valor, padrao):
    if not isinstance(valor, str):
        return padrao
    # Campos livres não podem transportar credenciais ou caminhos locais.
    if re.search(r'(?i)token|cookie|bearer|password|senha|secret|credential|'
                 r'api[_-]?key|authorization|[a-z]:[\\/]|/home/|/Users/|'
                 r'user.?data|browser|navegador', valor):
        return padrao
    return valor[:300]


def configuracao_canais(pasta):
    """Somente literais de CANAIS; nunca executa empresa.py."""
    for relativo in ('ferramentas/empresa.py', 'empresa.py'):
        try:
            caminho = Path(pasta) / relativo
            caminho.resolve().relative_to(Path(pasta).resolve())
            with caminho.open('rb') as stream:
                raw = stream.read(1024 * 1024 + 1)
            if len(raw) > 1024 * 1024:
                continue
            arvore = ast.parse(raw.decode('utf-8-sig'))
            for no in arvore.body:
                alvos = no.targets if isinstance(no, ast.Assign) else [no.target] if isinstance(no, ast.AnnAssign) else []
                if any(isinstance(a, ast.Name) and a.id == 'CANAIS' for a in alvos):
                    dados = ast.literal_eval(no.value)
                    if isinstance(dados, list):
                        return {c['id']: c for c in dados if isinstance(c, dict)
                                and isinstance(c.get('id'), str)}
        except (OSError, ValueError, SyntaxError, TypeError, RecursionError):
            continue
    return {}


def instante(valor, agora):
    valor = horario(valor)
    if valor:
        data = datetime.fromisoformat(valor.replace('Z', '+00:00'))
        return data.replace(tzinfo=agora.tzinfo) if data.tzinfo is None else data.astimezone(agora.tzinfo)
    return None


def proximo_horario(config, agora):
    hora = config.get('hora')
    if isinstance(hora, str) and re.fullmatch(r'(?:[01]\d|2[0-3]):[0-5]\d', hora):
        h, m = map(int, hora.split(':'))
        data = agora.replace(hour=h, minute=m, second=0, microsecond=0)
        if data <= agora:
            data += timedelta(days=1)
        return data.isoformat(timespec='seconds')
    return None


def horario(valor):
    if isinstance(valor, str) and len(valor) <= 40:
        try:
            datetime.fromisoformat(valor.replace('Z', '+00:00'))
            return valor
        except ValueError:
            pass
    return None


def link_publico(valor):
    if not isinstance(valor, str):
        return None
    try:
        url = urlsplit(valor)
        if (url.scheme == 'https' and url.netloc in HOSTS and
                re.fullmatch(r'/[A-Za-z0-9_/@.\-]*', url.path)):
            # Queries inteiras são descartadas; no YouTube só o id público é mantido.
            query = ''
            if url.path == '/watch':
                match = re.search(r'(?:^|&)v=([A-Za-z0-9_-]{11})(?:&|$)', url.query)
                if not match:
                    return None
                query = 'v=' + match[1]
            return urlunsplit(('https', url.netloc, url.path, query, ''))
    except ValueError:
        pass
    return None


def coletar(pasta):
    try:
        arquivo = Path(pasta) / 'central' / 'estado.json'
        arquivo.resolve().relative_to(Path(pasta).resolve())
        if not arquivo.is_file():
            return None
        with arquivo.open('rb') as stream:
            raw = stream.read(8 * 1024 * 1024 + 1)
        if len(raw) > 8 * 1024 * 1024:
            return None
        estado = json.loads(raw.decode('utf-8-sig'))
        if not isinstance(estado, dict) or not isinstance(estado.get('posts', {}), dict):
            return None
        canais, videos, calendario = {}, [], []
        configs = configuracao_canais(pasta)
        agora = datetime.now().astimezone()
        inicio = (agora - timedelta(days=agora.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
        fim = inicio + timedelta(days=14)
        recentes = {}
        for identificador, post in estado.get('posts', {}).items():
            if not isinstance(identificador, str) or not isinstance(post, dict):
                continue
            partes = identificador.split('/')
            if len(partes) != 2 or not all(re.fullmatch(r'[a-z0-9_-]{1,120}', p) for p in partes):
                continue
            canal = canais.setdefault(partes[0], {})
            config = configs.get(partes[0], {})
            revisao = post.get('revisao', {})
            revisao = revisao if isinstance(revisao, dict) else {}
            editorial = ('aprovado' if revisao.get('ok') is True and revisao.get('aprovacao')
                         else 'revisao' if revisao else 'producao')
            titulo = texto_publico(post.get('titulo'), partes[1].replace('-', ' '))
            video = dict(id=identificador, canal=partes[0], titulo=titulo,
                         status_por_plataforma={}, horario_previsto=None,
                         postado_em=None, link=None, status=editorial)
            datas = [instante(post.get(c), agora) for c in ('criado_em', 'atualizado')]
            datas += [instante(revisao.get(c), agora) for c in ('data', 'aprovacao')]
            previstas, publicadas = [], []
            plataformas_config = config.get('plataformas')
            habilitadas = (plataformas_config if isinstance(plataformas_config, list) else
                           [p for p in PLATAFORMAS if p in config])
            for plataforma in PLATAFORMAS:
                dados = post.get(plataforma, {})
                if not isinstance(dados, dict):
                    dados = {}
                grupo = canal.setdefault(plataforma, dict(postados=0, pendentes=0, erros=0,
                    reenvios=0, proximos_horarios=[], links=[]))
                status = dados.get('status', 'pendente')
                if status not in STATUS:
                    status = 'pendente'
                if plataforma in post or plataforma in habilitadas:
                    real = status if plataforma in post else editorial
                    video['status_por_plataforma'][plataforma] = real
                    publicada = horario(dados.get('postado_em')) if real == 'postado' else None
                    prevista = next((horario(dados.get(c)) for c in
                                     ('proxima_tentativa', 'agendado_em', 'horario', 'prazo')
                                     if horario(dados.get(c))), None)
                    if real in {'pendente', 'aprovado', 'agendado', 'erro', 'postando'}:
                        prevista = prevista or proximo_horario(config, agora)
                    else:
                        prevista = None
                    if publicada:
                        publicadas.append(publicada)
                    if prevista:
                        previstas.append(prevista)
                    datas.extend(instante(dados.get(c), agora) for c in
                                 ('postado_em', 'atualizado', 'criado_em'))
                    data = publicada if real == 'postado' else prevista
                    dt = instante(data, agora)
                    if ((dt and inicio <= dt < fim) or
                            (data is None and real in {'pendente', 'aprovado', 'agendado', 'erro', 'postando'})):
                        calendario.append(dict(data=data, titulo=titulo, canal=partes[0],
                                               plataforma=plataforma, status=real))
                    video['link'] = video['link'] or link_publico(dados.get('link'))
                grupo['postados' if status == 'postado' else 'erros' if status == 'erro' else 'pendentes'] += 1
                tentativas = dados.get('tentativas', 0)
                if type(tentativas) is int:
                    grupo['reenvios'] += max(0, tentativas - 1)
                for campo in ('proxima_tentativa', 'agendado_em', 'horario', 'prazo'):
                    data = horario(dados.get(campo))
                    if data and status != 'postado' and data not in grupo['proximos_horarios']:
                        grupo['proximos_horarios'].append(data)
                link = link_publico(dados.get('link'))
                if link and link not in grupo['links']:
                    grupo['links'].append(link)
            video['horario_previsto'] = min(previstas, key=lambda d: instante(d, agora)) if previstas else None
            video['postado_em'] = max(publicadas, key=lambda d: instante(d, agora)) if publicadas else None
            videos.append(video)
            recentes[identificador] = max((d.timestamp() for d in datas if d), default=0)
        for canal in canais.values():
            for grupo in canal.values():
                grupo['proximos_horarios'].sort()
        videos.sort(key=lambda v: (recentes[v['id']], v['id']), reverse=True)
        calendario.sort(key=lambda v: (v['data'] is None,
                          instante(v['data'], agora).timestamp() if v['data'] else 0,
                          v['canal'], v['titulo'], v['plataforma']))
        return {'canais': canais, 'videos': videos[:60], 'calendario': calendario}
    except Exception:
        return None
