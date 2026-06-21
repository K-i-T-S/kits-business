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

  # Run Claude — stream-json gives live tool call badges; tee captures to log
  EXIT_CODE=0
  set +e
  "$CLAUDE" \
    --dangerously-skip-permissions \
    --output-format stream-json \
    --include-partial-messages \
    -p "$DATED_PROMPT" \
    2>&1 | python3 "$REPO/scripts/sprint-formatter.py" | tee "$SPRINT_LOG"
  EXIT_CODE=${PIPESTATUS[0]}
  set -e

  # Strip ANSI codes before keyword search
  OUTPUT=$(sed 's/\x1B\[[0-9;]*[mK]//g' "$SPRINT_LOG")
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

  elif echo "$OUTPUT" | grep -qiE "session.?limit|usage.?limit|rate.?limit|too many requests|overloaded|capacity|429|Claude AI is unavailable|hit your.*limit|resets.*[0-9]+(am|pm)"; then
    # Save any partial work before sleeping
    git add src/ docs/MASTER_PLAN.md 2>/dev/null || true
    git diff --cached --quiet 2>/dev/null || \
      git commit -m "chore: partial checkpoint [limit hit $(date +%H:%M)]" 2>/dev/null || true
    git push origin main 2>/dev/null || true

    # Try to extract reset time from the message (e.g. "resets 11pm (Asia/Beirut)")
    RESET_STR=$(echo "$OUTPUT" | grep -ioE "resets [0-9]+(:[0-9]+)?(am|pm)" | head -1 || true)
    if [ -n "$RESET_STR" ]; then
      # Parse reset hour from string like "resets 11pm"
      RESET_TIME=$(echo "$RESET_STR" | grep -oE "[0-9]+(:[0-9]+)?(am|pm)")
      RESET_EPOCH=$(date -d "today $RESET_TIME" +%s 2>/dev/null || echo 0)
      NOW_EPOCH=$(date +%s)
      # If reset time already passed today, add 24 hours
      if [ "$RESET_EPOCH" -le "$NOW_EPOCH" ]; then
        RESET_EPOCH=$(( RESET_EPOCH + 86400 ))
      fi
      SLEEP_SECS=$(( RESET_EPOCH - NOW_EPOCH + 120 ))  # +2 min buffer after reset
      log "🔄 Session limit hit. Sleeping until $RESET_TIME (${SLEEP_SECS}s)."
    else
      SLEEP_SECS=$DELAY_LIMIT
      log "🔄 Session limit hit (no reset time found). Sleeping ${SLEEP_SECS}s."
    fi
    ERRORS=0
    countdown $SLEEP_SECS "session limit — sleeping until reset"

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
