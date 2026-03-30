# Credential Wallet — UAIU.LIVE/X

## Supported Credential Types
- `iso_14064`
- `iso_14065`
- `verra_auditor`
- `gs_auditor`
- `unfccc_reviewer`
- `ipcc_reviewer`
- `undp_technical`
- `cdm_auditor`
- `custom`

## Upload + Verify Flow
1. Go to `/x/verifier/credentials`.
2. Submit credential type, issuing body, number, and validity window.
3. Platform hashes the credential payload/document and stores evidence reference.
4. Admin verification sets **Platform Verified ✓** once validated.

## Public Profile Display
- Valid, publicly-visible credentials appear on `/x/professionals/:id`.
- Credential cards include issuing body, validity, and document hash.
- Platform-verified status is highlighted for buyers.

## Expiry Tracking
- 60-day reminder: early renewal prompt.
- 30-day reminder: urgent renewal prompt.
- Expired credentials are visually de-emphasized and flagged as expired.

## UNDP/UN Special Handling
When `unfccc_reviewer`, `ipcc_reviewer`, or `undp_technical` is added:
- Admin receives an immediate high-trust alert.
- Credential receives elevated trust weighting in quality scoring.
- Verifier trust tier is elevated once platform verification is complete.
