#!/usr/bin/env bash
# KiTS tmux Session Setup — 2-pane layout:
#   Left (70%):  loop runner + Claude streaming output
#   Right (30%): git log auto-refresh (shows commits landing in real-time)
set -euo pipefail

REPO="/home/casio699/KiTS/kits-business"
SESSION="kits-build"
RUNNER="$REPO/scripts/loop-runner.sh"

echo "═══════════════════════════════════════"
echo "  KiTS Build Session Setup"
echo "═══════════════════════════════════════"

# Kill existing session cleanly
if tmux has-session -t "$SESSION" 2>/dev/null; then
  echo "Stopping existing session '$SESSION'..."
  tmux kill-session -t "$SESSION"
fi

# Create new session — wide enough for the split layout
tmux new-session -d -s "$SESSION" -x 240 -y 55

# Session-level options
tmux set-option -t "$SESSION" remain-on-exit on
tmux set-option -t "$SESSION" history-limit 50000

# Status bar
tmux set-option -t "$SESSION" status on
tmux set-option -t "$SESSION" status-style "bg=colour235 fg=colour250"
tmux set-option -t "$SESSION" status-left "#[fg=colour39,bold] KiTS Auto Build #[fg=colour250]│ "
tmux set-option -t "$SESSION" status-right "#[fg=colour250]%H:%M  %d %b"
tmux set-option -t "$SESSION" status-interval 10

# ── Pane 0 (left, 70%): loop runner ──────────────────────────────
tmux send-keys -t "${SESSION}:0" "cd '$REPO' && bash '$RUNNER'" Enter

# ── Pane 1 (right, 30%): live git commit log ──────────────────────
tmux split-window -t "${SESSION}:0" -h -p 30
tmux send-keys -t "${SESSION}:0.1" \
  "watch -n3 -t 'echo \"=== Recent Commits ===\"; git -C \"$REPO\" log --oneline --color=always -15; echo; echo \"=== Sprint Status ===\"; grep -E \"^### Sprint\" \"$REPO/docs/MASTER_PLAN.md\" | sed \"s/\[COMPLETED\]/✅/;s/\[IN_PROGRESS\]/⚡/;s/\[PENDING\]/○/;s/\[BLOCKED\]/🚫/\" | head -20'" \
  Enter

# Focus back on main pane
tmux select-pane -t "${SESSION}:0.0"

echo ""
echo "✅ Session '$SESSION' started."
echo ""
echo "  Left pane:   Claude live output + loop status"
echo "  Right pane:  Git commits + sprint tracker (auto-refreshes every 3s)"
echo ""
echo "  Attach:  tmux attach -t $SESSION"
echo "  Detach:  Ctrl+B then D"
echo "  Kill:    tmux kill-session -t $SESSION"
echo ""
