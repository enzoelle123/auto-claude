# Especificação: andar mais vivo, pendências e ficha 2D (pedidos do andar 14, 28/10/2026)

Pedidos do cliente:
1. "Preciso que mostre o que tem que fazer de pendência e também revise e deixe esteticamente melhor, com os
   funcionários trabalhando mesmo e se mexendo."
2. "Quando clica no funcionário aparece ele em 2D e o que ele está fazendo e fez."

Mexa só em `site/public/andar.html`, `site/public/andar.js` (e `conversa.js` se precisar). Não mude a API nem contratos.
Mantenha: autenticação, polling de `/api/estado` (4 s, pausa com aba oculta), conversa, botão "Abrir central",
acessibilidade (foco, Esc fecha a ficha, `textContent` para todo texto vindo de dados), CSP (nada de script inline
novo; se mudar o importmap rode `node site/csp.mjs`), 375 px sem rolagem lateral.

## 1. Pendências visíveis
- Nova seção "Pendências" no topo da lista lateral (antes de "Funcionários"), com contador no título.
  Fonte: `floor.pendencias` (array de strings do mapa). Cada item: caixinha vazia ☐ + texto (remova crases do
  markdown, mostre `código` como `<code>` via DOM, nunca innerHTML com dados). Sem pendências: "Nenhuma pendência ✓".
- KPI novo no cabeçalho: "Pendências" com o número.
- Na cena 3D: um quadro de avisos (quadro branco na parede do fundo) com "Pendências: N" desenhado num CanvasTexture.

## 2. Estética e movimento (cena 3D do andar)
- Iluminação mais quente e suave (hemisphere + direcional com sombra suave se barato; sem pós-processamento pesado),
  piso com leve padrão de tábuas/carpete por CanvasTexture, plantas simples (vaso + esfera) nos cantos, luminária
  sobre cada mesa, monitor com tela emissiva que muda de cor quando digita.
- Bonecos mais bonitos: cabeça, cabelo (cor por setor), tronco, braços e pernas separados; cores por setor.
- Movimento contínuo e barato (um único rAF, pausa com aba oculta; limite ~30 fps quando ocioso):
  - sentado digitando: braços alternando, cabeça balançando de leve;
  - setor `ativo` ou com evento nos últimos 60 s: digita rápido + monitor pisca;
  - de tempos em tempos (8–20 s aleatório por boneco) um funcionário levanta, caminha até outra mesa ou até o
    quadro de pendências, "conversa" 2–3 s (balão "…") e volta à cadeira; pernas balançam ao andar;
  - contratados (bonecos extras) circulam mais.
- `prefers-reduced-motion: reduce` → sem caminhadas, só digitação lenta.

## 3. Ficha do funcionário com retrato 2D
- Ao tocar no boneco/mesa/item: a ficha abre com um **retrato 2D em SVG** gerado no JS (createElementNS, sem
  innerHTML): busto do funcionário (rosto, cabelo com a cor do setor, camisa com a cor do setor, crachá com o setor),
  com uma animação CSS leve (piscar os olhos / respirar). Ao lado: nome, cargo, status com selo colorido.
- Seção "Fazendo agora": último evento ao vivo ou, se não houver, o item mais recente de `mesas[setor]`;
  se nada, "Aguardando a próxima tarefa".
- Seção "Já fez": linha do tempo (até 15) com eventos ao vivo + `mesas[setor]`, cada item com ícone pelo tipo
  (gpt, agente, web, terminal, instalacao, chat…), hora quando houver.
- Seção "Ferramentas usadas" (chips) e botão "Pedir algo a este funcionário" (já existe; mantenha).
- No celular a ficha ocupa a tela como folha de baixo para cima; no desktop, painel lateral.

## 4. Testes que o Diretor vai rodar
- `node --check site/public/andar.js` e `node site/teste_api.mjs`.
- Navegador com `node site/dev.mjs` (senha local `teste123`): sem erros no console, pendências listadas, bonecos
  andando, ficha com retrato SVG, 375 px sem rolagem lateral.
