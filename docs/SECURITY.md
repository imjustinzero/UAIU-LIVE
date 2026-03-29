# Security Operations

## API key management
- Store API keys hashed at rest (bcrypt cost factor 12).
- Use key prefixes for lookup and full hash validation for auth.
- Support key rotation with overlap window for safe cutover.

## Rate limiting policy
- Apply per-IP limits for public endpoints.
- Apply per-key/device/org limits for authenticated and ingestion endpoints.
- Return structured rate-limit errors and standard headers.

## Geographic restrictions
- If `GEO_RESTRICT=true`, block requests from sanctioned geographies.
- Return `403` with `geographic_restriction` reason.
- Audit log all blocked requests.

## Incident response procedure
1. Detect and classify severity.
2. Contain impacted subsystem.
3. Eradicate root cause.
4. Recover service and validate integrity.
5. Publish post-incident report.

## Responsible disclosure policy
- Report vulnerabilities privately to security contacts.
- Include reproduction steps, impact, and affected versions.
- Coordinate disclosure timeline after patch is available.
