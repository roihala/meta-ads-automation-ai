#!/usr/bin/env bash
# runners/weekly_competitive_research.sh
#
# Flow D — Weekly competitive research. Mon 11:00 Asia/Jerusalem (1h after Flow C).
#
# Agent does live WebSearch shaped by business_knowledge (vertical, products,
# service_regions, competitors), synthesizes 3-5 findings about market prices,
# trending creative angles, and new ad formats in the business's vertical, and
# proposes them as `task_type='alert'` rows in `approvals`. Every claim about
# a competitor or market figure requires sources[] — enforced by guardrail
# §27 `no_competitor_hallucinations`.
#
# This flow does NOT call Meta. It only reads business_knowledge from
# Postgres and writes proposals + decisions. WebSearch + WebFetch are invoked
# by Claude directly (no Python wrappers).

set -euo pipefail

FLOW="weekly_competitive_research"
START_TS=$(date +%s%3N)

: "${BUSINESS_ID:?BUSINESS_ID must be set}"
: "${ANTHROPIC_API_KEY:?ANTHROPIC_API_KEY must be set}"

cd "$(dirname "$0")/.."

python -m campaigner.tools.heartbeat \
  --business-id "$BUSINESS_ID" \
  --flow "$FLOW" \
  --phase start >/dev/null

on_error() {
  local exit_code=$?
  local duration=$(($(date +%s%3N) - START_TS))
  python -m campaigner.tools.heartbeat \
    --business-id "$BUSINESS_ID" \
    --flow "$FLOW" \
    --phase error \
    --exit-code "$exit_code" \
    --duration-ms "$duration" \
    --error-message "runner exited non-zero" || true
  exit "$exit_code"
}
trap on_error ERR

# --allowedTools surfaces WebSearch + WebFetch into the headless session.
# Bug found during 2026-05-17 scan: without these the flow no-op's every
# Monday with "web_search_permission_missing" because the default headless
# tool surface doesn't include web tools. Bash is included because Claude
# needs it to call python -m campaigner.tools.{log_decision, propose_task,
# heartbeat}.
claude -p \
  --output-format json \
  --allowedTools "WebSearch,WebFetch,Bash" \
  "BUSINESS_ID=$BUSINESS_ID. Run the weekly competitive research per campaigner/CAMPAIGNER.md."

DURATION=$(($(date +%s%3N) - START_TS))
python -m campaigner.tools.heartbeat \
  --business-id "$BUSINESS_ID" \
  --flow "$FLOW" \
  --phase end \
  --duration-ms "$DURATION" \
  --exit-code 0 >/dev/null

echo "✓ $FLOW completed in ${DURATION}ms"
