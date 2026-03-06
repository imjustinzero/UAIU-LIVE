# Release Plan

## Goal
Gate every production release through a pre-flight checklist before enabling live trading. Single deployment — no second environment needed.

## Release process

1. Merge changes to main.
2. Run pre-flight checks:
   - `npx tsc --noEmit` — zero errors required
   - `npm run build` — clean build required
   - Smoke test: signin, spot-checkout (KYC gate), retire (ownership check), admin gate
   - Webhook replay test against Stripe test account
3. If any check fails, set `TRADING_DISABLED=1` via the Admin ops maintenance-mode toggle to block new trades while fixing.
4. Once all checks pass, redeploy and set `TRADING_DISABLED=0`.

## Fast rollback
- Toggle `TRADING_DISABLED=1` via `POST /api/admin/ops/maintenance-mode` — immediately blocks new trades without a redeploy.
- Redeploy the last known-good commit from Replit deployment history.
- Validate auth, checkout, webhook, admin, and retire paths before re-enabling.

## Webhook replay
- Identify failed event IDs in the Admin webhook dead-letter queue.
- Replay via Stripe Dashboard or Stripe CLI.
- `onConflictDoNothing` constraints prevent duplicate trade rows on replay.

## Environment variables (all in Replit Secrets)
```
ADMIN_SECRET_KEY=
DATABASE_URL=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_WEBHOOK_UUID=
ANTHROPIC_API_KEY=
DAILY_API_KEY=
ZOHO_SMTP_USER=
ZOHO_SMTP_PASS=
TRADING_DISABLED=0
```
