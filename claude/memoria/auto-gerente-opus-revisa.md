---
name: auto-gerente-opus-revisa
description: "Regra do cliente — ao terminar qualquer trabalho, um Gerente rodando em Opus revisa tudo antes da entrega"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 321e98c0-2435-4892-92e5-a6ce5dfbd5d4
  modified: 2026-10-16T04:34:50.339Z
---

Sempre que terminar um trabalho, um **Gerente rodando em Opus** revisa tudo antes de entregar, para não haver erros. Regra pedida pelo cliente em 16/10/2026, durante o /auto de Claude+GPT.

**Why:** os funcionários (subagentes) passaram a rodar em Sonnet para economizar, e o cliente quer uma última conferência forte para não receber nada com erro.

**How to apply:**
- No /auto, é a Etapa 5b: `Agent` com `subagent_type: "Reality Checker"` e `model: "opus"`, que recebe a lista de todos os arquivos criados ou alterados.
- Problema confirmado: corrigir e reenviar ao mesmo Gerente (`SendMessage`), no máximo 3 voltas.
- Só entregar com APROVADO ou com as pendências ditas claramente.

Ligado a [[auto-gpt-e-economia]].
