# Backup and Rollback Runbook

## Daily backup
- Full PostgreSQL dump daily
- Retain 14 rolling backups
- Verify restore weekly into staging

## Rollback plan
1. Disable trading fast:
   - set `TRADING_DISABLED=1`
2. Redeploy last known-good commit
3. Validate auth, checkout, webhook, admin, retire paths
4. Re-enable trading

## Webhook replay
- identify failed event IDs
- replay via Stripe CLI or dashboard
- confirm onConflictDoNothing protections
- verify no duplicate trade rows
