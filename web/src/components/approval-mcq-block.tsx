import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Approval } from "@/lib/db/types";

/**
 * Phase 0 (Mastery v2, 2026-05-17) — render an approval's `operator_questions`
 * as an inline answer form.
 *
 * The form posts to a server action declared in the parent page so the parent
 * controls validation, redirect, and side effects (status flip pending →
 * answered). Server component on purpose — no state needed; radio buttons are
 * native HTML form fields.
 *
 * Layout: RTL Hebrew, one question per row, options as radios (single) or
 * checkboxes (multi). Submit button disabled state is enforced via the
 * `required` attribute on inputs + form-level validation server-side.
 */
export function ApprovalMcqBlock({
  approval,
  action,
}: {
  approval: Approval;
  action: (formData: FormData) => Promise<void>;
}) {
  const questions = approval.operator_questions;
  if (!questions || questions.length === 0) return null;
  if (approval.status !== "pending") return null;

  return (
    <Card className="border-2 border-brand-500/40 bg-brand-500/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <span aria-hidden>❓</span>
          הסוכן רוצה לדעת ממך
        </CardTitle>
        <CardDescription>
          ענה ובחר &quot;שלח תשובה&quot; כדי שהסוכן יחזור אליך עם הצעה מדויקת יותר.
          זו לא דחייה — ההצעה תיכנס למצב &quot;נענתה&quot; והסוכן ייקח את התשובות
          לסבב הבא.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="flex flex-col gap-5">
          <input type="hidden" name="id" value={approval.id} />
          {questions.map((q, qIdx) => (
            <fieldset
              key={q.id}
              className="flex flex-col gap-2 rounded-md border bg-background p-3"
            >
              <legend className="px-1 text-sm font-semibold">
                <span className="text-muted-foreground">{qIdx + 1}.</span>{" "}
                {q.prompt_he}
                {q.required !== false ? (
                  <span className="text-destructive" aria-hidden>
                    {" *"}
                  </span>
                ) : null}
              </legend>
              <div className="flex flex-col gap-1.5">
                {q.options.map((opt) => {
                  const inputId = `q_${q.id}_${opt.value}`;
                  const inputName = q.multi ? `q_${q.id}[]` : `q_${q.id}`;
                  return (
                    <label
                      key={opt.value}
                      htmlFor={inputId}
                      className="flex cursor-pointer items-start gap-2 rounded-sm px-2 py-1 text-sm hover:bg-muted/50"
                    >
                      <input
                        type={q.multi ? "checkbox" : "radio"}
                        id={inputId}
                        name={inputName}
                        value={opt.value}
                        required={q.required !== false && !q.multi}
                        className="mt-1"
                      />
                      <span>{opt.label_he}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          ))}
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              שדות עם <span className="text-destructive">*</span> חובה. השליחה
              לא מבצעת פעולה ב-Meta — רק עונה לסוכן.
            </p>
            <Button type="submit">שלח תשובה</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

/**
 * Parse FormData into the structured operator_response shape the DB expects.
 * Used by the server action that handles the form post. Returns {} when no
 * answers were submitted (defensive — caller should validate against the
 * approval's operator_questions before recording).
 *
 * Radio buttons land as `q_<id>` → string. Checkboxes (multi) land as
 * `q_<id>[]` → string[] via `getAll`. We strip the `q_` prefix on the way out
 * so the persisted shape uses the bare question id as key (matches how the
 * agent reads it on next run via `prior_response_ref`).
 */
export function parseMcqFormData(
  formData: FormData,
  questions: Approval["operator_questions"],
): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  if (!questions) return out;
  for (const q of questions) {
    if (q.multi) {
      const values = formData.getAll(`q_${q.id}[]`).map(String).filter(Boolean);
      if (values.length > 0) out[q.id] = values;
    } else {
      const value = formData.get(`q_${q.id}`);
      if (typeof value === "string" && value.length > 0) out[q.id] = value;
    }
  }
  return out;
}
