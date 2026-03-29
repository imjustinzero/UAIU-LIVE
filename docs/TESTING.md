# Testing Guide

## Run tests
- All tests: `npm run test`
- Unit only: `npm run test:unit`
- Integration only: `npm run test:integration`
- Coverage: `npm run test:coverage`
- E2E: `npm run test:e2e`

## Coverage requirements
Critical paths target 80% line/function/branch coverage (configured in `vitest.config.ts`).

## Integration setup
- Configure `DATABASE_URL` and any required API keys.
- Seed minimum fixtures for audit, escrow, IoT, and market flows.
- Run integration tests in isolated DB schema/environment.

## E2E setup
- Ensure app is running and reachable at `PLAYWRIGHT_BASE_URL`.
- Use deterministic fixture data for verify page, trust page, and market data.

## Writing new tests
- Put pure logic tests under `tests/unit`.
- Put API-level tests under `tests/integration`.
- Put browser workflow tests under `tests/e2e`.
- Keep tests deterministic, isolated, and fast.
