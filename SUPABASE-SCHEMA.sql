-- UAIU.LIVE/X Supabase Schema
-- Run this in your Supabase SQL Editor: https://app.supabase.com → SQL Editor → New Query → Paste → Run

-- ════════════════════════════════════════
-- TABLES
-- ════════════════════════════════════════

CREATE TABLE IF NOT EXISTS entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  contact_name text,
  email text,
  phone text,
  entity_type text,
  annual_co2_exposure text,
  status text DEFAULT 'pending_kyc',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_name text,
  name text,
  origin text,
  standard text,
  credit_type text,
  quantity_tonnes numeric,
  ask_eur_per_tonne numeric,
  price_change_pct numeric DEFAULT 0,
  status text DEFAULT 'active',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rfqs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id text,
  company text NOT NULL,
  contact_name text NOT NULL,
  email text NOT NULL,
  side text NOT NULL,
  standard text NOT NULL,
  volume_tonnes integer NOT NULL,
  target_price_eur numeric,
  origin text,
  vintage_year integer,
  deadline text,
  notes text,
  receipt_hash text,
  status text DEFAULT 'new',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS trades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id text NOT NULL,
  side text,
  standard text,
  price_eur_per_tonne numeric,
  volume_tonnes integer,
  gross_eur numeric,
  fee_eur numeric,
  net_eur numeric,
  settlement text DEFAULT 'T+1',
  receipt_hash text,
  prev_receipt_hash text,
  verify_url text,
  status text DEFAULT 'filled',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS retirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cert_id text NOT NULL,
  trade_id text,
  retired_tonnes integer,
  beneficiary text,
  compliance_period text,
  notes text,
  receipt_hash text,
  status text DEFAULT 'permanently_retired',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS listing_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_name text,
  contact_name text,
  email text,
  standard text,
  credit_type text,
  volume_tonnes numeric,
  ask_eur_per_tonne numeric,
  origin text,
  registry_ref text,
  status text DEFAULT 'pending_verification',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS index_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol text NOT NULL,
  value numeric NOT NULL,
  method text,
  source text,
  created_at timestamptz DEFAULT now()
);

-- ════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ════════════════════════════════════════

ALTER TABLE entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE rfqs ENABLE ROW LEVEL SECURITY;
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE retirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE listing_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE index_points ENABLE ROW LEVEL SECURITY;

-- Allow anon INSERT (form submissions)
CREATE POLICY "anon_insert_entities" ON entities FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_insert_rfqs" ON rfqs FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_insert_trades" ON trades FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_insert_retirements" ON retirements FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_insert_listing_submissions" ON listing_submissions FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_insert_index_points" ON index_points FOR INSERT TO anon WITH CHECK (true);

-- Allow anon SELECT on listings (so the marketplace can load real data)
CREATE POLICY "anon_select_listings" ON listings FOR SELECT TO anon USING (true);

-- ════════════════════════════════════════
-- SAMPLE LISTINGS (optional seed data)
-- ════════════════════════════════════════

-- Uncomment to seed sample listings:
-- INSERT INTO listings (project_name, origin, standard, credit_type, quantity_tonnes, ask_eur_per_tonne, price_change_pct, status)
-- VALUES
--   ('EU ETS Compliance Credits', 'Caribbean Basin · EU Registered', 'EU ETS', 'eu', 50000, 63.40, 2.3, 'active'),
--   ('SwissX B100 Biofuel Credits', 'Antigua, Caribbean · FOB Bunkering', 'VCS', 'vcs', 20000, 71.80, 4.2, 'active'),
--   ('REDD++ Forest Conservation', 'Honduras · Antigua · Verified 2024', 'Gold Std', 'redd', 35000, 58.20, 1.1, 'active'),
--   ('Blue Carbon Seagrass Fields', 'Antigua & Barbuda · 28M Acres', 'VCS', 'blue', 15000, 45.60, -0.8, 'active'),
--   ('CORSIA Aviation Offsets', 'Caribbean · ICAO Verified', 'CORSIA', 'eu', 25000, 29.70, 3.1, 'active'),
--   ('Renewable Energy Credits', 'St. Lucia · Solar & Wind', 'Gold Std', 'vcs', 10000, 22.40, 0.6, 'active');
