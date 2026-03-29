# UAIU Device Certification Program

## Overview
Manufacturers submit devices to be validated for secure, reliable UAIU ingestion.

## How to apply
1. `POST /api/devices/certification/apply`
2. Track status with `GET /api/devices/certification/status/:id`
3. Public listing via `GET /api/devices/certifications`

## Test suite
1. Connection and authentication
2. Reading submission accuracy
3. Signature verification
4. Offline buffering and sync
5. Timestamp accuracy
6. Batch upload performance
7. Error handling and recovery

## Badge guidelines
- Compatible: API-level interoperability
- Certified: full automated suite pass
- Premium: certified + extended field-performance validation
