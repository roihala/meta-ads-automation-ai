"""
Contract-compliance tests for campaigner/tools/*.

What we verify (per spec §11.6):
  1. Valid args → exit 0 + stdout is a parseable JSON object.
  2. Missing required arg → exit 2 (argparse error) + stderr non-empty.
  3. Invalid enum value → exit 2 (argparse 'choices' rejection).
  4. Invalid JSON in a JSON arg → exit 2 (our validation layer).

Business semantics (does the row actually land in the right table with the
right values) is covered separately in `test_log_decision.py` and
`test_propose_task.py`. These tests only care about the CLI contract.
"""
from __future__ import annotations

import json

import pytest


# ---------- fixtures ----------

@pytest.fixture
def base_log_args(business_id, run_id):
    return [
        "--business-id", business_id,
        "--run-id", run_id,
        "--graph-name", "observe_propose",
        "--node-name", "observe",
        "--decision-type", "observation",
        "--summary", "contract test",
    ]


@pytest.fixture
def base_propose_args(business_id, run_id):
    return [
        "--business-id", business_id,
        "--run-id", run_id,
        "--task-type", "budget_change",
        "--payload", '{"new_daily_budget_cents":6500}',
        "--rationale", "contract test",
    ]


# ---------- exit 0: valid args ----------

def test_load_baselines_valid_args_exits_0(invoke_tool, business_id):
    r = invoke_tool("load_baselines", "--business-id", business_id)
    assert r.returncode == 0, f"stderr: {r.stderr}"
    payload = json.loads(r.stdout)
    assert payload["business_id"] == business_id
    assert "baselines" in payload
    assert isinstance(payload["baselines"], list)


def test_log_decision_valid_args_exits_0(invoke_tool, cleanup_run, base_log_args):
    r = invoke_tool("log_decision", *base_log_args)
    assert r.returncode == 0, f"stderr: {r.stderr}"
    payload = json.loads(r.stdout)
    assert "id" in payload
    assert payload["decision_type"] == "observation"


def test_propose_task_valid_args_exits_0(invoke_tool, cleanup_run, business_id, base_propose_args):
    # cleanup_run fixture already ensures DB state is clean — just use its run_id
    args = [a if a != base_propose_args[3] else cleanup_run for a in base_propose_args]
    # Replace run-id (arg index 3) with the cleanup_run value
    args = list(base_propose_args)
    args[3] = cleanup_run
    r = invoke_tool("propose_task", *args)
    assert r.returncode == 0, f"stderr: {r.stderr}"
    payload = json.loads(r.stdout)
    assert "approval_id" in payload
    assert payload["status"] == "pending"
    assert payload["task_type"] == "budget_change"


# fetch_insights is NOT exercised end-to-end here — it hits the live Meta API.
# We only verify it rejects bad args (covered below).


# ---------- exit 2: missing required arg ----------

@pytest.mark.parametrize("tool", ["fetch_insights", "load_baselines", "log_decision", "propose_task"])
def test_missing_business_id_exits_2(invoke_tool, tool):
    r = invoke_tool(tool)  # no args at all
    assert r.returncode == 2, f"tool={tool} stdout={r.stdout} stderr={r.stderr}"
    assert r.stderr, "argparse errors must go to stderr"


def test_log_decision_missing_decision_type_exits_2(invoke_tool, business_id, run_id):
    r = invoke_tool(
        "log_decision",
        "--business-id", business_id,
        "--run-id", run_id,
        "--graph-name", "observe_propose",
        "--node-name", "observe",
        "--summary", "x",
        # --decision-type omitted
    )
    assert r.returncode == 2


def test_propose_task_missing_payload_exits_2(invoke_tool, business_id, run_id):
    r = invoke_tool(
        "propose_task",
        "--business-id", business_id,
        "--run-id", run_id,
        "--task-type", "budget_change",
        "--rationale", "x",
        # --payload omitted
    )
    assert r.returncode == 2


# ---------- exit 2: invalid enum ----------

def test_fetch_insights_invalid_level_exits_2(invoke_tool, business_id):
    r = invoke_tool("fetch_insights", "--business-id", business_id, "--level", "bogus")
    assert r.returncode == 2


def test_log_decision_invalid_decision_type_exits_2(invoke_tool, business_id, run_id):
    r = invoke_tool(
        "log_decision",
        "--business-id", business_id,
        "--run-id", run_id,
        "--graph-name", "observe_propose",
        "--node-name", "observe",
        "--decision-type", "bogus",
        "--summary", "x",
    )
    assert r.returncode == 2


def test_propose_task_invalid_task_type_exits_2(invoke_tool, business_id, run_id):
    r = invoke_tool(
        "propose_task",
        "--business-id", business_id,
        "--run-id", run_id,
        "--task-type", "bogus",
        "--payload", "{}",
        "--rationale", "x",
    )
    assert r.returncode == 2


# ---------- exit 2: malformed JSON in JSON args ----------

def test_log_decision_malformed_inputs_json_exits_2(invoke_tool, business_id, run_id, base_log_args):
    r = invoke_tool(
        "log_decision",
        *base_log_args,
        "--inputs", "{not json",
    )
    assert r.returncode == 2
    assert "validation_error" in r.stdout or "VALIDATION" in r.stderr


def test_propose_task_malformed_payload_exits_2(invoke_tool, business_id, run_id):
    r = invoke_tool(
        "propose_task",
        "--business-id", business_id,
        "--run-id", run_id,
        "--task-type", "budget_change",
        "--payload", "{not json",
        "--rationale", "x",
    )
    assert r.returncode == 2


# ---------- exit 2: semantic validation (confidence out of range) ----------

def test_log_decision_confidence_out_of_range_exits_2(invoke_tool, base_log_args):
    r = invoke_tool("log_decision", *base_log_args, "--confidence", "1.5")
    assert r.returncode == 2


def test_propose_task_target_kind_without_target_id_exits_2(invoke_tool, business_id, run_id):
    r = invoke_tool(
        "propose_task",
        "--business-id", business_id,
        "--run-id", run_id,
        "--task-type", "budget_change",
        "--payload", "{}",
        "--rationale", "x",
        "--target-kind", "campaign",
        # --target-id omitted
    )
    assert r.returncode == 2
