# Security Challenge Process

## Submission
Submit via `/x/challenge` or `POST /api/challenges/submit`.
Required:
- Organization
- Challenged claim
- Technical challenge
- Evidence requested

## Valid challenge criteria
A valid challenge must:
- Reference a testable claim.
- Include falsification logic/evidence request.
- Provide technically reviewable detail.

## Response commitment
Platform target response SLA: **48 hours** for initial evidence package publication.

## Resolution states
- `open`
- `evidence_provided`
- `resolved`
- `disputed`

All submissions and responses are audit-chain hashed.

## Registry
Public registry: `GET /api/challenges` and `GET /api/challenges/:id`.
