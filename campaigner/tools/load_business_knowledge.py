"""
tools/load_business_knowledge.py — read business + knowledge row as JSON.

Used by observe-propose Step 1 so Claude has the vertical, primary_kpi,
questionnaire answers, brand voice, competitors — everything that shapes
diagnosis and rationale writing.

Contract: §11.6 (JSON stdout, exit 0/1/2).
"""
from __future__ import annotations

import argparse

from campaigner.lib.config import Config, ConfigError
from campaigner.lib.db import fetch_one
from campaigner.tools._contract import (
    emit_runtime_error,
    emit_success,
    emit_validation_error,
    with_db_retry,
)


def main() -> None:
    p = argparse.ArgumentParser(description="Load business + business_knowledge for Claude context.")
    p.add_argument("--business-id", required=True)
    args = p.parse_args()

    try:
        Config.load().require_db()
    except ConfigError as e:
        emit_validation_error(str(e))
        return

    try:
        business = with_db_retry(lambda: fetch_one(
            """
            SELECT id, name, timezone, meta_ad_account_id, meta_page_id,
                   meta_auth_mode, gcp_project_id,
                   monthly_budget_ils, daily_budget_ils, primary_kpi,
                   active, created_at
            FROM businesses
            WHERE id = %s
            """,
            (args.business_id,),
        ))
        if business is None:
            emit_validation_error(f"business not found: {args.business_id}")
            return
        knowledge = with_db_retry(lambda: fetch_one(
            """
            SELECT vertical, website_url, service_regions,
                   customer_age_min, customer_age_max,
                   products, delivery_time_days,
                   strong_seasons, weak_seasons,
                   questionnaire_answers, brand_voice, competitors,
                   last_refreshed_at
            FROM business_knowledge
            WHERE business_id = %s
            """,
            (args.business_id,),
        ))
    except Exception as e:
        emit_runtime_error(f"business knowledge load failed: {e}", exc=e)
        return

    emit_success({
        "business_id": args.business_id,
        "business": business,
        "knowledge": knowledge,
        "knowledge_present": knowledge is not None,
    })


if __name__ == "__main__":
    main()
