-- 029_capi_events.sql
-- Phase C of Mastery Plan v2 (2026-05-17): CAPI-for-CRM event firing.
--
-- Aiweon's funnel is Meta Lead Ads → WhatsApp (no website Pixel). The CAPI-
-- for-CRM path lets us still close the loop: when the operator grades a
-- lead in /leads UI, we POST a server-to-server event to Meta keyed on the
-- original lead_id Meta gave us. Meta's algorithm then reweights bidding
-- toward people whose profiles match the high-grade leads.
--
-- Per research (memory: project_phase2_lead_quality_shipped + the Lead Ads
-- research subagent 2026-05-17): this is the architectural fix to the 16.4
-- trap that doesn't require any website-side change. Three event names:
--   Lead       — fired on lead-grade insert (any grade) — signals "real lead landed"
--   Qualified  — fired when grade >= 4 (high-intent)
--   Customer   — fired when converted=true is marked
--
-- This migration adds the tracking column. Phase G monthly report reads
-- capi_events_pushed to show "X of Y leads reported back to Meta this month."

BEGIN;

ALTER TABLE leads
  ADD COLUMN capi_events_pushed jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN leads.capi_events_pushed IS
  'Array of {event_name, pushed_at, http_status, fbtrace_id} for CAPI events fired back to Meta for this lead. Append-only. Populated by campaigner/tools/push_capi_events.py triggered after lead_quality_grades inserts.';

CREATE INDEX IF NOT EXISTS leads_capi_pending_idx
  ON leads (business_id, synced_at)
  WHERE jsonb_array_length(capi_events_pushed) = 0
    AND archived_at IS NULL;

COMMIT;
