# UAIU SDK Reference

## JavaScript SDK (`@uaiu/sdk`)
- `new UAIUClient({ endpoint, apiKey, privateKey? })`
- `registerDevice(payload)`
- `submitReading(reading)`
- `batchSubmit(readings)`

## Python SDK (`uaiu-sdk`)
- API parity with JS SDK.
- Includes lightweight MicroPython-compatible client.

## Arduino library
- `UAIUClient` for ESP32, Arduino MKR, and Particle-class devices.
- Handles connectivity, signing, and reading uploads.

## MicroPython module
- Lightweight (<50KB target)
- Auto-reconnect and flash-based offline buffering.

## Common examples
- Device registration
- Single reading submit
- Batch submit with retry
- Signing with private keys
