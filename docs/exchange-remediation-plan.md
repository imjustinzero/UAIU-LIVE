# Exchange Reliability & Onboarding Remediation Plan

This plan is split into **2 delivery phases** so the team can restore core onboarding functionality first, then harden and polish the platform.

---

## Phase 1 — Restore Core Onboarding & Account Access (Critical + Highest-Risk Gaps)

**Goal:** Ensure a brand-new exchange user can register, accept terms, set credentials, complete KYC, and sign in again reliably.

### 1) Fix KYC default state root cause (Critical #1)

**Problem:** New exchange accounts are created with `kyc_status='pending'` instead of `not_started`, which suppresses the “Verify Identity” action in UI.

**Implementation plan**
1. Add DB migration to change default `exchange_accounts.kyc_status` to `not_started`.
2. Backfill existing rows where `kyc_status='pending'` and no KYC session exists yet (or no verification started timestamp) to `not_started`.
3. Add server-side account creation guard to always set explicit `not_started` if omitted.
4. Update UI state mapping so only `verified` and true in-progress states hide the start button.

**Acceptance criteria**
- New exchange accounts persist with `kyc_status='not_started'`.
- Existing affected users now see “Verify Identity” CTA.
- Regression test proves account creation default is `not_started`.

### 2) Enforce password setup during onboarding (Critical #2)

**Problem:** Accounts are being created without `password_hash`, so users cannot sign back in after session loss.

**Implementation plan**
1. Make password required at exchange registration (or force immediate set-password step before account activation).
2. Prevent login for accounts with null hash and return structured error directing to completion flow.
3. Add one-time password setup token path for already-created legacy accounts with null hash.
4. Add admin/report query to monitor remaining null-hash accounts until zero.

**Acceptance criteria**
- No newly created account has null `password_hash`.
- Legacy null-password users can complete setup via secure token flow.
- Login works after browser/session restart.

### 3) Enforce Terms & Conditions acceptance at account creation (Critical #3)

**Problem:** `accepted_terms_at` is null for all accounts; legal gate exists but is not enforced.

**Implementation plan**
1. Require a terms acceptance checkbox + version metadata in registration payload.
2. Reject account creation if terms are not accepted.
3. Persist `accepted_terms_at`, `accepted_terms_version`, and source IP/user-agent where applicable.
4. Backfill policy: leave legacy nulls unchanged but require acceptance at next sign-in before app access.

**Acceptance criteria**
- Newly created accounts always store terms acceptance.
- Legacy users with null value are blocked until acceptance.
- Audit log can prove when/version accepted.

### 4) Add forgot/reset password flow for exchange auth (High #4)

**Problem:** No recovery path exists.

**Implementation plan**
1. Add `POST /exchange/auth/forgot-password` and `POST /exchange/auth/reset-password`.
2. Generate hashed, short-lived, single-use reset tokens.
3. Send email via existing provider pipeline with secure reset URL.
4. Build UI screens for request + reset completion.
5. Add abuse controls: rate limit, uniform response messages, token invalidation on use.

**Acceptance criteria**
- Users can reset password end-to-end via email.
- Expired/used tokens are rejected.
- Endpoint is rate-limited and non-enumerable.

### 5) Add exchange email verification flow (High #5)

**Problem:** Exchange registrations do not verify email.

**Implementation plan**
1. Add email verification tokens + verification endpoint.
2. Send verification email on registration and when user changes email.
3. Gate sensitive actions (KYC start, trading/checkout actions) behind verified email.
4. Add resend verification endpoint with cooldown/rate limits.

**Acceptance criteria**
- New users cannot proceed to sensitive exchange actions without verified email.
- Verification status is visible in account UI.
- Unverified state has clear CTA and resend controls.

### 6) Add KYC completion polling after Stripe redirect (High #6)

**Problem:** Users can remain stuck in pending if webhook is delayed/missed.

**Implementation plan**
1. On return from Stripe Identity, start client polling to `GET /api/kyc/status` every 3–5 seconds for up to 2–3 minutes.
2. Stop polling immediately on terminal status (`verified`, `rejected`, `requires_input`).
3. Show clear progress UI and fallback support message if timeout reached.
4. Add idempotent server endpoint that resolves latest Stripe session status on-demand if webhook lagging.

**Acceptance criteria**
- Users get status updates without manual refresh.
- Missed webhook scenario still resolves user state through polling fallback.

### 7) Add rate limit to `POST /api/kyc/start` (High #7)

**Problem:** Endpoint can be spammed, creating avoidable Stripe Identity costs.

**Implementation plan**
1. Apply same limiter strategy used by other sensitive exchange endpoints (per-account + per-IP).
2. Add dedupe lock to prevent concurrent KYC session creation.
3. Return deterministic response with retry-after metadata.

**Acceptance criteria**
- Burst requests are throttled.
- Only one active start operation can run per account at a time.

### Phase 1 QA & rollout checklist

- Unit tests for registration invariants (`password_hash`, terms, kyc default).
- Integration tests for forgot/reset and email verification flows.
- End-to-end test: register → verify email → accept terms → start KYC → return redirect → polling updates → sign out/in.
- Data migration dry run in staging with production-like snapshot.
- Feature flags for email verification and password reset rollout.
- Observability dashboard: onboarding funnel conversion + error rates.

---

## Phase 2 — Reliability Hardening, Data Hygiene, and Product Polish

**Goal:** Reduce operational drift, eliminate demo fallbacks in production, and tighten model consistency.

### 8) Expired exchange session cleanup job (Medium #8)

**Implementation plan**
1. Add scheduled cleanup task to delete/archive expired sessions daily (or hourly under load).
2. Add DB index on session expiry column if missing.
3. Add metric for deleted row counts and table size trend.

**Acceptance criteria**
- Expired session rows do not grow unbounded.
- Cleanup job is observable and alertable on failure.

### 9) Remove production mock fallbacks for AI outputs (Medium #9)

**Implementation plan**
1. Guard demo fallback behind explicit non-production flag only.
2. In production, return “temporarily unavailable” with trace ID instead of fabricated responses.
3. Add integration checks validating Anthropic credentials/config at startup.
4. Mark any fallback response in logs/telemetry.

**Acceptance criteria**
- Production users never receive hardcoded “[Demo Mode]” content.
- AI failure behavior is explicit and non-deceptive.

### 10) Replace hardcoded Stripe credit packages with dynamic catalog (Medium #10)

**Implementation plan**
1. Read active Stripe products/prices from API (cached with TTL).
2. Validate products by metadata tags (e.g., `type=exchange_credit`).
3. Expose catalog endpoint for UI and handle stale cache fallback safely.

**Acceptance criteria**
- Price/package changes in Stripe are reflected without code deploy.
- Inactive or mis-tagged products are excluded.

### 11) Resolve KYB field clarity for buyer accounts (Low #11)

**Implementation plan (choose one and execute fully)**
- **Option A (preferred):** Keep `kyb_status` only for seller/business accounts and hide/remove from buyer-facing DTOs.
- **Option B:** Keep universal field but add explicit semantic docs/UI copy for buyers (“Not applicable”).

**Acceptance criteria**
- Data model and UX semantics are aligned; no unexplained KYB noise in buyer flows.

### 12) Re-evaluate session token storage UX/security balance (Low #12)

**Implementation plan**
1. Document current `sessionStorage` behavior and rationale in auth docs.
2. Evaluate “Remember me” mode using secure httpOnly cookie or persistent encrypted storage.
3. If unchanged, add UI copy in sign-in flow to set expectations.

**Acceptance criteria**
- Behavior is intentional, documented, and communicated to users.
- Support burden from “logged out on new tab/window” is reduced.

### Phase 2 QA & rollout checklist

- Load test auth/session tables before and after cleanup job.
- Contract tests for dynamic Stripe catalog endpoint.
- Production safeguard test: AI provider disabled should return explicit non-mock error.
- Schema/docs alignment review for KYB semantics.

---

## Cross-phase Execution Controls (to make this work “perfectly”)

1. **Define invariants as code**
   - No account without password hash.
   - No account without terms acceptance timestamp (post-cutover).
   - Default KYC = `not_started`.
   - Sensitive endpoints all rate-limited.

2. **Observability first**
   - Funnel metrics: register → verify email → set password → accept terms → KYC started → KYC verified.
   - Alerting: webhook failures, polling timeout spikes, reset email bounce rates.

3. **Safe migrations**
   - Run backfills in batches.
   - Add reversible migration scripts and before/after row-count checks.
   - Validate in staging with anonymized snapshot.

4. **Release strategy**
   - Feature flags for risky paths (email verification gate, polling, dynamic pricing).
   - Canary rollout for 5–10% of users before full enablement.
   - Post-release audit query pack to confirm invariants.

---

## Suggested ownership and timeline

- **Phase 1 (1–2 sprints):** Backend auth/KYC engineer + frontend onboarding engineer + QA.
- **Phase 2 (1 sprint):** Platform engineer + payments integration engineer + product/UX.
- **Daily standup focus metric:** count of blocked users at each onboarding step.
