# Industrial Enterprise Onboarding (30 Days)

## Timeline overview
### Week 1 — Assessment
- Upload Scope 1/2/3 inventory
- CBAM exposure assessment
- Supply chain carbon gap analysis

### Week 2 — EPD mapping
- Upload/link EPDs for top components
- Flag unverified sources
- Assign ISO verifier for 14064-1 review
- Build carbon budget

### Week 3 — Credit procurement
- Generate recommended credit mix
- Reserve UVS-certified credits
- Initiate ISO 14064-2 verification
- Create Product Carbon Passports for priority SKUs

### Week 4 — Reporting package
- Final Scope 1/2/3 + offsets
- CBAM declarations ready
- ISO verification statements issued
- Regulatory filing set assembled

## Integration guides
- SAP Green Ledger: `POST /api/integrations/sap/push`
- Siemens MindSphere/Opcenter: `POST /api/integrations/siemens/push`
- Honeywell Forge export: `GET /api/integrations/honeywell/export`
- BMW supplier export: `GET /api/integrations/bmw-supplier/export`

## Supply chain carbon mapping process
Capture supplier/component lines in `supply_chain_carbon_map`, measure data quality, and compute hotspot and CBAM exposure views with API endpoints.
