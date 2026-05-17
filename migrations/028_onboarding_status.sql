-- 028_onboarding_status.sql
-- Phase A of Mastery Plan v2 (2026-05-17): Onboarding Flow F.
--
-- A business gets onboarded once after the operator completes Meta OAuth. The
-- agent then runs `onboarding_chain.sh` to: (1) propose filling the business
-- brief, (2) propose the audience brief, (3) auto-scan gallery + account
-- health + tracking + alignment, (4) propose the first complete campaign.
--
-- This migration adds two columns to track where each business is in that
-- chain. NULL onboarding_started_at = pre-v2 business (already onboarded the
-- old manual way; chain skips them).

ALTER TABLE businesses
  ADD COLUMN onboarding_status text
    NOT NULL DEFAULT 'completed'
    CHECK (onboarding_status IN (
      'not_started',           -- meta_user_id just landed; chain hasn't run
      'brief_pending',          -- agent proposed fill_business_brief; waiting on operator
      'audience_brief_pending', -- brief filled; agent proposed audience_brief
      'scanning',               -- background scan in progress (gallery + health)
      'first_proposal_pending', -- agent emitted first_campaign approval
      'completed'               -- operator approved first campaign OR opted out
    )),
  ADD COLUMN onboarding_started_at timestamptz;

-- Existing businesses default to 'completed' (they shouldn't re-trigger chain).
-- New businesses created post-migration default to 'completed' too — the OAuth
-- flow that creates them should immediately flip to 'not_started' if it's a
-- fresh Meta connection. Code-side guard: only the OAuth handler writes
-- 'not_started'; nothing else.

CREATE INDEX businesses_onboarding_pending_idx
  ON businesses (onboarding_status)
  WHERE onboarding_status != 'completed';

COMMENT ON COLUMN businesses.onboarding_status IS
  'Phase A (Mastery v2, 2026-05-17). Tracks the onboarding chain progress. Drives the new /onboarding web route + onboarding_chain.sh runner. completed = chain done OR pre-v2 business.';

COMMENT ON COLUMN businesses.onboarding_started_at IS
  'When the onboarding chain began (Meta OAuth completed for the first time). NULL = pre-v2 business that never ran the chain. Drives cold-start front-load math (first 14 days from this timestamp get the 130-150% pacing multiplier per Phase F).';
