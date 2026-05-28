# Continue Prompt — Clara video flow + parked backlog

**Updated:** 2026-05-28
**Branch:** `migration/prd-step-5-plans-trigger` — last commit covers Phases 0-2 of the Clara video flow.
**Current workstream:** Implementing [`docs/plans/clara-video-flow.md`](../plans/clara-video-flow.md). Phases 0-2 of 7 are done; **Phases 3-7 remain.**

---

## What just landed (Phases 0-2)

**Schema** — `migrations/034_clara_pending_creatives.sql` (applied locally; not yet in prod Supabase):
- `creative_gallery.status` enum (`pending|generated|active|archived|expired`), backfilled from existing rows.
- `+hebrew_brief`, `+source_asset_ids uuid[]`, `+expires_at`.
- `generated_by` CHECK widened with `'clara'`.
- Indexes: `creative_gallery_pending_fifo_idx`, `creative_gallery_status_idx`.
- `business_knowledge` gains `business_name`, `logo_url`, `default_cta_url`.

**Imagen retired entirely.** Deleted: `image_generator.py`, `campaigner/lib/creative.py`, `campaigner/tools/generate_creative.py`. Dropped `google-genai` from `requirements.txt`. Dropped GCP env vars from `config/flows.yaml` defaults + `campaigner/lib/config.py`. `validate_credentials.py` now Anthropic + Meta only. `grep -r imagen` returns only intentional historical-context callouts.

**Flow C rewritten.** `runners/weekly_creative_firehose.sh` (Mon 10:00 IL) now writes:
- `redeploy_creative` proposals (HITL via `approvals`) when ≥3 viable unused gallery assets exist for the channel, OR
- `pending_creative` rows directly into `creative_gallery` (no HITL at this stage) via the new tool `campaigner/tools/propose_pending_creative.py`.

The new tool enforces a hard weekly cap of 14 pending briefs per business (7 × 2/day Clara cap), validates 2-3 source-asset UUIDs, sets `expires_at = now() + 7 days`. Contract: 4 new tests in `tests/tools/test_contract.py`.

**Knowledge files updated:**
- `campaigner/prompts/creative-guide.md` — full rewrite (Imagen sections removed; new §10 "תקציר Clara — מבנה ה-`hebrew_brief`"; §12 changelog).
- `campaigner/prompts/{guardrails,decision-tree,hebrew-copy-style}.md` — Imagen references swapped for Clara.
- `campaigner/CAMPAIGNER.md` Flow C section rewritten end-to-end; tool catalog updated.

**Web types** match the new schema. `web/src/lib/db/types.ts` + `local-postgres.ts` + `app/gallery/asset-tile.tsx` typecheck clean.

**Tests:** 308 passing (+5 new), web typecheck clean.

**Phase 0 spike doc scaffolded** at [`docs/research/clara-playwright-spike.md`](../research/clara-playwright-spike.md) — operator needs to run Playwright codegen against clarasocial.com with Aiweon's account to fill in selectors + auth findings. **This is the blocker on Phase 3 implementation** (the orchestration scaffold can ship without it, but `lib/clara_client.py` selectors can't be guessed).

---

## What's next

**Phases remaining** (per [`../plans/clara-video-flow.md`](../plans/clara-video-flow.md) §7):

| # | Phase | Status | Notes |
|---|---|---|---|
| 3 | Clara client + Flow I daily runner | **partly buildable now** | `extract_video_frame.py` (ffmpeg) + `generate_clara_video.py` orchestrator + `runners/daily_clara_generate.sh` + `dockerfiles/agent.clara.Dockerfile` + `config/flows.yaml` Flow I entry are all independent of the spike. `lib/clara_client.py` ships as a scaffold with `NotImplementedError` stubs until the spike fills in selectors. |
| 4 | Flow B `upload_creative` branch | independent | Add `task_type='upload_creative'` branch in `campaigner/tools/execute_task.py` — download MP4 from storage, call `MetaClient.upload_video_creative` (verify or add), flip gallery row `status='active'`, set `meta_creative_id`. |
| 5 | Web UI: library sections + approval card | independent | New library tabs (ממתינות / שנוצרו / פעילים / ארכיון) based on `creative_gallery.status`. New approval card for `upload_creative` with 9:16 video preview + brief + source-photo thumbnails. RTL Hebrew. |
| 6 | Observability for Flow I | trivial | Heartbeat already wired by the runner template; add a pending-depth + Clara-success-rate metric if there's a metrics surface. |
| 7 | Spec + doc updates | yes after 3-6 | Update `docs/plans/campaigner-spec.md` (add Flow I; new gallery cols; Imagen → Clara in §7). Update root `CLAUDE.md`, `runners/CLAUDE.md`, `CAMPAIGNER.md` flow table + load matrix. Outdated doc references still in `docs/plans/campaigner-backend-prd.md` + `docs/ARCHITECTURE.md` (architecture diagram). |

**Recommended order:** Phase 4 (small, self-contained) → Phase 3 scaffold (everything except selectors) → Phase 5 (Web UI) → Phase 6 → Phase 7. Spike-blocked work in `lib/clara_client.py` stays as `NotImplementedError` until the operator runs the spike.

**Operator-blocked items:**
1. **Phase 0 spike** — needs Aiweon's Clara credentials + a manual Playwright codegen session.
2. **Aiweon brand-fields backfill** — `scripts/backfill_aiweon_brand_fields.sql` has TODO markers for `business_name` / `logo_url` / `default_cta_url`. Flow I will refuse to invoke Clara until those are populated.
3. **k3s/Hetzner CronJob manifest** for `daily_clara_generate` — lives in the operator's Hetzner infra repo at `~/projects/bemtech/setup/hetzner/manifests/campaigner/`, not this repo. Phase 3 will need to coordinate.

---

## Files to read first on restart

1. [`docs/plans/clara-video-flow.md`](../plans/clara-video-flow.md) — the implementation plan with file-by-file breakdown.
2. [`docs/research/clara-playwright-spike.md`](../research/clara-playwright-spike.md) — Phase 0 spike doc (mostly TODO).
3. [`campaigner/prompts/creative-guide.md`](../../campaigner/prompts/creative-guide.md) — agent's knowledge file for Flow C; rewritten this session.
4. [`campaigner/CAMPAIGNER.md`](../../campaigner/CAMPAIGNER.md) §Flow C — the agent's protocol for the new pending-brief + redeploy mix.
5. [`campaigner/tools/propose_pending_creative.py`](../../campaigner/tools/propose_pending_creative.py) — new tool; its contract is the closest reference for `generate_clara_video.py` (Phase 3).
6. [`config/flows.yaml`](../../config/flows.yaml) — Flow I will be added here in Phase 3.
7. [`migrations/034_clara_pending_creatives.sql`](../../migrations/034_clara_pending_creatives.sql) — applied locally; **not yet in prod Supabase**.

---

## Parked workstreams (do not relitigate; resume only on explicit ask)

### PRD migration (`docs/plans/campaigner-migration-prd.md`)
Steps 1, 2, 3, 5 of 9 already landed before this session. **Step 4 (per-flow prompt split + shared brain)** is the next bottleneck — a 2-3-week atomic effort that splits `CAMPAIGNER.md` (~1,200 lines) into `prompts/flows/<flow_name>.md` + extracts `prompts/shared-brain.md` for concepts used by ≥2 flows. Steps 6-9 depend on Step 4. **Atomicity:** per-flow split without the shared-brain extraction is not independently shippable.

### Meta auth — System User Token (Path A)
Live in `.env` and validated against Bemtech's `act_1390480923117690` (real production ad account). `bemtech-app` (id `1663090314693954`) is the linked app; `bemtech-admin` (SU id `61579420437900`) is the identity. Token type `SYSTEM_USER`, never expires. `meta_auth_mode='system_user_token'` flipped in Supabase. **`/integrations` UI will show the never-expires badge but no asset list** — assets live only in `.env` (`META_AD_ACCOUNT_ID`, `META_PAGE_ID`), not in `meta_connections`.

### Meta auth — OAuth (Path B)
Frontend env (`web/.env.local`) configured; OAuth tables present in Supabase. Roi paused — needs to complete Meta dashboard config (Valid OAuth Redirect URIs + Client/Web OAuth toggles at `https://developers.facebook.com/apps/1279534720998161/fb-login/settings/`). **Production callback URLs** (for App Review submission) all live under `campaigner.aiweon.co.il`: `/api/meta/oauth/callback`, `/api/meta/deauthorize`, `/api/meta/data-deletion`.

### Operational TODOs from prior sessions

1. **`make agent`** — F/G/H CronJob manifests committed but not deployed. Step-2 AC clock hasn't started.
2. **Migrations 031 + 032 + now 034** — applied locally; **not in prod Supabase yet**. Recommended landing order: push branch → apply migrations in one window → redeploy agent image. All three are additive (new columns NULLable), safe to land independently of the agent rolling out.
3. **macOS runner bug** — `runners/*.sh` use `date +%s%3N` which BSD `date` doesn't grok. Demoted to cosmetic; the heartbeat tool self-writes correctly even when the bash trap math fails.
4. **Cleanup pending:** `.venv-host/` (~150 MB) + `.run-host.sh` (381 B) at repo root from a prior nested-session demo. Safe to delete.

### Decisions already made (don't relitigate)

- **Generator pattern:** YAML in `config/`, Python generator at `scripts/generate_from_<name>.py`, sentinel-comment fenced regions, `make generate` + `make verify-generated`. Agent never reads YAML directly — only generated markdown.
- **Threshold placeholder syntax:** `{{<domain>.<name>}}`.
- **`plans_carryover` stays as the plans table name** (additive columns only).
- **Clara replaces Imagen entirely** — not parallel, not fallback. Confirmed 2026-05-26 in this thread.
- **Clara HITL gates on the finished video only** — not on the pending brief. Operator approves the `upload_creative` row that Flow I queues after Clara returns.
- **Source assets for Clara come from `creative_gallery`** — agent reasons over candidates; video rows are valid (Flow I extracts a frame via ffmpeg).
- **Weekly cap 14 / daily cap 2** for Clara. `propose_pending_creative.py` enforces the weekly cap at insert time; `generate_clara_video.py` (Phase 3) will enforce the daily cap.
- **Two Docker images for the agent**: base `agent` for Flows A/B/C/D/F/G/H, separate `agent-clara` (Playwright + Chromium + ffmpeg) for Flow I, to keep base image lean.

---

## How to resume

```bash
# Verify local state matches the docs
docker compose run --rm campaigner python scripts/migrate.py --status
docker compose run --rm campaigner bash -c "pip install -q -r requirements-dev.txt && python -m pytest tests/ -q"
docker compose exec web pnpm exec tsc --noEmit

# Read the plan, pick a Phase
cat docs/plans/clara-video-flow.md
```

The plan has the full file-by-file breakdown of what each remaining phase needs. Start with whatever Phase the operator points at — Phase 4 is the smallest, Phase 3 has the most surface area but most of it is buildable independent of the spike.
