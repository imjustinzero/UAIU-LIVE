# UAIU.live Technical Due-Diligence Audit (Implementation Verification)

Scope: code-level verification of routes, UI, backend behavior, schema, cron/jobs, auth/session model, env/secrets, and third-party integrations.

## Verdict
- **Overall classification:** **Prototype / partial implementation with pitchware elements**.
- Many enterprise claims exist in UI and copy, but multiple flagship flows are mock-backed, fallback-only, or missing required backend endpoints.

## Feature Claim Verification Table

| Claim | Evidence in code | Files involved | How it would be tested | Status | What is missing / broken |
|---|---|---|---|---|---|
| institutional carbon procurement platform | Exchange account creation, KYC gate, listings, spot checkout, trades API exist; but market/pricing and several advanced modules are simulated. | `server/routes.ts`, `server/storage.ts`, `shared/schema.ts`, `client/src/pages/Exchange.tsx` | Create account -> verify KYC in DB -> execute `/api/exchange/spot-checkout` with Stripe configured -> confirm trade persisted and settlement path. | **Partially implemented** | Depends on Stripe + DB + secrets; significant modules around market intelligence/order book are mock/simulated. |
| RFQ desk | API validates and stores RFQs, sends desk email. | `server/routes.ts`, `server/storage.ts`, `shared/schema.ts` | POST `/api/exchange/rfq` with required fields and auth; verify `exchange_rfqs` row and email dispatch logs. | **Verified working** | Requires session auth and email service configuration for notifications. |
| PDF audit pack generation | Server-side PDF generation for trades (`generateTradePDF`) and emails as attachment in settlement flow. | `server/pdf-generator.ts`, `server/routes.ts` | Trigger escrow settlement release path; verify PDF attachment in outbound email and content hash section in PDF. | **Partially implemented** | No robust user-facing retrieval endpoint for audit packs; delivery depends on email configuration. |
| SHA-256 tamper-evident receipt chain | Hash is computed in settlement flows; PDF includes receipt and previous hash fields. | `server/routes.ts`, `server/pdf-generator.ts`, `client/src/pages/Exchange.tsx` | Execute sequential trades; verify `receipt_hash` and `prev_receipt_hash` linkage in DB and generated artifacts. | **Partially implemented** | `prev_receipt_hash` is often empty (`''` / genesis-like behavior), weakening true chain integrity. |
| public trade verification links | UI and PDFs reference `uaiu.live/verify/<tradeId>`, but no verify route implemented. | `client/src/pages/Exchange.tsx`, `server/pdf-generator.ts`, `server/routes.ts` | Visit advertised verify URL and attempt API verification endpoint lookup. | **Claimed but not implemented** | Public verification endpoint is absent; comments indicate prior public trade record endpoint removed. |
| Stripe Connect escrow / T+1 flow | Escrow create/verify/release/cancel/status routes exist; destination charge logic present; webhook auto-capture path included. | `server/routes.ts`, `server/stripe-connect.ts`, `SUPABASE-SCHEMA.sql` | Create escrow -> verify -> release; inspect Stripe PaymentIntent + Supabase `escrow_settlements`; test webhook capture path. | **Partially implemented** | Hard dependency on Stripe secrets/webhook + Supabase table availability; mixed persistence patterns increase operational risk. |
| AI RFQ parsing | `/api/exchange/ai-rfq` exists with Anthropic + demo fallback; separate voice route calls missing endpoint (`/api/ai/parse-rfq`). | `server/routes.ts`, `client/src/components/exchange/AIFeatures.tsx`, `client/src/components/exchange/VoiceRFQ.tsx` | Call `/api/exchange/ai-rfq` and compare parsed JSON; invoke Voice RFQ parse endpoint. | **Partially implemented** | API mismatch: Voice RFQ points to non-existent backend route. |
| AI compliance co-pilot | `/api/ai/copilot` implemented with Anthropic and demo fallback message. | `server/routes.ts`, `client/src/components/exchange/ComplianceCoPilot.tsx` | POST chat messages to endpoint with/without `ANTHROPIC_API_KEY`; validate response shape and UI rendering. | **Partially implemented** | Without Anthropic key this is demo text only; no domain-grounded retrieval/guardrails. |
| AI due diligence reports | Endpoint exists and returns model output or demo report; UI also has local mock fallback. | `server/routes.ts`, `client/src/components/exchange/AIPredictionAndDD.tsx` | Submit listing payload and verify generated report object fields. | **Partially implemented** | Not linked to verified data sources/trade comps; fallback is synthetic narrative. |
| AI price prediction | Endpoint exists with cache and Anthropic path; fallback returns mock bullish prediction. | `server/routes.ts`, `client/src/components/exchange/AIPredictionAndDD.tsx` | POST current price repeatedly, inspect cache behavior and prediction output. | **Partially implemented** | No true market model/data feed; demo predictions by default without key. |
| AI trade negotiator | Endpoint returns `{action,counter_price,...}` but UI expects `{recommended_price,acceptance_probability,...}`. | `server/routes.ts`, `client/src/components/exchange/TradeFeatures.tsx` | Trigger negotiator from UI and inspect runtime behavior/console; compare payload schema with render fields. | **Broken** | Response contract mismatch likely breaks rendered fields (undefined access). |
| voice RFQ | Web Speech capture in UI works; backend endpoint called does not exist; local regex fallback parses basic text. | `client/src/components/exchange/VoiceRFQ.tsx`, `server/routes.ts` | Use browser mic; inspect network call to `/api/ai/parse-rfq` then fallback behavior. | **Partially implemented** | Missing backend route for claimed AI parse; only heuristic local fallback. |
| live video trade room | Trade-room component calls missing `/api/daily/create-room`, then fabricates Daily URL fallback. | `client/src/components/exchange/TradeFeatures.tsx`, `server/routes.ts` | Click “Request Live Trade Call”; inspect network 404 and resulting room behavior. | **Broken** | No route implementation; fallback URL may not map to real room/tokenized access. |
| real-time listing chat | Socket.IO listing chat events implemented with join/history/message/online count updates. | `server/routes.ts`, `client/src/components/exchange/ListingChat.tsx` | Open two clients on same listing and exchange messages; verify online count updates. | **Verified working** | In-memory only (history not persistent), no auth or moderation controls. |
| portfolio dashboard | Dashboard and PDF export exist in UI and compute from supplied trade arrays. | `client/src/components/exchange/InstitutionalFeatures.tsx`, `client/src/pages/Exchange.tsx` | Execute trades in session -> view dashboard metrics -> export PDF. | **Partially implemented** | Mostly client-aggregated/session-derived data; not a robust institutional portfolio backend. |
| carbon budget tracker | Component driven by `MOCK_LISTINGS` and `MOCK_TRADES`; editable state local only. | `client/src/components/exchange/CarbonBudgetTracker.tsx` | Reload app after edits and verify persistence; inspect network calls (none for budget/trades). | **Claimed but not implemented** | No backend persistence/integration; pure UI demo logic. |
| regulatory calendar | Static deadline dataset in UI; subscription endpoint writes to Supabase and emails. | `client/src/components/exchange/RegulatoryCalendar.tsx`, `server/routes.ts`, `SUPABASE-SCHEMA.sql` | Subscribe with email -> verify row in `calendar_subscriptions` and notification email path. | **Partially implemented** | Calendar content is static/hardcoded, not synced to authoritative regulatory feeds. |
| live ETS price feed | “Live prices” generated by random-walk simulation from hardcoded base constants. | `server/exchange-prices.ts`, `server/routes.ts`, `client/src/pages/Exchange.tsx` | Poll `/api/exchange/prices`; inspect deterministic synthetic drift and no external market source. | **Claimed but not implemented** | No real ETS vendor/API integration. |
| live order book | Order book levels are random generated/jittered client-side. | `client/src/components/exchange/OrderBook.tsx` | Observe order book updates over time and network calls (none). | **Claimed but not implemented** | No matching engine or server order stream. |
| seller SLA workflow | Retirement upload token flow, upload endpoint, certificate persistence, and reminder cron logic exist. | `server/routes.ts`, `shared/schema.ts`, `server/cron.ts` | Settle trade -> issue token/email -> upload certificate with token -> inspect trade status and certificate row. | **Partially implemented** | Relies on email + token handling; operational SLA enforcement/reporting is minimal. |
| multi-sig approval flow | Endpoint generates token and sends email with approval URL, but no approval state machine/verify route. | `server/routes.ts`, `client/src/components/exchange/InstitutionalFeatures.tsx` | Request approval -> follow approval URL -> attempt to finalize settlement requiring approval. | **Claimed but not implemented** | No persisted approval ledger, no `/approve/:token` handler, no trade lock enforcement. |

## Mock / Placeholder / Stub Inventory (high impact)
- Synthetic market data and history generation for prices.
- Synthetic order book generation/jitter.
- Seed/mock trade ticker.
- AI routes commonly return demo payloads without key.
- UI references to verification URLs without backing route.
- Voice RFQ backend endpoint mismatch.
- Trade-room route mismatch (`/api/daily/create-room` absent).

## Dependency and Secret Risk
- Feature-critical secrets: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_WEBHOOK_UUID`, `ANTHROPIC_API_KEY`, `DAILY_API_KEY`, DB and email credentials. Missing these degrades many features to demo/offline modes.
- Several flows depend on Supabase tables (`escrow_settlements`, `calendar_subscriptions`) not represented in Drizzle schema and instead managed externally via SQL scripts.

## Readiness Assessment
- **Production-ready?** No.
- **Prototype-only?** Mostly yes, with some real backend legs (RFQ persistence, escrow scaffolding, Socket.IO chat).
- **Mostly pitchware?** For advanced institutional/AI/live-market claims: yes.

## Scores
- **Truth score:** **3.5 / 10** (claim language overstates implementation depth)
- **Working score:** **4.5 / 10** (core subsets function; many flagship claims are partial or broken)

## Biggest Red Flags
1. Broken contract between AI trade negotiator API and UI model.
2. Missing endpoints for key promoted experiences (`/api/ai/parse-rfq`, `/api/daily/create-room`, public verify URLs).
3. “Live” market modules are simulated (prices/order book/ticker).
4. Critical enterprise controls (multi-sig, tamper-evidence verification, public auditability) are incomplete end-to-end.
5. TypeScript check currently fails in `Exchange.tsx`, indicating baseline quality gate is red.

## Fastest Path to Make False Claims True
1. Implement missing endpoints + contract tests:
   - `/api/ai/parse-rfq`
   - `/api/daily/create-room`
   - `/verify/:tradeId` public verification API/UI
   - `/approve/:token` + approval ledger and enforcement.
2. Replace synthetic market feeds/order book with real providers and server-side stream fanout.
3. Normalize data model: move Supabase raw-table dependencies into migration-controlled schema.
4. Enforce end-to-end receipt chain persistence (`prev_receipt_hash` linkage) and provide verifier tooling.
5. Fix TS compile errors and add CI gates for typecheck + integration smoke tests.
