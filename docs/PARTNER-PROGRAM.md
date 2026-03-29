# UAIU Verified Partner Program

## What it is
UAIU Verified Partners are independent firms that provide human verification services outside of the core platform. UAIU handles discovery, referrals, and status signaling; partners handle verification execution.

## Partner types
- verification
- validation
- lca
- epd
- methodology
- advisory
- govcon

## Badge levels
- Featured
- Verified
- Certified

## How referrals work
1. A buyer or seller requests partner support.
2. UAIU creates a `partner_referrals` record.
3. The partner is notified and engagement begins.
4. On completion, listing status/tier can be upgraded.

## Compensation models
- `revenue_share`: platform % of engagement value
- `referral_fee`: fixed fee per engagement
- `both`: share + fixed fee

## How to apply
Use `POST /api/partners/register` with firm metadata, credentials, and specializations.

## What buyers see
Buyers can browse `/x/partners`, review partner public profiles, and request verification directly from listing CTAs.
