# Legal/Trust Feature Readiness Audit

Date: 2026-03-06
Scope reviewed: `server/routes.ts`, `server/autonomous-marketplace.ts`, `client/src/pages/Exchange.tsx`, `client/src/pages/Legal.tsx`, `shared/schema.ts`

## Requested items and current status

1. **KYC gating on buyer accounts — legal requirement**  
   **Status: ✅ Implemented for trade execution paths.**  
   Evidence: buyer trade checkout and retirement endpoints block when `kycStatus !== 'verified'`.

2. **ToS acceptance logging — legal protection**  
   **Status: ✅ Implemented.**  
   Evidence: account terms acceptance endpoint updates terms timestamp and emits a `terms_accepted` security log event.

3. **Risk disclosure on AI outputs — liability protection**  
   **Status: ⚠️ Partially implemented.**  
   Evidence: AI due diligence UI includes a visible “NOT FINANCIAL ADVICE” disclaimer, and Legal page includes a broad risk disclosure; there is no clear server-side guard that forces disclosure on every AI endpoint response.

4. **Public trade verification page — biggest trust signal**  
   **Status: ❌ Not fully implemented.**  
   Evidence: UI claims public verification, but current lookup only checks local in-session trades; server comment says prior public trade record endpoint was removed.

5. **Seller registry ownership verification — closes the registry gap completely**  
   **Status: ⚠️ Partially implemented.**  
   Evidence: seller inventory verification records exist, but current verification status logic is heuristic (serial length + volume) and does not prove registry account ownership cryptographically or via registry API challenge.

6. **API documentation — enables more partners like Alki**  
   **Status: ❌ Not found.**  
   Evidence: no OpenAPI/Swagger/reference docs located; only health/system metadata mentions select partner/KYC endpoints.

7. **GDPR compliance — required for EU buyers**  
   **Status: ⚠️ Partially implemented (policy language only).**  
   Evidence: Legal page includes privacy rights/lawful basis language, but no explicit GDPR workflows found (DSAR endpoints, consent records, processing register, DPA tooling, region controls).

8. **Onboarding flow — converts more signups to active traders**  
   **Status: ✅ Implemented baseline flow.**  
   Evidence: account creation, sign-in, password setup, KYC launch, and terms acceptance modal gating exist in Exchange flow.

9. **Buyer watchlist and price alerts — retention**  
   **Status: ❌ Not found.**  
   Evidence: no buyer watchlist/price-alert data model or endpoints located; only unrelated budget alert visuals.

10. **Volume discount table — closes bigger deals**  
   **Status: ❌ Not found as a table/feature.**  
   Evidence: code has volume-based AI negotiation heuristics and RFQ volume bands, but no explicit volume discount table surfaced to users.

## Bottom line

This list is **not all done**. Items **1, 2, and 8** appear implemented; **3, 5, and 7** are partial; **4, 6, 9, and 10** remain open.
