"""
tools/execute_task.py — dispatch an approved task to Meta and persist the result.

The keystone of Flow B. For a given `approval_id` in status='approved':
  1. Load the row.
  2. Dispatch by task_type to the appropriate MetaClient method.
  3. On success: set status='executed', stash execution_result.
  4. On failure: raise — the runner handles it (calls mark_failed + logs error).

Supported task_types (MVP):
  - budget_change        → MetaClient.update_budget
  - scale_up / scale_down → MetaClient.update_budget (new = old ± delta)
  - pause_campaign       → MetaClient.update_status(campaign, PAUSED)
  - resume_campaign      → MetaClient.update_status(campaign, ACTIVE)
  - pause_adset          → MetaClient.update_status(adset, PAUSED)
  - new_campaign         → MetaClient.create_complete_image_ad / video_ad

Deferred to v2 (returns an error):
  - new_creative         (requires ad + creative linking on existing adset)
  - expand_audience      (requires targeting update not yet in MetaClient)

The tool is **idempotent**: re-running on an already-executed row prints the
prior result and exits 0 without calling Meta again.

Contract: §11.6 (JSON stdout, exit 0/1/2).
"""
from __future__ import annotations

import argparse
import json
from typing import Any

from campaigner.lib.config import Config, ConfigError
from campaigner.lib.db import fetch_one, get_connection
from campaigner.lib.meta_client import MetaClient
from campaigner.tools._contract import (
    emit_runtime_error,
    emit_success,
    emit_validation_error,
    with_db_retry,
)


UNSUPPORTED_MVP = {"new_creative", "expand_audience"}


def _load_approval(approval_id: str) -> dict | None:
    return fetch_one(
        """
        SELECT id, business_id, task_type, target_kind, target_id,
               payload, urgency, status, execution_result
        FROM approvals
        WHERE id = %s
        """,
        (approval_id,),
    )


def _persist_success(approval_id: str, meta_result: dict) -> dict:
    with get_connection() as conn, conn.cursor() as cur:
        cur.execute(
            """
            UPDATE approvals
               SET status = 'executed',
                   executed_at = now(),
                   execution_result = %s::jsonb
             WHERE id = %s AND status IN ('approved', 'pending')
            RETURNING id, status, executed_at
            """,
            (json.dumps(meta_result, default=str), approval_id),
        )
        return cur.fetchone()


def _dispatch(client: MetaClient, approval: dict) -> dict:
    task = approval["task_type"]
    payload = approval.get("payload") or {}
    target_id = approval.get("target_id")
    target_kind = approval.get("target_kind")

    if task in UNSUPPORTED_MVP:
        raise NotImplementedError(f"task_type '{task}' is not yet wired to MetaClient in MVP")

    if task == "budget_change" or task in ("scale_up", "scale_down"):
        new_ils = payload.get("new_daily_budget_ils")
        if new_ils is None and "new_daily_budget_cents" in payload:
            new_ils = payload["new_daily_budget_cents"] / 100
        if new_ils is None:
            raise ValueError("payload must contain new_daily_budget_ils or new_daily_budget_cents")
        # MetaClient expects USD; Meta itself denominates in agorot via internal conversion.
        # Simplest path: pass ILS as "USD" to MetaClient — but the correct API is
        # to have MetaClient accept a currency. For MVP Aiweon is Hebrew-only ILS.
        usd_equivalent = float(new_ils) / float(client._m().usdils_rate)
        kind = "adset" if target_kind == "adset" else "campaign"
        return client.update_budget(object_type=kind, object_id=target_id, daily_budget_usd=usd_equivalent)

    if task == "pause_campaign":
        return client.update_status("campaign", target_id, "PAUSED")
    if task == "resume_campaign":
        return client.update_status("campaign", target_id, "ACTIVE")
    if task == "pause_adset":
        # spec uses task_type=pause_adset even when target_kind='ad' (§Gate 1 creative kills).
        kind = target_kind if target_kind in ("adset", "ad") else "adset"
        return client.update_status(kind, target_id, "PAUSED")

    if task == "new_campaign":
        creative_kind = payload.get("creative_kind", "image")
        if creative_kind == "video":
            return client.create_complete_video_ad(**{k: v for k, v in payload.items() if k != "creative_kind"})
        return client.create_complete_image_ad(**{k: v for k, v in payload.items() if k != "creative_kind"})

    raise ValueError(f"unknown task_type: {task}")


def main() -> None:
    p = argparse.ArgumentParser(description="Execute an approved task against Meta.")
    p.add_argument("--approval-id", required=True)
    p.add_argument("--dry-run", action="store_true",
                   help="skip the Meta call; log what would happen. Does NOT update approval status.")
    args = p.parse_args()

    try:
        cfg = Config.load()
        cfg.require_db()
    except ConfigError as e:
        emit_validation_error(str(e))
        return

    try:
        approval = with_db_retry(lambda: _load_approval(args.approval_id))
    except Exception as e:
        emit_runtime_error(f"approval load failed: {e}", exc=e)
        return

    if approval is None:
        emit_validation_error(f"approval not found: {args.approval_id}")
        return

    # Idempotency: already-executed rows return the stored result without calling Meta.
    if approval["status"] == "executed":
        emit_success({
            "approval_id": str(approval["id"]),
            "status": "executed",
            "meta_result": approval.get("execution_result"),
            "already_executed": True,
        })
        return

    if approval["status"] != "approved":
        emit_validation_error(
            f"approval status='{approval['status']}' — execute requires 'approved'"
        )
        return

    if args.dry_run:
        emit_success({
            "approval_id": str(approval["id"]),
            "dry_run": True,
            "task_type": approval["task_type"],
            "target_kind": approval["target_kind"],
            "target_id": approval["target_id"],
            "payload": approval["payload"],
            "would_call": "MetaClient dispatch (skipped in dry-run)",
        })
        return

    # Requires Meta creds from this point forward.
    try:
        cfg.require_meta()
    except ConfigError as e:
        emit_runtime_error(f"meta credentials missing: {e}", exc=e)
        return

    try:
        client = MetaClient(cfg)
        meta_result: Any = _dispatch(client, approval)
    except NotImplementedError as e:
        emit_runtime_error(str(e), exc=e)
        return
    except Exception as e:
        emit_runtime_error(f"Meta dispatch failed: {e}", exc=e)
        return

    try:
        row = with_db_retry(lambda: _persist_success(str(approval["id"]), meta_result))
    except Exception as e:
        # Meta call SUCCEEDED but DB update failed — this is the nasty failure mode.
        # Emit runtime error so runner logs and mark_failed records the discrepancy.
        emit_runtime_error(
            f"meta call succeeded but approval update failed: {e}. "
            f"meta_result={meta_result}",
            exc=e,
        )
        return

    emit_success({
        "approval_id": str(row["id"]),
        "status": row["status"],
        "executed_at": row["executed_at"].isoformat(),
        "meta_result": meta_result,
    })


if __name__ == "__main__":
    main()
