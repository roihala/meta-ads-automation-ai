import "server-only";
import { NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { getActiveBusiness } from "@/lib/active-business";
import { getDataClient } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Notifications feed — one unified payload for the nav bell.
 *
 * "מסונכרן לכל הפרוייקט" — we surface anything operator-actionable that
 * happened across the project: pending approvals (split by urgency),
 * the latest flow heartbeat (so an erroring runner is visible without
 * opening /history), and an "ungraded leads" counter that nudges the
 * operator back to /leads when fresh leads arrive.
 *
 * The bell shows a dot when `unread_count > 0`. Click → popover lists the items
 * inline; each carries an href that lands on the right page.
 */
export type NotificationKind =
  | "approval_urgent"
  | "approval_pending"
  | "flow_error"
  | "lead_ungraded";

export type NotificationItem = {
  id: string;
  kind: NotificationKind;
  title: string;
  subtitle: string | null;
  href: string;
  /** ISO 8601 — the moment this event occurred (created_at / ran_at). */
  at: string;
};

export type NotificationsResponse = {
  unread_count: number;
  items: NotificationItem[];
  /** Aggregate counts the bell uses for the dot color + badge. */
  summary: {
    pending_total: number;
    pending_urgent: number;
    flow_errors_24h: number;
    ungraded_leads: number;
  };
};

export async function GET() {
  const session = await getAuth().getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const business = await getActiveBusiness();
  if (!business) {
    return NextResponse.json<NotificationsResponse>({
      unread_count: 0,
      items: [],
      summary: {
        pending_total: 0,
        pending_urgent: 0,
        flow_errors_24h: 0,
        ungraded_leads: 0,
      },
    });
  }

  const db = getDataClient();

  // Parallelize the three reads — none depends on another.
  const [pending, heartbeats, leads] = await Promise.all([
    db.listPendingApprovals(business.id).catch(() => []),
    db.getLatestHeartbeats(business.id).catch(() => []),
    db.listLeads(business.id, "ungraded").catch(() => []),
  ]);

  const items: NotificationItem[] = [];

  // 1. Urgent + high pending approvals — surface the latest 4. Older urgent
  //    rows would clutter the popover; the count line tells the operator how
  //    many remain.
  const urgentRows = pending
    .filter((a) => a.urgency === "urgent" || a.urgency === "high")
    .sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  for (const a of urgentRows.slice(0, 4)) {
    items.push({
      id: `approval:${a.id}`,
      kind: a.urgency === "urgent" ? "approval_urgent" : "approval_pending",
      title: approvalLabel(a.task_type),
      subtitle: truncate(a.rationale, 100),
      href: `/approvals/${a.id}`,
      at: a.created_at,
    });
  }

  // 2. Most recent flow error in the last 24h — one row, not the full history.
  const dayAgo = Date.now() - 24 * 3600 * 1000;
  const errors = heartbeats.filter(
    (h) => h.phase === "error" && new Date(h.ran_at).getTime() >= dayAgo,
  );
  const errors24h = errors.length;
  if (errors.length > 0) {
    const top = errors[0];
    items.push({
      id: `hb:${top.id}`,
      kind: "flow_error",
      title: `שגיאה ב-${top.flow}`,
      subtitle: top.error_message ?? "ראה היסטוריה לפרטים מלאים",
      href: `/history`,
      at: top.ran_at,
    });
  }

  // 3. Ungraded leads — single aggregate item, no row per lead.
  if (leads.length > 0) {
    items.push({
      id: `leads:ungraded`,
      kind: "lead_ungraded",
      title: `${leads.length} לידים ממתינים לדירוג`,
      subtitle: "דרג כדי שהסוכן ידע אילו קמפיינים מביאים לקוחות איכותיים",
      href: `/leads?filter=ungraded`,
      at: leads[0]?.synced_at ?? new Date().toISOString(),
    });
  }

  // Newest first.
  items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  const pendingUrgent = pending.filter((a) => a.urgency === "urgent").length;

  // unread_count drives the bell — when this is 0 the dot is hidden. We count
  // pending approvals + errors + ungraded-leads as a single "open items" tally.
  const unreadCount =
    pending.length + errors24h + (leads.length > 0 ? 1 : 0);

  return NextResponse.json<NotificationsResponse>({
    unread_count: unreadCount,
    items,
    summary: {
      pending_total: pending.length,
      pending_urgent: pendingUrgent,
      flow_errors_24h: errors24h,
      ungraded_leads: leads.length,
    },
  });
}

function truncate(s: string | null | undefined, n: number): string | null {
  if (!s) return null;
  const t = s.trim();
  if (t.length <= n) return t;
  return t.slice(0, n - 1) + "…";
}

const APPROVAL_LABEL_HE: Record<string, string> = {
  scale_up: "הגדל תקציב",
  scale_down: "צמצם תקציב",
  pause_ad: "השהה מודעה",
  pause_campaign: "השהה קמפיין",
  new_creative: "קריאייטיב חדש",
  redeploy_creative: "מחזור קריאייטיב",
  boost_post: "קמפיין מפוסט קיים",
  new_campaign: "קמפיין חדש",
  publish_facebook_feed: "פרסום פוסט בפייסבוק",
  publish_instagram_feed: "פרסום בפיד אינסטגרם",
  publish_instagram_story: "פרסום סטורי",
  publish_instagram_reel: "פרסום ריל",
  set_kpi_target: "עדכן יעד KPI",
  alert: "התראה",
  ab_test_setup: "הקמת A/B test",
  ab_test_decide: "החלטה על A/B test",
  verify_pixel_capi: "אימות Pixel/CAPI",
};

function approvalLabel(task_type: string): string {
  return APPROVAL_LABEL_HE[task_type] ?? task_type;
}
