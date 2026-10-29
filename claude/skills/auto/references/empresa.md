# A empresa do /auto

Sete setores. Cada um tem responsabilidade, ferramentas e entrega. O Diretor (você, Claude) coordena, decide e fala com o cliente (o usuário).

## Tamanho do pedido (equipe adaptativa)

Classifique no início:

- **Pequeno**: uma tarefa só, um arquivo, uma pergunta, um ajuste (ex.: "extrai o áudio", "corrige esse bug", "vinheta de 3 s"). → Setores em sequência, sem agentes paralelos. Pesquisa só se ajudar muito. **1 reunião** (a final) se nada for ambíguo.
- **Grande**: produto, app, site, campanha, vídeo completo, série de conteúdo, "o melhor possível", "analisar mercado". → Agentes em paralelo na Pesquisa e na Qualidade. **3 reuniões**.

## Setores

### 1. Diretoria
- Entende o pedido, define o objetivo, o público e o critério de "bem feito".
- Conduz as reuniões, registra decisões (`painel.py nota ... decisoes`).
- Ferramentas: `/grill-me:cs-grill-me` (quando o pedido é vago), `/superpowers:brainstorming` (ideias de produto/código), `/executive-mentor:stress-test` (validar plano grande).

### 2. Pesquisa de mercado
- O que já existe, quem faz bem, onde há espaço para ser melhor, o que o público quer.
- Entregas: 3 a 6 concorrentes (`painel.py conc`), achados (`painel.py nota ... pesquisa`), arquivo `pesquisa/relatorio.md` com fontes.
- Ferramentas, da mais leve para a mais pesada:
  - Busca web: `WebSearch`/`WebFetch` (carregue com ToolSearch), `mcp__exa__web_search_exa`, navegador `mcp__Claude_Browser__*`.
  - Vídeos de concorrentes/referências: `/watch:watch`.
  - Muitos documentos/código para entender: `python gpt.py ler "<o que levantar>" --cd <pasta>` (o GPT lê e resume; poupa o limite do Claude).
  - Skills: `/product-skills:competitive-teardown`, `/marketing-skills:competitor-alternatives`, `/pulse:cs-pulse` (tendências recentes em Reddit/HN/web), `/deep-research:cs-deep-research` (pesquisa rigorosa), `/research-ops-skills:cs-market-research`.
  - Dados de redes e sites (kit de 16/10/2026, seção KIT do rotas.md): Instagram, TikTok, YouTube e Google Maps com `/apify-ultimate-scraper` (precisa de `npx apify-cli login`); página com login ou JavaScript com `autocli read <url>` ou `opencli` (os dois precisam do Chrome do cliente aberto; sem ele, `playwright-cli`).
- **Pedido grande: dispare em paralelo (uma única mensagem com várias chamadas Agent)**:
  - Agente A (`general-purpose`): "Mapeie concorrentes diretos de <X>. Para cada um: link, proposta, pontos fortes, fracos, preço/modelo, e uma ideia de como superar. Cite fontes."
  - Agente B (`pulse:cs-pulse` ou `general-purpose`): "O que o público de <X> está pedindo/reclamando nos últimos 90 dias (Reddit, YouTube, X, fóruns). Cite fontes."
  - Agente C (`general-purpose`): "Referências de excelência em <X> (design, formato, qualidade). O que fazem que os outros não fazem."
  - Junte tudo em `pesquisa/relatorio.md` e no painel.

### 3. Criação
- Ideias, conceito, direção de arte, roteiro/estrutura e **protótipos visuais**.
- Protótipos (sempre mostrar ao usuário):
  - Telas de app, mockups, thumbnails, capas e posts: desenhe no FigCraft (MCP `figcraft`) e mostre o PNG exportado; página HTML como Artifact só para site de verdade ou quando o FigCraft não der conta (carregue a skill `artifact-design` antes). Registre com `painel.py proto`.
  - Vídeo: storyboard com quadros desenhados no FigCraft ou renderizados no EffectCraft (`render_frame`); `npx hyperframes snapshot` quando a composição for do HyperFrames.
  - Apps já rodando: screenshot com Playwright (`mcp__playwright__browser_take_screenshot`) ou `mcp__Claude_Browser__computer`.
- Imagens:
  - **Grátis (padrão), nesta ordem**: 1) os apps locais pelos MCPs: FigCraft (telas e posts), VectorCraft (vetor e logo), PhotoCraft (foto), DesignCraft (impressos); 2) se não derem conta: SVG/HTML/Canvas, quadros do HyperFrames/Remotion; fotos reais de acervo livre via `/get-brolls` (NASA, Wikimedia, Pexels/Pixabay se houver chave).
  - **Pagas (pedir "sim" antes, dizendo o que e quantas)**: `/muapi-nano-banana`, `/muapi-youtube-thumbnail`, `/muapi-instagram-post`, `/muapi-logo-creator`, `/muapi-ui-design`, `/ecc:fal-ai-media`.
- Ferramentas de direção: `/frontend-design`, `/ecc:frontend-design-direction`, `/hyperframes-creative`, `/marketing-skills:brand-guidelines`, `/ecc:brand-voice`, `/marketing-skills:copywriting`.
- **Produção visual primeiro nos apps locais (17/10/2026):** FigCraft (telas, mockups, posts), VectorCraft (logo, ícone, SVG), PhotoCraft (foto), DesignCraft (impressos), EffectCraft (motion), FilmCraft (vídeo fora do CapCut) e PdfCraft (PDF), pelos MCPs de mesmo nome. Os protótipos continuam sendo mostrados ao cliente como Artifact ou imagem: exporte o PNG do app e mostre. Ver "Regras de escolha" no SKILL.md.
- Do kit de 16/10/2026, como apoio: `/design-taste-frontend` ou `/impeccable` (direção e polimento de interface), `/diagram-design` (diagramas), DESIGN.md de marcas em `~/claude-repos/skills/awesome-design-md/design-md/`, canvas e storyboard de vídeo no BeatDesign (`beatdesign`, MCP `beatdesign`) e os outros Crafting Apps pela CLI (`lightcraft-cli`, `soundcraft-cli`, `wordcraft-cli`, `deckcraft-cli`, `cadcraft-cli`; seção KIT do rotas.md).

### 4. Produção
- Faz de verdade. Use `references/rotas.md` (vídeo V1–V11, programação P1–P8) e `buscar.py` para o resto.
- Código: método superpowers (plano → execução → TDD). Vídeo: projeto do CapCut termina no conector CapCut; vídeo que não é do CapCut, no FilmCraft (V12), com grafismo no EffectCraft (V4).

### 5. Qualidade
- Testa e revisa **antes** de mostrar. Nunca declare pronto sem prova.
- Código: testes (`/pw:generate`, testes unitários), `/ecc:code-review`, `/karpathy-coder:karpathy-check`, `/ecc:security-scan`, `/superpowers:verification-before-completion`.
- Vídeo: `capcut_validate` (projeto do CapCut) ou `render_preview`/`sequence_inspect` do FilmCraft; `/watch:watch` no MP4 final para checar ritmo, legenda e cortes; conferir duração e formato com `ffprobe`.
- Crítico: `/engineering-skills:adversarial-reviewer` (código) ou `/roast:cs-roast` (ideia/produto): procura o que está fraco.
- Segunda opinião de outro modelo: `python gpt.py revisar --cd <repo>` (código) ou `python gpt.py opiniao "<pergunta>" --arquivo <arq>` (plano, roteiro, texto). Achado do GPT só entra depois de confirmado por teste ou leitura.
- **Gerente (Opus), sempre por último:** `Agent` com `subagent_type: "Reality Checker"` e `model: "opus"` revisa todos os arquivos criados ou alterados (ver Etapa 5b do SKILL.md). Só entregue com APROVADO ou com as pendências ditas claramente ao cliente.
- **Pedido grande: em paralelo**, um agente revisor técnico e um agente crítico ("compare com os concorrentes do relatório: estamos iguais ou melhores? onde perdemos?").
- Registre cada verificação com `painel.py nota ... qualidade` (o que foi testado e o resultado).
- Se reprovar: volte para Produção, corrija e teste de novo (no máximo 3 voltas; depois leve o problema para o usuário).

### 6. Ferramentas
Quando nenhuma ferramenta instalada resolve bem uma etapa:
1. Procure: `gh search repos "<termo> claude skill|mcp" --sort stars --limit 10` e busca web.
2. Critérios para **instalar sozinho** (o usuário autorizou): ≥ 500 estrelas **ou** organização oficial do produto; atualizado nos últimos 12 meses; licença presente; o nome do pacote confere com o repositório (cuidado com imitações).
3. Leia o instalador e os scripts de hook antes. Recuse se: baixa e executa scripts de domínios desconhecidos, código ofuscado, envia dados/credenciais para terceiros, pede senha, desativa segurança, ou é `.exe` sem assinatura.
4. Instale pelo método oficial (plugin, `npx skills add`, `uv tool install`, `pip`, `npm`). Registre: `painel.py usa <pasta> ferramentas instalacao "<nome>" "<por quê>"`.
5. Atualize o catálogo: `python "<pasta da skill>/catalogo.py"`.
   - Antes de recomendar ferramentas de "economia de tokens" ou de multi-modelo, confira gpt-e-tokens.md: várias já foram medidas e descartadas.
6. Se o sistema de permissões bloquear, avise o usuário e siga com o que tem.
7. Repositórios novos seguem o kit de 16/10/2026: código em `~/claude-repos/skills|clis|apps`, lista e instalação em `~/claude-repos/install_all.sh` (`AUTO_DIR=~/claude-repos bash install_all.sh <etapa>`), skill nova com `npx skills add <dono/repo> -g -y -a claude-code`, registro numa linha da seção KIT do rotas.md (o `catalogo.py` lê dali) e atalho de CLI em `~/.local/bin` (versão bash e `.cmd`). O app Claude é MSIX: pasta nova em `AppData` fica no armazenamento virtual dele (detalhes na seção KIT).

### 7. Documentação
- Entrega final no chat e em `entregas/`: o que foi feito, onde está, o que ficou pendente.
- **Prompt final otimizado** em `prompt-final.md` (modelo abaixo). É a memória do projeto para o `/auto` ler sozinho: o cliente não copia nem cola prompt. No chat, mostre só o caminho e a frase "Para continuar, digite `/auto`".
- Pendências sempre numa seção `## Pendências` do LEIA-ME ou como `- [ ]` no prompt-final.md (o `projetos.py` lê dali).

## As 3 reuniões (pedido grande)

Use `AskUserQuestion` para escolhas objetivas e texto normal para discutir. Sempre traga uma recomendação. Registre com `painel.py nota ... reunioes`.

1. **Briefing** (depois de entender o pedido): objetivo, público, formato, prazo/tamanho, o que é "sucesso". Proponha 2–3 caminhos. Máximo 4 perguntas.
2. **Pesquisa + conceito** (depois da Pesquisa e da primeira Criação): mostre os concorrentes, o diferencial proposto e o conceito/protótipo inicial. Discuta ideias, peça escolhas.
3. **Protótipo** (antes da produção pesada ou antes da entrega): mostre o protótipo/versão testada, o relatório da Qualidade, e peça ajustes.

Entre reuniões, trabalhe sem parar, exceto nos casos de "Pare e pergunte" do SKILL.md.

## Modelo do prompt final (prompt-final.md)

```markdown
# Prompt otimizado: <título>

/auto <objetivo em uma frase, com formato, público e destino>

## Contexto
- Público: ...
- Plataforma/formato: ...
- Insumos: <caminhos, links, projetos>

## Referências e diferencial
- Concorrentes analisados: <nome (link)> ... 
- Fazer melhor em: ...
- Evitar: ...

## Decisões já tomadas
- ...

## Sequência recomendada de ferramentas
1. <setor> · `<comando>` · <o que passar como argumento>
2. ...

## Critérios de qualidade (só entregar quando todos passarem)
- [x] <critério que passou, com a prova>
- [ ] <só o que ainda falta: o /auto lê estes>

## Entregas esperadas
- ...
```

O prompt final deve permitir que o próprio /auto (digitando só `/auto`) repita ou melhore o trabalho numa sessão nova sem perder nada: caminhos absolutos, decisões, e a sequência exata de comandos que funcionou (e os que não funcionaram, com o motivo).
