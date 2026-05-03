"""
tools/check_guardrails.py — deterministic check of a proposal against §14 guardrails.

Reads the proposal JSON + optional state JSON, runs every applicable guardrail,
returns structured pass/fail per rule. Claude calls this BEFORE writing the
proposal to approvals — if any guardrail fails, Claude logs a rejection and
skips the propose_task call.

The guardrails here are the ones the agent can check deterministically. Some
§14 rules (e.g. `no_competitor_hallucinations`) require judgment and are
enforced by prompts only — they are listed in `JUDGMENT_ONLY_RULES` and noted
as such in the output.

Contract: §11.6 (JSON stdout, exit 0/1/2).

State fields the checks consume (all optional):
  learning_status : 'LEARNING' | 'LEARNING_LIMITED' | 'ACTIVE'
  hook_rate       : float 0..1
  frequency       : float
  cpa_ils / cpr_ils / baseline_cpa_ils : numeric
  target_cpa_ils  : numeric
  last_conversion_hours_ago : float
  creative        : {"width": int, "height": int, "kind": "image|video|copy"}
  meta_creative_fatigue_flag : bool
  tracking_verified : bool
"""
from __future__ import annotations

import argparse
from typing import Any, Callable

from campaigner.lib.config import Config, ConfigError
from campaigner.lib.db import fetch_one
from campaigner.tools._contract import (
    emit_runtime_error,
    emit_success,
    emit_validation_error,
    parse_json_arg,
    with_db_retry,
)


# ----------------------------------------------------------------- results


def _pass(name: str, **kw) -> dict:
    return {"name": name, "passed": True, **kw}


def _fail(name: str, reason: str, **kw) -> dict:
    return {"name": name, "passed": False, "reason": reason, **kw}


def _skip(name: str, reason: str) -> dict:
    return {"name": name, "passed": True, "skipped": True, "reason": reason}


# -------------------------------------------------------- guardrail checks


def _no_delete_campaigns(prop: dict, state: dict, ctx: dict) -> dict:
    task = prop.get("task_type", "")
    if task.startswith("delete_"):
        return _fail("no_delete_campaigns", "pause is the only supported teardown path")
    return _pass("no_delete_campaigns")


def _max_tasks_per_day(prop: dict, state: dict, ctx: dict) -> dict:
    cap = ctx.get("daily_task_cap")
    if cap is None:
        return _skip("max_tasks_per_day", "daily_task_cap not provided in context — checked by caller")
    count = ctx.get("pending_today_count", 0)
    if count >= cap:
        return _fail("max_tasks_per_day", f"daily proposal cap {cap} reached (count={count})", cap=cap, count=count)
    return _pass("max_tasks_per_day", cap=cap, count=count)


def _no_learning_phase_touch(prop: dict, state: dict, ctx: dict) -> dict:
    ls = state.get("learning_status")
    if ls != "LEARNING":
        return _pass("no_learning_phase_touch", learning_status=ls)
    # Exception: scale_up to minimum budget is allowed.
    if prop.get("task_type") == "scale_up":
        return _pass("no_learning_phase_touch", note="scale_up exception — allowed in LEARNING")
    return _fail("no_learning_phase_touch", f"campaign in LEARNING — task_type={prop.get('task_type')} forbidden")


def _budget_jump_max_30pct(prop: dict, state: dict, ctx: dict) -> dict:
    if prop.get("task_type") not in ("budget_change", "scale_up", "scale_down"):
        return _pass("budget_jump_max_30pct", note="not a budget-changing task_type")
    pay = prop.get("payload") or {}
    old = pay.get("old_daily_budget_cents") or pay.get("old_daily_budget_ils")
    new = pay.get("new_daily_budget_cents") or pay.get("new_daily_budget_ils")
    if old is None or new is None or old == 0:
        return _skip("budget_jump_max_30pct", "old/new daily budget not in payload — cannot compute delta")
    delta_pct = abs(new - old) / old
    if delta_pct <= 0.20:
        return _pass("budget_jump_max_30pct", delta_pct=round(delta_pct * 100, 2))
    if delta_pct <= 0.30:
        hook = state.get("hook_rate", 0) or 0
        freq = state.get("frequency", 99) or 99
        if hook > 0.35 and freq < 2.0 and state.get("learning_status") == "ACTIVE":
            return _pass("budget_jump_max_30pct", delta_pct=round(delta_pct * 100, 2),
                         note="20-30% tier unlocked by hook>35% + freq<2.0")
        return _fail("budget_jump_max_30pct",
                     f"delta {round(delta_pct * 100, 1)}% requires hook>35% + freq<2.0 + ACTIVE",
                     delta_pct=round(delta_pct * 100, 2))
    return _fail("budget_jump_max_30pct", f"delta {round(delta_pct * 100, 1)}% > 30% cap",
                 delta_pct=round(delta_pct * 100, 2))


def _no_audience_change_on_active(prop: dict, state: dict, ctx: dict) -> dict:
    if prop.get("task_type") != "expand_audience":
        return _pass("no_audience_change_on_active")
    if state.get("learning_status") == "ACTIVE":
        cpa = state.get("cpa_ils")
        target = state.get("target_cpa_ils")
        if cpa is not None and target is not None and cpa <= target:
            return _fail("no_audience_change_on_active",
                         "campaign is ACTIVE and meeting target — don't disturb a working audience")
    return _pass("no_audience_change_on_active")


def _no_horizontal_scaling_by_duplication(prop: dict, state: dict, ctx: dict) -> dict:
    if prop.get("task_type") != "new_campaign":
        return _pass("no_horizontal_scaling_by_duplication")
    pay = prop.get("payload") or {}
    if pay.get("duplicate_of_campaign_id") or pay.get("is_duplicate"):
        return _fail("no_horizontal_scaling_by_duplication",
                     "duplicating an existing campaign resets Learning — use scale_up on the original")
    return _pass("no_horizontal_scaling_by_duplication")


def _no_pause_on_recent_conversion_24h(prop: dict, state: dict, ctx: dict) -> dict:
    if prop.get("task_type") not in ("pause_campaign", "pause_adset"):
        return _pass("no_pause_on_recent_conversion_24h")
    # Emergency override: CPA > 3× target bypasses this rule.
    cpa = state.get("cpa_ils") or 0
    target = state.get("target_cpa_ils") or 0
    if target > 0 and cpa >= target * 3:
        return _pass("no_pause_on_recent_conversion_24h", note="emergency CPA>3× override")
    hrs = state.get("last_conversion_hours_ago")
    if hrs is None:
        return _skip("no_pause_on_recent_conversion_24h", "last_conversion_hours_ago not in state")
    if hrs < 24:
        return _fail("no_pause_on_recent_conversion_24h",
                     f"last conversion was {hrs}h ago — campaign still producing results")
    return _pass("no_pause_on_recent_conversion_24h")


def _no_low_res_creative(prop: dict, state: dict, ctx: dict) -> dict:
    if prop.get("task_type") not in ("new_creative", "new_campaign"):
        return _pass("no_low_res_creative")
    creative = state.get("creative") or prop.get("payload", {}).get("creative")
    if not creative:
        return _skip("no_low_res_creative", "no creative dimensions in state or payload")
    w, h = int(creative.get("width", 0)), int(creative.get("height", 0))
    if w < 1080 or h < 1080:
        return _fail("no_low_res_creative", f"dimensions {w}x{h} below 1080p minimum")
    return _pass("no_low_res_creative", dimensions=f"{w}x{h}")


def _prefer_add_creative_over_pause(prop: dict, state: dict, ctx: dict) -> dict:
    if prop.get("task_type") not in ("pause_campaign", "pause_adset"):
        return _pass("prefer_add_creative_over_pause")
    if state.get("meta_creative_fatigue_flag"):
        return _fail("prefer_add_creative_over_pause",
                     "Creative Fatigue flag is on — propose new_creative × 3-5 instead of pause")
    return _pass("prefer_add_creative_over_pause")


def _no_frequency_only_kill(prop: dict, state: dict, ctx: dict) -> dict:
    if prop.get("task_type") not in ("pause_campaign", "pause_adset"):
        return _pass("no_frequency_only_kill")
    rationale = (prop.get("rationale") or "").lower()
    mentions_freq = "frequency" in rationale or "freq" in rationale
    mentions_other = any(kw in rationale for kw in ("cpr", "cpa", "fatigue", "hook rate", "ctr"))
    if mentions_freq and not mentions_other:
        return _fail("no_frequency_only_kill",
                     "rationale cites Frequency without a confirming signal (CPR / CPA / Fatigue / hook / CTR)")
    return _pass("no_frequency_only_kill")


def _verify_tracking_infrastructure(prop: dict, state: dict, ctx: dict) -> dict:
    if prop.get("task_type") != "new_campaign":
        return _pass("verify_tracking_infrastructure")
    verified = state.get("tracking_verified")
    if verified is False:
        return _fail("verify_tracking_infrastructure",
                     "Pixel + CAPI not verified; new_campaign without tracking burns budget")
    if verified is None:
        return _skip("verify_tracking_infrastructure", "tracking_verified not in state")
    return _pass("verify_tracking_infrastructure")


def _enforce_budget_formula(prop: dict, state: dict, ctx: dict) -> dict:
    if prop.get("task_type") not in ("new_campaign", "scale_up"):
        return _pass("enforce_budget_formula")
    pay = prop.get("payload") or {}
    daily = pay.get("daily_budget_ils") or pay.get("new_daily_budget_ils")
    target_cpa = pay.get("target_cpa_ils") or state.get("target_cpa_ils")
    if daily is None or target_cpa is None:
        return _skip("enforce_budget_formula", "daily_budget or target_cpa missing")
    required = (target_cpa * 50) / 7
    if daily < required:
        return _fail("enforce_budget_formula",
                     f"daily ₪{daily} < required ₪{round(required, 2)} = (CPA {target_cpa} × 50) / 7 — "
                     f"campaign cannot accumulate 50 conversions in 7 days",
                     required_daily_ils=round(required, 2))
    return _pass("enforce_budget_formula", required_daily_ils=round(required, 2))


def _explicit_approval_over_threshold_ils(prop: dict, state: dict, ctx: dict) -> dict:
    if prop.get("task_type") not in ("budget_change", "scale_up"):
        return _pass("explicit_approval_over_threshold_ils")
    pay = prop.get("payload") or {}
    old = pay.get("old_daily_budget_ils") or 0
    new = pay.get("new_daily_budget_ils") or 0
    delta = abs(new - old)
    if delta >= 500 and prop.get("urgency") not in ("high", "urgent"):
        return _fail("explicit_approval_over_threshold_ils",
                     f"spend delta ₪{delta}/day ≥ ₪500 requires urgency >= 'high'")
    return _pass("explicit_approval_over_threshold_ils")


# Judgment-only: enforced by prompts, not by this tool
JUDGMENT_ONLY_RULES = [
    "meta_api_rate_limit",
    "document_every_decision",
    "require_95pct_significance_for_ab",
    "no_manual_creative_pruning_before_48h",
    "video_preferred_on_equal_cpa",
]

CHECKS: list[Callable[[dict, dict, dict], dict]] = [
    _no_delete_campaigns,
    _max_tasks_per_day,
    _no_learning_phase_touch,
    _budget_jump_max_30pct,
    _no_audience_change_on_active,
    _no_horizontal_scaling_by_duplication,
    _no_pause_on_recent_conversion_24h,
    _no_low_res_creative,
    _prefer_add_creative_over_pause,
    _no_frequency_only_kill,
    _verify_tracking_infrastructure,
    _enforce_budget_formula,
    _explicit_approval_over_threshold_ils,
]


# ----------------------------------------------------------- context fetch


def _fetch_context(business_id: str) -> dict:
    """Fetch counters / thresholds check_guardrails needs from DB."""
    ctx: dict[str, Any] = {}
    biz = fetch_one(
        "SELECT daily_budget_ils FROM businesses WHERE id = %s",
        (business_id,),
    )
    if biz:
        daily_budget = biz.get("daily_budget_ils") or 0
        # §8.3 anti-flood cap tiers
        if daily_budget < 50:
            ctx["daily_task_cap"] = 2
        elif daily_budget <= 500:
            ctx["daily_task_cap"] = 5
        else:
            ctx["daily_task_cap"] = 10

    count_row = fetch_one(
        "SELECT COUNT(*) AS n FROM approvals WHERE business_id = %s "
        "AND created_at::date = now()::date",
        (business_id,),
    )
    ctx["pending_today_count"] = (count_row or {}).get("n", 0) or 0
    return ctx


# -------------------------------------------------------------------- main


def main() -> None:
    p = argparse.ArgumentParser(description="Check a proposal against §14 guardrails.")
    p.add_argument("--business-id", required=True)
    p.add_argument("--proposal", required=True, help="JSON object (same shape as propose_task --payload + metadata)")
    p.add_argument("--state", default=None, help="JSON object of live state (learning_status, hook_rate, ...)")
    args = p.parse_args()

    proposal = parse_json_arg(args.proposal, "proposal")
    if not isinstance(proposal, dict):
        emit_validation_error("--proposal must be a JSON object")
        return
    state = parse_json_arg(args.state, "state") or {}
    if not isinstance(state, dict):
        emit_validation_error("--state must be a JSON object")
        return

    try:
        Config.load().require_db()
    except ConfigError as e:
        emit_validation_error(str(e))
        return

    try:
        ctx = with_db_retry(lambda: _fetch_context(args.business_id))
    except Exception as e:
        emit_runtime_error(f"guardrail context fetch failed: {e}", exc=e)
        return

    results = [fn(proposal, state, ctx) for fn in CHECKS]
    violations = [r for r in results if not r.get("passed")]
    passed = len(violations) == 0

    emit_success({
        "business_id": args.business_id,
        "proposal_task_type": proposal.get("task_type"),
        "passed": passed,
        "violations": violations,
        "checks": results,
        "judgment_only_rules": JUDGMENT_ONLY_RULES,
        "context": ctx,
    })


if __name__ == "__main__":
    main()
