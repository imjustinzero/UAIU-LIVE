# Methodology Registry

## What it is

The UAIU Methodology Registry is a public, versioned, cryptographically attributed repository of partner verification methodologies. Every published methodology stores:

- immutable `methodologyCode` and semantic `version`
- SHA-256 `documentHash` of the methodology text
- evidence vault linkage
- audit chain block reference
- usage/citation counters

## How to publish

1. POST `/api/methodologies` with partner, code, version, scope, and full markdown methodology text.
2. The platform hashes the methodology document (`SHA-256`).
3. UAIU records a `methodology_published` audit chain block with partner, code, version, and hash.
4. The API returns a public URL: `/x/methodologies/:code/:version`.

## Versioning guide (SemVer)

Use semantic versioning for `version`:

- `MAJOR` (`2.0.0`): breaking methodological changes
- `MINOR` (`1.1.0`): additive enhancements
- `PATCH` (`1.0.1`): clarifications/fixes without process change

When superseding a version:

- publish a new version
- set old record status to `superseded`
- preserve prior version hash and citations

## How citations work

- Verification usage calls `POST /api/methodologies/:id/cite`.
- Citation count increments at methodology level.
- A citation trail is queryable via `GET /api/methodologies/:id/citations`.
- Each citation links methodology version/hash to a credit-level audit record.

## Alignment checks

Run `POST /api/methodologies/alignment-check` with:

- `methodologyId`
- `standardReference`

Response returns:

- alignment score (0-100)
- fully aligned sections
- partially aligned sections
- gaps
- recommendations

## Academic citation formats

Methodology impact data can be exported for scholarship workflows in:

- APA
- Chicago
- BibTeX
- RIS

Use the partner impact dashboard to compile citation trails and usage evidence for papers, CV entries, and professional profiles.

## Audit chain representation

Methodology publication block:

```json
{
  "type": "methodology_published",
  "partnerId": "...",
  "methodologyCode": "E2-VMV-1.0",
  "version": "1.0.0",
  "documentHash": "..."
}
```

Verification statement block now includes:

```json
{
  "type": "verification_statement",
  "verifierId": "uuid",
  "partnerFirmName": "string",
  "methodologyCode": "E2-VMV-1.0",
  "methodologyVersion": "1.0.2",
  "methodologyHash": "sha256",
  "creditId": "uuid",
  "creditsVerified": 1000,
  "standardsApplied": ["ISO 14064-2"],
  "confidenceLevel": "reasonable"
}
```

This preserves permanent linkage between credit verification claims and the exact methodology version/hash used at verification time.
