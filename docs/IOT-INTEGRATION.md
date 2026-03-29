# UAIU.LIVE/X IoT Integration Guide

## Supported device types
- `soil_sensor`
- `gas_flow_meter`
- `weather_station`
- `biomass_monitor`
- `satellite_feed`
- `energy_meter`

## Supported reading types
- `co2_sequestration_kg`
- `methane_flow_m3`
- `soil_carbon_percent`
- `energy_kwh`
- `temperature_c`
- `humidity_percent`
- `biomass_tonnes`

## Device registration and authentication
1. Register with `POST /api/iot/devices/register`.
2. Save response fields:
   - `deviceUuid`
   - `apiSecret`
3. Push readings using bearer token format:
   - `Authorization: Bearer <deviceId>:<apiSecret>`
4. Device remains pending operational acceptance until approved by admin policy.

## Firmware requirements
- Devices report firmware with `POST /api/iot/firmware/report`.
- Mandatory baseline is controlled by `FIRMWARE_MANDATORY_VERSION`.
- Outdated mandatory versions create `firmware_outdated` anomalies.

## Signature verification
- Payload signatures are validated against device `publicKey`.
- Current implementation accepts HMAC-SHA256 signatures over `rawPayload`.
- Invalid signatures are ingested but marked `signatureValid=false` and anomaly-flagged.

## Batch uploads (offline-first)
- Endpoint: `POST /api/iot/readings/batch`
- Max payload count controlled by `IOT_READING_MAX_BATCH` (default `1000`).
- Replay timestamps in batch trigger `batch_replay` critical anomalies.

## Anomaly catalog
- `signature_invalid`
- `value_out_of_range`
- `sudden_spike`
- `flatline`
- `offline_gap`
- `timestamp_drift`
- `batch_replay`
- `impossible_value`
- `firmware_outdated`
- `possible_deforestation_event`

## MRV methodology references
- `GHG_PROTOCOL`
- `VERRA_VM0015`
- `GOLD_STANDARD_TPDDTEC`

## IoT Trust Score
Weighted score (0-100):
- Signature validity: 30%
- Data coverage: 25%
- Anomaly rate inverse: 20%
- Device health: 15%
- Satellite cross-validation: 10%

Trust endpoint: `GET /api/iot/trust-score/:projectId`

## Satellite data integration
- Ingest with `POST /api/iot/satellite/ingest`
- Supported data types:
  - `ndvi`
  - `fire_alert`
  - `land_use_change`
  - `cloud_cover_percent`
- Satellite events are chained into audit blocks and can trigger anomaly events.
