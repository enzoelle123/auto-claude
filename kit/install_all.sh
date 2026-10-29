#!/usr/bin/env bash
# install_all.sh: script do cliente (16/10/2026). Mudanças para Windows e para as decisões
# da Reunião 1 estão marcadas com [ajuste]; o resto está igual ao original.
set -u
AUTO="${AUTO_DIR:-$HOME/auto}"
SKILLS_DIR="$AUTO/skills"; CLIS_DIR="$AUTO/clis"; APPS_DIR="$AUTO/apps"
LOG_DIR="$AUTO/logs"; REPORT="$AUTO/INSTALL_REPORT.md"; STEP="${1:-all}"
SKIP_BUILD=" ${SKIP_BUILD:-} "   # [ajuste] repos (dono/nome) que o build pula, separados por espaço
mkdir -p "$SKILLS_DIR" "$CLIS_DIR" "$APPS_DIR" "$LOG_DIR"
info() { echo "==> $*"; }; ok() { echo "  OK $*"; }; err() { echo "  ERRO $*"; }
have() { command -v "$1" >/dev/null 2>&1; }
declare -a ROWS=(); record() { ROWS+=("| $1 | $2 | $3 | $4 |"); }

SKILL_REPOS=(Leonxlnx/taste-skill vercel-labs/agent-skills addyosmani/agent-skills
  mattpocock/skills multica-ai/andrej-karpathy-skills apify/agent-skills apify/awesome-skills
  pbakaus/impeccable cathrynlavery/diagram-design ibelick/ui-skills
  google-labs-code/stitch-skills microsoft/playwright-cli alexgaoth/awesome-reverse-engineered
  VoltAgent/awesome-design-md)
CLI_REPOS=(googleworkspace/cli vercel-labs/skills HKUDS/CLI-Anything jackwener/OpenCLI
  iOfficeAI/OfficeCLI google/agents-cli nashsu/AutoCLI sonpiaz/watch-cli)
APP_REPOS=(debpalash/VoiceStudio harry0703/MoneyPrinterTurbo jamiepine/voicebox
  microsoft/VibeVoice OpenBMB/VoxCPM krillinai/OpenCreator multimodal-art-projection/YuE
  heygen-com/hyperframes OpenCut-app/OpenCut different-ai/openwork earthtojake/text-to-cad
  facebook/astryx storytold/artcraft storytold/photocraft storytold/vectorcraft
  storytold/designcraft storytold/filmcraft storytold/lightcraft storytold/effectcraft
  storytold/pdfcraft storytold/soundcraft storytold/wordcraft storytold/deckcraft
  storytold/cadcraft morluto/rea rehan-remade/universal-modder
  BeatAPI/BeatDesign storytold/figcraft)   # [ajuste] pedidos do cliente em 17/10/2026

# [ajuste] no Windows, "python3" é o atalho vazio da Microsoft Store: usa o primeiro Python que roda.
PY=""
for c in python3 python; do "$c" -c 'import sys' >/dev/null 2>&1 && { PY="$c"; break; }; done
# [ajuste] o venv do Windows fica em Scripts/; no Linux/macOS, em bin/.
activate_venv() { if [[ -f .venv/Scripts/activate ]]; then source .venv/Scripts/activate; else source .venv/bin/activate; fi; }

check_prereqs() {
  local missing=()
  for t in git node npm; do have "$t" || missing+=("$t"); done
  [[ -n "$PY" ]] || missing+=("python3")
  ((${#missing[@]})) && { err "Faltando: ${missing[*]}"; exit 1; }
  # [ajuste] decisão do cliente: sem Rust; projetos Rust usam o binário oficial da release.
  have cargo || info "cargo ausente: projetos Rust usam o binário oficial para Windows x64"
  ok "pré-requisitos (python: $PY)"
}

# [ajuste] não clona de novo o que já existe em outra pasta de $AUTO (ex.: video/hyperframes).
# Deixa em CLONE_DIR onde o repo está e ELSEWHERE=1 quando ele já existia fora do destino.
CLONE_DIR=""; ELSEWHERE=0
# [ajuste] a pasta $1 é um clone de dono/nome $2? (endereço exato, sem .git, sem diferenciar maiúsculas)
same_repo() { local u; u="$(git -C "$1" remote get-url origin 2>/dev/null)"; u="${u%.git}"; [[ "${u,,}" == "https://github.com/${2,,}" ]]; }
# [ajuste] pasta do repo dentro de $1: dono__nome quando o nome simples já é de outro dono (padrão do ~/claude-repos).
repo_dir() { local d="$1/${2##*/}"; [[ -d "$d/.git" ]] && ! same_repo "$d" "$2" && d="$1/${2%%/*}__${2##*/}"; echo "$d"; }
clone_repo() {
  local repo="$1" dest d
  dest="$(repo_dir "$2" "$repo")"
  CLONE_DIR="$dest"; ELSEWHERE=0
  if [[ -d "$dest/.git" ]]; then git -C "$dest" pull --ff-only -q >/dev/null 2>&1; return 0; fi
  for d in "$AUTO"/*/"${repo##*/}"; do
    [[ -d "$d/.git" && "$d" != "$dest" ]] || continue
    if same_repo "$d" "$repo"; then CLONE_DIR="$d"; ELSEWHERE=1; return 0; fi
  done
  git clone --depth 1 -q "https://github.com/$repo.git" "$dest" >>"$LOG_DIR/clone.log" 2>&1
}
install_skills() {
  for repo in "${SKILL_REPOS[@]}"; do
    if clone_repo "$repo" "$SKILLS_DIR"; then
      # [ajuste] -a claude-code: instala só no Claude Code (não espalha para o Codex, que é o revisor GPT).
      if npx -y skills add "https://github.com/$repo" -g -y -a claude-code >>"$LOG_DIR/skills.log" 2>&1 </dev/null; then
        ok "$repo"; record "$repo" skill instalado "npx skills add"
      else err "$repo"; record "$repo" skill clonado "skills add falhou"; fi
    else err "$repo"; record "$repo" skill falhou "repo não existe/renomeado"; fi
  done
}
# [ajuste] sem cargo: baixa o binário oficial para Windows x64 da última release do próprio repositório.
fetch_release() {
  local repo z
  repo="$(git remote get-url origin | sed -E 's#^https://github.com/##; s#\.git$##')"
  mkdir -p bin
  if gh release download -R "$repo" -D bin --clobber -p '*windows-x64-portable.zip' 2>/dev/null \
     || gh release download -R "$repo" -D bin --clobber -p '*x86_64-pc-windows-msvc.zip' 2>/dev/null; then
    for z in bin/*.zip; do unzip -o -q "$z" -d bin || exit 5; rm -f "$z"; done
    echo "binário oficial em $(pwd)/bin"
  else
    echo "sem binário portátil oficial para Windows x64 nas releases de $repo"; exit 4
  fi
}
install_project() {
  local dir="$1"
  ( cd "$dir" || exit 1
    if [[ -f Cargo.toml ]]; then
      if have cargo; then cargo build --release; else fetch_release; fi
    elif [[ -f package.json ]]; then
      if [[ -f bun.lockb || -f bun.lock ]] && have bun; then bun install; else npm install; fi || exit 1
      # [ajuste] if/fi: sem script "build", o original devolvia erro e marcava falha falsa.
      if grep -q '"build"' package.json; then npm run build || true; fi
    elif [[ -f pyproject.toml || -f requirements.txt || -f setup.py ]]; then
      "$PY" -m venv .venv && activate_venv && python -m pip install -q -U pip || exit 1
      if [[ -f requirements.txt ]]; then pip install -r requirements.txt || exit 1; fi
      if [[ -f pyproject.toml || -f setup.py ]]; then pip install -e . || true; fi
    elif [[ -f go.mod ]] && have go; then go build ./...
    else echo "tipo não reconhecido"; exit 2; fi
  ) >"$LOG_DIR/build-$(basename "$dir").log" 2>&1   # [ajuste] prefixo build-: "skills" e "cli" apagavam logs/skills.log
}
install_clis() {
  if npm install -g @playwright/cli@latest >>"$LOG_DIR/clis.log" 2>&1; then
    playwright-cli install --skills >>"$LOG_DIR/clis.log" 2>&1 || true
    ok playwright-cli; record microsoft/playwright-cli cli instalado "playwright-cli --help"
  else err playwright-cli; record microsoft/playwright-cli cli falhou "logs/clis.log"; fi
  for repo in "${CLI_REPOS[@]}"; do
    clone_repo "$repo" "$CLIS_DIR" || { err "$repo"; record "$repo" cli falhou "repo não existe"; continue; }
    if ((ELSEWHERE)); then ok "$repo (já existe)"; record "$repo" cli "já instalado" "$CLONE_DIR"; continue; fi
    if install_project "$CLONE_DIR"; then ok "$repo"; record "$repo" cli instalado "ver README"
    else err "$repo"; record "$repo" cli clonado "build falhou"; fi
  done
}
clone_apps() {
  for repo in "${APP_REPOS[@]}"; do
    if clone_repo "$repo" "$APPS_DIR"; then
      if ((ELSEWHERE)); then ok "$repo (já existe em $CLONE_DIR)"; record "$repo" app "já instalado" "$CLONE_DIR"
      else ok "$repo"; fi
    else err "$repo"; record "$repo" app falhou "repo não existe"; fi
  done
}
build_apps() {
  for repo in "${APP_REPOS[@]}"; do
    local dir; dir="$(repo_dir "$APPS_DIR" "$repo")"; [[ -d "$dir" ]] || continue   # [ajuste] mesma pasta do clone_repo
    if [[ "$SKIP_BUILD" == *" $repo "* ]]; then record "$repo" app clonado "build feito à parte (ver README)"; continue; fi
    if install_project "$dir"; then ok "$repo"; record "$repo" app instalado "ver README"
    else err "$repo"; record "$repo" app clonado "build falhou"; fi
  done
}
write_report() {
  { echo "# Relatório de instalação — $(date '+%Y-%m-%d %H:%M') — etapa $STEP"; echo
    echo "| Nome | Tipo | Status | Observação |"; echo "|---|---|---|---|"
    printf '%s\n' "${ROWS[@]}"; echo; } >>"$REPORT"
}
check_prereqs
case "$STEP" in
  skills) install_skills ;; clis) install_clis ;; apps) clone_apps ;; build) build_apps ;;
  all) install_skills; install_clis; clone_apps; build_apps ;;
  *) echo "use: skills|clis|apps|build|all"; exit 1 ;;
esac
write_report
