import "server-only";
import { NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { getActiveBusiness } from "@/lib/active-business";
import { getDataClient } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Global search — unified results across the project's main entities.
 * One endpoint backs the nav-level search dialog. Hebrew labels per entity
 * so the dialog can group results without re-mapping on the client.
 *
 * Scope:
 *   - all (default)        — searches every entity below
 *   - approvals|campaigns|gallery|audiences|leads|services — narrows to one
 *
 * Each result row carries: kind (entity), id, title, subtitle, href.
 * The dialog renders them as a flat list grouped by `kind`.
 */
export type SearchHit = {
  kind:
    | "approval"
    | "campaign"
    | "creative"
    | "audience"
    | "lead"
    | "service";
  id: string;
  title: string;
  subtitle: string | null;
  href: string;
};

export type SearchResponse = {
  query: string;
  total: number;
  hits: SearchHit[];
};

function norm(s: string | null | undefined): string {
  return (s ?? "").toLowerCase();
}

function matches(haystacks: Array<string | null | undefined>, q: string): boolean {
  for (const h of haystacks) {
    if (norm(h).includes(q)) return true;
  }
  return false;
}

export async function GET(req: Request) {
  const session = await getAuth().getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const raw = (url.searchParams.get("q") ?? "").trim();
  const scope = (url.searchParams.get("scope") ?? "all").toLowerCase();
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 60) || 60, 200);

  if (raw.length < 1) {
    return NextResponse.json<SearchResponse>({ query: raw, total: 0, hits: [] });
  }

  const business = await getActiveBusiness();
  if (!business) {
    return NextResponse.json<SearchResponse>({ query: raw, total: 0, hits: [] });
  }

  const q = raw.toLowerCase();
  const db = getDataClient();
  const hits: SearchHit[] = [];

  // Approvals — title is the task_type label substring, subtitle the rationale snippet.
  if (scope === "all" || scope === "approvals") {
    try {
      const approvals = await db.listPendingApprovals(business.id);
      for (const a of approvals) {
        if (
          matches([a.task_type, a.target_id, a.rationale, a.urgency], q)
        ) {
          hits.push({
            kind: "approval",
            id: a.id,
            title: approvalLabel(a.task_type),
            subtitle: truncate(a.rationale, 120),
            href: `/approvals/${a.id}`,
          });
        }
      }
    } catch {
      /* swallow — surface other entity results even if one fails */
    }
  }

  // Creatives (gallery assets) — DB-only, no live Meta lookup here.
  if (scope === "all" || scope === "gallery") {
    try {
      const assets = await db.listGalleryAssets(business.id);
      for (const a of assets) {
        if (
          matches(
            [
              a.original_filename,
              a.marketing_angle,
              a.service_tag,
              a.headline,
              a.primary_text,
              a.cta,
            ],
            q,
          )
        ) {
          hits.push({
            kind: "creative",
            id: a.id,
            title: a.headline || a.original_filename || a.id.slice(0, 8),
            subtitle:
              a.marketing_angle || a.service_tag || a.primary_text || null,
            href: `/gallery`,
          });
        }
      }
    } catch {
      /* swallow */
    }
  }

  // Audiences — read from local mirror only (the /audiences page lists these).
  if (scope === "all" || scope === "audiences") {
    try {
      const audiences = await db.listAudiences(business.id, "all");
      for (const aud of audiences) {
        if (
          matches(
            [aud.name, aud.description, aud.service_tag, aud.targeting_summary],
            q,
          )
        ) {
          hits.push({
            kind: "audience",
            id: aud.id,
            title: aud.name,
            subtitle:
              aud.targeting_summary ??
              aud.description ??
              `${aud.kind}${aud.service_tag ? ` · ${aud.service_tag}` : ""}`,
            href: `/audiences?kind=${aud.kind}`,
          });
        }
      }
    } catch {
      /* swallow */
    }
  }

  // Leads — name/email/phone/city.
  if (scope === "all" || scope === "leads") {
    try {
      const leads = await db.listLeads(business.id, "all");
      for (const l of leads) {
        if (matches([l.full_name, l.email, l.phone, l.city], q)) {
          hits.push({
            kind: "lead",
            id: l.id,
            title: l.full_name || l.email || l.phone || l.id.slice(0, 8),
            subtitle:
              [l.email, l.phone, l.city].filter(Boolean).join(" · ") || null,
            href: `/leads`,
          });
        }
      }
    } catch {
      /* swallow */
    }
  }

  // Services (products in business_knowledge) — search names + descriptions.
  if (scope === "all" || scope === "services") {
    try {
      const k = await db.getBusinessKnowledge(business.id);
      const products = k?.products ?? [];
      for (const p of products) {
        if (matches([p.name, p.description ?? null], q)) {
          hits.push({
            kind: "service",
            id: p.name,
            title: p.name,
            subtitle: p.description ?? null,
            href: `/business-knowledge#service-${encodeURIComponent(p.name)}`,
          });
        }
      }
    } catch {
      /* swallow */
    }
  }

  // Campaigns — DB-side we don't store Meta campaign names; the live data lives
  // in /campaigns which fetches from Meta on render. To keep the global search
  // self-contained we surface campaign IDs/names that show up on existing
  // approvals (target_kind='campaign'). That covers any campaign the agent has
  // touched. A "Live Meta campaigns" search would require a second round-trip
  // and is intentionally out of scope here.
  if (scope === "all" || scope === "campaigns") {
    try {
      const approvals = await db.listPendingApprovals(business.id);
      const seen = new Set<string>();
      for (const a of approvals) {
        if (a.target_kind !== "campaign" || !a.target_id) continue;
        if (seen.has(a.target_id)) continue;
        if (matches([a.target_id], q)) {
          seen.add(a.target_id);
          hits.push({
            kind: "campaign",
            id: a.target_id,
            title: `קמפיין ${a.target_id}`,
            subtitle: "מתוך הצעות ממתינות",
            href: `/campaigns#campaign-${a.target_id}`,
          });
        }
      }
    } catch {
      /* swallow */
    }
  }

  // Stable order: by kind weight (most actionable first), then by title.
  const KIND_WEIGHT: Record<SearchHit["kind"], number> = {
    approval: 0,
    campaign: 1,
    creative: 2,
    audience: 3,
    lead: 4,
    service: 5,
  };
  hits.sort((a, b) => {
    const ka = KIND_WEIGHT[a.kind];
    const kb = KIND_WEIGHT[b.kind];
    if (ka !== kb) return ka - kb;
    return a.title.localeCompare(b.title, "he");
  });

  const sliced = hits.slice(0, limit);
  return NextResponse.json<SearchResponse>({
    query: raw,
    total: hits.length,
    hits: sliced,
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
};

function approvalLabel(task_type: string): string {
  return APPROVAL_LABEL_HE[task_type] ?? task_type;
}
