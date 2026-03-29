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
