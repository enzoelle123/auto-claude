---
name: auto-repo-github
description: Repositório privado enzoelle123/auto-claude (29/10/2026) com o /auto inteiro e instalador automático; como atualizar
metadata:
  node_type: memory
  type: project
  originSessionId: dc8585c9-d8ac-4a30-84ea-778475c91168
  modified: 2026-10-29T14:41:35.312Z
---

Em 29/10/2026 o /auto virou o repositório **privado** https://github.com/enzoelle123/auto-claude, com cópia local em `~/Projetos/auto-claude`. Ele leva skills, funcionários e reserva, ganchos, tarefa predio-pedidos, settings (107 plugins), MCPs, perfis do Codex, memória `auto-*` e site do prédio. O kit vai como `kit/repos.txt` (96 repositórios com commit fixado).

- Para instalar num PC novo: `python ferramentas/instalar.py` (`--completo` inclui os apps pesados). Ele junta as configurações sem apagar nada e faz backup. O `CLAUDE.md` do repositório ensina a IA a fazer tudo sozinha.
- Para atualizar o repositório: `python ferramentas/exportar.py && python ferramentas/verificar.py`, depois commit e push.

**Why:** o cliente quer que, em qualquer PC, baste pedir à IA "baixe o /auto".

**How to apply:**
- Funciona só no Windows.
- Os caminhos viram marcadores `{{HOME*}}`.
- O endereço da Tailscale continua no histórico do commit c3a20a1. Ele foi tirado dos arquivos atuais.
- Ver [[auto-predio-3d]] e [[auto-kit-e-msix]].
