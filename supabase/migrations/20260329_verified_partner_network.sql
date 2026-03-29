CREATE TABLE IF NOT EXISTS verified_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_name varchar NOT NULL,
  partner_type varchar NOT NULL,
  contact_name varchar,
  contact_email varchar,
  website varchar,
  country varchar,
  credentials jsonb NOT NULL DEFAULT '{}'::jsonb,
  specializations jsonb NOT NULL DEFAULT '{}'::jsonb,
  methodology_description text,
  partner_badge_level varchar NOT NULL DEFAULT 'verified',
  revenue_share_percent numeric,
  referral_fee_per_engagement numeric,
  compensation_model varchar NOT NULL DEFAULT 'revenue_share',
  total_referrals integer NOT NULL DEFAULT 0,
  total_engagements_completed integer NOT NULL DEFAULT 0,
  total_revenue_generated numeric NOT NULL DEFAULT 0,
  public_profile_url varchar,
  status varchar NOT NULL DEFAULT 'pending',
  approved_at timestamp,
  approved_by varchar,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS partner_referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES verified_partners(id),
  credit_id uuid,
  buyer_org_id uuid,
  seller_org_id uuid,
  referral_type varchar NOT NULL,
  status varchar NOT NULL DEFAULT 'referred',
  referred_at timestamp NOT NULL DEFAULT now(),
  engagement_started_at timestamp,
  engagement_completed_at timestamp,
  engagement_value numeric,
  platform_fee_earned numeric,
  audit_block_id integer
);

ALTER TABLE exchange_credit_listings ADD COLUMN IF NOT EXISTS verification_tier integer NOT NULL DEFAULT 4;
ALTER TABLE exchange_credit_listings ADD COLUMN IF NOT EXISTS human_verification_partner_id uuid;
ALTER TABLE exchange_credit_listings ADD COLUMN IF NOT EXISTS human_verification_completed_at timestamp;

INSERT INTO verified_partners (
  firm_name,
  partner_type,
  contact_name,
  contact_email,
  website,
  country,
  credentials,
  specializations,
  methodology_description,
  partner_badge_level,
  compensation_model,
  status,
  public_profile_url
)
SELECT
  'E2 Management Consulting AG',
  'verification',
  'Ananda Millard PhD',
  '',
  '',
  '',
  '{}'::jsonb,
  '{}'::jsonb,
  '',
  'featured',
  'both',
  'pending_approval',
  '/x/partners/e2-management-consulting-ag'
WHERE NOT EXISTS (
  SELECT 1 FROM verified_partners WHERE firm_name = 'E2 Management Consulting AG'
);
