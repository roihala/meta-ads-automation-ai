import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Shell, PageHeader } from "@/components/shell";
import { getAuth } from "@/lib/auth";
import { getDataClient } from "@/lib/db";

/**
 * Phase A of Mastery Plan v2 (2026-05-17) — /onboarding route.
 *
 * Shows the operator where they are in the post-OAuth chain:
 *   Step 1: fill the business brief        → /business-knowledge
 *   Step 2: confirm the audience brief     → /audiences
 *   Step 3: agent scanning (no operator action)
 *   Step 4: approve the first-campaign proposal → /approvals/[id]
 *   Done!  → /
 *
 * The page is intentionally minimal — each step has a single CTA pointing
 * to the right place. The MCQ block on the approval handles in-app answers
 * (Phase 0 dependency).
 */

export const dynamic = "force-dynamic";

const STEP_LABEL_HE: Record<string, string> = {
  not_started: "מתחיל...",
  brief_pending: "ממתין לבריף עסקי",
  audience_brief_pending: "ממתין לאישור בריף קהל",
  scanning: "סורק את החשבון שלך ב-Meta",
  first_proposal_pending: "מציע קמפיין ראשון",
  completed: "הושלם",
};

const STEP_NUMBER: Record<string, number> = {
  not_started: 0,
  brief_pending: 1,
  audience_brief_pending: 2,
  scanning: 3,
  first_proposal_pending: 4,
  completed: 5,
};

const TOTAL_STEPS = 4;

export default async function OnboardingPage() {
  const auth = getAuth();
  const session = await auth.getSession();
  if (!session) redirect("/login?next=/onboarding");

  const db = getDataClient();
  const business = await db.getFirstBusiness();
  if (!business) {
    return (
      <Shell active="/onboarding">
        <PageHeader title="אונבורדינג" />
        <Card>
          <CardHeader>
            <CardTitle>אין עסק מחובר</CardTitle>
            <CardDescription>
              עוד לא התחברת ל-Meta. עבור ל-/integrations ולחץ &quot;התחבר ל-Meta&quot;
              כדי להתחיל.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/integrations">
              <Button>חיבור ל-Meta</Button>
            </Link>
          </CardContent>
        </Card>
      </Shell>
    );
  }

  if (business.onboarding_status === "completed") {
    redirect("/");
  }

  const snapshot = await db.getOnboardingSnapshot(business.id);
  const currentStep = STEP_NUMBER[snapshot.status] ?? 0;
  const progressPct = Math.min(
    100,
    Math.round((currentStep / TOTAL_STEPS) * 100),
  );

  return (
    <Shell active="/onboarding">
      <PageHeader
        eyebrow="ברוכים הבאים"
        title={`קמפיינר Aiweon — אונבורדינג של ${business.name}`}
        subtitle="הסוכן ילווה אותך משלב ההתחברות ועד לקמפיין הראשון. ארבעה שלבים, כ-10 דקות."
      />

      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>
              שלב {Math.min(currentStep, TOTAL_STEPS)} מתוך {TOTAL_STEPS}
            </CardTitle>
            <CardDescription>
              <Badge className="bg-brand-500 text-white">
                {STEP_LABEL_HE[snapshot.status]}
              </Badge>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-brand-500 transition-all duration-500"
                style={{ width: `${progressPct}%` }}
                aria-hidden
              />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              התחיל ב-
              {snapshot.started_at
                ? new Date(snapshot.started_at).toLocaleString("he-IL")
                : "עוד לא"}
            </p>
          </CardContent>
        </Card>

        {snapshot.pending_approval ? (
          <Card className="border-2 border-brand-500/40 bg-brand-500/5">
            <CardHeader>
              <CardTitle>הפעולה הבאה שלך</CardTitle>
              <CardDescription>
                הסוכן הציע פעולה לשלב הזה. כאן הסבר קצר; לחץ &quot;פתח&quot; כדי לראות
                את ההצעה המלאה ולהשיב.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <p className="text-sm leading-relaxed whitespace-pre-wrap line-clamp-6">
                {snapshot.pending_approval.rationale}
              </p>
              <div>
                <Link
                  href={`/approvals/${snapshot.pending_approval.id}`}
                >
                  <Button>פתח את ההצעה</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ) : snapshot.status === "scanning" ? (
          <Card>
            <CardHeader>
              <CardTitle>הסוכן עובד עכשיו</CardTitle>
              <CardDescription>
                סורק את הגלריה, בריאות החשבון, ויישור בין הבריף לפעילות הקיימת.
                לוקח 1-3 דקות. רענן את הדף בקרוב.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>אין פעולה ממתינה כרגע</CardTitle>
              <CardDescription>
                אם זה לא משתנה בקרוב, רענן את הדף. אם זה ממשיך — צור קשר.
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">מפת הדרכים</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="flex flex-col gap-2 text-sm">
              <Step n={1} active={currentStep === 1} done={currentStep > 1}>
                מילוי בריף עסקי (שירותים, אזורים, תקציב חודשי)
              </Step>
              <Step n={2} active={currentStep === 2} done={currentStep > 2}>
                אישור בריף קהל (גיאוגרפיה + החרגות; קהלי עניין באחריותך)
              </Step>
              <Step n={3} active={currentStep === 3} done={currentStep > 3}>
                סריקה אוטומטית של חשבון Meta (גלריה, בריאות, יישור)
              </Step>
              <Step n={4} active={currentStep === 4} done={currentStep > 4}>
                אישור הקמפיין הראשון — קצב חודשי כפול 1.4 ל-7-10 ימי
                front-load
              </Step>
            </ol>
          </CardContent>
        </Card>
      </div>
    </Shell>
  );
}

function Step({
  n,
  active,
  done,
  children,
}: {
  n: number;
  active: boolean;
  done: boolean;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-3">
      <span
        className={
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold " +
          (done
            ? "bg-emerald-500 text-white"
            : active
              ? "bg-brand-500 text-white"
              : "bg-muted text-muted-foreground")
        }
        aria-hidden
      >
        {done ? "✓" : n}
      </span>
      <span
        className={
          active
            ? "font-semibold"
            : done
              ? "text-muted-foreground line-through"
              : "text-muted-foreground"
        }
      >
        {children}
      </span>
    </li>
  );
}
