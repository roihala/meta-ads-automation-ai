import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getActiveBusiness } from "@/lib/active-business";
import { getAuth } from "@/lib/auth";
import { getDataClient } from "@/lib/db";
import {
  listAdsWithCreativeAndCampaign,
  listAdInsights,
} from "@/lib/meta";
import { tryGetTokenForBusiness } from "@/lib/meta-tokens";
import {
  groupLiveMetaCreativesByCampaign,
  type LiveMetaCampaignGroup,
  type LiveMetaCreative,
} from "@/app/gallery/scoring";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const InputSchema = z.object({
  source_creative_id: z.string().min(1),
  source_campaign_id: z.string().min(1),
});

function buildRationale(
  source: LiveMetaCreative,
  targetNames: string[],
): string {
  const m = source.performance?.metrics;
  const headline = `המשתמש ביקש לשכפל את הקריאייטיב המוביל ל-${targetNames.length} קמפיינים פעילים אחרים.`;
  const metricsLine: string[] = [];
  if (m?.ctr != null) metricsLine.push(`CTR ${m.ctr.toFixed(2)}%`);
  if (m?.hook_rate != null) metricsLine.push(`Hook ${m.hook_rate.toFixed(0)}%`);
  if (m?.spend != null && m.spend > 0)
    metricsLine.push(`הוצאה ₪${m.spend.toFixed(0)}`);
  const metrics = metricsLine.length > 0 ? `מטריקות: ${metricsLine.join(" · ")}.` : "";
  const targets = `יעד: ${targetNames.map((n) => `"${n}"`).join(", ")}.`;
  return [headline, metrics, targets].filter(Boolean).join("\n");
}

function findSource(
  groups: LiveMetaCampaignGroup[],
  campaignId: string,
  creativeId: string,
): LiveMetaCreative | null {
  for (const g of groups) {
    if (g.id !== campaignId) continue;
    return g.creatives.find((c) => c.creative_id === creativeId) ?? null;
  }
  return null;
}

export async function POST(req: NextRequest) {
  const session = await getAuth().getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = InputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const db = getDataClient();
  const business = await getActiveBusiness();
  if (!business) {
    return NextResponse.json({ error: "business_not_found" }, { status: 404 });
  }

  const resolved = await tryGetTokenForBusiness(db, business);
  const userToken = resolved?.token ?? null;
  if (!userToken || !business.meta_ad_account_id) {
    return NextResponse.json(
      { error: "meta_connection_required" },
      { status: 409 },
    );
  }

  // Re-fetch live ads + insights so target list is current — operator may
  // have paused a campaign since the hero loaded.
  let groups: LiveMetaCampaignGroup[];
  try {
    const [ads, insights] = await Promise.all([
      listAdsWithCreativeAndCampaign(userToken, business.meta_ad_account_id),
      listAdInsights(userToken, business.meta_ad_account_id),
    ]);
    const usage: Record<string, typeof ads> = {};
    for (const ad of ads) {
      if (!ad.creative_id) continue;
      (usage[ad.creative_id] = usage[ad.creative_id] ?? []).push(ad);
    }
    groups = groupLiveMetaCreativesByCampaign(usage, [], insights, {});
  } catch (e) {
    const msg = e instanceof Error ? e.message : "meta_lookup_failed";
    return NextResponse.json({ error: "meta_lookup_failed", detail: msg }, { status: 502 });
  }

  const source = findSource(groups, parsed.data.source_campaign_id, parsed.data.source_creative_id);
  if (!source) {
    return NextResponse.json(
      { error: "source_creative_not_live", detail: "המקור לא חי יותר ב-Meta — רענן את הדף" },
      { status: 409 },
    );
  }

  const targets = groups
    .filter((g) => g.id !== parsed.data.source_campaign_id)
    .map((g) => ({ id: g.id, name: g.name }));

  if (targets.length === 0) {
    return NextResponse.json({ error: "no_target_campaigns" }, { status: 409 });
  }

  const m = source.performance?.metrics ?? {
    ctr: null,
    hook_rate: null,
    spend: null,
    impressions: null,
  };
  const rationale = buildRationale(source, targets.map((t) => t.name));

  try {
    const rows = await db.createMetaCreativeDuplicateApprovals({
      business_id: business.id,
      source_meta_creative_id: source.creative_id,
      source_campaign_id: source.campaign_id,
      source_campaign_name: source.campaign_name,
      source_metrics: {
        ctr: m.ctr,
        hook_rate: m.hook_rate,
        spend: m.spend,
        impressions: m.impressions,
      },
      target_campaigns: targets,
      rationale,
      created_by_run_id: randomUUID(),
    });
    return NextResponse.json({ approvals: rows, count: rows.length }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "create_failed";
    return NextResponse.json({ error: "create_failed", detail: msg }, { status: 500 });
  }
}
