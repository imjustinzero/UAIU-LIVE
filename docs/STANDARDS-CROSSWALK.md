# Standards Crosswalk Engine

## Standards covered
Crosswalk entries can map across ISO 14064 variants, GHG Protocol standards, Verra VCS, Gold Standard, and joint-standard drafts.

## Table model
Each row maps:
- Source standard + clause + requirement
- Target standard + clause + requirement
- Alignment type (equivalent/partial/gap/conflict)
- UAIU implementation + feature reference

## Reading the crosswalk
Use `GET /api/crosswalk/standards` with filters for source/target/alignment.

## Gap prioritization
Use `GET /api/crosswalk/platform-coverage` for per-standard coverage % and gap counts.

## Contributions
Admin/working-group entry insert: `POST /api/crosswalk/entries`.

## Working group data access
Working group members can use the academic portal (`/x/academic`) and crosswalk APIs jointly for standards drafting analysis.
