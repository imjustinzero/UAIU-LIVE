# EPD / LCA Guide

## EPD explained simply
An Environmental Product Declaration (EPD) documents a product's lifecycle impacts, including embodied carbon across A/B/C life-cycle modules.

## How to register your EPD on UAIU
- Call `POST /api/epd/records`.
- Upload metadata and phase-level carbon data.
- UAIU computes total embedded carbon and stores a document hash + evidence vault ID.

## Linking EPD to offset retirements
- Call `POST /api/epd/records/:id/link-retirements` with retirement IDs and retired tonnes.
- Validation ensures retirement volume is sufficient relative to embedded carbon.
- The system issues an EPD Carbon Offset Certificate reference.

## Product Carbon Passport creation
Create passports via `POST /api/pcp/create` by linking EPD + retirement + UVS references.
Each passport gets a public URL and certificate number formatted as `PCP-[YEAR]-[SKU_PREFIX]-[SEQUENCE]`.

## ISO 14025 alignment
EPD records include ISO 14025 compliance flags and verification metadata to support procurement and reporting quality controls.
