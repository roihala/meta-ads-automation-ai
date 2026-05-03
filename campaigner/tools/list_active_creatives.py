"""
tools/list_active_creatives.py — fetch creatives that have been uploaded to Meta.

Used by Flow C (weekly_creative_firehose) to know what's already live so new
proposals don't duplicate angles. Reads `creative_gallery` rows with
`uploaded_to_meta_at IS NOT NULL`.

Contract: §11.6 (JSON stdout, exit 0/1/2).
"""
from __future__ import annotations

import argparse

from campaigner.lib.config import Config, ConfigError
from campaigner.lib.db import fetch_all
from campaigner.tools._contract import (
    emit_runtime_error,
    emit_success,
    emit_validation_error,
    with_db_retry,
)


def main() -> None:
    p = argparse.ArgumentParser(description="List active (uploaded-to-Meta) creatives from creative_gallery.")
    p.add_argument("--business-id", required=True)
    p.add_argument("--since-days", type=int, default=30, help="only creatives uploaded within N days")
    p.add_argument("--limit", type=int, default=100)
    args = p.parse_args()

    if args.since_days <= 0 or args.since_days > 365:
        emit_validation_error(f"--since-days must be 1..365 (got {args.since_days})")

    try:
        Config.load().require_db()
    except ConfigError as e:
        emit_validation_error(str(e))
        return

    try:
        rows = with_db_retry(lambda: fetch_all(
            """
            SELECT id, kind, aspect_ratio, dimensions,
                   headline, primary_text, cta,
                   marketing_angle, placement,
                   generated_by, meta_creative_id,
                   uploaded_to_meta_at, performance_snapshot,
                   created_at
            FROM creative_gallery
            WHERE business_id = %s
              AND uploaded_to_meta_at IS NOT NULL
              AND uploaded_to_meta_at >= now() - make_interval(days => %s)
            ORDER BY uploaded_to_meta_at DESC
            LIMIT %s
            """,
            (args.business_id, args.since_days, args.limit),
        ))
    except Exception as e:
        emit_runtime_error(f"creative_gallery fetch failed: {e}", exc=e)
        return

    # Angle distribution — helps firehose avoid over-concentrating on one angle.
    angles: dict[str, int] = {}
    for r in rows:
        key = r.get("marketing_angle") or "unspecified"
        angles[key] = angles.get(key, 0) + 1

    emit_success({
        "business_id": args.business_id,
        "count": len(rows),
        "angle_distribution": angles,
        "creatives": rows,
    })


if __name__ == "__main__":
    main()
