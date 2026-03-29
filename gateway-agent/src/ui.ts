import express from 'express';
import { bufferDepth } from './buffer';

export function startUi(getState: () => any) {
  const app = express();
  app.use(express.json());

  app.get('/', (_req, res) => {
    const s = getState();
    res.send(`<html><body><h1>UAIU Gateway Agent</h1><p>Status: ${s.connected ? 'Connected' : 'Offline'}</p><p>Readings/min: ${s.rpm}</p><p>Buffer: ${bufferDepth()} readings queued</p></body></html>`);
  });

  app.post('/test', (_req, res) => res.json({ ok: true }));
  app.post('/update', (_req, res) => res.json({ ok: true, message: 'Update scheduled' }));
  app.listen(8080);
}
