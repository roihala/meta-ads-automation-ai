-- scripts/backfill_aiweon_brand_fields.sql
-- One-off operator-driven backfill of brand fields on Aiweon's business_knowledge row.
-- Run AFTER migration 034 is applied.
--
-- Usage (from repo root):
--   docker compose exec postgres psql -U campaigner -d campaigner \
--     -f /scripts/backfill_aiweon_brand_fields.sql
--
-- Fill in the three values below before running. Flow I (daily Clara generation)
-- refuses to invoke Clara until business_name AND default_cta_url are populated.
-- The guardrail business_knowledge_brand_fields_required enforces this.
-- logo_url is optional (NULL = no logo overlay in generated videos).

\set ON_ERROR_STOP on

BEGIN;

WITH aiweon AS (
  SELECT id AS business_id
  FROM businesses
  WHERE name = 'Aiweon'
  LIMIT 1
)
UPDATE business_knowledge bk
SET
  business_name   = 'Aiweon',                            -- TODO: confirm display name
  logo_url        = NULL,                                -- TODO: paste logo URL or leave NULL
  default_cta_url = 'https://aiweon.example/'            -- TODO: paste actual landing URL
FROM aiweon
WHERE bk.business_id = aiweon.business_id;

-- Verify the row landed:
SELECT
  bk.business_id,
  b.name AS business,
  bk.business_name,
  bk.logo_url,
  bk.default_cta_url
FROM business_knowledge bk
JOIN businesses b ON b.id = bk.business_id
WHERE b.name = 'Aiweon';

COMMIT;
