#!/usr/bin/env bash
# KiTS Autonomous Sprint Loop
# Runs inside tmux session. Uses Claude Pro OAuth (no API key needed).
set -euo pipefail

REPO="/home/casio699/KiTS/kits-business"
CLAUDE="/home/casio699/.local/bin/claude"
PROMPT="$REPO/scripts/sprint-prompt.txt"

DELAY_SUCCESS=300
DELAY_LIMIT=18000
DELAY_ERROR=600
DELAY_BLOCKED=60

log() {
  local ts
  ts="$(date '+%Y-%m-%d %H:%M:%S')"
  echo "[$ts] $*" | tee -a "$REPO/logs/loop-$(date +%Y%m%d).log"
}

wait_with_countdown() {
  local seconds=$1
  local reason=$2
  local end=$(( $(date +%s) + seconds ))
  log "Waiting ${seconds}s — $reason"
  while [ "$(date +%s)" -lt "$end" ]; do
    local remaining=$(( end - $(date +%s) ))
    printf "\r⏳ %s | %dh %02dm %02ds remaining     " \
      "$reason" \
      $(( remaining / 3600 )) \
      $(( (remaining % 3600) / 60 )) \
      $(( remaining % 60 ))
    sleep 10
  done
  echo ""
  log "Wait complete. Resuming."
}

cd "$REPO"

log "═══════════════════════════════════════════════"
log "  KiTS Autonomous Sprint Loop — Starting"
log "  Claude: $("$CLAUDE" --version 2>/dev/null | head -1)"
log "═══════════════════════════════════════════════"

CONSECUTIVE_ERRORS=0
MAX_CONSECUTIVE_ERRORS=5

while true; do
  git pull origin main --quiet 2>/dev/null || {
    log "git pull failed (offline?). Continuing with local state."
  }

  PENDING=$(grep -cE '^### Sprint.*\[(PENDING|IN_PROGRESS)\]' "$REPO/docs/MASTER_PLAN.md" 2>/dev/null || echo 0)
  if [ "$PENDING" -eq 0 ]; then
    log "ALL SPRINTS COMPLETE. Nothing left to build."
    log "Add new sprints to docs/MASTER_PLAN.md to continue."
    exit 0
  fi

  NEXT=$(grep -E '^### Sprint.*\[(PENDING|IN_PROGRESS)\]' "$REPO/docs/MASTER_PLAN.md" | head -1 | \
    sed 's/^### //' | sed 's/ \[PENDING\]//' | sed 's/ \[IN_PROGRESS\]//')
  log "▶ Executing: $NEXT"

  DATED_PROMPT=$(sed "s/{{DATE}}/$(date +%Y-%m-%d)/g" "$PROMPT")
  SPRINT_LOG="$REPO/logs/sprint-$(date +%Y%m%d-%H%M%S).log"

  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  Claude is working on: $NEXT"
  echo "  Log: $SPRINT_LOG"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  # Stream Claude output to terminal AND log file simultaneously
  EXIT_CODE=0
  set +e
  "$CLAUDE" \
    --dangerously-skip-permissions \
    -p "$DATED_PROMPT" \
    2>&1 | tee "$SPRINT_LOG"
  EXIT_CODE=${PIPESTATUS[0]}
  set -e

  OUTPUT=$(cat "$SPRINT_LOG")

  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  if echo "$OUTPUT" | grep -qi "ALL_SPRINTS_COMPLETE"; then
    log "ALL SPRINTS COMPLETE (reported by Claude)."
    exit 0

  elif echo "$OUTPUT" | grep -qi "SPRINT_COMPLETE"; then
    log "✅ Sprint complete: $NEXT"
    CONSECUTIVE_ERRORS=0
    wait_with_countdown $DELAY_SUCCESS "cooldown before next sprint"

  elif echo "$OUTPUT" | grep -qi "SPRINT_BLOCKED"; then
    log "⚠ Sprint blocked: $NEXT — see $SPRINT_LOG"
    CONSECUTIVE_ERRORS=0
    wait_with_countdown $DELAY_BLOCKED "skipping blocked sprint"

  elif [ $EXIT_CODE -ne 0 ] && echo "$OUTPUT" | grep -qiE "usage limit|rate limit|overloaded|capacity|too many request|429"; then
    log "Pro usage limit hit. Sleeping 5 hours."
    git add -A 2>/dev/null && \
      git diff --cached --quiet || \
      git commit -m "chore: checkpoint before usage limit sleep [$(date +%H:%M)]" 2>/dev/null || true
    git push 2>/dev/null || true
    CONSECUTIVE_ERRORS=0
    wait_with_countdown $DELAY_LIMIT "Pro usage window — will resume automatically"

  elif [ $EXIT_CODE -ne 0 ]; then
    CONSECUTIVE_ERRORS=$(( CONSECUTIVE_ERRORS + 1 ))
    log "❌ Error (exit $EXIT_CODE, attempt $CONSECUTIVE_ERRORS/$MAX_CONSECUTIVE_ERRORS)"
    log "   Log: $SPRINT_LOG"

    if [ $CONSECUTIVE_ERRORS -ge $MAX_CONSECUTIVE_ERRORS ]; then
      log "5 consecutive errors. Sleeping 1 hour before retry."
      CONSECUTIVE_ERRORS=0
      wait_with_countdown 3600 "repeated failures — extended pause"
    else
      wait_with_countdown $DELAY_ERROR "error recovery"
    fi

  else
    log "✅ Sprint finished (no explicit keyword). Assuming success."
    CONSECUTIVE_ERRORS=0
    wait_with_countdown $DELAY_SUCCESS "cooldown"
  fi
done
