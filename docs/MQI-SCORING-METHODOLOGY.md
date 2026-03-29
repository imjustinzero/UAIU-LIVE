# MQI Scoring Methodology

## What MQI measures
MQI measures applied methodology quality and market trustworthiness from citations, standards alignment, usage, outcomes, verifier reputation, and references.

## Components and weights
1. Peer Citation Score (25%)
2. Standards Alignment (20%)
3. Real-World Usage (20%)
4. Outcome Tracking (20%)
5. Verifier Reputation (10%)
6. Academic References (5%)

Each component is normalized to 0–100, then weighted sum is computed.

## Data sources
- `verification_statements`
- `partner_methodologies`
- `methodology_peer_reviews`
- `verified_partners`
- `uvs_certifications`
- fraud/dispute and IoT-trust linked tables

## Grades
- AAA: 90+
- AA: 80–89
- A: 70–79
- BBB: 60–69
- BB: 50–59
- B: 40–49
- C: <40

## Price premium correlation
Correlate MQI snapshots with executed listing prices using rolling windows by standard, geography, and vintage.

## Improving MQI
- Increase high-quality independent usage.
- Align with recognized standards.
- Improve verifier outcomes and fraud-free operations.
- Add DOI-backed references.

## Signature verification
MQI snapshots are signed via HMAC over score payload using `UCPI_SIGNING_KEY`.

## Historical access
Use `/api/mqi/:methodologyCode/history` and leaderboard endpoints for trend analysis.
