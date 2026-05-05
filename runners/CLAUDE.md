# Claude-at-`runners/` — cron entrypoints

> Loaded automatically when cwd is here. Active alongside [root CLAUDE.md](../CLAUDE.md).

## What this folder is

Three Bash scripts. Each is a **cron entrypoint** that wraps a single `claude -p` headless invocation with environment validation, heartbeats, and exit-code discipline. They are the seam between Cloud Scheduler / cron and the agent.

| Script | Flow | Schedule (Asia/Jerusalem) |
|---|---|---|
| [`daily_observe_propose.sh`](daily_observe_propose.sh) | A — observe & queue proposals to `approvals` | 09:00 daily |
| [`execute_approvals.sh`](execute_approvals.sh) | B — execute approved rows against Meta | every 15 min |
| [`weekly_creative_firehose.sh`](weekly_creative_firehose.sh) | C — generate 3-5 new creatives per active campaign | Mon 10:00 |

The matching k8s `CronJob` manifests live in [`../kubefiles/`](../kubefiles/) (`agent_cronjob_*.yaml`).

## The runner contract

Every runner does these five things, in this order. If you write a new runner, copy the structure exactly.

1. **Validate env** (`set -euo pipefail`, `: "${BUSINESS_ID:?...}"`). Fail with exit 2 **before** writing any heartbeat — a misconfigured run shouldn't pollute the heartbeat table.
2. **Heartbeat `phase=start`** via `python -m campaigner.tools.heartbeat`. This makes the run visible to the failure-detector.
3. **`trap` to write `phase=error` on any non-zero exit**, including duration and exit code. Suppress trap errors with `|| true` so the trap itself never crashes.
4. **`claude -p --output-format json "..."`** with a prompt that names the flow. Claude reads [`../campaigner/CAMPAIGNER.md`](../campaigner/CAMPAIGNER.md) from cwd and routes to the right flow.
5. **Heartbeat `phase=end`** with duration and exit code 0 — only reached on success.

## Why this structure

- **Heartbeats are observability.** The frontend's "3 consecutive failures → red banner" detector (spec §10.8) reads the `heartbeats` table. A runner that doesn't write heartbeats is invisible.
- **`trap on ERR`** is the only way to guarantee a `phase=error` row even when `claude -p` segfaults or the network drops mid-flow.
- **The prompt is one line.** `claude -p "BUSINESS_ID=$BUSINESS_ID. Run the daily observe-propose flow per campaigner/CAMPAIGNER.md."` Claude reads everything else from CAMPAIGNER.md. Don't inline prompt content here — it's a maintenance trap.

## Exit codes

| Code | Meaning |
|---|---|
| 0 | Success. `phase=end` heartbeat written. |
| 1 | Runtime failure (Claude returned non-zero, DB unreachable, Meta API down). `phase=error` heartbeat written via trap. |
| 2 | Validation failure (env missing). No heartbeat — run never started. |

## Adding a new runner

1. **Don't.** Three flows is the spec. A fourth flow needs spec changes first.
2. If the spec adds one (e.g. monthly review, ad hoc backfill), copy `daily_observe_propose.sh` byte-for-byte and change three things: `FLOW=...`, the `claude -p` prompt, and the runtime expectations comment block at the top.
3. Add a matching `kubefiles/agent_cronjob_<flow>.yaml` and wire it in the [Makefile](../Makefile) `agent_deploy` target.
4. Update [root CLAUDE.md "Architecture"](../CLAUDE.md#architecture-mvp--claude-code-native) and `CAMPAIGNER.md` flow table.

## Triggering manually

```bash
# Local
docker compose run --rm campaigner bash runners/daily_observe_propose.sh

# Production (one-off)
make agent_run_once FLOW=daily-observe       # see Makefile
```

The CLI [`campaigner run <flow>`](../campaigner/cli/__main__.py) shells to these scripts directly.

## Where truth lives

| Question | Read |
|---|---|
| What each flow does | [`../campaigner/CAMPAIGNER.md`](../campaigner/CAMPAIGNER.md) Flow A / B / C |
| Heartbeat schema | [`../migrations/007_heartbeats.sql`](../migrations/007_heartbeats.sql) + spec §10.8 |
| Cron schedule of record | [`../kubefiles/agent_cronjob_*.yaml`](../kubefiles/) |
| Operator manual trigger | [Makefile](../Makefile) `agent_run_once` |
