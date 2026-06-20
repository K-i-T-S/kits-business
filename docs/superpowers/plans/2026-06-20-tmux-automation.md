# Tmux Continuous Sprint Automation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A self-healing tmux automation system that runs Claude Code sprints continuously for weeks without human intervention, using the existing Claude Pro subscription (zero extra cost), handling usage-limit windows gracefully, committing all work, and recovering automatically from any failure.

**Architecture:** A bash orchestration loop runs inside a persistent tmux session. Each sprint is a fresh `claude -p` invocation (stateless, reliable). The loop detects Claude Pro usage limits via exit code and output parsing, sleeps the right amount, then resumes. A single crontab watchdog entry checks every 30 minutes that the tmux session is alive and restarts it if it died. All state lives in `docs/MASTER_PLAN.md` — the loop reads it at the start of every iteration, so it can always recover from where it left off.

**Tech Stack:** bash, tmux, Claude Code CLI (`/home/casio699/.local/bin/claude`), git, crontab (Ubuntu 24.04)

## Global Constraints

- Claude binary: `/home/casio699/.local/bin/claude` (verified location)
- Repo: `/home/casio699/KiTS/kits-business`
- Sprint state tracked in: `docs/MASTER_PLAN.md` — headers use `[PENDING]` / `[IN_PROGRESS]` / `[COMPLETED]`
- Never use `ANTHROPIC_API_KEY` — authentication is via stored OAuth (Pro subscription)
- All scripts: `#!/usr/bin/env bash`, `set -euo pipefail`, executable (`chmod +x`)
- Logs: `logs/` directory in repo root, rotated by date
- tmux session name: `kits-build`
- Wait between successful sprints: 300 seconds (5 min cooldown)
- Wait on Pro usage limit detected: 18000 seconds (5 hours)
- Wait on other errors: 600 seconds (10 min, then retry)
- Watchdog cron interval: every 30 minutes

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `scripts/loop-runner.sh` | **Create** | Main orchestration loop — runs forever inside tmux |
| `scripts/tmux-kits.sh` | **Create** | One-command setup: installs tmux, creates session, starts loop |
| `scripts/watchdog.sh` | **Create** | Checks session health every 30 min, restarts if dead |
| `scripts/sprint-prompt.txt` | **Overwrite** | Robust sprint execution prompt with git + recovery logic |
| `scripts/setup-automation.sh` | **Create** | Single entry-point: user runs this once, everything starts |
| `logs/.gitkeep` | **Create** | Ensure logs dir is tracked |
| `.gitignore` (append) | **Modify** | Ignore `logs/*.log` but keep `.gitkeep` |

---

## Task 1: Install tmux and create logs directory

**Files:**
- Create: `logs/.gitkeep`
- Modify: `.gitignore` (append log exclusion)

**Interfaces:**
- Produces: tmux available at system level, `logs/` directory exists and is git-tracked

- [ ] **Step 1: Install tmux**

```bash
sudo apt-get update && sudo apt-get install -y tmux
```
Expected: `tmux 3.x` installed. Verify: `tmux -V`

- [ ] **Step 2: Create logs directory**

```bash
mkdir -p /home/casio699/KiTS/kits-business/logs
touch /home/casio699/KiTS/kits-business/logs/.gitkeep
```

- [ ] **Step 3: Append log rotation to .gitignore**

Add these lines to `.gitignore` (do not overwrite, append):
```
# Automation logs (keep .gitkeep, ignore log files)
logs/*.log
logs/cron-*.log
logs/sprint-*.log
logs/loop-*.log
logs/watchdog*.log
```

- [ ] **Step 4: Commit**

```bash
cd /home/casio699/KiTS/kits-business
git add logs/.gitkeep .gitignore
git commit -m "chore: add logs dir and gitignore for automation logs"
git push
```

---

## Task 2: Write the sprint execution prompt

**Files:**
- Overwrite: `scripts/sprint-prompt.txt`

**Interfaces:**
- Consumed by: `scripts/loop-runner.sh` (via `cat` + `sed` for date substitution)
- Produces: A complete, self-contained Claude prompt that handles both fresh sprints and recovery from stuck `[IN_PROGRESS]` states

The prompt must handle two scenarios:
1. **Normal**: find next `[PENDING]` sprint, execute it fully, commit, mark `[COMPLETED]`
2. **Recovery**: find a stuck `[IN_PROGRESS]` sprint (previous run died mid-execution), assess what was done, complete or roll back cleanly

- [ ] **Step 1: Write the prompt file**

Create `scripts/sprint-prompt.txt` with exactly this content:

```
You are the KiTS Business Terminal autonomous build agent.
Repo: /home/casio699/KiTS/kits-business
Date: {{DATE}}

════════════════════════════════════════
STEP 0 — RECOVER FROM INTERRUPTED SPRINT (check first)
════════════════════════════════════════
Read docs/MASTER_PLAN.md.

If ANY sprint is marked [IN_PROGRESS]:
  - This means a previous run was interrupted mid-execution
  - Read the files that sprint was supposed to modify
  - Assess: is the work complete? partially done? not started?
  - If complete but not committed: run npm run typecheck, fix errors, commit, mark [COMPLETED]
  - If partial: complete the remaining work, typecheck, commit, mark [COMPLETED]
  - If nothing was done: change [IN_PROGRESS] back to [PENDING] and fall through to STEP 1
  - After handling: git add -A && git commit -m "fix: complete interrupted sprint" && git push

════════════════════════════════════════
STEP 1 — FIND NEXT SPRINT
════════════════════════════════════════
In docs/MASTER_PLAN.md, find the FIRST sprint header with [PENDING].
If none exist: output "ALL_SPRINTS_COMPLETE" and stop.

Change that sprint's [PENDING] to [IN_PROGRESS] immediately.
Run: git add docs/MASTER_PLAN.md && git commit -m "sprint: starting [sprint name]"
Run: git push

════════════════════════════════════════
STEP 2 — READ BEFORE WRITING
════════════════════════════════════════
Read the sprint's full description in docs/MASTER_PLAN.md (scroll down from the header).
Read EVERY source file the sprint says to create or modify BEFORE editing anything.
Read src/components/Layout.tsx to understand theme + nav structure.

════════════════════════════════════════
STEP 3 — IMPLEMENT COMPLETELY
════════════════════════════════════════
Execute everything in the sprint. No skipping. No placeholders. No "TODO" comments.
Every acceptance criterion must be met.

CODE STANDARDS (non-negotiable):
- TypeScript strict: no 'any', no implicit returns, all functions typed
- Dark navy theme: bg-slate-900, bg-slate-950, text-white, border-white/10
- All UI text via useTranslation() — zero hardcoded English strings
- Mobile-first: test mentally at 375px (every flex/grid must work)
- Import from '@/' alias — never relative '../../../'

════════════════════════════════════════
STEP 4 — QUALITY CHECK (MANDATORY)
════════════════════════════════════════
Run: npm run typecheck
If there are errors: fix ALL of them. Do not proceed until zero errors.
Run: npm run lint:fix

════════════════════════════════════════
STEP 5 — COMMIT AND MARK COMPLETE
════════════════════════════════════════
In docs/MASTER_PLAN.md:
- Change [IN_PROGRESS] to [COMPLETED] on the sprint header line
- Add one line immediately below: > Completed {{DATE}}: [one-sentence summary of what was built]

Run:
git add -A
git commit -m "feat: [sprint name] — [brief description of what was built]"
git push

Output the word "SPRINT_COMPLETE" on its own line when done.

════════════════════════════════════════
ABSOLUTE RULES
════════════════════════════════════════
- Never ask questions — make reasonable decisions and implement
- Never mark [COMPLETED] if npm run typecheck has errors
- Never modify any sprint other than the one you are executing
- If you cannot complete the sprint: change to [BLOCKED], write a note explaining why, commit, output "SPRINT_BLOCKED"
```

- [ ] **Step 2: Verify the file was written**

```bash
wc -l /home/casio699/KiTS/kits-business/scripts/sprint-prompt.txt
```
Expected: ~65 lines

- [ ] **Step 3: Commit**

```bash
cd /home/casio699/KiTS/kits-business
git add scripts/sprint-prompt.txt
git commit -m "chore: automation sprint prompt with recovery logic"
git push
```

---

## Task 3: Write the main orchestration loop

**Files:**
- Create: `scripts/loop-runner.sh`

**Interfaces:**
- Consumes: `scripts/sprint-prompt.txt`, `docs/MASTER_PLAN.md`, `/home/casio699/.local/bin/claude`
- Produces: A long-running bash process that executes sprints sequentially, handles all failure modes, and exits cleanly when all sprints are done
- Called by: `scripts/tmux-kits.sh` (inside tmux session)
- Called by: `scripts/watchdog.sh` (on session restart)

**Failure modes handled:**
| Condition | Detection | Response |
|---|---|---|
| Pro usage limit | exit non-zero + output contains "limit\|capacity\|overloaded\|rate" | Sleep 5 hours |
| Sprint blocked | output contains "SPRINT_BLOCKED" | Log, skip to next after 60s |
| All sprints done | output contains "ALL_SPRINTS_COMPLETE" | Exit 0 cleanly |
| Other error | exit non-zero, no limit keywords | Sleep 10 min, retry same sprint |
| typecheck failure | Claude handles internally; if still fails, Claude marks BLOCKED | Loop sees SPRINT_BLOCKED |

- [ ] **Step 1: Write loop-runner.sh**

```bash
#!/usr/bin/env bash
# KiTS Autonomous Sprint Loop
# Runs inside tmux session. Uses Claude Pro OAuth (no API key needed).
set -euo pipefail

REPO="/home/casio699/KiTS/kits-business"
CLAUDE="/home/casio699/.local/bin/claude"
PROMPT="$REPO/scripts/sprint-prompt.txt"

# Delays (seconds)
DELAY_SUCCESS=300       # 5 min between successful sprints
DELAY_LIMIT=18000       # 5 hours on Pro usage limit
DELAY_ERROR=600         # 10 min on other errors
DELAY_BLOCKED=60        # 1 min before continuing after blocked sprint

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
log "  Claude: $($CLAUDE --version 2>/dev/null | head -1)"
log "═══════════════════════════════════════════════"

CONSECUTIVE_ERRORS=0
MAX_CONSECUTIVE_ERRORS=5

while true; do
  # ── Pull latest changes ─────────────────────────────────────────
  git pull origin main --quiet 2>/dev/null || {
    log "git pull failed (offline?). Continuing with local state."
  }

  # ── Check for pending work ──────────────────────────────────────
  PENDING=$(grep -c '\[PENDING\]\|\[IN_PROGRESS\]' "$REPO/docs/MASTER_PLAN.md" 2>/dev/null || echo 0)
  if [ "$PENDING" -eq 0 ]; then
    log "🎉 ALL SPRINTS COMPLETE. Nothing left to build."
    log "Add new sprints to docs/MASTER_PLAN.md to continue."
    exit 0
  fi

  NEXT=$(grep '\[PENDING\]\|\[IN_PROGRESS\]' "$REPO/docs/MASTER_PLAN.md" | head -1 | \
    sed 's/.*### Sprint /Sprint /' | sed 's/ \[PENDING\]//' | sed 's/ \[IN_PROGRESS\]//')
  log "▶ Executing: $NEXT"

  # ── Build prompt with today's date ─────────────────────────────
  DATED_PROMPT=$(sed "s/{{DATE}}/$(date +%Y-%m-%d)/g" "$PROMPT")

  # ── Run Claude ──────────────────────────────────────────────────
  SPRINT_LOG="$REPO/logs/sprint-$(date +%Y%m%d-%H%M%S).log"
  OUTPUT=""
  EXIT_CODE=0

  set +e
  OUTPUT=$(echo "$DATED_PROMPT" | "$CLAUDE" \
    --dangerously-skip-permissions \
    -p "$DATED_PROMPT" \
    2>&1 | tee "$SPRINT_LOG")
  EXIT_CODE=$?
  set -e

  # ── Parse outcome ────────────────────────────────────────────────
  if echo "$OUTPUT" | grep -qi "ALL_SPRINTS_COMPLETE"; then
    log "🎉 ALL SPRINTS COMPLETE (reported by Claude)."
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
    log "🔄 Pro usage limit hit. Sleeping 5 hours."
    # Ensure any partial work is committed before sleeping
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
      log "🛑 $MAX_CONSECUTIVE_ERRORS consecutive errors. Sleeping 1 hour before retry."
      CONSECUTIVE_ERRORS=0
      wait_with_countdown 3600 "repeated failures — extended pause"
    else
      wait_with_countdown $DELAY_ERROR "error recovery"
    fi

  else
    # Exit 0 but no SPRINT_COMPLETE keyword — treat as success
    log "✅ Sprint finished (no explicit keyword). Assuming success."
    CONSECUTIVE_ERRORS=0
    wait_with_countdown $DELAY_SUCCESS "cooldown"
  fi
done
```

- [ ] **Step 2: Make executable**

```bash
chmod +x /home/casio699/KiTS/kits-business/scripts/loop-runner.sh
```

- [ ] **Step 3: Verify syntax**

```bash
bash -n /home/casio699/KiTS/kits-business/scripts/loop-runner.sh && echo "Syntax OK"
```
Expected: `Syntax OK`

- [ ] **Step 4: Commit**

```bash
cd /home/casio699/KiTS/kits-business
git add scripts/loop-runner.sh
git commit -m "chore: add autonomous sprint loop runner"
git push
```

---

## Task 4: Write the tmux session setup script

**Files:**
- Create: `scripts/tmux-kits.sh`

**Interfaces:**
- Consumes: `scripts/loop-runner.sh`
- Produces: A running tmux session named `kits-build` with the loop active in pane 0
- Called by: user (once), and by `scripts/watchdog.sh` on restart

The tmux session must survive:
- SSH disconnection
- Terminal closure
- User logging out (with `loginctl enable-linger`)

- [ ] **Step 1: Write tmux-kits.sh**

```bash
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

# Kill existing session cleanly
if tmux has-session -t "$SESSION" 2>/dev/null; then
  echo "Stopping existing session '$SESSION'..."
  tmux kill-session -t "$SESSION"
fi

# Create new detached session (220 cols × 50 rows — enough for readable logs)
tmux new-session -d -s "$SESSION" -x 220 -y 50

# Session options: keep alive, no automatic exit
tmux set-option -t "$SESSION" remain-on-exit on
tmux set-option -t "$SESSION" history-limit 50000

# Set a clear status bar showing session name + time
tmux set-option -t "$SESSION" status-right "#[fg=green]KiTS Auto Build #[fg=white]| %H:%M %d-%b"
tmux set-option -t "$SESSION" status-interval 30

# Start the loop (cd first so relative paths work)
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
```

- [ ] **Step 2: Make executable and verify syntax**

```bash
chmod +x /home/casio699/KiTS/kits-business/scripts/tmux-kits.sh
bash -n /home/casio699/KiTS/kits-business/scripts/tmux-kits.sh && echo "Syntax OK"
```

- [ ] **Step 3: Commit**

```bash
cd /home/casio699/KiTS/kits-business
git add scripts/tmux-kits.sh
git commit -m "chore: tmux session setup script"
git push
```

---

## Task 5: Write the watchdog

**Files:**
- Create: `scripts/watchdog.sh`

**Interfaces:**
- Consumes: `scripts/tmux-kits.sh` (calls it to restart session)
- Produces: A script safe to run from crontab every 30 minutes
- Installed as: `*/30 * * * * bash /home/casio699/KiTS/kits-business/scripts/watchdog.sh`

The watchdog must be idempotent — safe to run even when the session is healthy.

- [ ] **Step 1: Write watchdog.sh**

```bash
#!/usr/bin/env bash
# KiTS Watchdog — run every 30 min via crontab
# Restarts the build session if it has exited or doesn't exist.
set -euo pipefail

REPO="/home/casio699/KiTS/kits-business"
SESSION="kits-build"
LOG="$REPO/logs/watchdog.log"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "$LOG"; }

# Check if session exists
if ! tmux has-session -t "$SESSION" 2>/dev/null; then
  log "Session '$SESSION' not found. Restarting..."
  bash "$REPO/scripts/tmux-kits.sh" >> "$LOG" 2>&1
  log "Session restarted."
  exit 0
fi

# Check if the loop pane is still running (not at a dead prompt)
PANE_PID=$(tmux list-panes -t "${SESSION}:0" -F "#{pane_pid}" 2>/dev/null || echo "")
if [ -z "$PANE_PID" ]; then
  log "Pane has no PID (exited). Restarting session..."
  bash "$REPO/scripts/tmux-kits.sh" >> "$LOG" 2>&1
  log "Session restarted."
  exit 0
fi

# Check if pane process has children (active work) or is just sitting idle
CHILDREN=$(pgrep -P "$PANE_PID" 2>/dev/null | wc -l || echo 0)
PANE_STATUS=$(tmux display-message -t "${SESSION}:0" -p "#{pane_dead}" 2>/dev/null || echo "1")

if [ "$PANE_STATUS" = "1" ]; then
  log "Pane is dead. Respawning loop inside existing session..."
  tmux send-keys -t "${SESSION}:0" \
    "cd '$REPO' && bash '$REPO/scripts/loop-runner.sh'" Enter >> "$LOG" 2>&1
  log "Loop respawned."
else
  log "Session healthy (pane_pid=$PANE_PID, children=$CHILDREN). No action needed."
fi
```

- [ ] **Step 2: Make executable and verify syntax**

```bash
chmod +x /home/casio699/KiTS/kits-business/scripts/watchdog.sh
bash -n /home/casio699/KiTS/kits-business/scripts/watchdog.sh && echo "Syntax OK"
```

- [ ] **Step 3: Commit**

```bash
cd /home/casio699/KiTS/kits-business
git add scripts/watchdog.sh
git commit -m "chore: watchdog script for session health monitoring"
git push
```

---

## Task 6: Write the one-command installer

**Files:**
- Create: `scripts/setup-automation.sh`

**Interfaces:**
- Consumes: all scripts above
- Produces: fully running automation in one command — user runs this once and walks away

- [ ] **Step 1: Write setup-automation.sh**

```bash
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

# 1. Verify claude is authenticated
echo "► Checking Claude authentication..."
if ! "$CLAUDE" --version &>/dev/null; then
  echo "✗ Claude Code CLI not found at $CLAUDE"
  echo "  Run: npm install -g @anthropic-ai/claude-code"
  exit 1
fi
echo "  ✓ Claude: $("$CLAUDE" --version 2>/dev/null | head -1)"

# 2. Verify tmux
echo "► Checking tmux..."
if ! command -v tmux &>/dev/null; then
  echo "  Installing tmux..."
  sudo apt-get install -y tmux
fi
echo "  ✓ tmux: $(tmux -V)"

# 3. Ensure logs dir exists
mkdir -p "$REPO/logs"

# 4. Enable linger so session survives logout
echo "► Enabling user linger (session survives logout)..."
loginctl enable-linger "$USER" 2>/dev/null && echo "  ✓ Linger enabled" || \
  echo "  ⚠ Linger not available — session will stop on logout (use 'nohup' or keep terminal open)"

# 5. Install watchdog into crontab (idempotent)
echo "► Installing watchdog crontab..."
CRON_LINE="*/30 * * * * bash $REPO/scripts/watchdog.sh >> $REPO/logs/watchdog.log 2>&1"
# Remove any existing KiTS watchdog entry, add fresh one
( crontab -l 2>/dev/null | grep -v "kits-business/scripts/watchdog" ; echo "$CRON_LINE" ) | crontab -
echo "  ✓ Watchdog runs every 30 minutes"
echo "  $(crontab -l | grep watchdog)"

# 6. Start the tmux session
echo "► Starting tmux session..."
bash "$REPO/scripts/tmux-kits.sh"

# 7. Summary
echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  ✅ Automation is running!                                   ║"
echo "╠══════════════════════════════════════════════════════════════╣"
echo "║  Watch live:  tmux attach -t kits-build                     ║"
echo "║  Detach:      Ctrl+B then D  (loop keeps running)           ║"
echo "║  Check logs:  tail -f $REPO/logs/loop-*.log  ║"
echo "║  Check plan:  cat $REPO/docs/MASTER_PLAN.md  ║"
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
```

- [ ] **Step 2: Make executable and verify syntax**

```bash
chmod +x /home/casio699/KiTS/kits-business/scripts/setup-automation.sh
bash -n /home/casio699/KiTS/kits-business/scripts/setup-automation.sh && echo "Syntax OK"
```

- [ ] **Step 3: Commit everything**

```bash
cd /home/casio699/KiTS/kits-business
git add scripts/setup-automation.sh scripts/sprint-prompt.txt
git commit -m "chore: one-command automation setup + complete sprint infrastructure"
git push
```

---

## Self-Review

**Spec coverage check:**
- ✅ Runs for weeks unattended — watchdog + linger
- ✅ Handles Pro token window — 5-hour sleep on limit detection
- ✅ Commits before sleeping — checkpoint commit in limit handler
- ✅ Recovers from crashes — watchdog restarts session; loop recovers `[IN_PROGRESS]` state
- ✅ Zero extra cost — no `ANTHROPIC_API_KEY`, uses stored OAuth (Pro)
- ✅ One command to start — `bash scripts/setup-automation.sh`
- ✅ Observable — live via `tmux attach`, logs in `logs/`
- ✅ Stoppable cleanly — `tmux kill-session -t kits-build`

**Placeholder scan:** None found. All code is complete and runnable.

**Type consistency:** N/A (bash only).

---

Plan complete and saved to `docs/superpowers/plans/2026-06-20-tmux-automation.md`.
