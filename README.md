# /auto: empresa virtual para o Claude Code

Tudo do `/auto` num lugar só: a skill, o prédio 3D (memória-mapa e pedidos pelo celular),
os funcionários, os ganchos, os plugins, os servidores MCP e o kit de skills, CLIs e apps.

## Instalar num PC novo (o jeito fácil)

Só Windows por enquanto. O repositório é privado: antes, faça login no GitHub uma vez
(`winget install GitHub.cli` e depois `gh auth login`). Então abra o Claude Code e peça:

> Baixe e instale o /auto: clone https://github.com/enzoelle123/auto-claude com o gh, leia o CLAUDE.md dele e siga.

A IA clona o repositório, lê o `CLAUDE.md` e roda o instalador sozinha. No fim ela mostra
só o que precisa de você: logins (ChatGPT/Codex, Claude, GitHub, Google) e o token do prédio.

## Instalar à mão

```bash
gh repo clone enzoelle123/auto-claude
```

```bash
python auto-claude/ferramentas/instalar.py
```

Opções: `--completo` (também instala os apps pesados, vários GB), `--sem-kit` (só o /auto e as configurações),
`--teste <pasta>` (ensaio numa pasta falsa, sem mexer em nada).

O instalador **não apaga nada**: junta as configurações às que você já tem e guarda cópia do que muda em
`~/.claude/backups/auto-instalar-<data>`.

## O que tem aqui

| Pasta | Conteúdo | Vai para |
|---|---|---|
| `claude/skills/` | a skill `auto` (auto.py, gpt.py, local.py, painel, prédio, referências) e as outras ~240 skills | `~/.claude/skills` |
| `claude/agents/`, `claude/agents-reserva/` | 53 funcionários ativos e 229 na reserva (economia de tokens) | `~/.claude/` |
| `claude/security-guidance/` | ganchos de revisão de segurança | `~/.claude/` |
| `claude/scheduled-tasks/predio-pedidos/` | tarefa que atende os pedidos do site do prédio a cada 30 min | `~/.claude/scheduled-tasks` |
| `claude/settings.template.json` | 107 plugins, marketplaces, ganchos e ajustes de economia | junta em `~/.claude/settings.json` |
| `claude/mcp-servers.template.json` | servidores MCP (playwright, serena, context7, capcut, apps Craft…) | junta em `~/.claude.json` |
| `claude/memoria/` | o que o /auto aprendeu (decisões e armadilhas) | `~/.claude/auto-memoria` |
| `codex/config.template.toml` | perfis do GPT: `auto-leitura` e `auto-escrita` | junta em `~/.codex/config.toml` |
| `kit/repos.txt` | ~100 repositórios do kit, com o commit exato | clonados em `~/claude-repos` |
| `kit/install_all.sh` | build dos apps do kit (só com `--completo`) | `~/claude-repos` |
| `predio/site/` | código do site do prédio (Vercel) e as specs | para publicar de novo, se quiser |
| `config/predio-ponte.example.json` | endereço da ponte do prédio, sem o token | `~/.config/predio-ponte.json` |

## Atualizar este repositório (no PC original)

```bash
python ferramentas/exportar.py && python ferramentas/verificar.py
```

Depois `git add -A`, `git commit` e `git push`. O `verificar.py` barra o envio se achar segredo.

## O que não vem no repositório (de propósito)

- Senhas, tokens e logins: cada PC faz os seus.
- Os projetos em `~/auto-projetos` (trabalhos do cliente) e o mapa do prédio, que o `/auto` regenera.
- Instaladores `.exe` e modelos de IA: o `--completo` baixa de novo.
