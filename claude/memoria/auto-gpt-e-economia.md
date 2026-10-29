---
name: auto-gpt-e-economia
description: "Ponte Claude→GPT (Codex, login ChatGPT, gpt.py somente leitura) e economia de tokens montadas em 16/10/2026; o que mudou e como desfazer"
metadata:
  node_type: memory
  type: project
  originSessionId: 321e98c0-2435-4892-92e5-a6ce5dfbd5d4
  modified: 2026-10-16T12:33:39.359Z
---

Em 16/10/2026 o /auto ganhou:
- **GPT:** Codex CLI 0.163.0 com login ChatGPT. Ponte `~/.claude/skills/auto/gpt.py` (`opiniao`, `ler`, `revisar`, `status`), com sandbox read-only e `windows.sandbox="mxc"` (sem MXC, o Codex bloqueia até leitura).
- **Economia:** 229 dos 282 funcionários estão em `~/.claude/agents-reserva/`; contratar com `economia.py agentes --chamar "Nome"`. Também `CLAUDE_CODE_SUBAGENT_MODEL=sonnet`, `bashOutputMaxChars` e `MAX_MCP_OUTPUT_TOKENS` em 15000 e sugestões de prompt desligadas. `economia.py restaurar` desfaz.

**Why:** o maior gasto era o contexto fixo (cerca de 19 mil tokens só de agentes em toda requisição). O cliente quer **todos os plugins ligados** e à disposição do /auto: não desligar plugin sem pedir. `codex mcp-server` não existe mais desde 05/09/2026, e o plugin codex-plugin-cc tem bugs no Windows.

**How to apply:**
- Achado do GPT só vale depois de verificado.
- Se um funcionário "sumiu", ele está na reserva.
- claude-mem consertado em 16/10/2026 (v2) **com o Claude Haiku na assinatura, por escolha do cliente**: Bun via winget, link fixo `~/.bun/bin/bun.exe`, `claude.exe` avulso logado (`claude auth login`, conta pro), `CLAUDE_CODE_PATH` = `~/.claude-mem/bin/claude.exe` (link fixo para a versão mais nova do app), chroma-mcp com pydantic<2.12. `reparos.py` mantém tudo isso (roda na Etapa 0 do /auto).
- Defender: o cliente decidiu NÃO adicionar exclusões para o Codex (funciona sem elas). Mudar segurança do Windows é coisa que só o cliente faz.
- O GPT roda no perfil `auto-leitura` de `~/.codex/config.toml`, que nega leitura de `.env`, chaves e credenciais.

Ligado a [[auto-gerente-opus-revisa]]. Projetos: `~/auto-projetos/2026-10-16-claude-gpt-tokens` (base) e `~/auto-projetos/2026-10-16-claude-gpt-v2` (pendências: claude-mem, Defender, reparos.py).
