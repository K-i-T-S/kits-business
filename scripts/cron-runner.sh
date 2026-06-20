#!/usr/bin/env bash
# KiTS Cron Runner — called by crontab every 5 hours
# Uses local Claude Code CLI with Pro subscription (no API key needed)
set -euo pipefail

REPO="/home/casio699/KiTS/kits-business"
LOG="$REPO/logs/cron-$(date +%Y%m%d-%H%M%S).log"
PROMPT_FILE="$REPO/scripts/sprint-prompt.txt"

mkdir -p "$REPO/logs"

echo "=== KiTS Cron Sprint: $(date) ===" | tee "$LOG"

# Check if there's work to do
if ! grep -q '\[PENDING\]' "$REPO/docs/MASTER_PLAN.md"; then
  echo "All sprints complete. Nothing to do." | tee -a "$LOG"
  exit 0
fi

# Pull latest before starting
cd "$REPO"
git pull origin main >> "$LOG" 2>&1 || true

# Build prompt with today's date
PROMPT=$(sed "s/AUTO_DATE/$(date +%Y-%m-%d)/" "$PROMPT_FILE")

# Run Claude Code CLI — uses stored OAuth (Pro subscription, zero API cost)
echo "Running Claude..." | tee -a "$LOG"
echo "$PROMPT" | claude \
  --dangerously-skip-permissions \
  -p "$PROMPT" \
  2>&1 | tee -a "$LOG"

echo "=== Done: $(date) ===" | tee -a "$LOG"
