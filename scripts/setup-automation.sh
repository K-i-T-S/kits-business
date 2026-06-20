#!/usr/bin/env bash
# KiTS Automation Setup — run once to start everything
set -euo pipefail

REPO="/home/casio699/KiTS/kits-business"
CLAUDE="/home/casio699/.local/bin/claude"

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║   KiTS Autonomous Build — Setup          ║"
echo "╚══════════════════════════════════════════╝"
echo ""

echo "► Checking Claude authentication..."
if ! "$CLAUDE" --version &>/dev/null; then
  echo "✗ Claude Code CLI not found at $CLAUDE"
  exit 1
fi
echo "  ✓ Claude: $("$CLAUDE" --version 2>/dev/null | head -1)"

echo "► Checking tmux..."
if ! command -v tmux &>/dev/null; then
  echo "  tmux not found — install it first: sudo apt install tmux"
  echo "  Then re-run this script."
  exit 1
fi
echo "  ✓ tmux: $(tmux -V)"

mkdir -p "$REPO/logs"

echo "► Enabling user linger (session survives logout)..."
loginctl enable-linger "$USER" 2>/dev/null && echo "  ✓ Linger enabled" || \
  echo "  ⚠ Linger not available — session will stop on logout (keep terminal open or use screen/nohup)"

echo "► Installing watchdog crontab..."
CRON_LINE="*/30 * * * * bash $REPO/scripts/watchdog.sh >> $REPO/logs/watchdog.log 2>&1"
# `crontab -l` exits 1 when no crontab exists — the `|| true` prevents pipefail from killing the script
# `grep -v` also exits 1 if nothing passes through — same fix
{ crontab -l 2>/dev/null || true; } | { grep -v "kits-business/scripts/watchdog" || true; echo "$CRON_LINE"; } | crontab -
echo "  ✓ Watchdog runs every 30 minutes"

echo "► Starting tmux session..."
bash "$REPO/scripts/tmux-kits.sh"

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  ✅ Automation is running!                                   ║"
echo "╠══════════════════════════════════════════════════════════════╣"
echo "║  Watch live:  tmux attach -t kits-build                     ║"
echo "║  Detach:      Ctrl+B then D  (loop keeps running)           ║"
echo "║  Check logs:  tail -f $REPO/logs/loop-*.log"
echo "║  Stop:        tmux kill-session -t kits-build               ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "The loop will:"
echo "  • Execute one sprint at a time, commit after each"
echo "  • Wait 5 min between sprints (cooldown)"
echo "  • Detect Pro usage limits and sleep 5 hours automatically"
echo "  • Restart via watchdog if the session ever crashes"
echo "  • Stop cleanly when all sprints in MASTER_PLAN.md are done"
echo ""
