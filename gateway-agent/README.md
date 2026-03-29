# UAIU Gateway Agent

Bridge app for local devices (Modbus, local MQTT, LoggerNet, HOBO USB) to UAIU Cloud.

## Features
- Local discovery
- Protocol adapters
- Signed readings
- Offline SQLite buffering
- Local UI at `http://localhost:8080`
- Batch uploads with retry and backoff
- Auto-update check against GitHub releases

Packaging targets: Windows `.exe`, macOS `.dmg`, Linux `.deb/.AppImage`, Docker image, Raspberry Pi ARM `.deb`.
