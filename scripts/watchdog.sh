#!/usr/bin/env bash
# KiTS Watchdog — run every 30 min via crontab
# Restarts the build session if it has exited or doesn't exist.
set -euo pipefail

REPO="/home/casio699/KiTS/kits-business"
SESSION="kits-build"
LOG="$REPO/logs/watchdog.log"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "$LOG"; }

if ! tmux has-session -t "$SESSION" 2>/dev/null; then
  log "Session '$SESSION' not found. Restarting..."
  bash "$REPO/scripts/tmux-kits.sh" >> "$LOG" 2>&1
  log "Session restarted."
  exit 0
fi

PANE_PID=$(tmux list-panes -t "${SESSION}:0" -F "#{pane_pid}" 2>/dev/null || echo "")
if [ -z "$PANE_PID" ]; then
  log "Pane has no PID (exited). Restarting session..."
  bash "$REPO/scripts/tmux-kits.sh" >> "$LOG" 2>&1
  log "Session restarted."
  exit 0
fi

PANE_STATUS=$(tmux display-message -t "${SESSION}:0" -p "#{pane_dead}" 2>/dev/null || echo "1")

if [ "$PANE_STATUS" = "1" ]; then
  log "Pane is dead. Respawning loop inside existing session..."
  tmux send-keys -t "${SESSION}:0" \
    "cd '$REPO' && bash '$REPO/scripts/loop-runner.sh'" Enter
  log "Loop respawned."
else
  log "Session healthy (pane_pid=$PANE_PID). No action needed."
fi
