# UAIU.LIVE/X Production Runbook

## Deployment checklist
1. Build artifact: `npm run build`.
2. Confirm required env vars are set from `.env.example`.
3. Run schema sync/migrations against production database.
4. Deploy server and verify `/health` + `/health/detailed`.
5. Confirm `/metrics` is scraping from Prometheus.

## Environment variable checklist
- Core: `DATABASE_URL`, `NODE_ENV`, `ALLOWED_ORIGINS`
- Hash agility: `HASH_ALGORITHM`, `APPROVED_ALGORITHMS`, `ESCROW_FINALITY_HOURS`
- IoT/MQTT: `MQTT_BROKER_URL`, `MQTT_USERNAME`, `MQTT_PASSWORD`, `MQTT_PORT`
- Alerting: `ALERT_WEBHOOK_URL`, `SLACK_WEBHOOK_URL`
- Notifications: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`
- Ops: `REDIS_URL`, `LOG_LEVEL`, `SENTRY_DSN`

## Database migration steps
1. Backup production DB.
2. Run: `npm run db:push -- --force`.
3. Validate expected tables and constraints.
4. Smoke-test critical routes (audit, escrow, market, IoT).

## Health verification
- `GET /health` returns `status`, `version`, `uptime`.
- `GET /health/detailed` confirms DB, audit chain, MQTT, escrow, UVS, and anomaly status.
- `GET /metrics` exposes Prometheus metrics endpoint.

## Alert response procedures
- **Critical**: acknowledge in <5 minutes, initiate incident bridge.
- **High**: investigate within 15 minutes.
- **Medium**: investigate within 1 hour.
- Log all remediation actions in the audit system.

## Incident severity levels
- **SEV-1**: platform down, settlement integrity risk, chain integrity failure.
- **SEV-2**: degraded core function (escrow delays, major API degradation).
- **SEV-3**: non-blocking issues (single integration or non-critical dashboard).

## Rollback procedure
1. Stop traffic or enable maintenance mode.
2. Roll back application artifact to prior stable release.
3. Restore DB from backup if schema/data corruption is detected.
4. Re-run smoke tests and reopen traffic.
