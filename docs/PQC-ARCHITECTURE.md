# PQC-Aware Hash Agility Architecture

## Why hash agility matters for T+1 settlement finality
UAIU escrow settlements use a T+1 finality window (`ESCROW_FINALITY_HOURS`, default 24h). A settlement may have been recorded with an algorithm that was considered acceptable at that moment, but that algorithm can later be deprecated due to new cryptanalytic advances or policy updates. Hash agility allows the platform to:

- keep historical settlement records valid and auditable,
- evaluate old records against current policy,
- avoid brittle rewrites or emergency code deployments when policy changes.

This is essential for financial workflows because finality and evidentiary integrity must survive algorithm transitions.

## Production algorithm rotation with zero code change
Hash selection is controlled entirely by environment variables:

- `HASH_ALGORITHM`: algorithm used for **new** audit/settlement hashes.
- `APPROVED_ALGORITHMS`: policy allow-list used for finality checks and review flags.

### Safe rotation flow
1. **Pre-stage support**: ensure runtime supports target algorithm (e.g., OpenSSL/Node capability).
2. **Dual-approval window**: set `APPROVED_ALGORITHMS` to include both old and new algorithms.
3. **Flip active algorithm**: set `HASH_ALGORITHM` to the new algorithm.
4. **Observe**: monitor for settlement/audit creation errors and chain verification mismatches.
5. **Deprecate old algorithm**: remove old algorithm from `APPROVED_ALGORITHMS` once counterparties and internal systems are fully migrated.

No code changes are required for these steps.

## Manual review workflow for deprecated settlement algorithms
When a settlement reaches required elapsed time but its historical hash algorithm is no longer approved, the system marks:

- `settled = true`
- `algorithmApproved = false`
- `requiresManualReview = true`

It must **never auto-reject** solely due to algorithm deprecation. Recommended workflow:

1. Analyst opens the settlement status payload and confirms `requiresManualReview`.
2. Analyst verifies linked audit-chain entry integrity and settlement metadata.
3. Analyst checks policy cutover date and whether settlement timestamp predates deprecation.
4. Analyst records disposition:
   - **Accept historical finality** with review note, or
   - **Escalate** for compliance/legal exception handling.

## NIST SP 800-208 and PQC transition context
NIST SP 800-208 emphasizes stateful hash-based signatures and migration planning where crypto agility is critical. While escrow hashing here is not the same primitive as signature schemes, the operational lesson is the same: crypto policy must be updatable without service interruption.

The broader NIST PQC transition timeline signals an ongoing multi-year migration period where legacy and newer algorithms can coexist. Systems that encode algorithm identity per record and validate against dynamic policy are more resilient during this transition.

## Counterparty infrastructure risk during transitions
Algorithm transitions are not purely internal. Counterparty ecosystems (banks, registries, middleware vendors, custodians) may lag in algorithm support or observability tooling.

Key risks:

- inconsistent algorithm support across environments,
- mismatched verification implementations,
- delayed incident detection when one party silently falls back.

Mitigations:

- publish algorithm/version compatibility matrices,
- run staged interoperability tests before hard cutover,
- keep an explicit manual-review lane for legacy-settled records,
- maintain auditable policy snapshots (what was approved and when).

## Test coverage reference
The production test harness is configured with Vitest and targets **80% coverage** on critical paths. Core unit tests currently validate hash algorithm selection, hash determinism, chain-linking properties, and escrow finality edge cases.

Recommended coverage focus:
- `server/hash-agility.ts` for algorithm policy and finality logic,
- audit-chain hash linkage and rotation routes,
- settlement status progression and manual-review behavior.

## Monitoring metrics reference
Operational monitoring should include:
- trade counters and value histograms,
- escrow finality duration histogram,
- IoT ingestion totals and anomaly counters,
- audit chain block counts and integrity gauge,
- API request/error counters and latency histograms.

Prometheus should scrape `/metrics`, and health probes should include both `/health` (public) and `/health/detailed` (admin).

## Rate-limit documentation (operational)
Baseline policy:
- public endpoints: strict per-IP limits,
- authenticated endpoints: per-key/per-plan limits,
- IoT ingestion: per-device high-throughput limits,
- admin and bulk operations: tighter per-user windows.

Rate-limit responses should be structured and include `X-RateLimit-*` headers plus `Retry-After` when throttled.

## Cryptographic Bill of Materials (CBOM)

UAIU exposes a live cryptographic inventory at `/api/crypto/cbom` and a metrics snapshot at `/api/crypto/cbom/summary`.

Each entry includes component mapping, algorithm family, PQC vulnerability flag, NIST/BSI/NCSC deprecation years, migration target, migration status, audit linkage, and verification timestamp.

Migration status categories:
- `complete`
- `in_progress`
- `not_started`
- `not_required`

## Multi-Jurisdictional Compliance

UAIU governance now tracks requirements across:
- **NIST IR 8547 (USA)**: 2030 deprecation horizon for classical asymmetric systems, 2035 disallow endpoint.
- **BSI TR-02102 (Germany)**: hybrid cryptography requirement by 2032 and disallow endpoint by 2035.
- **NCSC PQC Guidance (UK)**: priority migration horizon by 2031 with 2035 endpoint alignment.

Live endpoints:
- `/api/crypto/jurisdictions`
- `/api/crypto/compliance-matrix`
- `/x/crypto/governance`

## Hybrid Cryptography

Hybrid mode combines classical and PQC verification in parallel, with both checks required for full hybrid verification.

IoT hybrid enablement:
1. Register ML-DSA key via `POST /api/crypto/hybrid/register-pqc-key`.
2. Device switches to `hybridMode=true` and stores `pqcPublicKey` + `pqcAlgorithm`.
3. Readings can include `classicalSignature` and `pqcSignature`.
4. `hybridVerified=true` only when both signatures verify.

## Asymmetric vs Hash Agility

- **Hash agility** (`SHA-256 -> SHA3-256/BLAKE3`) is deployed and configurable via `HASH_ALGORITHM`.
- **Asymmetric migration** (`RSA/ECDSA/ECDH -> ML-DSA/ML-KEM`) is in progress and tracked per component in CBOM.

Both are required for complete PQC readiness:
- Hash agility addresses Grover-related security margin degradation.
- Asymmetric migration addresses Shor-vulnerable public-key primitives.

## Real-Time Monitoring

Cryptographic operations are recorded in `algorithm_usage_log` and exposed via:
- `/api/crypto/usage/realtime`
- `/api/crypto/usage/deprecated`
- `/api/crypto/usage/summary/:period`

Detailed health now includes:
- `currentAlgorithm`
- `approvedAlgorithms`
- `deprecatedUsageIn24h`
- `pqcPostureScore`
- `nextDeprecationYear`

See `/health/detailed` or `/api/health/detailed` and `/x/trust` for posture visibility.
