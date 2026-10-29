"""Temas do /auto: geração e validação, somente stdlib."""

import argparse
import json
from pathlib import Path
import re
import sys
import unicodedata

LIMITE = 30 * 1024
ASSUNTOS = ('video', 'jogo', 'programacao', 'site', 'marketing', 'design',
            'pesquisa', 'educacao', 'negocio', 'outro')
PROPS = set('claquete refletor camera sofa arcade controle pufe neon servidor quadro_branco monitor_duplo planta estante trofeu mesa_pingpong cavalete microfone globo'.split())
TIPOS = set('kpis etapas tabela lista calendario linha_tempo galeria checklist equipe decisoes pesquisa grafico metrica_externa conversa'.split())
CORES = dict(fundo='#0b0f1a', painel='#151a28', parede='#2a3149', texto='#eef1fa',
             fraco='#9aa3c0', destaque='#ff3d3d', destaque2='#25f4ee',
             ok='#3ddc84', alerta='#ffb020', erro='#ff5a6a')


def validar(tema, tamanho=None):
    """Retorna (tema normalizado, avisos); contratos inválidos levantam ValueError."""
    if tamanho is None:
        tamanho = len(json.dumps(tema, ensure_ascii=False, separators=(',', ':'), allow_nan=False).encode('utf-8'))
    if tamanho > LIMITE:
        raise ValueError('tema excede 30 KB')
    if not isinstance(tema, dict):
        raise ValueError('tema deve ser um objeto')

    def texto(valor, campo):
        espacos_js = '\u0009\u000a\u000b\u000c\u000d\u0020\u00a0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u2028\u2029\u202f\u205f\u3000\ufeff'
        if (not isinstance(valor, str) or not valor.strip(espacos_js)
                or len(valor.encode('utf-16-le', errors='surrogatepass')) // 2 > 80):
            raise ValueError(f'{campo}: texto obrigatório de até 80 caracteres')
        return valor

    def cor(valor, campo):
        if not isinstance(valor, str) or not re.fullmatch(r'#[0-9a-fA-F]{6}', valor):
            raise ValueError(f'{campo}: use #rrggbb')
        return valor

    if isinstance(tema.get('versao'), bool) or tema.get('versao') != 1:
        raise ValueError('versao deve ser 1')
    if tema.get('assunto') not in ASSUNTOS:
        raise ValueError('assunto inválido')
    saida = {k: tema[k] for k in ('versao', 'assunto')}
    for campo in ('nome', 'icone'):
        saida[campo] = texto(tema.get(campo), campo)
    paleta, andar = tema.get('paleta'), tema.get('andar')
    if not isinstance(paleta, dict) or not isinstance(andar, dict):
        raise ValueError('paleta e andar devem ser objetos')
    saida['paleta'] = {k: cor(paleta.get(k), 'paleta.' + k) for k in CORES}
    saida['andar'] = {k: cor(andar.get(k), 'andar.' + k) for k in ('piso', 'luz', 'fachada')}
    decoracao, paineis = andar.get('decoracao'), tema.get('paineis')
    if not isinstance(decoracao, list) or len(decoracao) > 6:
        raise ValueError('decoracao deve ser lista com no máximo 6 props')
    if not isinstance(paineis, list) or len(paineis) > 16:
        raise ValueError('paineis deve ser lista com no máximo 16 painéis')
    avisos = []
    saida['andar']['decoracao'] = []
    for prop in decoracao:
        if isinstance(prop, str) and prop in PROPS:
            saida['andar']['decoracao'].append(prop)
        else:
            avisos.append('prop desconhecido descartado')
    saida['paineis'] = []
    ids = set()
    for painel in paineis:
        if not isinstance(painel, dict):
            raise ValueError('painel deve ser um objeto')
        tipo = painel.get('tipo')
        if not isinstance(tipo, str) or tipo not in TIPOS:
            avisos.append('tipo de painel desconhecido descartado')
            continue
        identificador = texto(painel.get('id'), 'painel.id')
        if identificador in ids:
            raise ValueError('ids de painéis devem ser únicos')
        ids.add(identificador)
        titulo = texto(painel.get('titulo'), 'painel.titulo')
        item = dict(id=identificador, tipo=tipo, titulo=titulo)
        if 'dados' in painel:
            dados = texto(painel['dados'], 'painel.dados')
            partes = dados.split('.')
            if (partes[0] != 'ficha' or len(partes) < 2
                    or any(not parte or parte in {'__proto__', 'prototype', 'constructor'}
                           or any(c not in '_-' and unicodedata.category(c)[0] not in 'LN'
                                  for c in parte) for parte in partes[1:])):
                raise ValueError('painel.dados deve apontar para ficha.<chave>')
            item['dados'] = dados
        saida['paineis'].append(item)
    return saida, avisos


def base(assunto):
    if assunto not in ASSUNTOS:
        raise ValueError('assunto inválido')
    perfis = {
        'video': ('Estúdio Dark', '🎬', ['claquete', 'refletor', 'sofa'], '#ff3d3d'),
        'jogo': ('Startup de Games', '🎮', ['arcade', 'controle', 'pufe', 'neon'], '#a78bfa'),
        'programacao': ('Software House', '💻', ['servidor', 'monitor_duplo', 'quadro_branco'], '#38bdf8'),
        'site': ('Estúdio Web', '🌐', ['monitor_duplo', 'planta', 'quadro_branco'], '#22d3ee'),
        'marketing': ('Agência de Marketing', '📣', ['quadro_branco', 'microfone', 'sofa'], '#fb923c'),
        'negocio': ('Central de Negócios', '💼', ['quadro_branco', 'globo', 'planta'], '#34d399'),
        'design': ('Estúdio de Design', '🎨', ['cavalete', 'planta', 'sofa'], '#f472b6'),
        'pesquisa': ('Centro de Pesquisa', '🔬', ['estante', 'globo', 'quadro_branco'], '#818cf8'),
        'educacao': ('Espaço de Educação', '📚', ['estante', 'quadro_branco', 'globo'], '#fbbf24'),
        'outro': ('Ambiente /auto', '🏢', ['planta', 'sofa', 'quadro_branco'], '#38bdf8'),
    }
    nome, icone, props, destaque = perfis[assunto]
    paineis = []

    def painel(id, tipo, titulo, dados=None):
        item = dict(id=id, tipo=tipo, titulo=titulo)
        if dados:
            item['dados'] = 'ficha.' + dados
        paineis.append(item)

    painel('kpis', 'kpis', 'Resumo', 'kpis')
    painel('etapas', 'etapas', 'Esteira de vídeos' if assunto == 'video' else 'Etapas', 'etapas')
    if assunto == 'video':
        for args in [('agenda', 'calendario', 'Calendário da semana', 'calendario'),
                     ('canais', 'metrica_externa', 'Canais', 'externo.central.canais'),
                     ('videos', 'tabela', 'Vídeos recentes', 'externo.central.videos'),
                     ('roteiros', 'lista', 'Ganchos e roteiros', 'extra.roteiros'),
                     ('titulos', 'tabela', 'Títulos e thumbs', 'extra.titulos'),
                     ('entregas', 'galeria', 'Vídeos e thumbnails', 'entregas')]:
            painel(*args)
    elif assunto == 'jogo':
        for args in [('backlog', 'tabela', 'Backlog de mecânicas', 'extra.backlog'),
                     ('bugs', 'lista', 'Bugs abertos', 'extra.bugs'),
                     ('artes', 'galeria', 'Artes e capturas', 'entregas'),
                     ('roadmap', 'linha_tempo', 'Roadmap', 'extra.roadmap')]:
            painel(*args)
    elif assunto in ('programacao', 'site'):
        painel('tarefas', 'tabela', 'Tarefas', 'extra.tarefas')
        painel('deploys', 'linha_tempo', 'Deploys', 'extra.deploys')
        painel('metricas', 'metrica_externa', 'Métricas externas', 'externo')
    elif assunto in ('marketing', 'negocio'):
        painel('agenda', 'calendario', 'Calendário de conteúdo', 'extra.agenda')
        painel('concorrentes', 'pesquisa', 'Concorrentes', 'concorrentes')
        painel('decisoes', 'decisoes', 'Decisões', 'decisoes')
    else:
        painel('entregas', 'galeria', 'Entregas', 'entregas')
        painel('decisoes', 'decisoes', 'Decisões', 'decisoes')
    painel('criterios', 'checklist', 'Validação', 'criterios')
    if assunto == 'video':
        painel('pendencias', 'lista', 'Pendências', 'pendencias')
    painel('equipe', 'equipe', 'Equipe', 'setores')
    if assunto == 'video':
        painel('decisoes', 'decisoes', 'Decisões', 'decisoes')
        painel('linha_tempo', 'linha_tempo', 'Linha do tempo', 'linha_tempo')
    painel('conversa', 'conversa', 'Conversa')
    return validar(dict(versao=1, nome=nome, assunto=assunto, icone=icone,
                        paleta=dict(CORES, destaque=destaque),
                        andar=dict(piso='#1b2030', luz='#ffd9a0', fachada=destaque,
                                   decoracao=props), paineis=paineis))[0]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='comando', required=True)
    sub.add_parser('base').add_argument('assunto', choices=ASSUNTOS)
    sub.add_parser('validar').add_argument('arquivo')
    args = parser.parse_args()
    try:
        if args.comando == 'base':
            print(json.dumps(base(args.assunto), ensure_ascii=False, indent=2))
        else:
            if args.arquivo == '-':
                raw = sys.stdin.buffer.read(LIMITE + 1)
            else:
                with Path(args.arquivo).open('rb') as stream:
                    raw = stream.read(LIMITE + 1)
            if len(raw) > LIMITE:
                raise ValueError('tema excede 30 KB')
            _, avisos = validar(json.loads(raw.decode('utf-8-sig')), len(raw))
            for aviso in avisos:
                print('aviso: ' + aviso, file=sys.stderr)
            print('tema válido')
        return 0
    except ValueError as erro:
        print('erro: ' + str(erro), file=sys.stderr)
        return 1
    except (OSError, TypeError, RecursionError):
        print('erro: não foi possível ler ou validar o tema', file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')
    sys.exit(main())
