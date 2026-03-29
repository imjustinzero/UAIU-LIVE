# Standards Lab Guide

## What Standards Lab is
A collaborative environment for drafting, commenting, voting, and auditing methodology development.

## Forming a working group
Create via `POST /api/working-groups/create`; group starts in `forming` status with creator as first member.

## Membership and roles
Typical roles: lead, editor, reviewer, voter, observer.

## Draft numbering convention
Use WD/CD/FDIS progression (e.g., `WD-1`, `WD-2`, `CD-1`, `FDIS`).

## Comment submission
Submit through `POST /api/methodology-comments` while comment window is open.

## Voting eligibility and process
Eligible voters include verified partners and ISO verifiers; one vote per voter per draft.

## Audit chain tracking
Every major event (group create, draft publish, comment, response, vote) is anchored in audit chain entries.

## Citing drafts externally
Include draft number, date, and URL to immutable draft endpoint in references.

## ISO-body mirroring
ISO bodies can mirror formal milestones using working group, draft, and ballot endpoints while preserving local governance rules.
