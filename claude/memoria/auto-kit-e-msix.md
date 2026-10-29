---
name: auto-kit-e-msix
description: "Kit de 16-17/10/2026 em ~/claude-repos (seção KIT do rotas.md) e a armadilha do app Claude MSIX: pasta nova em AppData vira armazenamento virtual"
metadata:
  node_type: memory
  type: project
  originSessionId: 02b62172-e033-4e9c-8d9f-f59bc4509a41
  modified: 2026-10-17T12:11:47.299Z
---

Em 16-17/10/2026 o /auto ganhou um kit (skills, CLIs e apps) em `~/claude-repos/{skills,clis,apps}`, instalado por `~/claude-repos/install_all.sh` e registrado na seção KIT de `~/.claude/skills/auto/references/rotas.md` (o `catalogo.py` lê dali). Backup do /auto de antes: `~/.claude/backups/auto.backup-20261016`.

Decisões do cliente: sem Rust (binários oficiais); todas as skills, inclusive nomes repetidos; Instagram = Apify; VoxCPM/VibeVoice/YuE com CUDA; instaladores sem assinatura aprovados (VoiceStudio, Voicebox, OpenCreator, ArtCraft); watch-cli pulado; BeatDesign incluído. Pendentes com o cliente: `gws auth setup`, `npx apify-cli login`, extensão OpenCLI no Chrome.

**Why:** o app Claude no Windows é MSIX. Pasta nova criada dentro de `AppData` por processos do Claude vai para `%LOCALAPPDATA%\Packages\Claude_pzs8sxrjxfjjc\LocalCache` e só existe dentro do Claude. Isso quebra o uv (astral-sh/uv#19622: "Missing expected target directory for Python minor version link"), o pnpm (troca de versão em `AppData\Local\pnpm\.tools`) e esconde do Windows os apps instalados em pasta nova de `AppData\Local`.

**How to apply:** junction do uv quebrada → `mklink /J` apontando para a pasta física no LocalCache; pnpm → instalar global a versão fixada no `packageManager` do projeto; instalador de app → `/S /D=%LOCALAPPDATA%\Programs\<App>` (Programs fica real); venv do uv → passar o caminho do `python.exe`. Ver [[auto-gpt-e-economia]] e [[auto-gerente-opus-revisa]].
