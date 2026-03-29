# UAIU.LIVE/X IoT Developer Guide

## Overview
Connect devices to UAIU.LIVE/X for real-time carbon telemetry, anomaly screening, and MRV support.

## Supported Connection Methods
### Direct REST API
`POST https://uaiu.live/x/api/iot/readings`

Headers:
- `Authorization: Bearer {deviceId}:{device_api_secret}`

Body:
```json
{
  "deviceId": "...",
  "timestamp": "2026-03-29T12:00:00Z",
  "readingType": "co2_sequestration_kg",
  "value": 12.34,
  "unit": "kg",
  "rawPayload": {},
  "deviceSignature": "hex-signature"
}
```

### MQTT
- Broker: `MQTT_BROKER_URL`
- Topic: `uaiu/devices/{deviceId}/readings`
- Payload: JSON matching the reading schema above.

### Gateway Agent
Use ingestion adapters for Campbell Scientific, HOBO, Particle, LoRaWAN, SenseCAP, and Blues via `/api/iot/ingest/*` endpoints.

## Reading Types
| readingType | Unit | Description |
|---|---|---|
| `co2_sequestration_kg` | kg | Sequestration delta per event |
| `temperature_c` | °C | Ambient temperature |
| `humidity_percent` / `humidity_pct` | % | Relative humidity |
| `methane_flow_m3` | m³ | Methane flow |
| `energy_kwh` | kWh | Power generation |

## Device Registration
1. Call `POST /api/iot/devices/register` with `deviceId`, `deviceType`, `projectId`, `publicKey`, `location`.
2. Store returned API secret securely in the device.
3. Device enters pending/offline state until first accepted telemetry.

## Cryptographic Signing
Sign canonical JSON payload (`deviceId,timestamp,readingType,value,unit`) with device key; server verifies signature and marks `signatureValid`.

## Offline Buffering
Use `POST /api/iot/readings/batch` with max 1000 readings.
Replay detection rejects duplicate timestamps in batch and existing DB records.

## Anomaly Detection
Rules include: out-of-range, sudden-spike, flatline, impossible-value, timestamp-drift, replay, invalid-signature.
Critical events should be routed to incident response.

## Supported Devices
- Direct API-capable microcontrollers
- LoRaWAN gateways
- Industrial logger bridges (Campbell/HOBO)
- Particle cloud events
- Blues/SenseCAP adapters
