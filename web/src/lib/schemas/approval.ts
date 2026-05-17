import { z } from "zod";

/**
 * Shape of an `approvals` row as consumed by the UI. Matches the backend
 * enum exactly — see migrations/004_approvals.sql + backend PRD §10.4.
 * Migration 027 (2026-05-17) added operator_questions / operator_response /
 * status='answered' for Phase 0 of mastery v2.
 */

export const TASK_TYPES = [
  "budget_change",
  "pause_campaign",
  "resume_campaign",
  "pause_adset",
  "new_creative",
  "new_campaign",
  "scale_up",
  "scale_down",
  "expand_audience",
] as const;

export const URGENCY = ["low", "medium", "high", "urgent"] as const;
export const STATUS = [
  "pending",
  "approved",
  "rejected",
  "executed",
  "failed",
  "expired",
  "dry_run",
  "answered",
] as const;
export const TARGET_KIND = [
  "campaign",
  "adset",
  "ad",
  "creative",
  "account",
] as const;

/**
 * One MCQ question the agent asks the operator inline with a proposal.
 * `id` is referenced back in operator_response keys + by agent's next-run
 * `prior_response_ref` field (guardrail §46).
 */
export const operatorQuestionOptionSchema = z.object({
  value: z.string().min(1).max(64),
  label_he: z.string().min(1).max(80),
});

export const operatorQuestionSchema = z.object({
  id: z
    .string()
    .min(1)
    .max(40)
    .regex(/^[a-z0-9_]+$/, "id חייב להיות snake_case ASCII"),
  prompt_he: z.string().min(1).max(200),
  options: z.array(operatorQuestionOptionSchema).min(2).max(4),
  multi: z.boolean().optional(),
  required: z.boolean().optional(),
});

export const operatorQuestionsSchema = z.array(operatorQuestionSchema).max(2);

export const operatorResponseSchema = z.record(
  z.union([z.string(), z.array(z.string())]),
);

export const approvalSchema = z.object({
  id: z.string().uuid(),
  business_id: z.string().uuid(),
  task_type: z.enum(TASK_TYPES),
  target_kind: z.enum(TARGET_KIND),
  target_id: z.string(),
  payload: z.record(z.unknown()),
  rationale: z.string().min(1),
  expected_impact: z.record(z.unknown()).nullable(),
  urgency: z.enum(URGENCY),
  status: z.enum(STATUS),
  created_at: z.string(),
  expires_at: z.string().nullable(),
  operator_questions: operatorQuestionsSchema.nullable().optional(),
  operator_response: operatorResponseSchema.nullable().optional(),
  answered_at: z.string().nullable().optional(),
});

export const rejectRequestSchema = z.object({
  reason: z.string().trim().min(1, "נדרשת סיבה").max(200, "עד 200 תווים"),
});

/**
 * Validate operator-submitted MCQ answers against the questions block on the
 * approval. Returns the trimmed/normalized response or throws a ZodError-like
 * message — single answer per question unless `multi: true`, only declared
 * option values, all `required: true` questions present.
 */
export function buildAnswerRequestSchema(
  questions: z.infer<typeof operatorQuestionsSchema>,
) {
  const fields: Record<string, z.ZodTypeAny> = {};
  for (const q of questions) {
    const allowed = q.options.map((o) => o.value) as [string, ...string[]];
    const single = z.enum(allowed);
    const value = q.multi
      ? z.array(single).min(1).max(allowed.length)
      : single;
    fields[q.id] = q.required === false ? value.optional() : value;
  }
  return z.object(fields);
}

export type Approval = z.infer<typeof approvalSchema>;
export type TaskType = (typeof TASK_TYPES)[number];
export type Urgency = (typeof URGENCY)[number];
export type OperatorQuestion = z.infer<typeof operatorQuestionSchema>;
export type OperatorQuestions = z.infer<typeof operatorQuestionsSchema>;
export type OperatorResponse = z.infer<typeof operatorResponseSchema>;
