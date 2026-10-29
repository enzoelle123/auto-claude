# Especificação v2: Prédio /auto na Vercel, ao vivo, com fila de pedidos e centrais (Diretor: Claude · Dev: GPT)

Base pronta (v1, leia antes): `{{HOME_WIN}}\.claude\skills\auto\predio\template.html` (torre 3D three.js 0.186.1) e
`predio.py` (gera mapa.json). Pasta de trabalho v2: `{{HOME_WIN}}\auto-projetos\2026-10-27-predio-3d-auto-v2\`.

## Decisões do cliente
- Site na Vercel (conta já logada no CLI), acessível de qualquer lugar, **protegido por senha própria**.
- **Funcionários trabalhando ao vivo**: cada ação do /auto (e das centrais) aparece em segundos; os bonecos reagem.
- **Falar**: cada andar tem "Mandar pedido" → fila no servidor; o PC (/auto) lê e executa. Conversa ao vivo é pelo
  app Claude (Remote Control), fora do site: só um aviso/atalho informativo.
- **Centrais** (ex.: Central dos Canais, app local em http://127.0.0.1:8770): acesso total pela **Tailscale** (rede privada).
  O andar que tem central mostra o botão "Abrir central" com a URL da tailnet.
- Banco: **Upstash Redis** (grátis, criado pela Vercel Marketplace), acessado só por REST com `fetch`.

## Parte A — `site/api/*.js` e `site/vercel.json` (Node 20+, ESM, **sem dependências npm**)
Variáveis de ambiente: `SENHA_SITE`, `SEGREDO_SESSAO` (HMAC), `TOKEN_PC` (Bearer do PC), e as do Upstash
(`KV_REST_API_URL`/`KV_REST_API_TOKEN` ou `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN`: aceite as duas).
Um módulo `site/api/_lib.js` (o `_` evita virar rota) com: redis(cmd...) via REST (pipeline quando útil), leitura de JSON
com limite de tamanho, resposta JSON com `Cache-Control: no-store`, verificação de sessão (cookie `sessao` =
`<expira>.<hmac-sha256>`, comparação em tempo constante), verificação de Bearer `TOKEN_PC` (tempo constante),
e checagem de `Origin` igual ao host em todo POST/PUT/PATCH com cookie.
Rotas:
- `POST /api/login` `{senha}` → compara com `SENHA_SITE` em tempo constante; limite 5 tentativas/15 min por IP
  (`x-forwarded-for`, chave no Redis com EXPIRE); sucesso: cookie HttpOnly, Secure, SameSite=Strict, Path=/, 30 dias.
  `POST /api/logout` apaga o cookie. `GET /api/sessao` → 200 `{ok:true}` ou 401.
- `GET /api/mapa` (cookie) → o mapa guardado. `PUT /api/mapa` (Bearer) grava o mapa.json enviado (≤ 300 KB).
- `GET /api/estado` (cookie) → `{eventos: últimos 60, agora: ISO}`. `POST /api/estado` (Bearer) recebe um evento
  `{pasta, setor, tipo, nome, motivo, hora}` (strings, cortar cada campo em 200 chars) → LPUSH + LTRIM 200.
- `GET /api/pedidos?pasta=X` (cookie) → pedidos daquela pasta (mais novos primeiro, até 50).
  `POST /api/pedidos` (cookie) `{pasta, andar, texto (1–2000 chars)}` → id = timestamp+aleatório, `status:"novo"`, `criado`;
  limite 30 pedidos/hora por sessão. `GET /api/pedidos?status=novo` (Bearer) → todos os novos.
  `PATCH /api/pedidos` (Bearer) `{id, status: "em andamento"|"feito"|"recusado", resposta?}`.
  Guardar cada pedido como hash/JSON por id + um ZSET por data; nunca guardar a senha.
- `vercel.json`: cabeçalhos de segurança em tudo (`Content-Security-Policy` permitindo só self + `https://cdn.jsdelivr.net`
  para scripts/módulos, `frame-ancestors 'none'`, `X-Content-Type-Options nosniff`, `Referrer-Policy no-referrer`).
- Teste local: um `site/teste_api.mjs` que importa os handlers e simula req/res com um Redis falso em memória
  (variável `REDIS_FALSO=1` no `_lib.js`), cobrindo: login certo/errado/limite, rotas sem sessão = 401, Bearer errado = 401,
  pedido criado e listado, PATCH muda status, Origin diferente = 403. Rode com `node site/teste_api.mjs`.

## Parte B — `site/public/index.html` (o prédio, adaptado do template v1)
- Mesma torre, mesmo visual e interações da v1 (seleção de andar, explosão, mesas, painel lateral/gaveta, 375 px).
- **Sem dados embutidos**: ao abrir, `GET /api/sessao`; 401 → tela de senha (campo, botão Entrar, mensagem de erro e de
  limite); sucesso → `GET /api/mapa` e monta o prédio. Botão "Sair" no topo.
- **Ao vivo**: polling de `/api/estado` a cada 4 s (pausar com a aba oculta, `visibilitychange`). Para cada evento novo:
  o boneco da mesa daquele setor, no andar daquela pasta, ganha um balão (`tipo · nome`, até 8 s), o monitor pisca e ele
  "digita"; se o evento for de um andar diferente do selecionado, o andar pisca uma luz na fachada. Faixa "Ao vivo" no rodapé
  com os 5 últimos eventos (hora, andar, setor, nome, motivo). Bonecos de setores `ativo` digitam o tempo todo; os ociosos
  respiram de leve; ao receber evento de `agente`, um segundo boneco (o funcionário contratado) aparece ao lado da mesa por
  20 s. Animação só enquanto houver algo acontecendo (render sob demanda nos outros momentos).
- **Pedidos por andar**: formulário (textarea + Enviar) que faz POST `/api/pedidos`; lista dos pedidos do andar com status
  (novo, em andamento, feito, recusado) e `resposta` quando houver; atualiza junto com o polling quando o andar está aberto.
- **Central**: se o andar tiver `central: {nome, url}` no mapa, botão "Abrir central: <nome>" (abre em nova aba, `rel=noopener`)
  com nota "funciona com a Tailscale ligada no celular".
- Aviso fixo discreto: "Conversa ao vivo: app Claude → Remote Control".
- Texto sempre por `textContent` (nunca innerHTML com dados). Sem `window.claude`.

## Parte C — `ponte.py` (pasta v2) e ajuste no `predio.py`
- `ponte.py` (Python 3.13, só stdlib, `urllib`, timeout 4 s, nunca levanta exceção para quem chama): lê
  `{{HOME_WIN}}\.config\predio-ponte.json` `{"url": "https://...", "token": "..."}` (não imprimir o token).
  Comandos: `mapa <arquivo mapa.json>` (PUT), `evento <pasta> <setor> <tipo> <nome> <motivo>` (POST, hora = agora),
  `pedidos` (lista os novos em texto curto: `id | andar | pasta | texto(200)`), `status <id> <status> [resposta]` (PATCH).
  Sem config ou sem rede: imprime uma linha `ponte: desligada (...)` e sai com código 0 (evento) ou 1 (outros).
- `predio.py` (copie da v1 para a pasta v2 e altere): se `<pasta do projeto>/central.json` existir (`{"nome", "url"}`),
  incluir `central` no andar. Tolerar arquivo inválido.

## Testes do Diretor
`node site/teste_api.mjs` passa; deploy na Vercel; login com senha; 401 sem sessão; `ponte.py evento` faz o boneco reagir
em ≤ 5 s; pedido criado no celular aparece em `ponte.py pedidos`; botão da central aparece no andar dos canais dark.
