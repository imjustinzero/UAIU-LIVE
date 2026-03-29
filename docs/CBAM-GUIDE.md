# CBAM Guide

## What CBAM is and who it affects
The Carbon Border Adjustment Mechanism (CBAM) is the EU framework for carbon reporting and pricing on imported goods.
It primarily affects importers and upstream suppliers in steel, cement, aluminium, fertiliser, electricity, and hydrogen value chains.

## How UAIU simplifies CBAM compliance
- Create quarterly declarations (`Q1-2026`, etc.) in one place.
- Auto-calculate embedded carbon totals and certificate requirements.
- Link retirement proof IDs to establish carbon chain-of-custody.
- Generate downloadable submission package ZIP for filing readiness.

## Embedded carbon factors by goods category
Current default factors are maintained in the API endpoint `GET /api/cbam/embedded-carbon/factors` and scheduled for quarterly refresh.

## How to link credits to CBAM declarations
1. Create declaration with imported tonnes + carbon factor.
2. Submit retirement IDs and retired tonnes with `POST /api/cbam/declarations/:id/link-credits`.
3. Platform validates `retired tonnes >= embedded carbon tonnes`.
4. Audit chain captures the link event for traceability.

## Submission package contents
- Declaration summary
- Embedded carbon methodology
- Linked retirement proof references
- UVS reference note
- Audit chain reference
- ISO 14064 alignment statement
