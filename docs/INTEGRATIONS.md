# UAIU.LIVE/X Integrations

## Salesforce Sustainability Cloud
1. Set `SF_CLIENT_ID`, `SF_CLIENT_SECRET`, `SF_INSTANCE_URL`.
2. Call `POST /api/integrations/salesforce/push`.
3. Endpoint formats settlement + retirement payload in Salesforce-compatible JSON.

## Microsoft Sustainability Manager
1. Set `MS_TENANT_ID`, `MS_CLIENT_ID`, `MS_CLIENT_SECRET`.
2. Call `POST /api/integrations/microsoft/push`.
3. Data is formatted to sustainability activity import shape.

## CDP Export
- Use `GET /api/integrations/cdp/export` for CDP-compatible XML disclosure files.

## Generic JSON Export (Persefoni / Watershed / Greenly / Sweep / Normative)
- Use `GET /api/integrations/generic/export`.
- Response contains normalized records with registry, tonnes, pricing, verification, retirement fields.

## API Key Authentication
- Generate key: `POST /api/keys/generate` with `x-admin-key`.
- Use key as `Authorization: Bearer <api-key>` on all `/api/v1/*` routes.

## Webhooks + HMAC
- Register webhook: `POST /api/v1/webhooks/register`.
- Events: `settlement.created`, `settlement.finalized`, `certificate.issued`, `audit.completed`, `algorithm.rotated`.
- Verify `X-UAIU-Signature` using HMAC-SHA256 with webhook secret.

## /api/v1 Endpoint Reference
- `GET /api/v1/credits`
- `POST /api/v1/credits/reserve`
- `POST /api/v1/credits/purchase`
- `GET /api/v1/settlements`
- `GET /api/v1/settlements/:id`
- `GET /api/v1/portfolio`
- `GET /api/v1/audit/chain`
- `GET /api/v1/trust/status`
- `POST /api/v1/webhooks/register`
