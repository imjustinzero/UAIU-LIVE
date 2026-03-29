# ISO Verifier Guide

## Supported ISO standards
- ISO 14064-1
- ISO 14064-2
- ISO 14064-3
- ISO 14065
- ISO 14066
- ISO 14025
- ISO 14040/44

## Registering as an ISO verifier
Use `POST /api/iso/verifiers/register` with accreditation body, accreditation number, validity period, and supported standards.

## Engagement workflow
1. Create engagement via `POST /api/iso/engagements`.
2. Pull verifier workload with `GET /api/iso/engagements/:verifierId`.
3. Retrieve ISO checklist from `GET /api/iso/standards/checklists/:standard`.
4. Publish signed statement using `POST /api/iso/engagements/:id/statement`.

## Statement generation
Statements are hash-sealed and anchored into the audit chain with confidence level and materiality metadata.

## Accreditation requirements
Verifier profiles track accreditation body, accreditation number, validity date, standards list, and marketplace readiness status.
