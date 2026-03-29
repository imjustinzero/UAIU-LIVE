# UAIU.LIVE/X Academic API

Base path: `/api/academic/v1/`

## Datasets
- `/market/price-series`
- `/verification/outcomes`
- `/iot/data-quality`
- `/methodology/citations`
- `/fraud/patterns`
- `/pqc/algorithm-usage`

All datasets are aggregated/anonymized by default.

## Access requests
Submit `POST /api/academic/v1/access-request` with:
- institutionName
- researcherName
- researcherEmail
- orcidId (optional)
- researchPurpose
- dataRequested
- dataAccessLevel

## Citation requirement
Every response includes:
`X-UAIU-Citation: UAIU Holdings Corp. UAIU.LIVE/X Carbon Market Data [date range]. Retrieved [date]. uaiu.live/x/academic. DOI: pending`

## Anonymization method
- No buyer/seller/entity names are returned.
- Outputs are grouped by category/time/geography and reported as aggregates.
- IDs and direct entity references are removed from outputs.

## Special access
ISO/GHG Protocol Joint Working Group researchers are eligible for elevated access tier by policy review.
