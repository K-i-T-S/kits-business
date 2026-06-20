#!/usr/bin/env bash
# KiTS Auto Sprint Runner — executes the next [PENDING] sprint via Claude Code CLI
# Usage: bash scripts/auto-sprint.sh [sprint_id]
#   sprint_id: optional — force a specific sprint ID (e.g. "1.1")
set -euo pipefail

PLAN_FILE="docs/MASTER_PLAN.md"
FORCE_ID="${1:-}"
mkdir -p logs
LOG="logs/sprint-$(date -u +%Y%m%d-%H%M%S).log"

log() { echo "$*" | tee -a "$LOG"; }

log "=============================="
log " KiTS Auto Sprint Runner"
log " $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
log "=============================="

[ -f "$PLAN_FILE" ] || { log "ERROR: $PLAN_FILE not found"; exit 1; }

# ── Find target sprint ────────────────────────────────────────────
if [ -n "$FORCE_ID" ]; then
  MATCH=$(grep -nE "^### Sprint ${FORCE_ID}[[:space:]]" "$PLAN_FILE" | head -1)
else
  MATCH=$(grep -nE '^\s*### Sprint.*\[PENDING\]' "$PLAN_FILE" | head -1)
fi

[ -n "$MATCH" ] || { log "No pending sprints found."; exit 0; }

LINE=$(echo "$MATCH" | cut -d: -f1)
HEADER=$(echo "$MATCH" | cut -d: -f2- | sed 's/^ *//' | sed 's/ \[PENDING\]//' | sed 's/ \[BLOCKED\]//')
log "Sprint: $HEADER (line $LINE)"

# ── Extract sprint block (header → next ### or end, max 150 lines) ─
BLOCK=$(awk "NR==$LINE{p=1} p && NR>$LINE && /^### Sprint /{exit} p{print}" "$PLAN_FILE" | head -150)

# ── Mark IN_PROGRESS ──────────────────────────────────────────────
sed -i "${LINE}s/\[PENDING\]/[IN_PROGRESS]/" "$PLAN_FILE"
log "Marked [IN_PROGRESS]"

# ── Build prompt ──────────────────────────────────────────────────
PROMPT=$(cat <<PROMPT
You are the KiTS Business Terminal autonomous build agent.
Repository root: $(pwd)
Date: $(date -u '+%Y-%m-%d')

MISSION: Execute the sprint marked [IN_PROGRESS] in $PLAN_FILE completely.

MANDATORY FIRST STEPS:
1. Read $PLAN_FILE — understand the full vision, principles, and the [IN_PROGRESS] sprint
2. Read src/components/Layout.tsx — understand nav structure and theme
3. Read the source files mentioned in the sprint BEFORE editing them

SPRINT TO EXECUTE:
$HEADER
$BLOCK

EXECUTION RULES:
- TypeScript strict: no 'any', all functions typed, no implicit returns
- After ALL changes: run npm run typecheck — fix EVERY error before finishing
- After typecheck: run npm run lint:fix
- Dark navy theme: bg-slate-900/950, text-white, border-white/10
- Mobile-first: all new UI must work at 375px
- All text through useTranslation() — no hardcoded English strings
- No placeholder or half-implemented features — ship complete

WHEN DONE (CRITICAL):
- Update $PLAN_FILE: change [IN_PROGRESS] to [COMPLETED] on sprint header line
- Add one line below the header: > Completed $(date -u '+%Y-%m-%d'): [one-line summary]
- If you cannot complete: change to [BLOCKED] and explain why in a note

DO NOT ask questions. Execute completely.
PROMPT
)

# ── Run Claude ────────────────────────────────────────────────────
log "Launching Claude Code CLI..."
echo "$PROMPT" | claude \
  --dangerously-skip-permissions \
  --model claude-sonnet-4-6 \
  -p "$PROMPT" \
  2>&1 | tee -a "$LOG"
STATUS=${PIPESTATUS[0]}

log ""
log "=============================="
log " Exit: $STATUS | Log: $LOG"
log "=============================="

# ── Verify plan updated ───────────────────────────────────────────
if grep -qE "^### Sprint.*\[IN_PROGRESS\]" "$PLAN_FILE"; then
  log "WARNING: Sprint still [IN_PROGRESS] — Claude may not have updated plan"
fi

exit $STATUS
