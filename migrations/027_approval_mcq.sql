-- 027_approval_mcq.sql
-- Phase 0 of Mastery Plan v2 (2026-05-17): inline MCQ answers on approvals.
--
-- Roi reported 2026-05-17: agent proposals sometimes pose multiple-choice
-- ("שאלות אמריקאיות") to the operator, but the only way to answer is to reject
-- with the chosen option as rejection_rationale. That's wrong — answering a
-- clarifying question isn't rejection, and the structured choice is lost to
-- freetext drift.
--
-- v2 adds:
--   - operator_questions jsonb  — agent declares the questions inline with the
--                                 proposal payload (separate column so the
--                                 payload contract per task_type stays clean).
--   - operator_response jsonb   — operator's answers, posted via the new
--                                 MCQ UI block on the approval detail page.
--   - status 'answered'         — a new state that means "operator answered
--                                 the questions; agent should pick it up on
--                                 next run and either re-propose with
--                                 refinement OR mark as approved/rejected
--                                 once it has what it needs."
--
-- Status flow with v2:
--   pending → answered (operator answered MCQ; agent will re-evaluate next run)
--   pending → approved → executed
--   pending → rejected
--   answered → pending (agent re-proposed with refinement, MCQ cleared)
--   answered → approved (agent decided no more questions needed)
--   answered → rejected (operator changed mind after answering)

ALTER TABLE approvals
  ADD COLUMN operator_questions jsonb,
  ADD COLUMN operator_response jsonb,
  ADD COLUMN answered_at timestamptz;

-- Drop the old status CHECK constraint and recreate with 'answered'.
ALTER TABLE approvals
  DROP CONSTRAINT IF EXISTS approvals_status_check;

ALTER TABLE approvals
  ADD CONSTRAINT approvals_status_check
  CHECK (status IN (
    'pending','approved','rejected','executed','failed','expired','dry_run','answered'
  ));

COMMENT ON COLUMN approvals.operator_questions IS
  'Array of MCQ questions the agent wants the operator to answer before this proposal can move forward. Shape: [{id, prompt_he, options: [{value, label_he}], multi?: bool, required?: bool}]. NULL/empty = no questions, normal approve/reject flow.';

COMMENT ON COLUMN approvals.operator_response IS
  'Operator answers to operator_questions. Shape: {<question_id>: <value> | [<value>, ...]}. Set when status flips to ''answered''.';

COMMENT ON COLUMN approvals.answered_at IS
  'Timestamp when the operator submitted MCQ answers. NULL until operator_response is written.';
