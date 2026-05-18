"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Triggers the weekly_creative_firehose runner on demand. The runner queues
 * 3-5 new creative proposals into the approvals table — the operator then
 * approves/rejects them in /approvals like any other agent decision. Nothing
 * publishes until approval, per HITL invariant.
 */
export function GenerateWithAgentButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [state, setState] = useState<"idle" | "sent" | "error">("idle");
  const [err, setErr] = useState<string | null>(null);

  function onClick() {
    setErr(null);
    setState("idle");
    start(async () => {
      const res = await fetch("/api/runners/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flow: "weekly_creative_firehose" }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }));
        setErr(body.error ?? `HTTP ${res.status}`);
        setState("error");
        return;
      }
      setState("sent");
      setTimeout(() => {
        router.refresh();
        setState("idle");
      }, 5000);
    });
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={onClick}
      disabled={pending}
      title={
        err ??
        "מפעיל את הסוכן להציע 3-5 קריאייטיבים חדשים לאישור — לוקח כדקה עד שההצעות מופיעות ב-/approvals"
      }
      className="gap-1.5"
    >
      <Sparkles className="h-4 w-4" />
      {pending
        ? "מפעיל..."
        : state === "sent"
          ? "נשלח לסוכן ✓"
          : state === "error"
            ? "שגיאה"
            : "ייצר עם הסוכן"}
    </Button>
  );
}
