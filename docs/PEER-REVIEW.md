# Methodology Peer Review

## What it is
A formal peer review workflow for methodologies. Before AAA MQI standing, methodologies should pass partner peer review.

## Selection criteria
Reviewers are selected with preference for:
- Different organization than methodology author
- Relevant specialization overlap
- Reputation score >= 75
- No declared conflict
- Availability cap (not overloaded)

## Process timeline
1. Author requests review
2. System proposes 2-3 reviewers
3. 21-day review period
4. Reviews submitted and hashed
5. Author response/disposition
6. Panel recommendation

## Requesting a review
Use `POST /api/peer-review/request/:methodologyId`.

## Submitting a review
Use `POST /api/peer-review/:reviewId/submit`.
Submitted payloads are hashed and linked to audit chain block IDs.

## MQI impact
Completed and approved peer review can raise confidence and support higher MQI trajectory.
