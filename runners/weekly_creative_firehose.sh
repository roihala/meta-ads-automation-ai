#!/usr/bin/env bash
# runners/weekly_creative_firehose.sh
#
# Flow C — Per active campaign, write 3-5 fresh-creative proposals.
#   - `redeploy_creative` proposals when ≥3 viable unused gallery assets exist
#     (HITL via `approvals`).
#   - Otherwise: pending Clara briefs written directly into `creative_gallery`
#     with status='pending' via `propose_pending_creative.py`. The daily
#     Flow I runner (`daily_clara_generate.sh`) consumes them ≤2/day,
#     drives Clara via Playwright, and queues a `task_type='upload_creative'`
#     approval for the operator. Hard cap: 14 pending briefs/week.
#
# Scheduled: Mon 10:00 Asia/Jerusalem.
#
# No Meta calls from this flow. Imagen path retired 2026-05-26 — see
# docs/plans/clara-video-flow.md.

set -euo pipefail

FLOW="weekly_creative_firehose"
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

claude -p \
  --output-format json \
  "BUSINESS_ID=$BUSINESS_ID. Run the weekly creative firehose per campaigner/CAMPAIGNER.md."

DURATION=$(($(date +%s%3N) - START_TS))
python -m campaigner.tools.heartbeat \
  --business-id "$BUSINESS_ID" \
  --flow "$FLOW" \
  --phase end \
  --duration-ms "$DURATION" \
  --exit-code 0 >/dev/null

echo "✓ $FLOW completed in ${DURATION}ms"
