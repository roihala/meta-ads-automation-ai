# Campaigner Decision Map — What a Senior Meta Performance Brain Decides

> **Purpose.** This document is the single source of truth for the full decision space of the Campaigner agent brain. It maps every category of decision a senior Meta performance marketer makes, the mechanisms that implement each decision, which mechanisms are already built, which are shipping in the current plan ([cheeky-seeking-blossom.md](cheeky-seeking-blossom.md)), and which are deferred to backlog tiers 2 and 3.
>
> **Maintenance rule.** When a new mechanism is proposed, add it here FIRST with a tier. Never let a mechanism live only in a plan file — plans get archived, this map persists.

---

## 1. The 10-layer decision space of a senior Meta campaigner

| Layer                              | Decisions the brain must be able to make                                                                                                                 |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **L1 — Strategy / intent**         | What business objective am I serving this month? What offer is active? What's the funnel stage? What's the seasonal context? What's the budget envelope? |
| **L2 — Account architecture**      | How many campaigns? CBO vs ABO? Which optimization event? Which bid strategy? Manual vs Advantage+ placements? Attribution window?                       |
| **L3 — Audience**                  | Broad vs narrow in cold start? Advantage+ Audience vs saved/lookalike? Exclusions? Cannibalization between ad sets?                                      |
| **L4 — Creative**                  | Hook/angle, format (image/video/mix), ratios, variation count, material diversity, copy voice, CTA, landing destination                                  |
| **L5 — Budget & pacing**           | Scale up/down timing & magnitude, emergency pause vs cooldown, inter-campaign reallocation, monthly burn, creative-refresh reserve                       |
| **L6 — Measurement & attribution** | Is the Pixel/CAPI healthy? Right optimization event given volume? Attribution window coherent with sales cycle? MER/Entity-ID testing?                   |
| **L7 — Account health**            | Policy violations, review warnings, token expiry, billing, business-verification status, auction cannibalization against self                            |
| **L8 — Off-platform**              | Landing page speed, form completion rate, message-match, mobile responsiveness, tracking-event firing                                                    |
| **L9 — Ops workflow**              | When to involve the operator, alert severity, reconciling contradictory proposals within a single run, hands-off campaigns                               |
| **L10 — Institutional learning**   | Pattern extraction from winners/losers, baseline drift, hypothesis/experiment tracking, revisiting stale assumptions                                     |

---

## 2. Mechanism catalog — 12 mechanisms, with tier & status

Legend:

- **in_plan** — shipping in [cheeky-seeking-blossom.md](cheeky-seeking-blossom.md)
- **backlog_tier_2** — high-value, defer until tier 1 is stable and Aiweon is out of cold-start
- **backlog_tier_3** — defer to v2 (second ad account onboarding trigger)
- **done_already** — already in codebase pre-plan (reference only)

### Tier 1 — shipping now

| ID  | Mechanism                  | Layer(s) | Status  | Why it's urgent                                                                                                                                                               | Target file(s)                                                                           |
| --- | -------------------------- | -------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| M1  | Tracking Health Gate       | L6       | in_plan | If Pixel/CAPI is broken, every downstream metric lies. Brain will otherwise recommend action on untrusted data. First link in the causal chain of diagnosis.                  | `campaigner/tools/check_tracking_health.py`, `CAMPAIGNER.md` Flow A Step 1.0             |
| M2  | Monthly Brief layer        | L1       | in_plan | PERSONALITY.md mandates "ask intent before recommending." No structured place today for active offer, deadline, hands-off flags. Brain optimizes toward wrong KPI without it. | `businesses.monthly_brief jsonb`, `load_business_knowledge.py`, `/business-knowledge` UI |
| M3  | Budget Utilization Receipt | L5       | in_plan | PERSONALITY.md mandates "check utilization before touching budget." ₪30/d that spent ₪19 in 4d ≠ ₪30/d that spent ₪120 — totally different problems.                          | `campaigner/tools/check_utilization.py`, rule in `guardrails.md`                         |

### Tier 2 — backlog (post-tier-1 stability)

| ID  | Mechanism                                      | Layer(s) | Status         | Why deferred                                                                                                                                                                        | Rough design                                                                                                                            |
| --- | ---------------------------------------------- | -------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| M4  | Landing Page / Funnel Health signal            | L8       | backlog_tier_2 | Needs external probe or GA/hotjar integration. High value for B2B lead forms but out of MVP scope.                                                                                  | Lightweight tool fetching click-to-lead ratio from Meta; if below threshold, block `new_creative` proposals and raise `alert` instead   |
| M5  | Attribution Event Policy (low-volume fallback) | L6       | backlog_tier_2 | Cold-start accounts have <5 purchases/mo; optimizing for purchase is wrong choice. Need a policy that steps up the funnel (AddToCart → ViewContent → Leads) based on weekly volume. | Rule in `performance-brain.md`: if `conversions_7d < 20` → recommend event-swap proposal to lower-funnel event                          |
| M6  | Portfolio / Cannibalization Detection          | L2, L3   | backlog_tier_2 | Less relevant for Aiweon's single-campaign cold start. Becomes critical at 3+ active ad sets with overlapping audiences.                                                            | `tools/detect_audience_overlap.py` — compute audience overlap % between active ad sets; warn if >30%                                    |
| M7  | Proposal Bundle Reconciliation                 | L9       | backlog_tier_2 | Currently each proposal is standalone; a single run might produce "add creative" + "pause ad set" + "scale budget" for the same ad set. Needs a reconciliation step in Flow A.      | New step: after propose_task round, scan same run_id proposals for same target_id; apply precedence rules before writing to `approvals` |

### Tier 3 — backlog (v2 / multi-account)

| ID  | Mechanism                             | Layer(s) | Status         | Why deferred                                                                                                            |
| --- | ------------------------------------- | -------- | -------------- | ----------------------------------------------------------------------------------------------------------------------- |
| M8  | Policy Violation Risk Pre-check       | L7       | backlog_tier_3 | Only relevant when brain generates creative automatically at volume. Manual-upload dominant workflow today.             |
| M9  | Do-nothing / Counterfactual Reasoning | L9, L10  | backlog_tier_3 | "Would Andromeda self-correct if we do nothing?" — hard to implement without historical A/B baseline per campaign.      |
| M10 | Hypothesis / Experiment Tracker       | L10      | backlog_tier_3 | Each 3-5 variant batch is a hypothesis. Full experiment tracking is a separate product surface.                         |
| M11 | Benchmark Drift Detection             | L10      | backlog_tier_3 | `target_cpa` set 6 months ago may no longer fit the market. Requires time-series baselines and periodic review cadence. |
| M12 | Hands-off Protected Campaign Flag     | L9       | backlog_tier_3 | Partially covered by M2 `monthly_brief.hands_off_campaign_ids`. Full "protected" semantics (no observe, no log) is v2.  |

### Already in codebase (reference only)

| Mechanism                                                               | Layer(s)   | Location                                                               |
| ----------------------------------------------------------------------- | ---------- | ---------------------------------------------------------------------- |
| Two-gate evaluation (Gate 1 leading 48h-7d, Gate 2 lagging post-50conv) | L4, L10    | `campaigner/prompts/performance-brain.md`, `check_data_sufficiency.py` |
| 13 hard guardrails (deterministic)                                      | L2–L9      | `campaigner/prompts/guardrails.md`, `check_guardrails.py`              |
| Decision-tree T0–T6 (per-campaign diagnosis)                            | L2, L4, L5 | `campaigner/prompts/decision-tree.md`                                  |
| Learning-phase caution (`no_learning_phase_touch`)                      | L2, L4     | `guardrails.md §3`, `check_guardrails.py:78-85`                        |
| HITL approval queue (pending → approved → executed)                     | L9         | `approvals` table, `propose_task.py`, `execute_task.py`                |
| Anti-flood cap (5 proposals/day for ₪50-500 budget)                     | L9         | `CAMPAIGNER.md §5`                                                     |
| `agent_decisions` audit trail                                           | L10        | `agent_decisions` table, `log_decision.py`                             |
| Monthly pacing                                                          | L5         | `compute_monthly_pace.py`, `seasonal.py`                               |
| Creative firehose model (10-50+ diverse, 3-5/wk adds)                   | L4         | `creative-guide.md §1-3`                                               |
| Meta Creative Fatigue flag (CPR ≥ 2× baseline)                          | L4         | `performance-brain.md §5`, `decision-tree.md §T1`                      |
| Heartbeat liveness (3-failure alert)                                    | L9         | `heartbeats` table, `heartbeat.py`                                     |

---

## 3. How top practitioners think — synthesis

Based on research into senior Meta performance marketers (Charley Tichenor, Depesh Mandalia, Pilothouse Digital, Dara Denney, Barry Hott). Principles below inform both the plan and the backlog prioritization.

### P1 — "Creative is the new targeting" (Tichenor)

Under Andromeda, creative signals drive which auctions you enter and which users you reach. **Diagnose creative first**, audience/budget second. A weak hook will not be fixed by "widen the audience."
→ Implemented in CDP §2, §4 (diversity on 2 of 4 axes).

### P2 — Liquidity & Natural CAC (Tichenor)

Every market has a natural CAC floor. If your budget × available audience doesn't support that floor, no optimization will win. **Check liquidity before recommending scale.**
→ Informs M3 (utilization) and will inform M6 (cannibalization) in tier 2.

### P3 — Range × Diversity beats Volume (Pilothouse 3-3-3)

10-25 creatives that vary on 3 real dimensions × 3 options = 27 combinations beat 50 near-duplicates. Diversity is _material_ (hook, subject, format, offer), not _cosmetic_ (color, font).
→ Directly implemented in CDP §4.

### P4 — Brief-first, metric-second (Mandalia)

Start from the monthly business objective and work backwards to creative and structure. Metric targets without an intent are optimization theatre.
→ Implemented in M2.

### P5 — Symptom-vs-Cause layering (Hott/Denney)

CTR drop is a symptom. The cause is one of: creative fatigue, audience saturation, Pixel/tracking issue, offer mismatch, LP breakage, seasonal shift, competitor surge. Walk the chain before prescribing.
→ First link in chain is M1 (tracking health). Second link will be M4 (LP health) in tier 2.

### P6 — Do-nothing-first

Andromeda often self-corrects within 48-72h. Many "urgent" alerts resolve themselves. The question "would it recover if we did nothing?" is a legitimate first answer.
→ Deferred as M9 tier 3 because it requires historical baseline per campaign.

### P7 — One change at a time

Changing budget + audience + creative in the same edit destroys attribution of which change caused the outcome. Andromeda's learning phase penalty compounds.
→ Partially enforced by guardrails today; fully by M7 (reconciliation) in tier 2.

### P8 — Receipts not opinions

"CTR is bad" → needs the number, the baseline, the delta. PERSONALITY.md binds this as voice; M3 binds it as mechanism for budget claims.
→ M3 (utilization receipt) is the first formal receipt-enforcement mechanism.

---

## 4. Promotion rules (when to move an item from backlog to a plan)

- **Tier 2 → active plan** when at least two of:
  - Aiweon is out of cold-start (conversions_30d ≥ 50)
  - A specific incident has been attributed to the missing mechanism
  - The operator has requested it explicitly
  - A second ad account has been onboarded
- **Tier 3 → active plan** when a second ad account is onboarded (v2 migration trigger per CLAUDE.md).

Every promotion must update this doc first, then the new plan file.

---

## 5. Revision log

| Date       | Author           | Change                                                                               |
| ---------- | ---------------- | ------------------------------------------------------------------------------------ |
| 2026-04-23 | Campaigner + Roi | Initial map. 12 mechanisms catalogued; M1-M3 in tier 1; M4-M7 tier 2; M8-M12 tier 3. |
