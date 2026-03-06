# UAIU.LIVE/X — Backup & Disaster Recovery Policy

**Version**: 2.0  
**Owner**: Platform Operations  
**Last Reviewed**: 2026-03-06  
**Classification**: Internal / Institutional

---

## 1. Overview

This document defines the backup strategy, disaster recovery procedures, and operational
responsibilities for the UAIU.LIVE/X carbon credit exchange platform.

| Item | Value |
|------|-------|
| Database | PostgreSQL (Neon/Replit-managed) |
| Backup format | Plain SQL (`pg_dump`) |
| Primary storage | S3-compatible object storage (AWS S3 / Cloudflare R2 / Backblaze B2 / MinIO) |
| Secondary storage | Local `/tmp/uaiu_backups` (ephemeral — survives restarts, not redeploys) |
| Backup owner | Platform operator (technical) |
| Recovery owner | Platform operator (technical) |

---

## 2. Backup Policy

### Frequency
| Type | Schedule | Trigger |
|------|----------|---------|
| Scheduled | Daily — 5 minutes after service start, then every 24 hours | Automatic (cron) |
| On-demand | Any time | Admin panel → Backup & DR → Trigger Backup |

### Retention
| Storage tier | Retention |
|---|---|
| S3 / remote | 30 most recent backups (older backups auto-deleted on each run) |
| Local `/tmp` | 7 most recent backups (pruned on each run) |

### Backup Contents
Each backup captures a complete `pg_dump` of the production database including:
- All user, match, credit, social, and session data
- Exchange accounts, listings, trades, settlement runs
- Seller profiles, Connect accounts, payout records
- Autonomous marketplace tables
- Backup log metadata itself

### Metadata Captured Per Backup
Every backup writes a row to the `backup_logs` table containing:
- `filename` — e.g. `uaiu_2026-03-06_08-00-00.sql`
- `file_size_bytes` — exact byte count
- `checksum_sha256` — SHA-256 hash of the dump file
- `storage_path` — full S3 key or local path
- `storage_provider` — `s3` or `local`
- `upload_status` — `uploaded`, `local_only`, `upload_failed`
- `backup_type` — `scheduled` or `manual`
- `triggered_by` — `cron` or `admin`
- `created_at` — UTC timestamp

---

## 3. Recovery Point Objective (RPO)

**RPO: 24 hours**

In a worst-case scenario where the last backup was taken immediately before the
incident, data loss is bounded to the 24-hour window since the previous backup.
On-demand backups triggered before planned operations reduce this to near-zero.

---

## 4. Recovery Time Objective (RTO)

**RTO: 4 hours**

Target time from incident declaration to full trading resumption:

| Phase | Target Time |
|---|---|
| Incident declared and trading disabled | 15 minutes |
| Backup located and downloaded | 30 minutes |
| Database restored and verified | 60 minutes |
| Schema alignment confirmed (db:push) | 15 minutes |
| Smoke testing (auth, trade, webhook) | 30 minutes |
| Trading re-enabled and monitoring active | 30 minutes |
| **Total** | **~4 hours** |

---

## 5. Restore Procedure

### Prerequisites
- Access to production environment variables (`DATABASE_URL`, S3 credentials)
- `psql` installed locally
- `aws` CLI or equivalent S3 client (e.g. `rclone`, `s3cmd`)

### Step 1 — Locate the Latest Good Backup

Via Admin panel (recommended):
```
Admin > Backup & DR > Review backup list > copy storage_path of latest uploaded backup
```

Via direct DB query:
```sql
SELECT id, filename, file_size_bytes, upload_status, storage_path, created_at
FROM backup_logs
WHERE upload_status = 'uploaded'
ORDER BY created_at DESC
LIMIT 5;
```

### Step 2 — Download the Backup from S3

Using AWS CLI:
```bash
aws s3 cp s3://<S3_BACKUP_BUCKET>/uaiu-backups/<filename>.sql ./restore_target.sql \
  --region <AWS_REGION>
```

Using Cloudflare R2 (with custom endpoint):
```bash
aws s3 cp s3://<S3_BACKUP_BUCKET>/uaiu-backups/<filename>.sql ./restore_target.sql \
  --endpoint-url https://<ACCOUNT_ID>.r2.cloudflarestorage.com
```

### Step 3 — Verify Checksum Before Restoring

```bash
sha256sum restore_target.sql
```

Compare the output hash against the `checksum_sha256` value in the `backup_logs` table.
**Do not proceed if they do not match.**

### Step 4 — Stop Trading

Via admin API:
```bash
curl -X POST https://your-domain/api/admin/ops/maintenance-mode \
  -H "X-Admin-Key: <ADMIN_SECRET_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"enabled": true}'
```

Or set the environment variable directly: `TRADING_DISABLED=1`

### Step 5 — Restore the Database

**Option A: Restore into existing database (replaces all data)**
```bash
# DESTRUCTIVE — drops all existing data
psql "$DATABASE_URL" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
psql "$DATABASE_URL" < restore_target.sql
```

**Option B: Restore into a clean database**
```bash
# Point DATABASE_URL at a new empty database, then:
psql "$DATABASE_URL" < restore_target.sql
```

### Step 6 — Align Schema

```bash
npm run db:push
```

This applies any schema changes made after the backup point without data loss.

### Step 7 — Smoke Test

```bash
# Auth
curl -X POST https://your-domain/api/exchange/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"<test_email>","password":"<test_password>"}'

# Public status
curl https://your-domain/api/status/public

# Admin health
curl https://your-domain/api/admin/ops/overview \
  -H "X-Admin-Key: <ADMIN_SECRET_KEY>"

# Backup list
curl https://your-domain/api/admin/backup/list \
  -H "X-Admin-Key: <ADMIN_SECRET_KEY>"
```

### Step 8 — Re-enable Trading

```bash
curl -X POST https://your-domain/api/admin/ops/maintenance-mode \
  -H "X-Admin-Key: <ADMIN_SECRET_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"enabled": false}'
```

Monitor logs for 15 minutes post-restoration before declaring recovery complete.

---

## 6. Restore Owner

| Role | Responsibility |
|---|---|
| Platform Operator | Primary restorer. Executes all steps. |
| Technical Lead (if applicable) | Validates restore decision and post-restore verification |
| Business Owner | Notified of incident, approves trading re-enablement |

---

## 7. Verification Cadence

| Activity | Frequency | Owner |
|---|---|---|
| Integrity check (Admin backup/verify) | Weekly | Platform Operator |
| Full restore test (Section 9 checklist) | Monthly | Platform Operator |
| DR policy review | Quarterly | Platform Operator |
| S3 bucket access + credentials test | Monthly | Platform Operator |

---

## 8. Environment Variables Required

The following must be set to enable S3-backed off-site backups.
Without them, the system falls back to local `/tmp` only and logs a warning.

| Variable | Required | Description |
|---|---|---|
| `S3_BACKUP_BUCKET` | **Yes (for S3)** | Bucket name, e.g. `uaiu-backups-prod` |
| `AWS_ACCESS_KEY_ID` | **Yes (for S3)** | Key with `s3:PutObject`, `s3:GetObject`, `s3:ListBucket`, `s3:DeleteObject` |
| `AWS_SECRET_ACCESS_KEY` | **Yes (for S3)** | Corresponding secret key |
| `AWS_REGION` | Optional | Region, default `us-east-1` |
| `S3_BACKUP_ENDPOINT` | Optional | Custom endpoint for R2/B2/MinIO |
| `DATABASE_URL` | Always | PostgreSQL connection string |

### Provider Quick-Start

**AWS S3**
```
S3_BACKUP_BUCKET=uaiu-backups-prod
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
```

**Cloudflare R2** (zero egress fees — recommended)
```
S3_BACKUP_BUCKET=uaiu-backups
AWS_ACCESS_KEY_ID=<R2 access key id>
AWS_SECRET_ACCESS_KEY=<R2 secret>
S3_BACKUP_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
AWS_REGION=auto
```

**Backblaze B2**
```
S3_BACKUP_BUCKET=uaiu-backups
AWS_ACCESS_KEY_ID=<B2 key id>
AWS_SECRET_ACCESS_KEY=<B2 application key>
S3_BACKUP_ENDPOINT=https://s3.us-west-004.backblazeb2.com
AWS_REGION=us-west-004
```

---

## 9. Restore-Test Checklist

Use this checklist to prove backups are usable. Complete monthly and record results in Section 10.

```
UAIU.LIVE/X Restore Test
Date: ____________  Tester: ____________  Environment: staging / isolated test DB

PREPARATION
[ ] Team notified that restore test is in progress
[ ] Target database identified and isolated from production

BACKUP TRIGGER
[ ] Triggered manual backup via Admin -> Backup & DR -> Trigger Backup
[ ] Backup appears in list with upload_status = 'uploaded'
[ ] Clicked Verify — confirmed verify_status = 'ok'
[ ] Backup filename: _______________________________________________
[ ] Checksum (first 16 chars): ____________________________________

DOWNLOAD & INTEGRITY
[ ] Downloaded .sql file from S3 to local machine
[ ] Ran sha256sum — hash matches backup_logs.checksum_sha256:  YES / NO
[ ] File size matches file_size_bytes in backup_logs:  YES / NO

RESTORE
[ ] Restored .sql into isolated test Postgres instance (no production data touched)
[ ] Ran npm run db:push against test DB — no errors

DATA VERIFICATION
[ ] Table list matches production schema:  YES / NO
[ ] SELECT COUNT(*) FROM users — count: ______
[ ] SELECT COUNT(*) FROM exchange_accounts — count: ______
[ ] SELECT COUNT(*) FROM exchange_trades — count: ______
[ ] SELECT COUNT(*) FROM seller_payouts — count: ______
[ ] SELECT COUNT(*) FROM backup_logs — count: ______
[ ] Latest trade timestamp is plausible:  YES / NO

SMOKE TEST
[ ] Auth endpoint responds with valid token
[ ] /api/status/public returns { "status": "operational" }
[ ] Admin /api/admin/ops/overview returns valid data
[ ] Admin /api/admin/backup/list returns backup rows

RESULT:  PASS / FAIL
NOTES: ___________________________________________________________
```

---

## 10. Runbook Test Log

Record completed restore tests here:

| Date | Tester | Backup Filename | Result | Notes |
|------|--------|----------------|--------|-------|
| — | — | — | — | Initial deployment — no test completed yet |

---

## 11. Incident Classification

| Severity | Trigger | Response |
|---|---|---|
| **P0 — Data loss** | Table missing, corrupt rows, failed transactions | Disable trading immediately. Restore from last verified backup. |
| **P1 — Service down** | App crash, DB unreachable | Redeploy first. Restore if redeployment fails. |
| **P2 — Degraded** | Slow queries, partial feature failure | No restore. Roll back last code deploy. |
| **P3 — Backup failure** | `upload_status = 'upload_failed'` | Investigate S3 credentials. Trigger manual backup. |

For P0 and P1: disable trading via maintenance mode **before** taking any action.

---

## 12. Related Documents

- `docs/STAGING_AND_RELEASE.md` — Release and deployment process
- `docs/MONITORING_ALERTS.md` — Alerting and uptime monitoring setup
- `docs/TRUST_LAYER.md` — Security and trust overview
- `docs/VENDOR_QUESTIONNAIRE.md` — Institutional vendor security questionnaire
- `server/backup-storage.ts` — S3 backup implementation
- `server/cron.ts` — Backup scheduler
