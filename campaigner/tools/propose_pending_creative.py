"""
tools/propose_pending_creative.py — insert a pending Clara brief into `creative_gallery`.

Called by Flow C (Mon firehose) per campaign. Writes a row with:

    kind         = 'video'
    status       = 'pending'
    generated_by = 'clara'
    hebrew_brief, source_asset_ids[2..3], expires_at = now() + 7d

No third-party calls, no spend. The daily Flow I runner consumes oldest pending
rows FIFO (cap 2/day), drives Clara via Playwright, and flips the row to
`status='generated'` with `storage_url` populated.

Cap enforcement: counts `status='pending'` rows for the business created in
the last 7 days. Rejects insert above 14 (the weekly Monday cap × 7 days × 2/day
matches the daily Flow I throughput).

Source-asset validation: every UUID in `--source-asset-ids` must reference an
existing, non-deleted `creative_gallery` row for the same business with
`kind IN ('image','video')`. Pending / expired rows are not valid sources
(they don't have storage_url yet).

Exit codes per contract §11.6 (0 / 1 / 2).
"""

from __future__ import annotations

import argparse
import json

from campaigner.lib.config import Config, ConfigError
from campaigner.lib.db import fetch_all, get_connection
from campaigner.tools._contract import (
    emit_runtime_error,
    emit_success,
    emit_validation_error,
    parse_json_arg,
    with_db_retry,
)

WEEKLY_PENDING_CAP = 14  # 7 days × 2/day Clara cap (Flow I)
EXPIRY_DAYS = 7
UUID_RE_LEN = 36  # crude but good-enough for sanity-checking


def _validate_uuid_list(raw: object) -> list[str]:
    """Coerce `raw` into a list of 2-3 UUID strings or exit with validation error."""
    if not isinstance(raw, list):
        emit_validation_error("--source-asset-ids must be a JSON list")
        return []  # unreachable
    if len(raw) not in (2, 3):
        emit_validation_error(
            f"--source-asset-ids must contain exactly 2 or 3 entries (got {len(raw)})"
        )
        return []  # unreachable
    out: list[str] = []
    for i, item in enumerate(raw):
        if not isinstance(item, str) or len(item) != UUID_RE_LEN or item.count("-") != 4:
            emit_validation_error(
                f"--source-asset-ids[{i}] is not a UUID string: {item!r}"
            )
            return []  # unreachable
        out.append(item)
    if len(set(out)) != len(out):
        emit_validation_error("--source-asset-ids contains duplicates")
    return out


def _count_pending_in_last_week(business_id: str) -> int:
    rows = fetch_all(
        """
        SELECT count(*) AS n
          FROM creative_gallery
         WHERE business_id = %s
           AND status = 'pending'
           AND created_at > now() - interval '7 days'
        """,
        (business_id,),
    )
    return int(rows[0]["n"])


def _validate_source_assets(business_id: str, ids: list[str]) -> None:
    """Confirm every source asset exists, belongs to the business, and is a
    usable kind. Exit 2 on validation failure."""
    rows = fetch_all(
        """
        SELECT id::text AS id, kind, status, deleted_at
          FROM creative_gallery
         WHERE id = ANY(%s::uuid[])
           AND business_id = %s
        """,
        (ids, business_id),
    )
    found = {row["id"]: row for row in rows}
    missing = [i for i in ids if i not in found]
    if missing:
        emit_validation_error(
            "source_asset_ids not found in creative_gallery for this business",
            detail={"missing": missing},
        )
    bad: list[dict] = []
    for sid in ids:
        row = found[sid]
        if row["deleted_at"] is not None:
            bad.append({"id": sid, "reason": "deleted"})
            continue
        if row["kind"] not in ("image", "video"):
            bad.append({"id": sid, "reason": f"kind={row['kind']}"})
            continue
        if row["status"] not in ("active", "generated", "archived"):
            # archived is OK as long as deleted_at is NULL (very rare).
            # pending / expired rows have no storage_url yet — not usable.
            bad.append({"id": sid, "reason": f"status={row['status']}"})
    if bad:
        emit_validation_error(
            "one or more source assets are not usable as Clara inputs",
            detail={"bad": bad},
        )


def main() -> None:
    p = argparse.ArgumentParser(
        description=(
            "Insert a pending Clara brief into creative_gallery. "
            "Flow C (Mon) calls this once per active campaign that needs a fresh creative."
        ),
    )
    p.add_argument("--business-id", required=True)
    p.add_argument(
        "--run-id",
        required=True,
        help="created_by_run_id stamp — kept in the agent_decisions trail by the caller",
    )
    p.add_argument(
        "--hebrew-brief",
        required=True,
        help=(
            "Free Hebrew atmosphere prompt sent verbatim to Clara. "
            "No structured fields; focus on atmosphere + goal "
            "(e.g. 'מסעדת שף בראשון לציון עם תפריט ים-תיכוני מודרני')."
        ),
    )
    p.add_argument(
        "--source-asset-ids",
        required=True,
        help=(
            "JSON list of exactly 2 or 3 creative_gallery row UUIDs. Each must "
            "be kind='image' or kind='video' (videos get one frame extracted "
            "by ffmpeg in Flow I). e.g. '[\"uuid1\",\"uuid2\",\"uuid3\"]'"
        ),
    )
    args = p.parse_args()

    brief = args.hebrew_brief.strip()
    if not brief:
        emit_validation_error("--hebrew-brief is empty")
        return
    if len(brief) > 4000:
        emit_validation_error(
            f"--hebrew-brief is {len(brief)} chars; cap at 4000 to keep Clara happy"
        )
        return

    raw_ids = parse_json_arg(args.source_asset_ids, "source-asset-ids")
    source_ids = _validate_uuid_list(raw_ids)

    try:
        Config.load().require_db()
    except ConfigError as e:
        emit_validation_error(str(e))
        return

    # Hard cap (guardrail pending_brief_weekly_cap_14).
    try:
        n_pending = with_db_retry(lambda: _count_pending_in_last_week(args.business_id))
    except Exception as e:
        emit_runtime_error(f"pending-count query failed: {e}", exc=e)
        return
    if n_pending >= WEEKLY_PENDING_CAP:
        emit_validation_error(
            f"weekly pending-brief cap reached ({n_pending}/{WEEKLY_PENDING_CAP}). "
            f"Flow I will drain ≤ 2/day; wait or expire stale rows.",
            detail={"current_pending_count": n_pending, "cap": WEEKLY_PENDING_CAP},
        )
        return

    # Source-asset validation (guardrail pending_brief_must_have_2_3_sources +
    # existence + usability).
    try:
        with_db_retry(lambda: _validate_source_assets(args.business_id, source_ids))
    except Exception as e:
        emit_runtime_error(f"source-asset validation failed: {e}", exc=e)
        return

    def _do_insert() -> dict:
        with get_connection() as conn, conn.cursor() as cur:
            cur.execute(
                f"""
                INSERT INTO creative_gallery (
                  business_id, kind, status, generated_by,
                  hebrew_brief, source_asset_ids, expires_at
                )
                VALUES (
                  %s, 'video', 'pending', 'clara',
                  %s, %s::uuid[], now() + interval '{EXPIRY_DAYS} days'
                )
                RETURNING id, status, created_at, expires_at
                """,
                (args.business_id, brief, source_ids),
            )
            return cur.fetchone()

    try:
        row = with_db_retry(_do_insert)
    except Exception as e:
        emit_runtime_error(f"creative_gallery insert failed: {e}", exc=e)
        return

    emit_success(
        {
            "gallery_id": str(row["id"]),
            "business_id": args.business_id,
            "run_id": args.run_id,
            "status": row["status"],
            "kind": "video",
            "generated_by": "clara",
            "source_asset_ids": source_ids,
            "expires_at": row["expires_at"].isoformat(),
            "created_at": row["created_at"].isoformat(),
            "pending_count_after_insert": n_pending + 1,
            "weekly_cap": WEEKLY_PENDING_CAP,
        }
    )


if __name__ == "__main__":
    main()
