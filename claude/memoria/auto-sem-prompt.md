---
name: auto-sem-prompt
description: Um comando só — /auto com ou sem texto decide continuar/novo e escreve o prompt; o cliente nunca escreve prompt
metadata:
  node_type: memory
  type: feedback
  originSessionId: 321e98c0-2435-4892-92e5-a6ce5dfbd5d4
  modified: 2026-10-16T17:06:26.598Z
---

O cliente não quer precisar escrever nem colar prompt. O /auto deve fazer isso sozinho:
- Tudo é `/auto` (com ou sem texto), sem palavra especial: `python auto.py "<texto>"` faz reparos, decide CONTINUAR/FECHADO/DUVIDA/NOVO e sugere a pasta (pedido de 16/10/2026: "deixe tudo em um comando só").
- Pedido curto vira prompt otimizado, salvo em `prompt-inicial.md`.
- No fim, nada de mandar copiar prompt: só "Para continuar, digite `/auto`".

**Why:** pedido do cliente em 16/10/2026. Antes, ele copiou o "prompt final" da entrega e colou de volta para continuar o trabalho.

**How to apply:**
- Regra na seção "Um comando só" do SKILL.md do /auto + Etapa 0 passo 0 (`auto.py`).
- Pendências sempre em `## Pendências` do LEIA-ME ou como `- [ ]` no prompt-final.md, porque o `projetos.py` lê dali.
- Item resolvido depois leva "(resolvido…)" ou fica riscado.

Ligado a [[auto-gpt-e-economia]] e [[auto-gerente-opus-revisa]].
