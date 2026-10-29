# Rotas do /auto

Rotas prontas, tiradas do Guia de Comandos. Cada rota lista as etapas em ordem. `→` significa "o resultado passa para a próxima etapa". Use só as etapas que o pedido precisa.

## Estado das ferramentas (pré-requisitos)

| Ferramenta | Estado | Pré-requisito / onde configurar |
|---|---|---|
| conector `capcut` | pronto | CapCut **fechado**. Modelo de texto configurado (`modelo-texto`): `capcut_add_text` funciona |
| conector `capcut-smartcut` | pronto | Projeto com **legendas automáticas** geradas no CapCut. Não faz backup: clonar antes |
| `/get-brolls` | pronto | YouTube, TikTok, Instagram, NASA, Commons sem chave. **Pixabay configurado e testado** (stock: use `--intent illustrative`). Pexels sem chave (emissão de chaves pausada pelo Pexels) |
| `/watch:watch` | pronto | Gemini configurada e testada (assiste vídeos mesmo sem legenda) |
| `/easyedits` | pronto | Gera SRT (CapCut importa) e XML (CapCut **não** importa) |
| `/video-use` e narração com voz | pronto | ElevenLabs testada, plano **free: 10.000 caracteres/mês**. Avise o usuário antes de narrações longas |
| `/remotion-*` | pronto | Node instalado; cada projeto baixa ~300 MB |
| `/hyperframes*`, `/media-use` | pronto | Node instalado |
| `/muapi-*` | pronto, **pago** | Chave salva. CLI: `~/.muapi-venv/Scripts/muapi.exe`. Sempre pedir "sim" antes de gerar |
| conector `ffmpeg` | pronto | Só `speed_up` e `extract_audio`; o resto via FFmpeg no terminal |
| MoneyPrinterTurbo | falta chave | Painel: `~/claude-repos/video/MoneyPrinterTurbo/.venv/Scripts/streamlit run webui/Main.py` (porta 8501); chave de IA + Pexels no painel |
| `graphify` | pronto | CLI `graphify` em `~/.local/bin` |
| GPT via `gpt.py` (Codex CLI 0.163.0) | pronto após `codex login` | Login com a conta ChatGPT do cliente (`python gpt.py status` mostra). Config em `~/.codex/config.toml` (perfil `auto-leitura`: só leitura, segredos negados). Se o WinGet atualizar o Node, o `gpt.py` (e o `reparos.py`) acham o Node novo mesmo com o app aberto (PATH antigo) e reinstalam sozinhos a versão testada `@openai/codex@0.163.0` (testado com Node simulado e PATH sem node/npm). Chamadas longas: Bash com `timeout: 600000` |
| `economia.py` | pronto | Funcionários fora do núcleo em `~/.claude/agents-reserva/`; backups em `~/.claude/backups/auto-economia/` |
| claude-mem | pronto (desde 16/10/2026) | Usa o **Claude Haiku na assinatura** a cada ferramenta (decisão do cliente). Precisa de: Bun (`~/.bun/bin/bun.exe`), `claude.exe` avulso logado (`claude auth login`), `CLAUDE_CODE_PATH` em `~/.claude-mem/settings.json` e chroma-mcp com pydantic<2.12 — tudo mantido por `reparos.py`. Injeta ~1,3 mil tokens no início de cada conversa (medido com 61 observações; usa as 50 mais recentes). `reparos.py` avisa se o `claude.exe` avulso perder o login. Painel: http://127.0.0.1:37777 |
| `reparos.py` | pronto | Roda na Etapa 0; reinstala o Codex se o Node mudar, religa o MCP `rea` ao Node novo (`rea-agents setup --client claude_code`, conferido antes com `--dry-run`; reinstala o `rea-agents` 6.5.0 se ele sumiu com o Node antigo), religa Bun e `claude.exe` do claude-mem, refaz as junctions `cpython-3.X` do uv no LocalCache do app (MSIX) e reinstala o chroma-mcp fixado. Testado em 17/10/2026 com casos simulados (sandbox no AppData que reproduz o bug do MSIX; `CLAUDE_CONFIG_DIR` isolado para o rea) e na máquina real (junction do 3.11 refeita; `uv venv --python 3.11` voltou). Backup da versão anterior: `~/.claude/backups/reparos.py.backup-20261017` |
| Kit de 16/10/2026 (`~/claude-repos/skills`, `clis`, `apps`) | pronto | Instalador `~/claude-repos/install_all.sh` (etapas `skills`, `clis`, `apps`, `build`; ajustes de Windows marcados `[ajuste]`), relatório `~/claude-repos/INSTALL_REPORT.md`, logs em `~/claude-repos/logs/`. Skill nova: `npx skills add <dono/repo> -g -y -a claude-code` (só no Claude Code, não no Codex). Tudo por categoria na seção **KIT** abaixo |
| `gws` 0.22.5 (Google Workspace) | falta login | O cliente roda `gws auth setup` (uma vez: cria o projeto no Google Cloud e faz login) e depois `gws auth login`. Instalado com `npm i -g @googleworkspace/cli` |
| skills `apify-*` (33) | falta login | O cliente roda `npx apify-cli login` (plano grátis com créditos mensais). Instagram (decisão de 16/10/2026): `/apify-ultimate-scraper` |
| `opencli` 1.8.8 | falta extensão | O cliente instala a extensão **OpenCLI** (Browser Bridge) no Chrome pela Chrome Web Store; ela usa o Chrome já logado |
| `autocli` 0.3.8, `playwright-cli` 0.1.22, `officecli` 1.0.157, `cli-hub` 0.4.1, `agents-cli` 1.10.0, `rea-agents` 6.5.0 | pronto | npm/uv globais (`autocli.exe` em `~/.local/bin`; `autocli read` e os sites com login só funcionam com o Chrome aberto). `agents-cli login` só para Google Cloud/AI Studio. `rea` registrado como MCP no `~/.claude.json` com o caminho do Node 24.19 fixo, sem Ghidra/IDA/JADX: se o WinGet trocar o Node, o `reparos.py` roda `rea-agents setup --client claude_code --yes` sozinho (o MCP volta numa sessão nova ou pelo `/mcp`) |
| VoxCPM, VibeVoice, YuE | pronto (modelo baixa no 1º uso) | Venv Python 3.12 com PyTorch CUDA 13.0 em `~/claude-repos/apps/<nome>/.venv` (testado: `torch.cuda.is_available()` = True). RTX 3060 de 6 GB: VoxCPM1.5 (~6 GB, inglês e chinês, 44,1 kHz) cabe e foi o testado; a CLI usa o VoxCPM2 (~8 GB, 30 idiomas com português, 48 kHz) se você não passar `--hf-model-id openbmb/VoxCPM1.5`, e ele aperta; YuE2 pede 24 GB e Linux. Os três venvs usam o Python 3.12 do uv, que mora no armazenamento virtual do app Claude: rodam dentro do Claude, não num terminal aberto por fora. Se o uv falhar com "Missing expected target directory", rode `python ~/.claude/skills/auto/reparos.py` (refaz a junction) ou passe o `python.exe` 3.12 pelo caminho completo (`~/AppData/Roaming/uv/python/cpython-3.12.14-windows-x86_64-none/python.exe`) |
| OpenWork, VoiceStudio, Voicebox, OpenCreator, ArtCraft | pronto, falta login/modelos | Instalados por usuário em `%LOCALAPPDATA%` (16/10/2026). Só o OpenWork é assinado; os outros 4 o cliente aprovou sem assinatura (SHA-256 conferido com o GitHub). Instaladores em `~/claude-repos/apps/_instaladores/` |
| Crafting Apps (13, storytold) | pronto; 7 com MCP (17/10) | MCPs `figcraft`, `vectorcraft`, `photocraft`, `designcraft`, `filmcraft`, `effectcraft` e `pdfcraft` (`--compact`) no escopo do usuário, conectados e testados em 19/10; são a primeira escolha do /auto (Regras de escolha do SKILL.md). Versão portátil oficial em `~/claude-repos/apps/<app>/bin/<app>-<versão>-windows-x64-portable/`: `<app>.exe` (interface) e `<app>-cli.exe` (sem interface: `commands`, `exec`, `run`, `export`) |

## VÍDEO

### V1. Editar gravação de fala (talking head) no CapCut
1. `capcut_list_drafts` → achar o projeto e checar se está travado.
2. `capcut_clone_draft` (base = projeto, novo = `<nome>-auto`).
3. `capcut-smartcut: smart_cut_project` na cópia (se não houver legendas: peça para gerar legendas automáticas no CapCut).
4. `capcut-smartcut: batch_edit_subtitles` → corrigir português.
5. (opcional) V3 para B-roll, V4 para grafismos.
6. `capcut_set_props` → zooms de retenção nas frases fortes (100%→115%, 1–2 s).
7. `capcut_validate` → `capcut_save`.

### V2. Montar um vídeo novo a partir de arquivos soltos, no CapCut
Só quando o vídeo vai para o CapCut (pedido cita CapCut ou o cliente finaliza lá). Fora disso: V12 (FilmCraft).
1. `capcut_clone_draft` (base = um projeto existente, `empty: true`).
2. `capcut_add_video` / `capcut_add_image` em ordem; `capcut_add_audio` para trilha (volume 10–20% sob fala).
3. `capcut_add_text` para títulos (se houver modelo de texto).
4. `capcut_validate` → `capcut_save`.

### V3. B-roll para um roteiro ou vídeo
1. Se só houver o vídeo: `/watch:watch <arquivo>` → obter transcrição com tempos.
2. `/get-brolls` com o roteiro/transcrição e a pasta do projeto → **pare para aprovação humana**.
3. Após entrega em `entrega/`: `capcut_add_video` de cada trecho numa faixa acima, no tempo da fala correspondente.

### V4. Grafismos, vinhetas, títulos animados, explicativos
1. EffectCraft primeiro (MCP `effectcraft`: `get_comp`, `set_property`, `add_keyframe`, `add_effect`, `render_frame` para conferir), com o mesmo briefing (duração, formato 9:16 ou 16:9, texto, estilo) → salve com `save_project` e gere o MP4 com `effectcraft-cli --project <arquivo.ecproj> render --comp <comp> --out <arquivo.mp4> --format h264`.
2. Se o EffectCraft não der conta (ex.: efeito pronto que só o registro tem): `/hyperframes` com o briefing completo; `/hyperframes-registry` para efeitos nomeados (glitch, grão, confete…).
3. Se for para o CapCut: `capcut_add_video` do MP4.
Alternativa só se pedirem React/Remotion: `/remotion-create` → `/remotion-render`.

### V5. Legendas
- No CapCut: gerar legendas automáticas lá + `batch_edit_subtitles` para corrigir.
- Arquivo SRT a partir de clipes: `/easyedits`.
- Fora do CapCut: FilmCraft (`captions.export` para SRT/VTT; legenda gravada no vídeo com `"burnCaptions":true` no `file.exportMedia`, ou arquivo ao lado com `"captionSidecar":"srt"`).
- Legenda animada estilo karaokê como vídeo: EffectCraft (texto animado com `add_keyframe`); se não der conta, `/hyperframes` (captions); `/remotion-captions` só se pedirem Remotion.

### V6. Analisar vídeos (referência, concorrente, autoanálise)
1. `/watch:watch <link ou arquivo>` (um por vídeo).
2. Síntese: ritmo, ganchos, cortes/min, sugestões aplicáveis.

### V7. Cortes curtos (Shorts/Reels) de um vídeo longo
- Grátis: `/watch:watch` para achar os melhores trechos → V12 no FilmCraft com os trechos (V2 se for para o CapCut; FFmpeg no terminal para um corte simples e reenquadrar 9:16).
- Pago (perguntar antes): `/muapi-youtube-shorts` ou `/muapi-ai-clipping`.

### V8. Vídeo inteiro automático a partir de um tema
- Sem CapCut (padrão): roteiro (`/youtube-full:youtube-full`) → grafismos no EffectCraft (V4) → montagem no FilmCraft (V12).
- Com CapCut: roteiro → EffectCraft (ou `/hyperframes`, ou MoneyPrinterTurbo) → V2.
- Direto: MoneyPrinterTurbo (se tiver chave) ou `/video-use` (se tiver chave).

### V9. Thumbnail, capa, post
- Grátis, primeiro: FigCraft (MCP `figcraft`: frame no tamanho da rede, texto, formas, imagem → `export` PNG/JPG com `ids` do frame); foto tratada no PhotoCraft e logo no VectorCraft antes de entrar no frame.
- Se não der conta: `/hyperframes` exportando um quadro, ou página HTML renderizada.
- Pago (perguntar): `/muapi-youtube-thumbnail`, `/muapi-instagram-post`.

### V12. Edição de vídeo fora do CapCut
1. FilmCraft (MCP `filmcraft`): `media_import` dos arquivos → `command_run` `file.newSequenceFromClip {"items":[<id do clipe>]}` (sem `items` ele pede um clipe selecionado) → editar com `command_run` (`command_list` mostra os comandos) → `render_preview` para conferir → `command_run` com `file.exportMedia {"path":"<saida.mp4>","format":"h264","wait":true}` (sem `wait` a chamada volta antes de o arquivo existir) (também hevc, ProRes, DNxHR, GIF). Legendas: `captions.export` (SRT, VTT). Projeto para outro editor: `file.exportFcpxml`, `file.exportEdl`, `file.exportAaf`.
2. Grafismo dentro do vídeo: V4 (EffectCraft).
3. Projeto que é ou vai para o CapCut: V1/V2 no conector `capcut`.

### V13. Estúdio: perfil no piloto automático (28/10/2026)
Referência: reels do @travaoscroll ("esse perfil se produz sozinho"). Mora na Central dos Canais (`~/auto-projetos/2026-10-22-canais-dark`, porta 8770, sala **Estúdio**).
- Acha o viral: `python ferramentas/viral.py <canal> [--usar 1]` (Hacker News, Reddit pelo RSS — o `.json` dá 403 —, Google Trends BR; títulos pelo modelo local). Com "viral do dia" ligado no canal, a `rotina_diaria.py` usa o viral em vez da próxima pauta (`--viral` força).
- Escreve, narra, anima: a rotina de sempre (GPT → checagem → VoxCPM2 → HyperFrames).
- Mede o próprio movimento: o Revisor chama `ferramentas/movimento.py` (trecho parado ≥ 1,6 s → zoom lento só ali; reprova se continuar parado). Vídeo aprovado à mão (aprovados.json) só é medido, não alterado.
- Posta: YouTube, TikTok e **Instagram** (`publicar.py postar <id> instagram`, navegador salvo `instagram-<canal>`, rótulo de IA obrigatório). O Instagram liga quando o perfil é preenchido na sala Estúdio.
- Comentou a palavra → direct: `ferramentas/dm.py` (API oficial da Meta, Private Replies; token do cliente via `dm.py configurar <canal>`, guardado em `central/meta/`). `dm.py material <id>` escreve "## Palavra-chave" + "## Material" no post (GPT, links só do roteiro).
- Métricas e tendência: `dm.py metricas` (seguidores/views/alcance pela API) e "▲ Crescendo" quando 2 de 3 sinais sobem em 7 dias.
- Manter o PC acordado: nunca / só na tomada / sempre (sala Estúdio).
- Kali: canal só-Instagram com os 6 reels do projeto kali-reels, **pausado** até o cliente ouvir o áudio e resolver a licença da voz.

### V10. Estratégia e roteiro de conteúdo
- `/youtube-full:youtube-full` (títulos, SEO, roteiro), `/video-content-strategist:video-content-strategist` (calendário), `/marketing-skills:social-content` (legendas de post).

### V11. Conversões rápidas
- Extrair áudio: `ffmpeg: extract_audio`. Acelerar: `ffmpeg: speed_up`.
- Comprimir, converter, recortar, reenquadrar: FFmpeg no terminal.

## PROGRAMAÇÃO

### P1. App ou funcionalidade nova
1. `/superpowers:brainstorming` (se a ideia estiver vaga; responda com o que o pedido já diz).
2. `/superpowers:writing-plans`.
3. `/superpowers:subagent-driven-development` (ou `executing-plans`).
4. Testes de site: `/pw:pw-init` → `/pw:generate`.
5. `/ecc:code-review` → `/superpowers:verification-before-completion`.
6. `/superpowers:finishing-a-development-branch`.
Atalho para MVP completo em um passo: `/ecc:orch-build-mvp`.

### P2. Bug
1. `/superpowers:systematic-debugging`.
2. Build/tipos quebrados: `/ecc:build-fix` (ou o específico: `/ecc:react-build`, `/ecc:go-build`…).
3. Teste de regressão → `/superpowers:verification-before-completion`.

### P3. Entender projeto existente
1. `/graphify .` (ou `graphify update .` no terminal).
2. Perguntas com base no grafo; `graphify explain` / `graphify path`.

### P4. Revisão e qualidade
- `/ecc:code-review` ou `/code-review`; `/karpathy-coder:karpathy-check`; `/simplify`; segunda opinião do GPT pela P7.
- Segurança: `/ecc:security-scan` ou `/security-review`.
- Cobertura: `/ecc:test-coverage`.

### P5. Site, landing page, front-end
- `/frontend-design` + `/landing:cs-landing` ou `/product-skills:landing-page-generator`.
- Auditoria: `/web-quality-audit`, `/performance`, `/seo`, `/accessibility`.
- Direção de arte sem "cara de IA": `/design-taste-frontend` (página pública) ou `/impeccable` (qualquer interface); limpeza final `/baseline-ui`; diagrama `/diagram-design`. "No estilo de <marca>": ler o DESIGN.md em `~/claude-repos/skills/awesome-design-md/design-md/` antes (seção KIT).

### P6. Sessão longa
- Salvar: `/ecc:save-session`; retomar: `/ecc:resume-session`; lembrar: `/claude-mem:mem-search` (memória automática, consertada em 16/10/2026) ou `search_session_transcripts`.
- Contexto pesando: `/compact` com foco ou `/clear` entre pedidos (gpt-e-tokens.md).

### P7. Segunda opinião e revisão com o GPT
1. `python gpt.py status` (login ok?).
2. Código: `python gpt.py revisar --cd <repo>` (ou `--base main`). Plano/texto: `python gpt.py opiniao "<pergunta>" --arquivo <arq>`.
3. Para cada achado: confirmar com teste ou leitura do código; descartar o que não se confirmar e dizer por quê.
4. Corrigir (só o Claude edita) → testar → registrar em `qualidade`.

### P8. Entender muito material gastando pouco
- `python gpt.py ler "<o que levantar>" --cd <pasta>` (cota do ChatGPT) ou funcionário `Explore` com `model: "haiku"`.
- Código: `/graphify .` ou MCP `serena` (símbolos) antes de abrir arquivos.

### P9. Modelo local (Ollama, 28/10/2026)
`python local.py "<pedido>" [--arquivo A] [--linhas N]` · `python local.py status`. Ollama 0.40.12 + `qwen3.5:4b` (3,3 GB) na RTX 3060: ~80 tokens/s, grátis, offline, sem cota. Use para títulos, resumos curtos, classificar e extrair; não para código grande, checagem de fatos ou decisão. O 1º uso carrega o modelo (~1 min). O Nanbeige 4.3 33B do reel não cabe (Q4_K_M = 20,8 GB; disco e VRAM insuficientes).

### P10. Caçador de clientes (7 agentes, 28/10/2026)
`python ~/auto-projetos/2026-10-22-missao-lucro-zero-custo/entregas/cacador/cacador.py --vendo "<o que vende>" --cliente "<tipos de empresa>" --cidade "<cidade>" [--bairro X] [--max 25] [--redator gpt|local|modelo]`.
Agentes: buscador (OpenStreetMap: Nominatim + Overpass com 3 servidores reserva) → visitante (lê o site) → triagem (o que falta: site, celular, Instagram, contato) → detetive (detalhe real copiado do site, conferido) → redator (GPT em lote, 1 chamada; local/modelo de reserva) → revisor anti-robô (lista negra, aberturas repetidas) → organizador (`leads.html/.csv/.md/.json`, botões Copiar/WhatsApp/E-mail que o cliente clica). **Nunca envia.** Venda o resultado, não a ferramenta (reel 4). Teste real: Batel, Curitiba, 8 empresas em ~1,5 min.

## KIT 16/10/2026: skills, CLIs e apps por categoria

Projeto `~/auto-projetos/2026-10-16-instalar-novas-skills-clis-apps-lista-in`. Skills: ferramenta Skill (`/nome`). CLIs: terminal (todas no PATH; atalhos novos em `~/.local/bin` com versão `.cmd`). Apps: `.exe` ou a CLI/MCP deles. As linhas `cli`, `app` e `referência` entram no catálogo do `buscar.py`. Fonte das escolhas de 17/10: site do Leo Pavezi (https://leo-pavezi-ia.leopvz.chatgpt.site), que indica ArtCraft, OpenCut e VectorCraft.

**MCP só com o app aberto:** `voicebox` (http://127.0.0.1:17493/mcp), `voicestudio` (http://localhost:3900/mcp) e `beatdesign` (http://127.0.0.1:3031/mcp, com `beatdesign` rodando). Abra o app e peça ao cliente para reconectar pelo `/mcp` (servidor de plugin ou de usuário só ele reconecta). Sempre conectados: `rea`, `cad` (plugin text-to-cad; falhava pelo bug do uv abaixo, consertado em 17/10 e conectado em 19/10) e os 7 Crafting Apps (`figcraft`, `vectorcraft`, `photocraft`, `designcraft`, `filmcraft`, `effectcraft`, `pdfcraft`), que rodam sem interface e ligam o motor só quando usados (sobem em menos de 1 s; 22 a 53 MB de memória cada, medido em 19/10). Confinamento de arquivos: VectorCraft, PhotoCraft e EffectCraft leem `{{HOME_WIN}}` e só gravam em `{{HOME_WIN}}\auto-projetos`; PdfCraft com `--root {{HOME_WIN}}`; FigCraft 0.6.0, DesignCraft e FilmCraft não aceitam confinamento. Para ver ao vivo seria preciso outro MCP ligado ao app aberto (ex.: `figcraft-cli mcp --attach 7979`, `vectorcraft-cli mcp --connect 127.0.0.1:7979`); não está configurado. O MCP `fal` do universal-modder falha sem `FAL_KEY` (pago). O plugin universal-modder instala um hook SessionStart que só põe a pasta `bin` dele no PATH (lido em 16/10: inofensivo).

**Ambiente do app Claude (MSIX):** o que ele grava como pasta nova em `AppData` (Pythons e ferramentas do uv, como graphify, serena, chroma-mcp, cli-hub e agents-cli) vai para o armazenamento virtual `%LOCALAPPDATA%\Packages\Claude_pzs8sxrjxfjjc\LocalCache` e só existe dentro do Claude. Bug do uv no Windows: "Missing expected target directory for Python minor version link" (astral-sh/uv#19622). Conserto (17/10): recriar a junction `cpython-3.X-windows-x86_64-none` com `mklink /J`, apontando para a pasta física no LocalCache; o `reparos.py` faz isso sozinho na Etapa 0. Volta a quebrar quando o uv instala ou atualiza um Python (ele recria a junction pelo caminho lógico); a rodada seguinte do `reparos.py` refaz e avisa "python-uv: junction refeita". Para instalar app que o cliente deve ver no Windows, use `/D=%LOCALAPPDATA%\Programs\<App>`.

### Design/UI
| Ferramenta | Tipo | O que faz | Quando usar | Como chamar |
|---|---|---|---|---|
| taste-skill (Leonxlnx) | skill | Direção de arte contra "cara de IA" para páginas públicas, com inspetor no navegador e estilos prontos | Landing, portfólio, página que precisa parecer desenhada | `/design-taste-frontend` (também `-v1` e `-v2-experimental`), `/gpt-taste`, `/high-end-visual-design`, `/minimalist-ui`, `/industrial-brutalist-ui`, `/redesign-existing-projects`, `/image-to-code`, `/imagegen-frontend-web`, `/imagegen-frontend-mobile`, `/brandkit`, `/stitch-design-taste`, `/full-output-enforcement` |
| impeccable (pbakaus) | skill | Desenha, critica, audita e dá polimento em qualquer interface | Revisão de UX/UI, refino visual, DESIGN.md | `/impeccable` |
| ui-skills (ibelick) | skill | Limpeza rápida de UI e correções pontuais | Polimento final, acessibilidade, metadados, animação travando | `/baseline-ui`, `/improve-ui`, `/fixing-accessibility`, `/fixing-metadata`, `/fixing-motion-performance`, `/component-canvas`, `/create-design-md` |
| stitch-skills (Google Labs) | skill | Fluxos do Google Stitch: gerar telas, design system, código para design | As `stitch-*` só com o MCP do Stitch (não instalado); `/shadcn-ui` e `/enhance-prompt` funcionam sem | `/stitch-generate-design`, `/stitch-code-to-design`, `/design-md`, `/enhance-prompt`, `/shadcn-ui`, `/react-vite-dashboard`, `/site-md`, `/stitch-loop`, `/taste-design` |
| diagram-design (cathrynlavery) | skill | Diagramas e gráficos com marca em HTML, SVG e PNG | Explicar sistema ou processo com figura | `/diagram-design` |
| agent-skills (Vercel) | skill | Regras de interface e de React da Vercel | Revisar UI e código React/Next | `/web-design-guidelines`, `/vercel-react-best-practices`, `/vercel-composition-patterns`, `/vercel-react-view-transitions`, `/vercel-react-native-skills` |
| awesome-design-md | referência | 84 DESIGN.md de marcas conhecidas (cores, tipos, componentes) | Pedido "no estilo de <marca>": ler antes de desenhar | `~/claude-repos/skills/awesome-design-md/design-md/<marca>/` |
| Astryx (Meta) | referência | Design system React 19 pronto para agentes | Projeto React novo que precisa de componentes | No projeto: `npm install @astryxdesign/core @astryxdesign/theme-neutral @stylexjs/stylex` (código em `~/claude-repos/apps/astryx`) |

### Automação web e scraping
| Ferramenta | Tipo | O que faz | Quando usar | Como chamar |
|---|---|---|---|---|
| Apify (agent-skills + awesome-skills) | skill | 33 skills com Actors da Apify: Instagram, TikTok, YouTube, Google Maps, Reddit, anúncios, e-commerce, vagas, leads | Coletar dados públicos de redes e sites (antes: `npx apify-cli login`) | Instagram: `/apify-ultimate-scraper` (perfis, posts, reels, hashtags, comentários) e `/apify-influencer-brand-collabs`; outros: `/apify-google-maps-leads`, `/apify-reddit-scraper`, `/apify-ads-intelligence`, `/apify-creator-emails`, `/apify-ecommerce`, `/apify-easy-competitive-intelligence` |
| playwright-cli | cli | Navegador por comandos (abrir, clicar, preencher, print), com skill própria | Tarefas e testes web gastando pouco contexto | `playwright-cli --help` ou `/playwright-cli` |
| OpenCLI | cli | Transforma sites em comandos usando o Chrome logado (1.222 comandos) | Ler, buscar ou postar em sites com login (precisa da extensão Browser Bridge) | `opencli --help`; skills `/opencli-usage`, `/opencli-browser`, `/smart-search` |
| AutoCLI | cli | Versão em Rust: mais de 55 sites (Reddit, X, YouTube, Instagram, HN) e `read <url>` vira Markdown | Pegar conteúdo de site rápido, inclusive página com JavaScript (só com o Chrome aberto: usa a sessão dele; sem Chrome, use `playwright-cli`) | `autocli --help`, `autocli read <url>` ou `/autocli` |
| CLI-Anything | cli | Catálogo de CLIs prontas para controlar programas (GIMP, Blender, LibreOffice, QGIS) | Automatizar um programa de desktop pelo terminal | `cli-hub --help` ou `/cli-hub-meta-skill` |

### Google Workspace e Office
| Ferramenta | Tipo | O que faz | Quando usar | Como chamar |
|---|---|---|---|---|
| gws | cli | Drive, Gmail, Agenda, Planilhas, Docs, Slides, Forms e Tasks por linha de comando (saída JSON) | Ler ou escrever no Google do cliente (antes: `gws auth setup` e `gws auth login`, feitos por ele) | `gws --help`; skills `/gws-shared`, `/gws-gmail-triage`, `/gws-gmail-send`, `/gws-drive-upload`, `/gws-sheets-read`, `/gws-calendar-agenda`, `/gws-workflow-meeting-prep` (21 instaladas; as outras 74 em `~/claude-repos/clis/cli/skills`, instalar com `npx skills add googleworkspace/cli --skill <nome> -g -y -a claude-code`) |
| OfficeCLI | cli | Cria, revisa e edita Word, Excel e PowerPoint sem o Office | Gerar ou alterar .docx, .xlsx e .pptx (relatório, planilha, deck) | `officecli --help`; skill `/officecli`; regras especiais com `officecli load_skill <nome>` (`word`, `word-form`, `excel`, `pptx`, `pitch-deck`, `data-dashboard`, `financial-model`, `academic-paper`, `morph-ppt`, `morph-ppt-3d`) |

### Voz/áudio
| Ferramenta | Tipo | O que faz | Quando usar | Como chamar |
|---|---|---|---|---|
| VoxCPM (OpenBMB) | app | Voz (TTS) e clonagem, local; VoxCPM1.5 (inglês e chinês, cabe em 6 GB) ou VoxCPM2 (30 idiomas com português, ~8 GB) | Narração grátis sem o limite de 10 mil caracteres do ElevenLabs | `voxcpm design --hf-model-id openbmb/VoxCPM1.5 --text "<texto>" --output <saida.wav>` (testado); português: trocar por `openbmb/VoxCPM2`, que aperta na GPU de 6 GB |
| VibeVoice (Microsoft) | app | Voz em tempo real (0.5B) e transcrição (ASR) | Narração rápida em inglês ou transcrição | `vibevoice-tts --txt_path <arquivo.txt> --speaker_name Carter` |
| YuE2 | app | Música com letra e voz, estilo Suno | Só com GPU de 24 GB (aqui são 6 GB): evite | `yue2 doctor` e `yue2 generate --help` |
| VoiceStudio | app | Estúdio local de voz (alternativa ao ElevenLabs) com API REST e MCP | Clonar voz, narrar, dublar ou transcrever com o app aberto | `%LOCALAPPDATA%\Programs\VoiceStudio\VoiceStudio.exe`; skill `/voicestudio`; MCP `voicestudio`; API http://localhost:3900 |
| Voicebox | app | Estúdio de voz (clonar, ditar, criar) com MCP | Falar texto numa voz clonada ou transcrever, com o app aberto | `%LOCALAPPDATA%\Programs\Voicebox\voicebox.exe`; MCP `voicebox` (voicebox_speak, voicebox_transcribe) |

### Vídeo
| Ferramenta | Tipo | O que faz | Quando usar | Como chamar |
|---|---|---|---|---|
| BeatDesign (BeatAPI) | app | Canvas infinito e linha do tempo para imagem e vídeo, local, com 29 ferramentas MCP e render de MP4 | Montar storyboard, canvas e edição de vídeo junto com o agente; gerar mídia só com chave BeatAPI (paga) | `beatdesign` (sobe http://127.0.0.1:3020 e o MCP); skill e MCP do plugin `beatdesign` |
| OpenCreator (ex-KrillinAI) | app | Traduz e dubla vídeos (legenda e voz) | Versão de um vídeo em outro idioma | `%LOCALAPPDATA%\Programs\OpenCreator\OpenCreator.exe` (usa o login do Codex/ChatGPT) |
| OpenCut | app | Editor de vídeo aberto tipo CapCut | Edição simples no navegador, sem instalar (a versão local em Rust não foi compilada) | https://opencut.app (código em `~/claude-repos/apps/OpenCut`) |
| watch-cli | referência | Frames e transcrição de vídeos sociais pela API paga da Kyma | Pulado (decisão de 16/10/2026): use `/watch:watch` | Código em `~/claude-repos/clis/watch-cli` |

### Apps criativos (Crafting Apps)
**Primeira escolha do /auto** (decisão do cliente em 17/10/2026): FigCraft, VectorCraft, PhotoCraft, DesignCraft, FilmCraft, EffectCraft e PdfCraft, pelos MCPs de mesmo nome (veja as Regras de escolha do SKILL.md). Os outros (ArtCraft, LightCraft, SoundCraft, WordCraft, DeckCraft, CadCraft) entram pela CLI quando os sete não derem conta. Cada um tem a interface (`<app>.exe`) e uma CLI sem interface (`<app>-cli`), mas os subcomandos mudam de app para app: veja `<app>-cli --help` antes. Exemplos testados: `vectorcraft-cli run --cmd ... --export`, `filmcraft-cli export`, `effectcraft-cli --project x.ecproj render --out x.mp4`, `pdfcraft-cli tools` e `text/combine/extract`. Para falar com o app aberto, cada um usa uma opção própria (`--bridge` no FilmCraft, EffectCraft e PhotoCraft; `--connect` no VectorCraft e DesignCraft; `--attach` no FigCraft). Pasta: `~/claude-repos/apps/<app>/bin/<app>-<versão>-windows-x64-portable/`.

| Ferramenta | Tipo | O que faz | Quando usar | Como chamar |
|---|---|---|---|---|
| ArtCraft | app | Motor de criação de arte e cenas com IA para artistas e cineastas | Arte e composição com IA, com interface | `%LOCALAPPDATA%\Programs\ArtCraft\artcraft.exe` |
| FigCraft | app | Design de interface e protótipo, tipo Figma (MCP `figcraft`) | Tela de app ou site, mockup, post e thumbnail com layout | MCP `figcraft` (`create_node` com `parent` = id do frame, `export` com `ids`); CLI `figcraft-cli`; código em `~/claude-repos/apps/figcraft` |
| PhotoCraft | app | Editor de fotos (MCP `photocraft`) | Retoque, recorte e montagem de imagem | MCP `photocraft` (`doc_new`/`doc_open` → `command_run` → `doc_save`; caminhos relativos a `{{HOME_WIN}}`, a raiz de leitura e escrita); CLI `photocraft-cli commands` |
| VectorCraft | app | Arte vetorial (MCP `vectorcraft`) | Logo, ícone, ilustração em vetor (o site do Leo traz um guia para analisar o código e aplicar numa gráfica) | MCP `vectorcraft` (`draw_shape`, `add_text`, `set_paint`, `export`); CLI `vectorcraft-cli run ... --export arte.svg` |
| DesignCraft | app | Diagramação de páginas (MCP `designcraft`) | Folheto, revista, cartaz, peça impressa | MCP `designcraft` (`new_document` → `execute frame.create` → `render_page` → `export_png`); CLI `designcraft-cli commands` |
| FilmCraft | app | Editor de vídeo não linear (MCP `filmcraft`) | Montar e exportar vídeo fora do CapCut (h264, ProRes, GIF), legendas SRT/VTT | MCP `filmcraft` (`media_import`, `command_run file.exportMedia`); CLI `filmcraft-cli export <saida.mp4>` |
| LightCraft | app | Revelação de fotos não destrutiva | Ajuste de cor e luz em lote | `lightcraft-cli commands` |
| EffectCraft | app | Motion graphics e composição (MCP `effectcraft`) | Vinheta, efeitos e grafismos em vídeo | MCP `effectcraft` (`comp.new`, `layer.newText`, `add_keyframe`, `effect.apply`); MP4 com `effectcraft-cli --project <x.ecproj> render --out <x.mp4>` |
| PdfCraft | app | Leitor e editor de PDF (MCP `pdfcraft`, modo compacto) | Ler, editar, juntar, dividir, formulário, OCR, assinar, tarjar | MCP `pdfcraft` (`doc_open`, `text_extract`, `doc_combine`; o resto por `tool_search` e `tool_call`); CLI `pdfcraft-cli tools` e `pdfcraft-cli text/combine/extract` |
| SoundCraft | app | Áudio multipista (tipo Pro Tools) | Mixar trilha, voz e efeitos | `soundcraft-cli commands` |
| WordCraft | app | Editor de texto (tipo Word) | Documento com interface própria | `wordcraft-cli commands` |
| DeckCraft | app | Apresentações | Slides com interface própria | `deckcraft-cli commands` |
| CadCraft | app | CAD e desenho técnico 2D | Planta e desenho técnico | `cadcraft-cli commands` |
| text-to-cad (plugin) | skill | Modelos 3D (STEP, GLB, STL, 3MF), desenho técnico, checagem para fabricação; MCP `cad` | Peça para impressão 3D, CNC ou chapa | `/text-to-cad:cad`, `/text-to-cad:engineering-drawing`, `/text-to-cad:dfm`, `/text-to-cad:gcode` |

### Engenharia reversa
| Ferramenta | Tipo | O que faz | Quando usar | Como chamar |
|---|---|---|---|---|
| find-reverse-engineered | skill | Busca em mais de 12 mil projetos abertos que falam com apps, APIs, formatos e aparelhos fechados | Algo sem API oficial (cliente não oficial, formato .psd ou .dwg) | `/find-reverse-engineered` |
| REA (rea-agents) | cli | Engenharia reversa de executáveis, apps Electron/JS, APK, firmware e páginas, com MCP `rea` | Entender como um programa faz algo, comparar versões, descompilar | `/reverse-engineer-anything` ou `rea-agents --help` (Ghidra, IDA e JADX não instalados) |
| universal-modder (plugin) | skill | Mods de jogos: reconhecimento do motor, engenharia reversa, teste no jogo e vídeo | Modificar um jogo do cliente (assets pelo fal, pago) | `/universal-modder:mod-any-game`, `/universal-modder:game-recon`, `/universal-modder:reverse-engineering` |

### Skills de engenharia
| Ferramenta | Tipo | O que faz | Quando usar | Como chamar |
|---|---|---|---|---|
| agent-skills (Addy Osmani) | skill | 25 skills do ciclo: especificar, planejar, fatiar, TDD, depurar, revisar, segurança, desempenho, lançamento | Método passo a passo (alternativa ao superpowers: não misturar os dois na mesma etapa) | `/spec-driven-development`, `/planning-and-task-breakdown`, `/incremental-implementation`, `/test-driven-development`, `/debugging-and-error-recovery`, `/code-review-and-quality`, `/security-and-hardening`, `/performance-optimization`, `/shipping-and-launch`, `/doubt-driven-development` |
| skills (Matt Pocock) | skill | 38 skills: TDD, diagnóstico, interrogar plano, spec, tickets, protótipo, arquitetura, PR, handoff, escrita para agentes | Projetos TypeScript e planejamento | O Claude chama: `/tdd`, `/diagnosing-bugs`, `/grilling`, `/prototype`, `/codebase-design`, `/domain-modeling`, `/pr`, `/research`, `/wizard`, `/writing-for-agents`, `/git-guardrails-claude-code`. Só o cliente digita (o autor marcou `disable-model-invocation`): `/to-spec`, `/to-tickets`, `/implement`, `/improve-codebase-architecture` e outras 19; o Diretor pode segui-las lendo `~/.claude/skills/<nome>/SKILL.md` |
| Vercel (deploy) | skill | Deploy, tokens e custo na Vercel | Publicar ou otimizar na Vercel (Kali: só PR; quem publica é o dono) | `/deploy-to-vercel`, `/vercel-cli-with-tokens`, `/vercel-optimize`, `/writing-guidelines` |
| skills (Vercel) | cli | Instala, procura, lista e atualiza skills de agentes | Acrescentar skill nova ao /auto | `npx skills add <dono/repo> -g -y -a claude-code`, `npx skills ls -g`, `npx skills update -g`; skill `/find-skills` |
| agents-cli (Google) | cli | Cria, avalia e publica agentes ADK no Google Cloud, com 7 skills | Construir agente com ADK e Gemini (login: `agents-cli login`) | `agents-cli --help` ou `/google-agents-cli-workflow` |
| OpenWork | app | Alternativa aberta ao Claude Cowork: agentes trabalhando nos arquivos | Cliente quer outro app de agentes ou outro modelo | `%LOCALAPPDATA%\Programs\@openworkdesktop\OpenWork.exe` |
| Guia VectorCraft (Leo Pavezi) | referência | Prompt para uma IA investigar um repositório aberto e dizer como aplicá-lo num negócio, separando o que foi testado do que é hipótese | Avaliar se um projeto aberto serve para um cliente antes de instalar | https://leo-pavezi-ia.leopvz.chatgpt.site/vectorcraft |

Nomes repetidos (instalados por decisão de 16/10/2026): `code-review` (Matt Pocock), `grill-me`, `grill-with-docs`, `handoff`, `chief-of-staff`, `research`, `test-driven-development` e `karpathy-guidelines` também existem como plugin (`plugin:nome`) ou no próprio Claude Code. Chame a versão com prefixo quando quiser a do plugin; as do Matt Pocock `grill-me`, `grill-with-docs`, `handoff` e `chief-of-staff` são só para o cliente digitar, então o Claude usa a do plugin. A skill `dev` só serve para manter o repositório do playwright-cli: ignore.

## OUTROS

- Marketing/redes: `/marketing-skills:*` (use buscar.py).
- Pesquisa aprofundada: `/deep-research:cs-deep-research`, `/research:cs-research`.
- Documentos: `anthropic-skills:docx`, `pdf`, `pptx`, `xlsx`.
- Qualquer outra coisa: `buscar.py`.
