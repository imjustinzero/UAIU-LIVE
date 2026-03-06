# Staging and Release Plan

## Goal
Create a separate staging deployment with the same env shape as production.

## Required env groups
- APP_ENV=staging | production
- DATABASE_URL
- ADMIN_KEY
- STRIPE_SECRET_KEY
- STRIPE_WEBHOOK_SECRET
- STRIPE_WEBHOOK_UUID
- ANTHROPIC_API_KEY
- DAILY_API_KEY
- ZOHO_SMTP_USER / PASS

## Rules
1. Every release hits staging first.
2. Run: typecheck, build, smoke tests, webhook replay, buyer flow, seller flow.
3. Promote the same commit to production.
4. Keep a rollback commit and release note.

## Fast rollback
- redeploy previous known-good commit
- set TRADING_DISABLED=1 if needed
- replay safe webhooks after recovery
