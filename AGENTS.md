# Instruções para a IA que abrir este repositório

Este repositório é o **/auto** inteiro: a skill (empresa virtual), o prédio 3D, os 282 funcionários,
os ganchos, as configurações de plugins e MCPs e a lista do kit de apps.

## Se o usuário pediu para "baixar", "instalar" ou "configurar" o /auto

Funciona no **Windows** (Mac/Linux ainda não). Faça sozinho, sem pedir confirmação a cada passo:

0. Se o repositório ainda não está no PC: ele é **privado** (https://github.com/enzoelle123/auto-claude).
   Rode `gh auth status`; se não estiver logado, peça ao dono para rodar `gh auth login` (o login é dele).
   Depois: `gh repo clone enzoelle123/auto-claude "$HOME/Projetos/auto-claude" -- -c core.longpaths=true` e entre na pasta.
1. Rode o instalador (Git Bash ou PowerShell), com tempo longo (o kit tem ~100 repositórios):
   ```bash
   python ferramentas/instalar.py
   ```
   Ele copia tudo para `~/.claude`, junta configurações sem apagar nada (guarda backup em
   `~/.claude/backups/auto-instalar-<data>`), adiciona os perfis do GPT ao Codex e clona o kit em `~/claude-repos`.
   - Só se o usuário pedir os apps pesados (ComfyUI, VoxCPM, YuE, apps "Craft"): `python ferramentas/instalar.py --completo`.
2. No fim, o instalador lista **o que só o dono pode fazer** (logins e senhas). Mostre essa lista ao usuário
   em português simples. Você não digita senha, token nem chave por ele.
3. Se faltar `git`, `node` ou `python`, instale com `winget install Git.Git OpenJS.NodeJS.LTS Python.Python.3.12`
   (Windows) ou o gerenciador do sistema, e rode o instalador de novo.
4. Diga ao usuário: "Pronto. Reinicie o Claude Code e digite `/auto`."

## Se o usuário pediu para "atualizar o repositório do /auto" (no PC original)

```bash
python ferramentas/exportar.py
python ferramentas/verificar.py
git add -A && git commit -m "atualiza /auto" && git push
```
O `verificar.py` procura segredos antes do envio; se ele acusar algo, não envie.

## Regras

- Nunca commitar `.env`, tokens, `~/.claude.json` inteiro, `~/.config/predio-ponte.json` real nem `~/.codex/auth.json`.
- Caminhos da pasta do usuário ficam como marcadores (`{{HOME}}`, `{{HOME_WIN}}`, `{{HOME_WIN2}}`, `{{HOME_POSIX}}`);
  o instalador troca pela pasta do PC novo.
