# Remaining Replit / environment configuration

## 1. Backup scheduler
`scripts/postgres_backup.sh` is ready but still needs an external trigger.

Use one of:
- Replit workflow / scheduled job:
  `0 2 * * * bash scripts/postgres_backup.sh`
- cron-job.org hitting a protected admin endpoint that wraps the script

## 2. Legal page content
The templates are present, but before presenting to institutional counterparties you should fill in:
- `PRIVACY_POLICY.md`
- `RISK_DISCLOSURE.md`
- `TRADING_TERMS.md`
- `COMPANY_DETAILS.md`

## 3. Incident banner
If you want the Admin banner to reflect live platform state, wire it to:
- `PLATFORM_STATUS`
- or `/api/status/public`

## 4. No new secrets required
This pack reuses:
- `ADMIN_SECRET_KEY`
- your existing Stripe / Zoho / DB variables

## 5. Optional live payout rails
If you want real seller cash release, connect a payout provider and replace the workflow-only state transition in:
- `POST /api/exchange/payout/release/:tradeId`
