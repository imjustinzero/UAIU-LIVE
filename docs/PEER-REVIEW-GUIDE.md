# Peer Review Guide

## Purpose and structure
Peer review validates methodology rigor before market scaling.

## Reviewer selection
Reviewers are selected from verified partners based on specialization overlap, reputation threshold, and conflict constraints.

## Timeline
Request → assignment → review submission → panel recommendation.

## Submission format
Review must include structured content and recommendation (`accept`, `accept_with_revisions`, `major_revisions`, `reject`).

## MQI impact
Completed and favorable peer review contributes positively to MQI scoring and confidence.

## Author responses
Authors receive panel output and reviewer comments; status is updated to `peer_reviewed` or `needs_revision`.

## Requesting peer review
Use `POST /api/peer-review/request/:methodologyId` for published methodologies.

## Declining invitations
Decline by updating assignment status and providing reason; reassignment should trigger automatically.

## Conflict of interest
Reviewers must disclose organizational, financial, and collaboration conflicts; conflicted reviewers must not be assigned.
