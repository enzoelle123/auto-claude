---
name: auto-predio-3d
description: Prédio 3D do /auto (um andar por projeto) é a memória-mapa e o canal do celular; GPT cria via gpt.py criar
metadata:
  node_type: memory
  type: project
  originSessionId: dc9a7418-fabf-490b-96a2-3bd6a237d158
  modified: 2026-10-28T22:38:43.343Z
---

Desde 27/10/2026 o /auto tem um prédio 3D: https://claude.ai/artifact/12QYQ94LqZP8RjaTyHnEpn. Os arquivos ficam em `~/auto-projetos/_predio` (predio.html, mapa.json, mapa.md, link.txt) e o gerador em `~/.claude/skills/auto/predio/`. O auto.py regenera tudo no início de cada /auto.

- Cada andar tem dois botões. "Perguntar" usa `sample`. "Pedido" grava na coleção `pedidos` do db, que se lê com ArtifactData no início do /auto.
- Para republicar, use o mesmo file_path sem `capabilities`, para manter sample, db e user.
- O GPT escreve código com `gpt.py criar --cd <pasta em ~/auto-projetos>`, pelo perfil Codex `auto-escrita` (extends `:workspace`). Pastas que começam com `_` são recusadas.

v2 (27/10/2026): site **https://predio-auto.vercel.app** (time Vercel kali-acab, com aceite do cliente; senha própria; Upstash grátis). auto.py manda o mapa e lista "pedidos do site"; responder com `predio/ponte.py status <id> feito "<resposta>"`; painel.py manda cada ação ao vivo. Config do PC em `~/.config/predio-ponte.json`. Central dos Canais pela Tailscale (tailnet only): https://desktop-0lndd24.tail95cf23.ts.net, central.json no projeto; após reiniciar o PC, abrir a Central pelo atalho. Admins do time Kali veem os segredos: pedido do site que pede ação externa exige confirmação no chat.

Desde 28/10/2026 a tarefa agendada `predio-pedidos` (a cada 30 min, modo Bypass, ~/.claude/scheduled-tasks/predio-pedidos/SKILL.md) lê os pedidos novos, executa junto ao GPT, responde no andar e por push; ações externas (postar, enviar, comprar, apagar) param e pedem confirmação. Não ligar outro vigia no chat ao mesmo tempo (atenderia em dobro). Atalho no Inicializar do Windows liga a Central oculta.

v3 (28/10/2026): botão "Criar ambiente visual" por andar → pedido `[tema]` → tarefa gera `<projeto>/tema.json` com o GPT → andar decorado + `dash.html?pasta=<pasta>`. Peças em predio/: ficha.py (filtro de segredos + miniaturas WEBP), tema.py, fontes/central_canais.py, sincronizar.py (site vence o PC, backup datado). Spec: auto-projetos/2026-10-27-predio-3d-auto-v2/spec-temas.md. Armadilha: heredoc do Bash come barras invertidas — editar caminhos Windows com a ferramenta Edit ou chr(92).

**Why:** o cliente quer acompanhar e pedir coisas pelo celular sem abrir o PC, gastar menos tokens com memória em mapa e sempre trabalhar "junto ao GPT": o Claude idealiza e valida, o GPT cria.

**How to apply:** em todo /auto, ler o mapa.md antes de buscar chats, tratar os pedidos `novo` e delegar a criação de código ao GPT com uma spec. Se a cota do GPT acabar, o Claude faz e avisa. Relacionado: [[auto-gpt-e-economia]], [[auto-sem-prompt]].
