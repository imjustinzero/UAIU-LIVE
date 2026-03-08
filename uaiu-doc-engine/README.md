# UAIU Document Engine

Institutional document generation engine for UAIU.LIVE/X.

## Run

```bash
npm install
npm run db:generate
npm start
```

## API

- `GET /health`
- `POST /api/trigger`
- `GET /api/trades/:tradeId`
- `GET /api/documents/:tradeId`
- `GET /api/verification/:tradeId`
- `POST /api/webhooks/hellosign`
