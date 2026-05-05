"""
tools/propose_task.py — insert a row into `approvals` (the HITL queue).

This is the ONLY way Claude can propose an action to a human. The agent
never acts on Meta directly from the observe-propose flow — every change
goes through this table, which is read by `execute_approvals.sh` after a
human (or auto-approval rule) flips `status='approved'`.

Exit codes per contract §11.6 (0 / 1 / 2).
"""

from __future__ import annotations

import argparse
import json
from datetime import UTC, datetime, timedelta

from campaigner.lib.config import Config, ConfigError
from campaigner.lib.db import get_connection
from campaigner.tools._contract import (
    emit_runtime_error,
    emit_success,
    emit_validation_error,
    parse_json_arg,
    with_db_retry,
)

# Per spec §10.4 comment on `task_type`:
VALID_TASK_TYPES = (
    "budget_change",
    "pause_campaign",
    "resume_campaign",
    "pause_adset",
    "new_creative",
    "new_campaign",
    "scale_up",
    "scale_down",
    "expand_audience",
)

VALID_TARGET_KINDS = ("campaign", "adset", "ad", "creative", "account")
VALID_URGENCIES = ("low", "medium", "high", "urgent")


def main() -> None:
    p = argparse.ArgumentParser(
        description="Propose an action for human approval (insert into approvals).",
    )
    p.add_argument("--business-id", required=True)
    p.add_argument(
        "--run-id", required=True, help="created_by_run_id — links proposal to its invoke"
    )
    p.add_argument("--task-type", required=True, choices=VALID_TASK_TYPES)
    p.add_argument(
        "--payload",
        required=True,
        help='JSON dict with proposal specifics (e.g. {"new_daily_budget_cents":6500,"old":5000})',
    )
    p.add_argument("--rationale", required=True, help="Why this is being proposed")

    p.add_argument("--target-kind", choices=VALID_TARGET_KINDS, default=None)
    p.add_argument(
        "--target-id", default=None, help="Meta object id (required when target-kind is set)"
    )
    p.add_argument(
        "--expected-impact", default=None, help="JSON dict, e.g. {'expected_cpa_change_pct':-12}"
    )
    p.add_argument("--urgency", choices=VALID_URGENCIES, default="medium")
    p.add_argument(
        "--expires-in-hours",
        type=float,
        default=48.0,
        help="How long this proposal stays 'pending' before auto-expire (default 48h)",
    )

    args = p.parse_args()

    # Validation
    if args.target_kind is not None and not args.target_id:
        emit_validation_error("--target-id is required when --target-kind is given")
    if args.expires_in_hours <= 0 or args.expires_in_hours > 24 * 30:
        emit_validation_error(
            f"--expires-in-hours must be in (0, 720] (got {args.expires_in_hours})"
        )

    payload = parse_json_arg(args.payload, "payload")
    if not isinstance(payload, dict | list):
        emit_validation_error("--payload must be a JSON object or array")

    expected_impact = parse_json_arg(args.expected_impact, "expected-impact")
    if expected_impact is not None and not isinstance(expected_impact, dict | list):
        emit_validation_error("--expected-impact must be a JSON object or array")

    expires_at = datetime.now(UTC) + timedelta(hours=args.expires_in_hours)

    try:
        Config.load().require_db()
    except ConfigError as e:
        emit_validation_error(str(e))
        return

    def _do_insert() -> dict:
        with get_connection() as conn, conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO approvals (
                    business_id, created_by_run_id, task_type,
                    target_kind, target_id,
                    payload, rationale, expected_impact,
                    urgency, expires_at
                )
                VALUES (
                    %s, %s, %s,
                    %s, %s,
                    %s::jsonb, %s, %s::jsonb,
                    %s, %s
                )
                RETURNING id, status, created_at, expires_at
                """,
                (
                    args.business_id,
                    args.run_id,
                    args.task_type,
                    args.target_kind,
                    args.target_id,
                    json.dumps(payload),
                    args.rationale,
                    json.dumps(expected_impact) if expected_impact is not None else None,
                    args.urgency,
                    expires_at,
                ),
            )
            return cur.fetchone()

    try:
        row = with_db_retry(_do_insert)
    except Exception as e:
        emit_runtime_error(f"approvals insert failed: {e}", exc=e)
        return

    emit_success(
        {
            "approval_id": str(row["id"]),
            "business_id": args.business_id,
            "task_type": args.task_type,
            "target_kind": args.target_kind,
            "target_id": args.target_id,
            "status": row["status"],
            "urgency": args.urgency,
            "created_at": row["created_at"].isoformat(),
            "expires_at": row["expires_at"].isoformat(),
        }
    )


if __name__ == "__main__":
    main()
