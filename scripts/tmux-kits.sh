#!/usr/bin/env bash
# KiTS tmux Session Setup
# Creates or restarts the kits-build session with the loop runner.
set -euo pipefail

REPO="/home/casio699/KiTS/kits-business"
SESSION="kits-build"
RUNNER="$REPO/scripts/loop-runner.sh"

echo "═══════════════════════════════════════"
echo "  KiTS Build Session Setup"
echo "═══════════════════════════════════════"

if tmux has-session -t "$SESSION" 2>/dev/null; then
  echo "Stopping existing session '$SESSION'..."
  tmux kill-session -t "$SESSION"
fi

tmux new-session -d -s "$SESSION" -x 220 -y 50

tmux set-option -t "$SESSION" remain-on-exit on
tmux set-option -t "$SESSION" history-limit 50000
tmux set-option -t "$SESSION" status-right "#[fg=green]KiTS Auto Build #[fg=white]| %H:%M %d-%b"
tmux set-option -t "$SESSION" status-interval 30

tmux send-keys -t "${SESSION}:0" \
  "cd '$REPO' && bash '$RUNNER'" \
  Enter

echo ""
echo "✅ Session '$SESSION' started."
echo ""
echo "Useful commands:"
echo "  Attach:  tmux attach -t $SESSION"
echo "  Detach:  Ctrl+B then D  (loop keeps running)"
echo "  Status:  tmux ls"
echo "  Kill:    tmux kill-session -t $SESSION"
echo ""
