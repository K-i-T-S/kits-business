#!/usr/bin/env bash
# KiTS Autonomous Sprint Loop — runs inside tmux, uses Claude Pro OAuth
set -euo pipefail

REPO="/home/casio699/KiTS/kits-business"
CLAUDE="/home/casio699/.local/bin/claude"
PROMPT_FILE="$REPO/scripts/sprint-prompt.txt"

DELAY_SUCCESS=120     # 2 min cooldown between sprints
DELAY_LIMIT=18000     # 5 hours on Pro usage limit
DELAY_ERROR=600       # 10 min on errors
DELAY_BLOCKED=30      # 30 sec before continuing past a blocked sprint
MAX_ERRORS=5

log() {
  local ts
  ts="$(date '+%Y-%m-%d %H:%M:%S')"
  local msg="[$ts] $*"
  echo "$msg" | tee -a "$REPO/logs/loop-$(date +%Y%m%d).log"
}

banner() {
  echo ""
  echo "┌─────────────────────────────────────────────────────┐"
  printf  "│  %-51s │\n" "$*"
  echo "└─────────────────────────────────────────────────────┘"
}

countdown() {
  local secs=$1 reason=$2
  local end=$(( $(date +%s) + secs ))
  log "⏸  Waiting ${secs}s — $reason"
  while [ "$(date +%s)" -lt "$end" ]; do
    local rem=$(( end - $(date +%s) ))
    printf "\r  ⏳ %s — %02d:%02d remaining   " \
      "$reason" $(( rem / 60 )) $(( rem % 60 ))
    sleep 5
  done
  printf "\r  ✓ Done waiting.                                   \n"
  log "Resumed after wait."
}

cd "$REPO"

banner "KiTS Sprint Loop  •  $(date '+%Y-%m-%d %H:%M')  •  $("$CLAUDE" --version 2>/dev/null | head -1)"
log "Loop started. Repo: $REPO"

ERRORS=0

while true; do
  # Pull latest (loop-runner.sh, sprint-prompt.txt, MASTER_PLAN.md)
  git pull origin main --quiet 2>/dev/null || log "git pull failed — using local state"

  # Count actual pending sprints (anchored to ### Sprint headers only)
  PENDING=$(grep -cE '^### Sprint.*\[(PENDING|IN_PROGRESS)\]' "$REPO/docs/MASTER_PLAN.md" 2>/dev/null || true)
  if [ "${PENDING:-0}" -eq 0 ]; then
    banner "ALL SPRINTS COMPLETE"
    log "No more pending sprints. Exiting."
    exit 0
  fi

  NEXT=$(grep -E '^### Sprint.*\[(PENDING|IN_PROGRESS)\]' "$REPO/docs/MASTER_PLAN.md" \
    | head -1 | sed 's/^### //' | sed 's/ \[PENDING\]//' | sed 's/ \[IN_PROGRESS\]//')

  SPRINT_LOG="$REPO/logs/sprint-$(date +%Y%m%d-%H%M%S).log"
  DATED_PROMPT=$(sed "s/{{DATE}}/$(date +%Y-%m-%d)/g" "$PROMPT_FILE")

  banner "▶  $NEXT"
  log "Starting: $NEXT"
  log "Log file: $SPRINT_LOG"
  echo ""

  # Run Claude — output streams to terminal AND log simultaneously
  EXIT_CODE=0
  set +e
  "$CLAUDE" --dangerously-skip-permissions -p "$DATED_PROMPT" 2>&1 | tee "$SPRINT_LOG"
  EXIT_CODE=${PIPESTATUS[0]}
  set -e

  OUTPUT=$(cat "$SPRINT_LOG")
  echo ""

  # ── Classify outcome ─────────────────────────────────────────────
  if echo "$OUTPUT" | grep -q "ALL_SPRINTS_COMPLETE"; then
    banner "ALL SPRINTS COMPLETE"
    log "Claude reports all sprints done. Exiting."
    exit 0

  elif echo "$OUTPUT" | grep -q "SPRINT_COMPLETE"; then
    log "✅ DONE: $NEXT"
    ERRORS=0
    countdown $DELAY_SUCCESS "cooldown before next sprint"

  elif echo "$OUTPUT" | grep -q "SPRINT_BLOCKED"; then
    log "⚠  BLOCKED: $NEXT — see $SPRINT_LOG"
    ERRORS=0
    countdown $DELAY_BLOCKED "skipping blocked sprint"

  elif echo "$OUTPUT" | grep -qiE "usage.?limit|rate.?limit|too many requests|overloaded|capacity|429|Claude AI is unavailable"; then
    log "🔄 Pro usage limit detected. Sleeping 5 hours."
    # Save any partial work
    git add src/ docs/MASTER_PLAN.md 2>/dev/null || true
    git diff --cached --quiet 2>/dev/null || \
      git commit -m "chore: partial checkpoint [usage limit $(date +%H:%M)]" 2>/dev/null || true
    git push origin main 2>/dev/null || true
    ERRORS=0
    countdown $DELAY_LIMIT "Pro token window refresh"

  elif [ "$EXIT_CODE" -ne 0 ]; then
    ERRORS=$(( ERRORS + 1 ))
    log "❌ Claude exited $EXIT_CODE (error $ERRORS/$MAX_ERRORS)"
    if [ "$ERRORS" -ge "$MAX_ERRORS" ]; then
      log "Too many consecutive errors. Sleeping 1 hour."
      ERRORS=0
      countdown 3600 "extended pause after repeated failures"
    else
      countdown $DELAY_ERROR "error cooldown"
    fi

  else
    # Exit 0 but no keyword — assume success
    log "✅ DONE (no keyword): $NEXT"
    ERRORS=0
    countdown $DELAY_SUCCESS "cooldown before next sprint"
  fi
done
