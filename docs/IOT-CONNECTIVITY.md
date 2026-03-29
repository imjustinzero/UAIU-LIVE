# UAIU IoT Connectivity

## MQTT Integration
- Configure `MQTT_BROKER_URL`, `MQTT_USERNAME`, `MQTT_PASSWORD`, `MQTT_PORT`, and `MQTT_TLS_PORT`.
- Topic structure:
  - `uaiu/devices/{deviceId}/readings`
  - `uaiu/devices/{deviceId}/status`
  - `uaiu/devices/{deviceId}/commands`
  - `uaiu/projects/{projectId}/summary`
- Server subscribes to `uaiu/devices/+/readings` and `uaiu/devices/+/status` and publishes acknowledgements to `uaiu/devices/{deviceId}/ack`.

## REST API direct integration
- Existing endpoint: `POST /api/iot/readings`
- Batch endpoint: `POST /api/iot/readings/batch`
- MQTT bootstrap endpoint: `GET /api/iot/mqtt/connection-info`

## Gateway Agent installation
- Windows: packaged `.exe`
- macOS: packaged `.dmg`
- Linux: `.deb` and `.AppImage`
- Docker: `uaiu/gateway-agent:latest`
- Raspberry Pi: ARM `.deb`

## Protocol adapter reference
- `POST /api/iot/ingest/campbell`
- `POST /api/iot/ingest/hobolink`
- `POST /api/iot/ingest/particle`
- `POST /api/iot/ingest/lorawan`
- `POST /api/iot/ingest/sensecap`
- `POST /api/iot/ingest/blues`

All adapters log to `iot_raw_payloads` and return `{ accepted, readingIds, auditBlockIds }`.

## Offline buffering
- Gateway Agent writes readings to local SQLite.
- Upload retries use exponential backoff.
- Buffer depth visible in local UI.

## Signing and verification
- Gateway generates RSA-2048 keys on first run.
- Readings are signed before upload.
- UAIU verifies signatures and flags anomalies.
