# Campaigner Meta Mastery v2 — End-to-End Redesign

> **Status:** Master plan v2, opened 2026-05-17 by Roi + Claude after deep external research + internal pipeline audit.
> **Source:** 8 parallel research subagents (Andromeda, cold-start, Lead Ads + WhatsApp, creative, budget pacing, audience, organic↔paid, agency reporting) + 9-stage internal pipeline audit + 3 Roi clarifications captured 2026-05-17 (`boost_post` semantics, targeting ownership, approval MCQ UI).
> **Supersedes:** [`campaigner-mastery-plan.md`](campaigner-mastery-plan.md) (v1, 2026-05-13). v1 phases 1-9 are mapped into v2 structure below.
> **Aiweon reality baked in:** Lead Ads + WhatsApp funnel, no website Pixel/CAPI, new Meta account (cold-start), USD-denominated ad account, Hebrew product, single business, monthly-budget commitment (~₪3000 starting band).

---

## 0. Why v2 exists

The v1 plan correctly enumerated surface-area gaps (audience, lead quality, account health, reporting). But it stopped at "ship Phase 1, then 2, then 3." It did **not** answer the deeper question Roi raised on 2026-05-17:

> "אני לא מרגיש שהוא חוץ ממלא תובנות באמת בונה הצעות כמו שצריך… אני רוצה מח אמיתי ולא רק רובוט תובנות."

The 9-stage audit (§3 below) made the diagnosis concrete: the agent **diagnoses brilliantly but acts only on performance, never on lead quality, never on budget commitment, never on operator intent.** v2 reframes the brain around three operational shifts the v1 plan did not make explicit:

| # | Shift | What it means in code |
|---|---|---|
| 1 | **Budget-as-driver, not budget-as-gate** | `compute_monthly_pace.py` already writes a `budget_health` observation. v2 makes `pace_ratio` a *modifier on `task_type` selection*. Today it only gates `new_creative`; in v2 it routes between `scale_up` / `boost_post` / `new_campaign` / `expand_audience` / `alert`. This is the "missing router" between observation and proposal. |
| 2 | **Quality-adjusted CPL as the default reading** | Phase 2 shipped tools (`grade_lead`, `compute_quality_adjusted_kpi`, etc.) but Flow A doesn't call them. v2 wires `fetch_lead_quality_summary` in front of every scale decision, with hard `min_graded_sample=20` block on `scale_up`. This is the structural fix to the 16.4 trap. |
| 3 | **Onboarding-as-chain, not onboarding-as-checklist** | First-time Meta connect → business brief → audience brief → gallery scan → first-campaign proposal must be one orchestrated chain (Flow F), not 5 operator-triggered tools. The "wow" moment of a real campaign manager is opening the app the day after connect and seeing a complete proposal waiting. |

v2 also corrects three explicit Roi clarifications (memory entries [`feedback_boost_post_means_campaign_with_post`](../../C:\Users\harel\.claude\projects\d--meta-ads-automation-ai\memory\feedback_boost_post_means_campaign_with_post.md), [`feedback_targeting_owned_by_user`](../../C:\Users\harel\.claude\projects\d--meta-ads-automation-ai\memory\feedback_targeting_owned_by_user.md), [`feedback_approval_mcq_needs_inline_ui`](../../C:\Users\harel\.claude\projects\d--meta-ads-automation-ai\memory\feedback_approval_mcq_needs_inline_ui.md)).

---

## 1. Research synthesis — what top operators actually do (2025-2026)

Eight parallel research streams, each citing 20-40 primary sources (Meta docs, Foxwell, Jon Loomer, Common Thread Collective, Tichenor, Theriot, Heath, Madgicx, Search Engine Land, agency case studies, YouTube media buyers, Twitter/X threads). Compressed below; full sources in §11.

### 1.1 Meta Andromeda + Advantage+ (rolled out Oct 2025)

**Andromeda is a retrieval-layer rewrite.** It reads the creative (visual format, hook, tone, subject), predicts who'll engage, and treats your audience targeting as **soft suggestions, not gates**. GEM (Global Earnings Model) handles pricing after Andromeda picks candidates — that's why two ads with identical targeting can have very different CPMs.

**Practitioner-confirmed thresholds:**
- **Creative Similarity ≥60% → suppression.** Andromeda lumps near-duplicate ads into a single Entity ID; 100 lookalike variants count as 1. Volume without genuine diversity (changes in ≥2 of {message, visual, format}) is wasted.
- **Volume sweet spot: 10-20 genuinely distinct creatives per ad set**, with mature DTC pushing 20-50. Pre-Andromeda 3-6/ad-set is dead.
- **Broad targeting + Advantage+ Audience beats Lookalike-only by ~49% ROAS** (Lebesgue 2024 cross-account). Custom audiences remain for *suppression* and *first-party LAL seeds*.
- **Signal quality is non-negotiable.** Pixel+CAPI lifts ROAS ~22% vs Pixel-only. For Lead Ads: must push lead-stage events (`Qualified`, `Booked`, `Closed Won`) back via CAPI keyed on `lead_id`.

**Advantage+ Shopping/Sales:** mature, ~22% ROAS lift, used by virtually all scaled DTC. **Advantage+ Leads:** ~10% lower CPL, **but indifferent to lead quality** unless CRM-side quality events feed back via CAPI. Without that loop it's the 16.4 trap on autopilot.

### 1.2 Cold-start playbook (fresh Meta account, days 1-90)

**Days 1-7 (warm-up):** add payment method immediately (itself a trust signal), verify business, publish 2-3 organic posts on Page (Meta penalizes ads attached to dormant Pages), optionally run a ₪10-20/day engagement campaign for 2 days to "season" the account.

**Days 4-30 (first real campaign):** **single CBO campaign, single ad set, 4-6 ad creatives.** Objective = Leads. Form type = **Higher Intent + 1-2 qualifying questions, autofill OFF on phone**. Bid = Lowest cost (cost caps starve a young campaign). Audience = Broad (IL, Hebrew, age 25-55, no interest stacking).

**The min-budget formula every operator quotes:** `min_daily_budget = (target_CPA × 50) / 7`. For Aiweon target CPL ~₪80 → **min ₪571/day** to clear learning phase in 7 days, OR **₪150-250/day with 2-3 week learning**. **Below ₪100/day with Lead optimization = sit in Learning Limited forever** (modernmarketinginstitute, get-ryze, Niblin convergent).

**Days 30-60:** scale +20-30% every 3-5 days on winners, add a second campaign only when the first is *consistently* exiting learning AND there's a genuinely distinct angle. **Days 60-90:** mature, can introduce Advantage+ Leads in parallel (70/30 manual/A+ split), systematic A/B via Meta Experiments.

**Realistic Aiweon Month-1 expectation:** ₪150-300/day budget → 40-100 raw lead submits → CPL ₪35-90 raw / ₪70-200 quality-adjusted → 4-15 sales-qualified WhatsApp conversations. **No promises of "X leads by Day 30."** Promise: "By Day 30 we know if offer+creative+audience is alive. By Day 60 we have a CPL band ±20%. By Day 90 we're scaling the winner."

### 1.3 Lead Ads + WhatsApp funnel (the Aiweon core)

**CAPI-for-CRM is the unlock for Aiweon's no-Pixel funnel.** Meta's purpose-built path: webhook → store with `lead_id` → operator grades in `/leads` UI (already shipped) → backend fires server-to-server `Lead` / `Qualified` / `Customer` events keyed on the original `lead_id`. **No website Pixel required.** This closes the 16.4 loop without changing the funnel architecture.

**Form design defaults for Aiweon:**
- **Higher Intent** template (review step) — not "More Volume" (autofill). Higher Intent = -10-20% volume, +15-25% quality.
- **SMS OTP** verification — drops bot/junk rate from 10-30% to <5%.
- **3 questions max, 5 absolute ceiling.** Best types: geo disqualifier, budget/timeline qualifier, conditional follow-up.
- **Conversion Leads optimization:** requires 200+ leads/month AND 8 weeks CAPI history. **Below that it degrades worse than default Leads goal.** Don't enable until volume + history both clear.

**Speed-to-lead is load-bearing:** MIT 9× conversion advantage at <5 min vs <10 min; Kixie 78% of sales go to first responder. Architecturally: webhook → real-time push notification to operator's phone, not email digest.

**Click-to-WhatsApp (CTWA) vs Lead Ads:**
- CTWA → **"Leads" performance goal** beats "Conversations" by ~24% CPL (counter-intuitive but Meta confirms: "Leads" optimizes for in-chat qualification step, "Conversations" for anyone who'll send any message).
- Israeli market is **WhatsApp-native** (~95% penetration). CTWA in Reels + Stories is the natural pairing.
- **Recommendation for Aiweon: run both CTWA + Lead Ads in parallel at ~70/30 for 90 days**, decide on consolidation in month 4 based on graded CPL, not raw CPL.

**Quality grading rubric (4 binary dimensions = 80% of conversion predictiveness per 2025 B2B literature):**
1. Reply within 24h y/n
2. Real Israeli business verifiable y/n
3. Decision-maker y/n
4. Intent signal (asked price/timeline/scheduling) y/n

Stars 1-5 derived from these four.

### 1.4 Creative strategy (post-Andromeda)

- **Hook rate thresholds 2025-2026:** <25% fix-it · 25-29% table-stakes · 30-39% good · **40%+ elite** (Andromeda starts treating creative as relevant). Reels should hit ≥30%; Feed lands 20-30%.
- **9:16 = master format.** Reels >50% of all IG ad inventory in 2025; vertical video 34.5% lower CPA vs image, 15% lower vs silent video. **Treat 9:16 as master, crop to 1:1 + 4:5 — never the other way.**
- **B2B Lead-gen ≠ DTC:** static still drives 50-70% of conversions for service businesses where buyers read claims. Aiweon mix: ~50/50 video/static.
- **AI-generated creative homogeneity trap:** parity on CTR, but **-28% video completion / -19% CTR on >15s video**, rated more "annoying/boring/confusing" by users. Top 1% of ads are overwhelmingly human-made.
- **Aiweon mix recommendation:** 40-50% real-human content (operator/founder talking-head, screen-recordings of AIWEON working, client testimonials) + 20-30% Imagen (B-roll, abstract tech metaphors) + 20-30% organic-post boosts. **AI services demand a credibility tax — buyers must see "humans built this."**
- **People-direct-to-camera beats product-only ~2× CTR even in B2B** (Diamond Group). For Aiweon: founder talking-head + product screen-record > stock-photo "businessman pointing at hologram."
- **Hebrew hooks that stop Israeli thumbs:** direct address by occupation, specific shekel numbers (Israelis price-anchor instantly), counter-narrative ("הפסקנו לעשות X. הנה מה שקרה"), process-proof. **Scroll-past phrases to ban:** "פתרונות חדשניים", "מובילים בתחומם" — every Israeli scrolls past these.
- **Cold-start curve for Aiweon:** Week 1 = 5-6 creatives → Week 4 = 12-15 in pool → maintain 15-20 with ~3/week refresh (matches the 10.4-day rotation top brands run).
- **Hebrew Advantage+ Enhancements:** turn OFF generative text/image variations — they break RTL layout and rewrite the offer. Leave ON: brightness/contrast, image expansion, music.

### 1.5 Budget pacing — the v2 thesis area

- **CBO vs ABO:** "ABO to learn, CBO to earn." At ₪3000/month ($27/day) Aiweon is **below the $50/day Andromeda confidence threshold** → **ABO is correct until budget grows past ~₪6000/month**. CBO across 1 ad set has no benefit.
- **Universal scale rule:** **max +20% per edit, ≥72h between edits, gated on 3+ consecutive days above target.** Anything more = Learning Phase reset + CPM spike.
- **Daily vs lifetime:** daily is default for evergreen; lifetime only for time-boxed promos (mid-flight lifetime edits reset learning).
- **Israeli calendar overlay (monthly budget multipliers):**

  | Period | Multiplier | Why |
  |---|---|---|
  | August | 0.70-0.80 | B2B vacation slump |
  | Tishrei (Sep/Oct, Rosh Hashanah→Sukkot, ~3 weeks) | 0.70-0.80 | Disrupted B2B decision-making; pause heavy spend during chag days themselves |
  | Pesach week (Nisan) | 0.75 | Same disruption pattern |
  | Late Oct - early Dec | 1.15-1.20 | Strongest B2B buying window post-chagim |
  | Jan - Mar | 1.10 | Budget-cycle window for IL B2B |
  | BFCM IL (late Nov) | (no monthly mult, but CPM +20-80%) | Consumer-brand auction crush — expect higher CPL even on stable campaigns |
- **Meta paces +25% intra-day buffer naturally** (rolling out to +75% in late 2025-2026). One-day variance inside the buffer is not an overrun — **don't alert**.
- **Cold-start months get front-load:** 130-150% of pro-rated daily pace for first 7-10 days (Foxwell — "faster spend = faster signal"). Don't penalize "overrun" in cold-start.
- **End-of-month rule:** if `days_left ≤ 5 AND pace_ratio < 0.85` → **DO NOT panic-spend**. Log lost opportunity to monthly brief; root-cause it for next month.

### 1.6 Audience strategies (post-iOS 14.5)

- **Advantage+ Audience = default for conversion objectives.** Original Audiences only for: <50 weekly conversions, hyper-local services, regulated verticals, or specific B2B ICP.
- **Israeli small-country math:** Meta-reachable IL 18+ = ~6.47M. **1% LAL = 65-95K users — BELOW the 50K delivery-collapse floor.** For Aiweon: **2% LAL minimum, 3-5% workhorse, NEVER 1%**.
- **Stack 1%+3-5% LAL into the same ad set** (Andromeda picks); fragmenting per-percentage is anti-pattern.
- **Aiweon (no Pixel) audience source inventory:** Lead Form submitters (90/180/365d), Lead Form openers non-submit (90d), IG/FB Page engagers (365d), Video viewers (3s/25%/50%/75%), Customer email/phone upload, WhatsApp conversation openers.
- **Master Exclusion union (submitters + customers + employees) → -40% CPA** with Meta's "Acquire new only" setting (Wonderful measurement).
- **DTE (Detailed Targeting Expansion) is locked ON for conversion objectives in 2025** — no override. June 2025 Meta consolidated many granular interests into broader groupings. The direction is explicit: **Meta is forcibly automating the audience layer.**
- **Detailed Targeting Exclusions were REMOVED March 2025.** Only geo + Custom-Audience exclusions remain.
- **Saturation threshold (new):** `freq >2.5/7d + first-impression-ratio <40% + conversion-efficiency decay before CTR decay`. The old "freq >3" rule is deprecated.
- **Free-text → Meta rule v1 scope (Aiweon):**
  - **Tractable:** city lists, country, radius around point (1-70 km), age, country-minus-city.
  - **Punt to operator with clear explanation:** sub-city neighborhoods ("צפון העיר" — Meta doesn't expose Tel Aviv neighborhoods natively; HeGeL/JOSIS literature confirms Hebrew place-mapping is unsolved research).
  - **Refuse with explanation:** implicit demographics ("אנשי הייטק" = interest in disguise = violates targeting-ownership policy), sociolects ("דתיים"/"חרדים"/"ערבים" = Meta retired most facets anyway).

### 1.7 Organic ↔ Paid synergy

- **Reels = 10-30× follower count reach for new Pages** (vs 2-3× in 2024). Meta is still subsidizing Reels reach — **this window expires as the Page ages**. For Aiweon: **4-5 Reels/week mandatory for first 90 days**.
- **Posting cadence floor:** FB 3/wk, IG feed 2/wk, Reels 3-5/wk, Stories 4-5/wk.
- **`boost_post` candidate must clear ALL of:**
  1. Engagement rate ≥ **1.5× Page 30-day average**
  2. Save rate ≥ **1.0% of reach** (Mosseri-confirmed #1 ranking signal)
  3. Share rate ≥ **0.5%** OR sends/DM-shares ≥ **0.3%** (Mosseri-confirmed #3)
  4. Reels watch-through ≥ **25%**
  5. Comment depth ≥ **3 multi-reply threads**
- **Wait 48-72h after posting** before considering boost (so organic signals accrue → ad relevance + CPM benefit).
- **Boost button is forbidden** (Roi rule + universal agency consensus). `boost_post` task_type always = full campaign with `object_story_id` referencing the post as creative.
- **Hidden synergy bug:** when `boost_post` runs via `object_story_id`, paid + organic impressions both land on the same post. **Operator must reply to paid-impression comments too** — Meta watches reply rate as a quality signal. Surface this in UI.
- **Mosseri 2025 ranking trio (admitted publicly):** watch-time, likes/reach, **sends-per-reach (DM shares)**. Save rate is highest-intent signal. Likes are decorative.
- **Israel platform reality:** FB 88% (7.14M users) + IG 81% (4.65M). **FB still strong on 35+ in Israel** (anomaly vs other Western markets) → **dual-platform mandatory** for Aiweon B2B.
- **Meta July 2025 originality rules** demonetize/throttle repeat-reposters. Don't cross-post identical paid creative to organic without transformation.

### 1.8 Agency monthly reporting

- **Standard structure:** Cover → Executive summary (3 sentences: verdict, cause, action) → KPI scorecard vs target → MoM + YoY → **"What we did" (decisions, not metrics — the section that justifies the retainer)** → "What we learned" (Observation → Insight → Recommendation triplets) → **"What's next" (test hypotheses + budget shifts)** → **"Asks from client"** → Appendix.
- **Leading vs lagging order:** scouts (CPM/reach) → midfielders (hook rate, CTR) → strikers (CVR, CPL, ROAS). Leading metrics predict lagging by 5-7 days.
- **Length:** 1-page executive summary + 5-12 pages full or 10-20 slides. >20 slides = client stops reading.
- **Cadence that retains clients ~34% longer:** weekly tactical snapshot + monthly narrative + quarterly QBR. Plus a 5-7 min Loom walkthrough (universal in 2025-2026 retention playbooks).
- **Aiweon-specific:**
  - **RTL ordering:** headline KPI tile top-right (Hebrew eye lands there), bar/line X-axes right-to-left (newest period left), table headers right with LTR numeric columns.
  - **KPI hierarchy for Lead Ads + WhatsApp funnel:** show full funnel even when later stages are operator-graded (Leads → Qualified → Discovery Call → Customer → CAC); dim/grey unrated cells to train operator grading + surface grading-coverage % as its own metric.
  - **Quality-adjusted CPL leads when divergent from Meta CPL by ≥20%.** The 16.4 case (paused for quality despite winning Meta metrics) goes in *executive summary*, not appendix.
  - **AI-agent transparency:** small footer line "דו"ח זה הופק על-ידי סוכן ה-AI של Aiweon ואושר על-ידי…" + one-page "agent decision funnel" section ("החודש הסוכן הציע 12 פעולות. אישרת 7. דחית 5. סיבה ראשית לדחייה: X"). Canva 2026 trust data: proactive disclosure → +34% trust.
  - **"What's next" section becomes the seed for next month's `monthly_brief`** (existing M2 mechanism) — operator signs off monthly instead of filling brief from scratch.

---

## 2. Code today vs research best practice — alignment matrix

| Domain | Best practice (research) | Aiweon today (code) | Status |
|---|---|---|---|
| Targeting ownership | Advantage+ Audience default, interest stacking dead | `propose_audience`/`expand_audience` policy = user owns targeting, agent does geo only | ✅ aligned |
| Creative volume | 10-20 distinct creatives/ad-set, weekly refresh | Gallery + `generate_creative` exist; cold-start curve not encoded | 🟡 partial |
| Creative diversity check | Andromeda Entity-ID collapse at Similarity ≥60% | `check_creative_fatigue` exists; **no similarity check** | ❌ missing |
| Hook rate thresholds | <25% fix-it, 40%+ elite | Computed in `list_active_creatives --with-performance`; **no threshold guardrail** | 🟡 partial |
| Min-budget formula | `(CPA × 50) / 7` for learning-phase exit | **Not surfaced**; agent doesn't warn on under-budget | ❌ missing |
| Budget routing | `pace_ratio` modifies task_type | `compute_monthly_pace` writes observation only; gates only `new_creative` | ❌ **gap #2 — v2 Phase B** |
| Lead quality wire-in | Quality-adjusted CPL gates every scale | Phase 2 tools shipped; Flow A doesn't call them | ❌ **gap #1 — v2 Phase C** |
| CAPI-for-CRM events | `Lead`/`Qualified`/`Customer` to Meta keyed on `lead_id` | Webhook ingests; **no outbound events** | ❌ **Phase C** |
| Onboarding chain | Connect → brief → scan → first campaign as one chain | All steps are operator-triggered tools | ❌ **gap #3 — v2 Phase A** |
| MCQ UI in approvals | Inline radio buttons + structured response back to agent | Operator must reject + write rationale | ❌ **Phase 0** |
| Lookalike sizing for IL | 2-5%, never 1% in Israel | `propose_audience` doesn't enforce | ❌ small fix needed |
| Master Exclusion union | Submitters + customers + employees on every prospecting set | **No automation** | ❌ Phase D |
| `boost_post` semantics | Full campaign w/ object_story_id (not Meta Boost) | Already correct in code | ✅ aligned (confirmed by research) |
| `boost_post` triggers | 5 thresholds (engagement, save, share, watch, comment depth) | `check_organic_performance` exists; **no deterministic threshold check** | 🟡 partial — Phase E |
| Reels-first for new Pages | 4-5/week, 10-30× reach subsidy | **Organic publishing not in Flow A** | ❌ Phase E |
| Israeli calendar | August/Tishrei/Pesach reductions + late-Q4 lift | `seasonal_hints` jsonb exists; **defaults not seeded** | ❌ Phase F |
| Cold-start front-load | 130-150% for 7-10 days | **No cold-start mode** in pacing | ❌ Phase F |
| End-of-month panic-spend prevention | Never crash-spend last 5 days | **No guardrail** | ❌ Phase F |
| Agency-grade monthly report | Exec summary → decisions → insights → asks → forward plan | `/reports` skeleton exists (Block 10); missing forward plan + asks + Loom | 🟡 partial — Phase G |
| Min graded-sample on scale | 20 graded leads before any scale_up | §40 warns but doesn't block | ❌ Phase C (hard block) |

---

## 3. End-to-end pipeline audit — 9 stages × readiness

(From the 2026-05-17 internal audit, updated with research-confirmed weights.)

| # | Stage | % Ready | Critical missing piece |
|---|---|---|---|
| 1 | Onboarding chain | 20% | No flow F. Every step operator-triggered. |
| 2 | Campaign creation | 70% | `create_campaign_chain` works; no partial-failure rollback, no preview. |
| 3 | Audience lifecycle | 30% | Phase 1 tools shipped, agent doesn't call them. No monthly review. |
| 4 | Creative pipeline | 80% | Most mature. Missing: fatigue retire/pause, aspect normalizer, bundle tracking. |
| 5 | **Budget routing** | 50% | **The gap.** `pace_ratio` is observed, never drives task_type. |
| 6 | Lead lifecycle | 0% | Phase 2 fully scaffolded, **zero integration**. WhatsApp uncoupled. |
| 7 | Post-launch monitoring | 60% | Signals collected; account quality/rejected ads/tracking-fix not actioned. |
| 8 | A/B + experimentation | 60% | Setup + decide work; no auto-promote-winner. |
| 9 | Reporting + feedback loop | 30% | Weekly audit exists; monthly + operator-feedback-to-agent missing. |

---

## 4. The three operational shifts — v2 thesis in detail

### 4.1 Shift 1 — Budget-as-driver

Today's pseudo-code (paraphrased from §T-1 in `decision-tree.md`):
```
if budget_health.status == "severely_under":
    block new_creative proposals
# nothing else
```

v2 pseudo-code:
```
case (budget_health.status, days_left, has_quality_winner, gallery_health):
  ("underrun", >7, True, healthy):    propose scale_up(+20%) on best campaign
  ("underrun", >7, True, exhausted):  propose redeploy_creative from gallery
  ("underrun", >7, True, empty):      propose alert "צריך תוכן חדש" + Imagen brief
  ("underrun", >7, False, *):         propose new_campaign OR boost_post if viral organic exists
  ("underrun", ≤5, *, *):             do NOT panic-spend; log lost_opportunity to monthly_brief
  ("overrun", *, *, *):               propose scale_down on weakest quality-adjusted CPL
  ("ok", *, *, *):                    routine observation; no proposal needed
```

The router lives in a new file `campaigner/tools/route_pacing_action.py` and is called as Step 0.7 of Flow A, **before** any §T-lane evaluation. Result becomes one of the inputs to the existing routing logic, not a replacement for it.

### 4.2 Shift 2 — Quality-adjusted CPL as default

Today `fetch_lead_quality_summary.py` exists but Flow A never calls it. v2 adds it to Flow A Step 1 (signal collection), and `compute_quality_adjusted_kpi.py` to Step 2 (analysis). Every `scale_up` and `winner` classification reads `avg_quality_14d` and `graded_sample_size_14d`.

New deterministic blocks (raising guardrail count from 41 → 45):
- **§42 `scale_up_requires_graded_sample`** — block any `scale_up` proposal where `graded_sample_size_14d < 20`. Replaces §40's warn-only behavior.
- **§43 `winner_requires_quality_grade`** — block "winner" classification in Gate 2 if `avg_quality_14d < 3.5` (existing rule, was prompt-only; now deterministic).
- **§44 `quality_adjusted_cpl_leads_report`** — Hebrew rationale on every approval that mentions CPL must use quality-adjusted figure when divergence ≥20%, raw CPL as secondary.
- **§45 `lead_grading_coverage_minimum`** — surface alert when grading-coverage drops below 60% over 30d (operator needs nudge to grade).

### 4.3 Shift 3 — Onboarding-as-chain

New `runners/onboarding_chain.sh` orchestrates:

```
0. Trigger: businesses.meta_user_id transitions from NULL → set (Meta OAuth complete)
1. propose_task(task_type=fill_business_brief)
2. WAIT until brief filled (operator action on /business-knowledge)
3. run backfill_gallery_from_meta (auto, no approval)
4. run check_account_health + check_business_alignment + check_tracking_health
5. propose_task(task_type=audience_brief) with prefill from geo_targeting + service_regions
6. WAIT until audience brief approved
7. IF active_campaign_count == 0:
     propose_task(task_type=first_campaign,
                  payload={objective, audience, creative-from-gallery, copy,
                           daily_budget computed from monthly_budget + cold-start front-load,
                           rationale with full math + benchmark + sources})
8. propose_task(task_type=organic_cadence_setup) [if Page idle >7d]
```

Each step waits for operator approval/action where required; non-approval steps run autonomously. The "wow" is opening the dashboard the day after Meta connect and seeing a complete first-campaign proposal with full rationale.

---

## 5. Phase ordering — v2

Replacing v1's surface-driven 9-phase ordering with a dependency + value-per-effort ordering. Each phase is **closed end-to-end** (migrations + tools + guardrails + UI + agent integration + tests) before the next opens.

| Phase | Title | Why this order | Est. duration |
|---|---|---|---|
| **0** | **MCQ UI for approvals** | Tiny, unblocks F (onboarding chains ask MCQ questions) | 2-3 hours |
| **A** | **Onboarding Flow F** | Highest "wow" delta; unblocks all real cold-start UX | 2-3 sessions |
| **B** | **Budget Pacing Router** | The "missing brain"; tightest leverage on monthly-result ownership | 1-2 sessions |
| **C** | **Lead Quality Wire-in + CAPI-for-CRM** | Closes 16.4 trap; required before B can scale safely | 2 sessions |
| **D** | **Audience Monthly Review + Free-text→Rule** | Closes Phase 1 lifecycle; relatively self-contained | 1 session |
| **E** | **Organic Cadence + boost_post Triggers + Weekly Digest** | Activates Page authority; weekly digest gives retention edge fast | 1-2 sessions |
| **F** | **Israeli Calendar + Cold-Start Mode + EOM Discipline** | Pacing safety net; small but high-leverage | 1 session |
| **G** | **Reporting v2 + Monthly Client Deliverable** | Closes feedback loop; only meaningful once B+C+E have generated data | 2 sessions |

Total ~12-15 sessions if done sequentially. Phases A-F are independent enough to parallelize 2-at-a-time after Phase 0.

---

## 6. Per-phase detailed scope

### Phase 0 — Approval MCQ UI (blocker)

**Trigger:** Roi reported 2026-05-17 that proposals sometimes pose "אופציה A או B?" with no answer UI.

**Goal:** When a proposal includes `operator_questions[]`, the approval card renders inline radio/checkbox buttons; chosen values flow back as `approval.operator_response` (separate field from `rejection_rationale`); agent reads them on next run as structured context.

**Deliverables:**
- Migration 026: `approvals.operator_questions jsonb`, `approvals.operator_response jsonb`, `approvals.status` enum gains `answered`.
- Schema: `[{id, prompt_he, options: [{value, label_he}], multi?: bool, required?: bool}]`.
- Web: `<MCQBlock>` component in `/approvals/[id]` page. "אשר" disabled until all required answered.
- API: `POST /api/approvals/[id]/answer` validates with Zod + updates row.
- Agent: `load_active_plans.py` includes `prior_response` field when re-proposing from an `answered` row. New guardrail §46 `respect_operator_response` — agent must reference `prior_response_ref` in `inputs` when a follow-up task descends from an answered approval.

**Acceptance criteria:** Operator can answer "א" / "ב" via radio + click אשר; the approval moves to `answered`; next agent run reads the response in `inputs.prior_response_ref` and references it in the new proposal's rationale.

**Success metric:** Operator reports a measurable drop in "I rejected this to answer a question" friction within the first week of use.

### Phase A — Onboarding Flow F

**Trigger:** `businesses.meta_user_id IS NOT NULL AND businesses.onboarding_status != 'completed'` (new flag).

**Goal:** From Meta OAuth to a complete first-campaign proposal sitting in the approvals queue, with zero operator-triggered steps in between (other than filling the brief itself).

**Deliverables:**
- Migration 027: `businesses.onboarding_status enum('not_started','brief_pending','audience_brief_pending','scanning','first_proposal_pending','completed')`, `businesses.onboarding_started_at timestamptz`.
- Runner: `runners/onboarding_chain.sh` (see §4.3 pseudo-code).
- Tools: new `propose_business_brief.py`, `propose_audience_brief.py`, `propose_first_campaign.py` (latter uses existing `draft_new_campaign_payload` + adds cold-start front-load math + monthly→daily budget translation + Israeli-calendar seasonal application).
- Web: `/onboarding` route renders current step + next action; redirects from `/` when status ≠ `completed`.
- Guardrail §47 `first_campaign_payload_completeness` — first-campaign proposal must include: chosen service, objective (Leads or Messages/CTWA), audience block (geo + age + language), creative-from-gallery OR generation brief, copy with hebrew-copy-style.md compliance, daily budget with `(CPA × 50)/7` math shown + cold-start front-load multiplier, and a "what to expect Month 1" expectation-setter section.

**Acceptance criteria:**
1. New business connects Meta → `onboarding_status='brief_pending'` set within 10s.
2. Operator fills brief → `audience_brief_pending` step opens with prefilled geo from operator-entered service_regions.
3. After audience approved → background runs scan; status moves to `first_proposal_pending` with one complete first-campaign approval ready.
4. Approval rationale in plain Hebrew is operator-readable without glossary.

**Success metric:** Time from Meta-OAuth-complete to first-campaign-proposal-visible: **target ≤ 1 hour** (excluding operator time on brief). v1 baseline: ~5 hours of operator-triggered steps.

### Phase B — Budget Pacing Router

**Trigger:** Daily at Flow A Step 0.7 (new step between current Step 0.6 account-health and Step 1 signal-collection).

**Goal:** Make `pace_ratio` a first-class input to task_type selection. The "missing brain" of Flow G.

**Deliverables:**
- Tool: `campaigner/tools/route_pacing_action.py` — implements the decision matrix from §4.1; returns `recommended_lane` + `rationale` JSON.
- Decision-tree update: new §T0p `Pacing-Driven Routing` lane, runs immediately after §T0r (top-level router). Output feeds into the existing §T2+/§T_PE/§T9.1/§T11/§T_CR/§T_AUD evaluation as a prior.
- Guardrail §48 `pacing_router_must_run_first` — Flow A skip-pacing-router is itself a §error decision.
- Guardrail §49 `eom_no_panic_spend` — if `days_left ≤ 5 AND pace_ratio < 0.85`, block all `scale_up >+15%` and all `new_campaign` proposals; only allow `redeploy_creative` / `boost_post` (already-tested creative units that won't kick learning).
- Guardrail §50 `cold_start_front_load_window` — first 14 days after `businesses.onboarding_started_at`, allow daily budget at 130-150% of pro-rated; do not flag as `overrun`.
- Web: `BudgetHealthCard` extended with "מה אני מציע לעשות החודש" panel listing the router's recommendation + receipts.

**Acceptance criteria:**
1. Underrun + healthy winner → `scale_up` proposal generated with +20% step within 1 daily cycle.
2. Underrun + exhausted gallery → `alert` proposal generated with explicit Hebrew explanation "אין מאיפה ליצור עוד creatives" + 2-option MCQ (generate vs. boost organic).
3. EOM underrun + ≤5 days left → `lost_opportunity` decision logged to `monthly_brief.lost_opportunities[]`, NO panic-spend proposal.
4. Cold-start (day 1-14) overrun within +50% → no alert, no scale_down.

**Success metric:** Monthly utilization of `effective_monthly_budget` between 90-105% (target band). Pre-v2 baseline likely 50-70% for new accounts.

### Phase C — Lead Quality Wire-in + CAPI-for-CRM

**Trigger:** Daily Flow A Step 1.5 (between signal collection and analysis).

**Goal:** Quality-adjusted CPL becomes the default reading. Block scale on under-graded campaigns. Push lead-stage events to Meta via CAPI keyed on `lead_id` so Meta's algorithm learns what a good Aiweon lead looks like.

**Deliverables:**
- Flow A integration: `fetch_lead_quality_summary.py` runs Step 1 alongside fetch_insights; `compute_quality_adjusted_kpi.py` runs Step 2 before any winner/loser classification.
- New tool: `campaigner/tools/push_capi_events.py` — server-to-server POST to Meta's Conversions API with `{event_name: "Lead"|"Qualified"|"Customer", event_id: lead_id, event_time, action_source: "system_generated"}`. Triggered by lead-grade transitions in `/leads` UI.
- Migration 028: `leads.capi_events_pushed jsonb` (array of `{event_name, pushed_at, response}`).
- Guardrails §42-§45 (see §4.2).
- Web: `/leads` UI shows CAPI status badge per lead ("דווח ל-Meta" / "ממתין").
- Background job: `runners/push_pending_capi_events.sh` (every 15 min) — picks up newly-graded leads and pushes events.
- Personality update: PERSONALITY.md §"How to diagnose" gets a new step 0 — "Pull quality-graded CPL alongside Meta CPL; report divergence in paragraph 2 when ≥20%."

**Acceptance criteria:**
1. Operator grades a lead 5 stars → within 15 min a `Customer` event lands in Meta Events Manager (verifiable in Meta UI).
2. Attempting to scale a campaign with `graded_sample_size_14d < 20` produces a guardrail block with Hebrew explanation in rationale.
3. Monthly report headline KPI is `quality_adjusted_cpl` when divergence ≥20%, with raw Meta CPL as a small secondary tile.

**Success metric:** "16.4-style" trap doesn't repeat — no `scale_up` proposal lands on a campaign with quality grade < 3.5 stars after Phase C ships.

### Phase D — Audience Monthly Review + Free-text → Rule

**Trigger:** Cron 1st of each Hebrew calendar month (or 1st-3rd business day after).

**Goal:** Once a month, propose one `audience_review` task per active business surfacing audience health + 1-2 specific suggested edits. **Never autonomous edits.** Plus: free-text → Meta rule parser for geo (the operator UX win Roi asked for).

**Deliverables:**
- Tool: `campaigner/tools/propose_audience_review.py` — checks each `meta_audiences` row's size + age + freshness; classifies as `healthy` / `decaying` / `stale` / `oversized` (size > 50% of country pop = poor signal); emits `audience_review` task with up to 2 suggested edits in MCQ format.
- Tool: `campaigner/tools/parse_geo_freetext.py` — Hebrew NLP → Meta targeting JSON. v1 scope: city lists, country, radius, age. Out-of-scope (return `requires_operator: true`): sub-city neighborhoods, implicit demographics, sociolects. Uses curated Israeli-city gazetteer.
- Master Exclusion automation: new tool `compute_master_exclusion.py` builds the union (Lead Form submitters 365d + Customer file + Operator-tagged employee list) and stores in `meta_audiences` as a Custom Audience kind=`exclusion_union`. Refreshed weekly. Guardrail §51 `prospecting_must_apply_master_exclusion` — block `new_campaign` / `expand_audience` proposals where prospecting ad set doesn't include `excluded_custom_audiences: [master_exclusion_id]`.
- LAL sizing guardrail §52 `lal_min_ratio_for_il` — proposals with `country=IL AND ratio < 0.02` blocked with Hebrew explanation about small-country math.
- Web: `/audiences` page gains "השוואה חודשית" tab. Operator can type "תושבי תל אביב מלבד אילת" → preview shows parsed rule + Meta-side audience size estimate before saving.

**Acceptance criteria:**
1. 1st of month → one `audience_review` task per business with active audiences appears in approvals queue.
2. Operator types "ת"א + ר"ג + גבעתיים, גילאי 28-50" → parser returns Meta targeting JSON; preview renders correctly.
3. Operator types "תושבי הצפון" → parser returns `requires_operator: true` with Hebrew explanation suggesting they pick specific cities OR a radius pin.
4. `new_campaign` proposal without master_exclusion attached blocks at §51.

**Success metric:** Audience-related operator-friction tickets drop (subjective). Master exclusion applied to 100% of new prospecting ad sets.

### Phase E — Organic Cadence + boost_post Triggers + Weekly Digest

**Trigger:** Continuous (weekly cron for digest + per-post evaluation when new posts land).

**Goal:** Activate the Reels-first new-Page reach subsidy. Make `boost_post` proposals deterministic via 5-threshold gate. Send Roi a weekly Hebrew digest of agent activity + pending approvals.

**Deliverables:**
- Tool extension: `check_organic_performance.py` now returns boost-candidate flag based on the 5 thresholds (engagement ≥1.5× Page avg, save ≥1.0%, share ≥0.5%, watch ≥25%, comments ≥3 threads).
- Guardrail §53 `boost_post_requires_five_thresholds` — `boost_post` proposals must show all 5 metric values + thresholds in `inputs`; missing any → block.
- Guardrail §54 `boost_post_wait_window` — block if post `created_time` < 48h ago.
- Decision-tree §T9.1 updated to call the threshold gate before proposing.
- New `publish_*` cadence proposals: agent surfaces "השבוע פרסמת 1 reel — בדף חדש Meta נותנת לך פי 10-30 reach חינם. שווה לכוון ל-4-5 לשבוע" when weekly count below floor.
- New runner: `runners/weekly_digest.sh` (Sunday 09:00 IL) — composes Hebrew digest: spend YTD vs target, top 3 proposals waiting, top 3 alerts, top 3 wins, link to dashboard. Sent to operator Email + (optional) WhatsApp via WA Business API.
- Web: `/digest/[week]` page renders the digest archive.
- Comment-handling note in UI: on `boost_post` campaigns, comment count surfaces a "התגובות שלך כוללות תגובות מהקמפיין הממומן — ענה לכולן" tooltip.

**Acceptance criteria:**
1. An organic post hitting all 5 thresholds within 48-72h window → `boost_post` proposal appears within 2 hours.
2. A post hitting 4 of 5 thresholds → NO `boost_post`, but an `alert` "פוסט קרוב לסף — עוד יום-יומיים יראו" appears.
3. Sunday 09:00 → weekly digest email arrives with 7-day summary in Hebrew.
4. Reels weekly count below floor → cadence alert proposed.

**Success metric:** Organic Page authority signal (avg post reach + engagement rate) climbs measurably over first 90 days post-launch. Weekly digest open rate (proxy for retention discipline).

### Phase F — Israeli Calendar + Cold-Start Mode + EOM Discipline

**Trigger:** Calendar-driven (always-on filter on pacing router output).

**Goal:** Three small but load-bearing pacing safety nets.

**Deliverables:**
- Seed default `seasonal_hints` for IL businesses (one-time migration data): August 0.75, Tishrei chag-days 0.50 + non-chag 0.80, Pesach week 0.75, Late Oct - early Dec 1.18, Jan-Mar 1.10, BFCM week (Nov) → no monthly multiplier but expect CPM +20-80% (logged as `cpm_event` flag).
- Tool: `apply_israeli_calendar.py` — runs in pacing router; multiplies `effective_monthly_budget` by active seasonal multiplier; flags `cpm_event` weeks so agent doesn't pause on Black Friday CPM spike.
- Cold-start mode: `pacing_router` consults `businesses.onboarding_started_at`; if days since start ≤ 14, applies 130-150% front-load multiplier and suppresses `overrun` flag.
- Guardrail §49 (already in Phase B) — EOM no-panic-spend.
- Guardrail §55 `cpm_event_no_pause` — during flagged `cpm_event` weeks, don't propose pause on CPM-only spike (must show falling CTR or rising CPL beyond seasonal expected).
- Web: `BudgetHealthCard` displays active season ("עכשיו אלול — תקציב מצומצם ב-20% עד אחרי החגים") + cold-start badge ("חודש ראשון — מתאים front-load") + EOM countdown ("נשארו 3 ימים בחודש").

**Acceptance criteria:**
1. August → effective_monthly_budget × 0.75 visible in `BudgetHealthCard`; pacing decisions use the lower number.
2. Day 5 of new account → daily budget at 140% of pro-rated pace; no `overrun` flagged.
3. Day 28 of month with pace 0.6 → router emits `lost_opportunity` log, not panic-scale.

**Success metric:** Zero panic-spend events in late-month windows; cold-start months don't trigger false `overrun` alerts.

### Phase G — Reporting v2 (Monthly Client Deliverable)

**Trigger:** Cron 3rd business day of each Gregorian month (configurable).

**Goal:** A monthly deliverable that makes Roi (and his future clients) feel an agency is in the seat. Sections per §1.8 research synthesis.

**Deliverables:**
- Tool: `compose_monthly_report.py` — produces structured JSON with: cover, exec_summary (3-sentence verdict/cause/action), kpi_scorecard, mom_yoy, decisions_log (from `agent_decisions` filtered to non-observation types), insights (O-I-R triplets generated by Claude API), next_month_plan, asks_from_operator, agent_decision_funnel (approved/rejected/why), appendix.
- Web: `/reports/[month]` page extended (Block 10 already shipped skeleton):
  - RTL headline KPI tile top-right; quality-adjusted CPL leads when divergent.
  - Funnel visualization showing dim cells for ungraded stages + grading-coverage badge.
  - Operator approval funnel ("12 הצעות → 7 אושרו → 5 נדחו · סיבה: X").
  - "מה הסוכן ממליץ לחודש הבא" section that doubles as next month's `monthly_brief` seed.
  - Disclosure footer "דו"ח זה הופק על-ידי סוכן AI ואושר על-ידי [שם המפעיל]".
  - PDF export button (Hebrew-RTL PDF generation, via Puppeteer or react-pdf).
- Loom integration (manual or via Loom API): 5-min walkthrough auto-embedded if operator records one.
- Weekly tactical snapshot already covered in Phase E digest.
- Quarterly QBR composer deferred to v3.

**Acceptance criteria:**
1. 3rd business day of month → monthly report visible at `/reports/[month]` with all sections populated.
2. PDF export renders correctly RTL with Hebrew fonts intact.
3. "What's next" section becomes editable seed for next month's `monthly_brief` jsonb.
4. AI-disclosure footer present on every report.

**Success metric:** Operator opens monthly report within 48h of generation (event-tracked). Subjective: "I'd send this to a paying client unchanged."

---

## 7. New guardrails summary (count rising 41 → 55)

| § | Name | What it enforces |
|---|---|---|
| 42 | `scale_up_requires_graded_sample` | Block scale_up if graded_sample_size_14d < 20 |
| 43 | `winner_requires_quality_grade` (was prompt-only) | Block winner classification if avg_quality_14d < 3.5 |
| 44 | `quality_adjusted_cpl_leads_report` | Rationale leads with quality-adjusted CPL when divergence ≥20% |
| 45 | `lead_grading_coverage_minimum` | Alert when grading-coverage < 60% over 30d |
| 46 | `respect_operator_response` | Follow-up tasks must reference `prior_response_ref` |
| 47 | `first_campaign_payload_completeness` | First-campaign in onboarding chain must include full bundle |
| 48 | `pacing_router_must_run_first` | Skipping pacing router in Flow A is an error |
| 49 | `eom_no_panic_spend` | Block scale_up >15% and new_campaign in last 5 days when underrun |
| 50 | `cold_start_front_load_window` | First 14 days: allow 130-150% pacing; don't flag overrun |
| 51 | `prospecting_must_apply_master_exclusion` | new_campaign / expand_audience must include master_exclusion_id |
| 52 | `lal_min_ratio_for_il` | Block LAL ratio < 0.02 for country=IL (small-country math) |
| 53 | `boost_post_requires_five_thresholds` | boost_post must show all 5 metric values + thresholds in inputs |
| 54 | `boost_post_wait_window` | Block boost_post if post created_time < 48h ago |
| 55 | `cpm_event_no_pause` | Don't propose pause on CPM-only spike during flagged cpm_event weeks |

---

## 8. Agent self-KPIs (how we'll measure "is the agent doing its job")

These belong in the agent's *own* monthly report, alongside Aiweon's campaign KPIs.

| Metric | Target | Source |
|---|---|---|
| Monthly utilization of `effective_monthly_budget` | 90-105% | `compute_monthly_pace` outputs |
| Proposal acceptance rate (approved / total) | ≥50% | `approvals.status` aggregation |
| Median days from underrun-detection → corrective proposal | ≤2 days | New: `agent_decisions.outputs.detected_at` vs follow-up approval `created_at` |
| Quality-adjusted CPL trend (MoM) | Improvement OR stable in target band | `compute_quality_adjusted_kpi` outputs |
| Grading coverage (last 30d) | ≥60% | `leads` table joined with `lead_quality_grades` |
| First-campaign-from-OAuth time | ≤1 hour | New: `businesses.onboarding_started_at` vs first `first_campaign` approval |
| Repeat-rejection rate (re-proposing rejected ideas without differentiation) | ≤5% | §37 guardrail violations |
| Hours of EOM panic-spend prevented (logged) | ≥0 (positive = caught) | `agent_decisions` of type `lost_opportunity` |

---

## 9. Risk register

| Risk | Mitigation |
|---|---|
| **CAPI-for-CRM event volume too low for Meta to learn from in cold-start** | Honest expectation-setting in Phase C — first 8 weeks events are for audit trail; Meta's optimization layer activates ~Week 8-12 when ≥200 events accumulate. |
| **Operator doesn't grade leads → §45 alerts pile up** | UX: grading takes <10s per lead in `/leads`; weekly digest shows "X leads waiting for grade" prominently; never auto-grade. |
| **Free-text→rule parser returns wrong geo silently** | Always show parsed result + Meta-side size estimate before saving; never auto-apply. `requires_operator: true` is the default when confidence < 0.85. |
| **Israeli calendar multipliers wrong for some businesses (e.g. tourism)** | Seasonal hints are per-business jsonb; defaults shipped, operator can override per row. |
| **Onboarding chain stalls if operator doesn't fill brief** | Reminder email + dashboard CTA at 24h, 72h, 7d post-OAuth. After 14d auto-pause chain with explanation. |
| **MCQ UI confuses operator (too many choices)** | Hard cap at 4 options per question; question text ≤30 Hebrew chars; show maximum 2 questions per approval. |
| **Phase G PDF rendering issues with Hebrew fonts** | Test with Heebo + Open Sans Hebrew on Puppeteer + Chromium-IL locale; fallback to web page link if PDF generation fails. |
| **Meta API rate limits during CAPI event burst** | Background queue with retry + exponential backoff; cap at 10 events/sec/business. |
| **Andromeda's behavior changes mid-rollout (Meta unannounced)** | Quarterly re-audit of §1 research synthesis; agent doesn't hardcode Andromeda specifics — uses the abstraction "what Meta currently optimizes for" with thresholds in `business_settings` for easy override. |

---

## 10. Out-of-scope for v2 (deferred to v3+)

- **Multi-business multi-account** (v3 LangGraph migration, see [`docs/plans/campaigner-spec.md`](campaigner-spec.md) v2 section). v2 stays single-business per project root constraints.
- **Customer-file PII upload** for Custom Audience seeding (sensitive; needs separate consent flow).
- **Quarterly Business Review (QBR) composer** — once 2+ months of monthly reports exist.
- **Real-time Meta webhook subscription** (currently we poll daily; webhook would give same-day account-quality alerts but requires Meta App Review).
- **Audience overlap visualization UI** (Phase 1 v1 stretch goal; data exists, visualization deferred).
- **Multi-language ads** (Aiweon is Hebrew-only for v2).
- **Branded Content / Partnership Ads automation** — Aiweon is an influencer-marketing platform so this is product-level v3 work.
- **A/B test auto-promote-winner + auto-pause-loser** — currently winner is documented, not acted on (Block 11 scope).

---

## 11. Detailed research sources

Full source lists per domain are stored in [`docs/deep_research/v2_mastery/`](../deep_research/v2_mastery/) (one file per subagent output, captured 2026-05-17). Top citations:

**Andromeda + Advantage+:** Jon Loomer "Meta Andromeda" · Foxwell Digital "New Meta GEM era" · AdExchanger "Andromeda actually changes" · MTM Agency Oct 2025 update · DataAlly Creative Similarity Score · Lebesgue CBO vs ABO research · Charley Tichenor (X @CTtheDisrupter) · Andrew Foxwell on Perpetual Traffic Ep 752-753 · Nick Theriot "Testing Facebook Ads Post-Andromeda" (YouTube).

**Cold-start:** AdMove "New Facebook Ad Account 30-Day Playbook" · Spiral "Scaling Meta 2025" · Pay2.House warm-up · Modern Marketing Institute "Exit Learning Phase 2026" · Niblin Learning-Phase guide · Get-Ryze Meta minimum budget · Jon Loomer Learning Phase.

**Lead Ads + WhatsApp:** Edge Digital "Meta Lead Forms 2025" · Privyr "Generate high quality leads" · Dancing Chicken Meta Lead Generation 2025 · LeadsBridge Conversion Leads · Smarketing Cloud "Inconsistent Lead Quality + CAPI" · Datahash "Meta CAPI for CRM" · LeadSync "Lead form SMS verification" · Direction One "5-level filter framework" · Wonderful "Bot traffic surge" · Meta WhatsApp Business "Down-funnel optimization" · Infobip CTWA guide · Times of Israel "WhatsApp-first" · Kixie speed-to-lead statistics · Cleverly + Leads at Scale B2B lead scoring.

**Creative:** Confect Andromeda 2026 · Segwise Andromeda creative strategy · Wonderful 11 Creative Strategies · Motion App "Ultimate creative testing 2025" · Foxwell "Creative Diversity Golden Ticket" · Sovran Hook Rate Ultimate Guide · Vaizle Hook/Hold Rate · CNBC "Reels >50% IG ads 2025" · Triple Whale Creative Fatigue · Soku "AI vs Human 10,000 campaigns" · Science.org "AI remixing same 12 cliches" · Diamond Group "Meta B2B myth."

**Budget pacing:** CrystalGate ABO vs CBO 2025 · Metaphase Andromeda CBO/ABO · Skaleit Andromeda 2026 · Causal Funnel Scaling 2026 · AdAmigo scaling without losing ROAS · Ben Heath two-campaign 80/20 · Top Growth Marketing "0.85 multiplier" · Improvado Budget Pacing · Meta "About Bid and Budget Pacing" · SocialKapture "+75% daily buffer" · Pix-Vu daily vs lifetime · Coinis "Kill a Meta Ad Decision Framework" · CTC Taylor Holiday on creative testing 2026.

**Audiences:** Foxwell "Audience targeting really works" · Foxwell "Broad targeting without exclusions" · Jon Loomer "Advantage+ Audience vs Original" · Wonderful "Acquire new only" · ATTN Agency LAL strategies post-iOS · Flighted "B2B SaaS audience targeting" · StackMatix "Facebook Ads B2B" · Conversios Advantage+ Audience 2026 · WickedReports "Detailed Targeting Exclusions removed" · MediaPost "Meta consolidates targeting" · HeGeL Hebrew geo-location dataset · JOSIS Hebrew textual geolocation · Affect Group Israel Meta audience 2026.

**Organic ↔ Paid:** Buffer 2026 Instagram Algorithm · Hootsuite 2025 FB algorithm · Social Media Examiner "FB content strategy 2025" · Hashmeta FB algorithm changes 2025 · TrueFuture Reels Reach 2026 · ALM Corp Instagram organic 3.5% · ALM Corp "Meta Original Content Rules 2026" · Common Thread Collective creative demand scores · Foxwell "Brand Collab Whitelisting 2025" · Neal Schaffer "When to use Boost Post" · BlitzMetrics "Boosting Posts succeed" · DataReportal "Digital 2025 Israel" · NapoleonCat IL FB users May 2025 · Meta Developers Click-to-WhatsApp Marketing API.

**Reporting:** AgencyAnalytics "Narrative Reports" + "Vanity Metrics" + "20 Client Reporting Tips" · AdStellar 2026 reporting · Postbright "Meta Ads Reporting" · Madgicx "Agency Client Reporting" · Swydo "Client Reporting Best Practices 2025" · WhatConverts "Why static reports kill retention" · SearchEngineLand "Read Meta ads like a system" · Stackmatix "Metrics That Matter" · Pilothouse 3-3-3 framework · Foxwell Founders 2026 State of Agencies · ALM Corp "White Label Meta Agency 2026" · IAB AI Transparency Framework · Canva Marketing AI Report 2026 · Vida Customer Trust AI 2026.

---

## 12. Update log

| Date | Change |
|---|---|
| 2026-05-17 | v2 initial draft. 8-subagent research synthesis + 9-stage internal audit + 3 Roi clarifications. Phases 0-G defined. Replaces v1's 9-phase ordering. Total 14 new guardrails (§42-§55). 8 agent self-KPIs introduced. |

---

> **Next action:** Phase 0 (MCQ UI) opens. It's small (2-3 hours), unblocks Phase A, and tackles the operator-friction issue Roi raised explicitly. After Phase 0, Phase A (Onboarding Flow F) opens — that's the "wow" delivery.
