# UAIU.LIVE/X Formal Properties

Formal properties are machine-verifiable invariants. Each property is stored in `formal_properties` and is verified by executable test logic via `/api/properties/verify-all` and `/api/properties/verify/:propertyId`.

## Verification model
- Properties are publicly readable (`GET /api/properties`, `GET /api/properties/:propertyId`).
- Tests run automatically every 6 hours via cron.
- Every verification run writes evidence + status + timestamp and is hashed to the audit chain.

## Initial property set
- UAIU-PROP-001: Audit chain append-only.
- UAIU-PROP-002: Hash agility completeness.
- UAIU-PROP-003: Algorithm attribution completeness.
- UAIU-PROP-004: Escrow finality monotonicity.
- UAIU-PROP-005: Double-spend impossibility.
- UAIU-PROP-006: UVS criteria completeness.
- UAIU-PROP-007: Sanctions screening coverage.
- UAIU-PROP-008: Manual review non-rejection.
- UAIU-PROP-009: Evidence vault tamper detection.
- UAIU-PROP-010: Methodology attribution permanence.

## Independent execution
1. Call `POST /api/properties/verify-all` (admin) to run all checks.
2. Call `POST /api/properties/verify/UAIU-PROP-00X` for single property.
3. Read `verificationLog` evidence payload for each run.

## Submit a challenge
Use `/x/challenge` or `POST /api/challenges/submit` to challenge any formal property or platform claim.

## Standards alignment
Each property stores a `standardsAlignment` JSON object (ISO/NIST/GHG/OFAC as applicable).
