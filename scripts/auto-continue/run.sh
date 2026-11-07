#!/bin/zsh
# Auto-continue (P2, D65): runs "繼續 roadmap" with Claude Code in headless
# mode, every 6 hours under launchd, once Joe installs and enables it
# (docs/auto-continue.md). Safe by construction:
# - skips (and logs why) on battery power, when another run is going,
#   or when docs/roadmap.md has nothing left to do (then disables itself);
# - keeps the Mac awake only while it runs (caffeinate), for at most
#   MAX_SECONDS;
# - lists exactly which tools Claude may use, never skips permission
#   checks, and forbids deleting data, changing env variables, force
#   pushes, and paid API calls (LISTENLOOP_UNATTENDED=1 makes the
#   recording scripts refuse).
# Logs: ~/Library/Logs/listenloop-auto/<YYYY-MM>.log

set -u
REPO="${LISTENLOOP_REPO:-$HOME/Projects/listenloop}"
LOG_DIR="$HOME/Library/Logs/listenloop-auto"
LOCK_DIR="$HOME/Library/Application Support/listenloop-auto/lock"
MAX_SECONDS="${LISTENLOOP_MAX_SECONDS:-10800}" # 3 hours
LABEL="com.listenloop.auto-continue"
mkdir -p "$LOG_DIR" "${LOCK_DIR:h}"
LOG="$LOG_DIR/$(date +%Y-%m).log"
log() { print -r -- "$(date '+%Y-%m-%d %H:%M:%S') $*" >> "$LOG"; }

POWER="$(pmset -g ps | head -1)"
log "start · ${POWER}"

if [[ "$POWER" != *"AC Power"* ]]; then
  log "skip · on battery power"
  exit 0
fi

# mkdir is atomic: only one run holds the lock.
if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  log "skip · another run is going (lock: $LOCK_DIR)"
  exit 0
fi
trap 'rmdir "$LOCK_DIR" 2>/dev/null' EXIT

cd "$REPO" || { log "stop · repository not found: $REPO"; exit 1; }

# Nothing left to do: no unchecked item in the roadmap.
if ! grep -q -- '- \[ \]' docs/roadmap.md; then
  log "stop · docs/roadmap.md has no open items; disabling the schedule"
  launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null
  exit 0
fi

git checkout -q main && git pull -q --ff-only || log "warn · couldn't update main"

ALLOWED=(
  "Read" "Edit" "Write" "Glob" "Grep" "TodoWrite"
  "Bash(git status:*)" "Bash(git diff:*)" "Bash(git log:*)" "Bash(git add:*)"
  "Bash(git commit:*)" "Bash(git checkout:*)" "Bash(git switch:*)"
  "Bash(git pull:*)" "Bash(git push -u origin:*)" "Bash(git push origin:*)"
  "Bash(git branch:*)" "Bash(git fetch:*)" "Bash(git rebase origin/main:*)"
  "Bash(gh pr create:*)" "Bash(gh pr checks:*)" "Bash(gh pr view:*)"
  "Bash(gh pr merge:*)" "Bash(gh api repos/YA-CIAO-LIANG/listenloop/commits:*)"
  "Bash(npm run lint:*)" "Bash(npm run format:*)" "Bash(npm run typecheck:*)"
  "Bash(npm test:*)" "Bash(npm run test:*)" "Bash(npm run build:*)"
  "Bash(npm run test:e2e:*)" "Bash(npm run db:push -- --yes:*)"
  "Bash(npm run db:types:*)" "Bash(npm run rls:check:*)"
  "Bash(npx prettier:*)" "Bash(npx eslint:*)" "Bash(npx tsc:*)"
  "Bash(npx vitest:*)" "Bash(npx playwright test:*)"
  "Bash(ls:*)" "Bash(cat:*)" "Bash(head:*)" "Bash(tail:*)" "Bash(wc:*)"
  "Bash(python3:*)" "Bash(node:*)" "Bash(lsof:*)" "Bash(kill:*)"
)
DENIED=(
  "Bash(vercel:*)" "Bash(npx vercel:*)" "Bash(npx supabase:*)"
  "Bash(npm run db:backup:*)" "Bash(npm run official:drafts:*)"
  "Bash(npm run ai:record:*)" "Bash(npm run voices:samples:*)"
  "Bash(git push --force:*)" "Bash(git push -f:*)" "Bash(git reset --hard:*)"
  "Bash(rm -rf:*)" "Bash(curl:*)" "WebFetch"
)
RULES='Unattended run (scripts/auto-continue/run.sh, D65). Rules on top of CLAUDE.md:
- Never call a paid API, never record fixtures, never change environment variables or Vercel settings.
- Only additive database migrations; never drop, delete, or truncate data.
- Stop and write in docs/roadmap.md if anything needs Joe (accounts, keys, approvals, real API calls).
- Before stopping, update docs/roadmap.md with what you did and what is next.'

log "run · claude -p 繼續 roadmap (max ${MAX_SECONDS}s)"
# perl's alarm ends the run after MAX_SECONDS (macOS has no `timeout`).
LISTENLOOP_UNATTENDED=1 AI_PROVIDERS=fake \
  perl -e 'alarm shift; exec @ARGV' "$MAX_SECONDS" \
  caffeinate -i -s \
  claude -p "繼續 roadmap" \
    --permission-mode default \
    --allowedTools "${ALLOWED[@]}" \
    --disallowedTools "${DENIED[@]}" \
    --append-system-prompt "$RULES" \
    --output-format text >> "$LOG" 2>&1
CODE=$?
case $CODE in
  0) log "end · finished" ;;
  142) log "end · stopped after ${MAX_SECONDS}s (time limit)" ;;
  *) log "end · exit code $CODE" ;;
esac
exit 0
