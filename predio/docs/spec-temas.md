# Especificação v3: andares temáticos + dashboard por projeto (Diretor: Claude · Dev: GPT)

Pedido do cliente (28/10/2026): ao abrir um andar, botão **"Criar ambiente visual"**. O andar ganha o tema do
assunto (jogo → startup de games, vídeo → estúdio, programação → software house, etc.) e um botão leva a um
**dashboard sempre tematizado** com tudo o que é preciso para acompanhar e validar o projeto, no padrão do /auto.
Tudo editável (editor na tela e pedindo ao Claude). Estilo base: a Central dos Canais
(`{{HOME_WIN}}\auto-projetos\2026-10-22-canais-dark\central\index.html`: fundo escuro, cards com sombra,
"muro/quadro" por setor, tokens `--painel #151a28 --parede #2a3149 --chao #1b2030 --texto #eef1fa --fraco #9aa3c0
--linha #3b4566 --ok #3ddc84 --alerta #ffb020 --erro #ff5a6a`). Leia-o antes.
Decisões: **motor único** (um dashboard, temas e painéis por JSON, sem deploy por projeto); dados = arquivos do projeto
+ ao vivo + **fontes externas plugáveis**.

## Contratos de dados (o Diretor valida contra isto)
### `tema.json` (por projeto, ≤ 30 KB)
```json
{"versao":1,"nome":"Estúdio Dark","assunto":"video","icone":"🎬",
 "paleta":{"fundo":"#0b0f1a","painel":"#151a28","parede":"#2a3149","texto":"#eef1fa","fraco":"#9aa3c0",
           "destaque":"#ff3d3d","destaque2":"#25f4ee","ok":"#3ddc84","alerta":"#ffb020","erro":"#ff5a6a"},
 "andar":{"piso":"#1b2030","luz":"#ffd9a0","fachada":"#ff3d3d","decoracao":["claquete","refletor","sofa"]},
 "paineis":[{"id":"kpis","tipo":"kpis","titulo":"Resumo"}, {"id":"funil","tipo":"etapas","titulo":"Produção",
            "dados":"ficha.etapas"}]}
```
- `assunto`: video | jogo | programacao | site | marketing | design | pesquisa | educacao | negocio | outro.
- `decoracao`: itens de uma biblioteca fixa de props 3D low-poly (feita uma vez no motor): claquete, refletor, camera,
  sofa, arcade, controle, pufe, neon, servidor, quadro_branco, monitor_duplo, planta, estante, trofeu, mesa_pingpong,
  cavalete, microfone, globo. Máx. 6.
- `paineis[].tipo` (biblioteca do motor): `kpis`, `etapas` (funil/kanban), `tabela`, `lista`, `calendario`,
  `linha_tempo`, `galeria` (entregas com miniatura quando for imagem/vídeo), `checklist` (validação), `equipe`
  (setores e funcionários ao vivo), `decisoes`, `pesquisa` (concorrentes/achados), `grafico` (barras/linha SVG),
  `metrica_externa`, `conversa`. `dados` aponta para um caminho dentro da ficha (`ficha.<chave>`); painéis sem dados
  mostram estado vazio claro ("ainda sem dados: o /auto preenche quando…").
- Valores validados: cores `#rrggbb`; textos ≤ 80 chars; no máx. 16 painéis; ids únicos; tipos/props fora da biblioteca
  são descartados com aviso.

### `ficha.json` (por projeto, gerada pelo PC, ≤ 200 KB)
`{"gerado":iso,"pasta","titulo","resumo","status","setores":{..},"kpis":[{rotulo,valor,meta?,tom?}],
"etapas":[{nome,itens:[{titulo,status,detalhe?,link?}]}],"criterios":[{texto,feito}],"pendencias":[..],
"entregas":[{nome,caminho,tipo,tamanho,data}],"decisoes":[..],"reunioes":[..],"pesquisa":[..],"concorrentes":[..],
"ferramentas":[{hora,setor,tipo,nome,motivo}],"linha_tempo":[{hora,texto}],"externo":{"<fonte>":{...}},"extra":{..}}`
- Montada de `painel.json`, `prompt-final.md` (`- [x]/- [ ]`), `LEIA-ME.md`, `entregas/` (lista de arquivos, sem
  conteúdo), `pesquisa/*.md` (títulos), mais `<projeto>/dashboard.json` (opcional, campos livres que o /auto mantém:
  ex. roteiros, agenda, thumbs; vai em `extra` e pode trazer `etapas`/`kpis` próprios que têm prioridade).
- **Fontes externas** (`fontes/<nome>.py`, cada uma com `def coletar(pasta) -> dict | None`, nunca levanta exceção,
  timeout 10 s): primeira `fontes/central_canais.py`, ativa quando existir `<projeto>/central/estado.json`
  (lê-lo só para leitura: por canal/plataforma — postados, pendentes, erros, reenvios, próximos horários, links;
  NUNCA copiar tokens, cookies ou caminhos de navegador). Resultado em `externo.central`.

## Parte A — API (site/api, sem dependências; mesmos padrões de `_lib.js`)
- `GET /api/tema?pasta=X` (sessão) → tema ou 404. `PUT /api/tema?pasta=X` (sessão **ou** Bearer) grava o tema validado
  (mesma validação do contrato; recusa > 30 KB). Guardar versão anterior (`auto:tema:<pasta>:anterior`) para "desfazer".
- `GET /api/ficha?pasta=X` (sessão). `PUT /api/ficha?pasta=X` (Bearer, ≤ 200 KB).
- `GET /api/temas` (sessão) → `{pasta: {nome, icone, paleta.destaque, andar}}` de todos (para o prédio pintar andares).
- Testes em `site/teste_api.mjs`: validação do tema (cor inválida, tipo desconhecido, tamanho), 401/403, desfazer.

## Parte B — Motor do dashboard (`site/public/dash.html` + `dash.js` + `dash.css`; sem script inline)
- Abre com `dash.html?pasta=X`; sem sessão → `/`. Carrega tema + ficha; aplica paleta em tokens CSS; cabeçalho com
  ícone, nome do tema, título do projeto, status e "← Andar" / "← Prédio".
- Layout de cards responsivo (grade 12 col → 1 col a 375 px, sem rolagem lateral), estilo Central.
- Implementa todos os tipos de painel. `equipe` e `linha_tempo` atualizam ao vivo (`/api/estado` a cada 4 s, aba visível).
  `conversa` usa `conversa.js`. `checklist` mostra os critérios do /auto (validação) com % concluído.
- **Editor de tema** (botão "Editar tema"): cores (input color), nome, ícone, decoração (checkbox da biblioteca),
  painéis (ligar/desligar, reordenar com botões ↑↓, renomear); pré-visualização imediata; "Salvar" (PUT), "Desfazer
  última" e "Pedir ao Claude" (abre a conversa do andar com `[tema] `). Tudo por `textContent`/valores, nada de HTML livre.
- Sem tema ainda: tela "Este andar ainda não tem ambiente visual" + botão "Criar ambiente visual" (ver Parte C).

## Parte C — Andar e prédio tematizados (app.js, andar.js, andar.html)
- `andar.html`: botões **"Criar ambiente visual"** (quando não há tema) ou **"Abrir dashboard"** + "Editar tema"
  (quando há). Criar = POST `/api/pedidos` com texto `[tema] Criar ambiente visual deste andar` (a tarefa agendada do PC
  gera junto ao GPT) e mostra "Pedido enviado: o ambiente fica pronto em até 30 min".
- Cena do andar com tema: piso, luz, cor de destaque nas placas/monitores e os props da `decoracao` (biblioteca 3D
  low-poly em `props3d.js`, compartilhada, feita com primitivas do three; cada prop ≤ ~40 linhas).
- Prédio (`app.js`): `GET /api/temas` → faixa de fachada e luz das janelas na cor do tema + ícone no rótulo do andar.

## Parte D — PC (`tema.py` e `ficha.py`, Python stdlib, na pasta v2; o Diretor instala na skill)
- `ficha.py <pasta-projeto> [--saida arquivo]` monta a ficha (contrato acima, com fontes externas).
- `tema.py validar <tema.json>` (mesmas regras da API; imprime erros e sai 1) e `tema.py base <assunto>` (imprime um
  tema inicial válido para o assunto, com painéis recomendados — use as listas abaixo).
- `ponte.py`: novos comandos `tema <pasta> <arquivo>` (PUT /api/tema) e `ficha <pasta> <arquivo>` (PUT /api/ficha).

### Painéis recomendados por assunto (base para o GPT ajustar ao projeto)
- **video**: kpis (vídeos prontos/postados/na fila, próximos horários), etapas (roteiro/gancho → narração → edição →
  revisão → agendado → postado), calendário da semana, galeria de vídeos/thumbs, títulos e thumbnails (lista),
  comentários a responder (lista), análise de virais do nicho (tabela), checklist de validação, equipe, conversa.
- **jogo**: kpis (build, fases prontas, bugs abertos, playtests), etapas (conceito → protótipo → vertical slice →
  alpha → beta → lançamento), backlog de mecânicas (tabela), bugs (lista), galeria de artes/capturas, roadmap
  (linha_tempo), checklist, equipe, conversa.
- **programacao/site**: kpis (testes passando, deploy, PRs, erros), etapas (spec → código → testes → revisão →
  deploy), tabela de tarefas, linha_tempo de deploys, métricas externas (quando houver), checklist, equipe, conversa.
- **marketing/negocio**: kpis (leads, propostas, receita), funil (etapas), calendário de conteúdo, concorrentes
  (pesquisa), decisões, checklist, equipe, conversa.
- **outro**: kpis, etapas pelos setores do /auto, entregas, decisões, checklist, equipe, conversa.

## Testes do Diretor
`node site/teste_api.mjs`; `node --check` em todos os .js; `node site/csp.mjs`; `python ficha.py` no projeto
canais-dark (deve trazer `externo.central` sem segredos) e num projeto sem central; `python tema.py base jogo | python
tema.py validar -`; navegador local (`node site/dev.mjs`): andar sem tema → botão criar; com tema → andar decorado,
prédio colorido, dashboard completo a 375 px e 1280 px, editor salva/desfaz, console sem erros.
