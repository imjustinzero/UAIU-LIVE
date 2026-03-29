-- Create all missing tables needed for the schema

CREATE TABLE IF NOT EXISTS algorithm_usage_log (
    id SERIAL PRIMARY KEY,
    algorithm_name VARCHAR(255),
    usage_count INT DEFAULT 0,
    last_used TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS anomaly_events (
    id SERIAL PRIMARY KEY,
    event_type VARCHAR(255),
    severity VARCHAR(50),
    details TEXT,
    occurred_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS api_keys (
    id SERIAL PRIMARY KEY,
    api_key VARCHAR(255) UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_chain_entries (
    id SERIAL PRIMARY KEY,
    operation VARCHAR(255),
    entity_type VARCHAR(255),
    entity_id VARCHAR(255),
    audit_hash VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_reports (
    id SERIAL PRIMARY KEY,
    report_type VARCHAR(255),
    content TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cbam_declarations (
    id SERIAL PRIMARY KEY,
    declaration_id VARCHAR(255),
    status VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS committee_members (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255),
    role VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS compliance_documents (
    id SERIAL PRIMARY KEY,
    doc_type VARCHAR(255),
    status VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS credit_registry (
    id SERIAL PRIMARY KEY,
    credit_serial VARCHAR(255),
    status VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS credit_reservations (
    id SERIAL PRIMARY KEY,
    user_id INT,
    amount INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS device_certifications (
    id SERIAL PRIMARY KEY,
    device_id VARCHAR(255),
    cert_status VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS epd_records (
    id SERIAL PRIMARY KEY,
    epd_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS exchange_rfq_matches (
    id SERIAL PRIMARY KEY,
    rfq_id INT,
    listing_id INT,
    match_score FLOAT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS exchange_settlement_runs (
    id SERIAL PRIMARY KEY,
    settlement_id VARCHAR(255),
    status VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS exchange_exception_queue (
    id SERIAL PRIMARY KEY,
    exception_type VARCHAR(255),
    status VARCHAR(50),
    details TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS firmware_versions (
    id SERIAL PRIMARY KEY,
    version VARCHAR(100),
    released_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS greenhouse_gas_protocols (
    id SERIAL PRIMARY KEY,
    protocol_name VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ho_instruments (
    id SERIAL PRIMARY KEY,
    instrument_name VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS iot_readings (
    id SERIAL PRIMARY KEY,
    device_id VARCHAR(255),
    sensor_type VARCHAR(255),
    value FLOAT,
    recorded_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS iso_certifications (
    id SERIAL PRIMARY KEY,
    cert_type VARCHAR(255),
    status VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS listing_views (
    id SERIAL PRIMARY KEY,
    listing_id INT,
    view_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS methodology_audit_links (
    id SERIAL PRIMARY KEY,
    methodology_id INT,
    audit_entry_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS mqi_snapshots (
    id SERIAL PRIMARY KEY,
    methodology_id INT,
    score FLOAT,
    snapshot_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS partner_referrals (
    id SERIAL PRIMARY KEY,
    partner_id VARCHAR(255),
    referral_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS partner_listings (
    id SERIAL PRIMARY KEY,
    partner_id VARCHAR(255),
    listing_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS partner_methodologies (
    id SERIAL PRIMARY KEY,
    partner_id VARCHAR(255),
    methodology_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS professional_profiles (
    id SERIAL PRIMARY KEY,
    user_id INT,
    title VARCHAR(255),
    bio TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sector_standards (
    id SERIAL PRIMARY KEY,
    sector VARCHAR(255),
    standard_name VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS seller_exception_queue (
    id SERIAL PRIMARY KEY,
    seller_id INT,
    exception_type VARCHAR(255),
    status VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS trade_exception_queue (
    id SERIAL PRIMARY KEY,
    trade_id INT,
    exception_type VARCHAR(255),
    status VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS uvs_certifications (
    id SERIAL PRIMARY KEY,
    certification_number VARCHAR(255),
    status VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS verified_partners (
    id SERIAL PRIMARY KEY,
    partner_name VARCHAR(255),
    country VARCHAR(100),
    status VARCHAR(50),
    total_referrals INT DEFAULT 0,
    total_revenue_generated FLOAT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Verify all tables created
SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename;
