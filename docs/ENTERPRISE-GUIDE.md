# UAIU.LIVE/X Enterprise Guide

## Enterprise onboarding process
1. Organization profile capture (name, industry, ticker, revenue, emissions baseline, net-zero target).
2. Compliance needs assessment (SEC, CSRD, CDP, TCFD, CORSIA, SB253/SB261).
3. Dedicated setup (account manager assignment, kickoff scheduling, API credential generation).
4. Custom carbon budget planning (recommended credit mix by type, registry, UVS grade, and geography).

## Regulatory filing automation guide
- Use `/x/compliance` to monitor deadline readiness and generate filing packages.
- Trigger filing generation from framework cards.
- Export packs for legal and board review before final submission.

## Greenwashing legal shield explained
- Register exact public claims via `POST /api/claims/register`.
- UAIU evaluates retired credits and supporting evidence.
- Verified claims receive a public certificate for downstream legal defense.

## Boardroom presentation mode guide
- Open `/x/present/:orgId` for full-screen live presentation mode.
- Navigate with arrow keys or enable 30-second auto-advance.
- Includes net-zero progress, live map pulse, compliance status, audit chain, and verification proof.

## Supply chain carbon tracking guide
- Invite suppliers with `POST /api/supplychain/invite`.
- Track member status and annual emissions in `/api/supplychain/:orgId/members`.
- Purchase bulk offsets with `/api/supplychain/:orgId/bulk-offset`.
- Use summary endpoint to pre-populate Scope 3 filing inputs.

## Carbon Passport sharing guide
- Public passport URL: `/x/passport/:retirementId`.
- API assets: JSON metadata, PNG image, and Apple Wallet payload.
- Recommended distribution: LinkedIn post, website embed, investor updates, and signature links.
