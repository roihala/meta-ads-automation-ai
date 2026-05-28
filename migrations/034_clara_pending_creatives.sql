-- 034_clara_pending_creatives.sql
-- Clara video flow (docs/plans/clara-video-flow.md §3). Adds:
--   1. lifecycle status to creative_gallery + backfill for existing rows
--   2. pending-brief fields (hebrew_brief, source_asset_ids, expires_at)
--   3. widen generated_by CHECK to include 'clara'
--   4. indexes for the pending FIFO and status views
--   5. business_knowledge brand fields (business_name, logo_url, default_cta_url)
--      auto-injected by Flow I into Clara prompts.
--
-- Invariants enforced at the tool layer (not in SQL):
--   - status='pending' rows MUST have hebrew_brief AND source_asset_ids populated.
--   - status='generated' rows MUST have storage_url populated.
--   - A row never transitions backwards ('generated' -> 'pending' is illegal).

BEGIN;

-- 1. Lifecycle status. Default 'active' for the column; existing rows then
--    get re-classified by their actual state in the UPDATE below.
ALTER TABLE creative_gallery
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('pending','generated','active','archived','expired'));

UPDATE creative_gallery
SET status = CASE
  WHEN deleted_at IS NOT NULL THEN 'archived'
  WHEN meta_creative_id IS NOT NULL THEN 'active'
  ELSE 'generated'  -- generated locally (Imagen / manual_upload) but never uploaded to Meta
END;

COMMENT ON COLUMN creative_gallery.status IS
  'Lifecycle: pending (brief written, not generated) -> generated (asset exists, not uploaded) -> active (uploaded as Meta creative) -> archived (soft-deleted) or expired (pending brief auto-expired after 7d).';

-- 2. Pending-brief fields. All nullable; required only when status='pending'.
ALTER TABLE creative_gallery
  ADD COLUMN IF NOT EXISTS hebrew_brief text,
  ADD COLUMN IF NOT EXISTS source_asset_ids uuid[],
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

COMMENT ON COLUMN creative_gallery.hebrew_brief IS
  'Free Hebrew atmosphere prompt the agent wrote on Mon Flow C, sent verbatim to Clara on the daily Flow I run. NULL on non-pending rows.';
COMMENT ON COLUMN creative_gallery.source_asset_ids IS
  '2-3 creative_gallery row IDs the agent picked as Clara source material. Image rows used as-is; video rows have a frame extracted via ffmpeg.';
COMMENT ON COLUMN creative_gallery.expires_at IS
  'When a pending brief auto-expires if not consumed. Set to created_at + 7 days by propose_pending_creative. NULL on non-pending rows.';

-- 3. Widen generated_by CHECK to include 'clara'.
ALTER TABLE creative_gallery
  DROP CONSTRAINT IF EXISTS creative_gallery_generated_by_check;

ALTER TABLE creative_gallery
  ADD CONSTRAINT creative_gallery_generated_by_check
  CHECK (
    generated_by = ANY (
      ARRAY['imagen', 'gemini', 'manual_upload', 'meta_backfill', 'clara']
    )
  );

-- 4. Indexes for the two main queues.
--    - Pending FIFO: daily Flow I pulls oldest pending rows per business.
--    - Status view: library UI tabs (ממתינות / שנוצרו / פעילים / ארכיון).
CREATE INDEX IF NOT EXISTS creative_gallery_pending_fifo_idx
  ON creative_gallery (business_id, created_at ASC)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS creative_gallery_status_idx
  ON creative_gallery (business_id, status)
  WHERE deleted_at IS NULL;

-- 5. business_knowledge brand fields. Auto-injected into Clara prompts and
--    used as the destination URL for the generated ad. Guardrail
--    business_knowledge_brand_fields_required (added in a follow-up commit)
--    blocks Flow I when business_name OR default_cta_url is null.
ALTER TABLE business_knowledge
  ADD COLUMN IF NOT EXISTS business_name text,
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS default_cta_url text;

COMMENT ON COLUMN business_knowledge.business_name IS
  'Display name auto-injected into Clara video-generation prompts. Falls back to businesses.name when null.';
COMMENT ON COLUMN business_knowledge.logo_url IS
  'Brand logo asset URL. Used by Clara as a brand element in generated videos. NULL = no logo overlay.';
COMMENT ON COLUMN business_knowledge.default_cta_url IS
  'Landing URL bound to Flow I-generated video ads unless overridden per campaign. Required for Flow I to proceed.';

COMMIT;
