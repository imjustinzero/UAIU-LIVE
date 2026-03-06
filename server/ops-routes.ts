import type { Express } from 'express';
import { getOpsState, recordOpsEvent } from './ops-monitoring';
import { requireAdminHeader } from './exchange-auth';

export function registerOpsRoutes(app: Express) {
  app.get('/api/admin/ops/overview', requireAdminHeader, (_req, res) => {
    const ops = getOpsState();
    const latency = Object.entries(ops.routeLatencyMs)
      .map(([route, v]) => ({ route, avgMs: Math.round(v.total / Math.max(v.count, 1)), maxMs: v.max, count: v.count }))
      .sort((a, b) => b.maxMs - a.maxMs)
      .slice(0, 25);
    res.json({
      uptimeSec: ops.uptimeSec,
      process: ops.process,
      counters: ops.counters,
      latency,
      recentEvents: ops.events.slice(0, 50),
    });
  });

  app.post('/api/admin/ops/maintenance-mode', requireAdminHeader, (req, res) => {
    const enabled = !!req.body?.enabled;
    process.env.TRADING_DISABLED = enabled ? '1' : '0';
    recordOpsEvent('maintenance_mode_changed', { enabled });
    res.json({ success: true, enabled });
  });

  app.get('/api/status/public', (_req, res) => {
    const ops = getOpsState();
    res.json({
      status: 'operational',
      updatedAt: new Date().toISOString(),
      uptimeSec: ops.uptimeSec,
      components: [
        { name: 'Exchange API', status: 'operational' },
        { name: 'Trading Auth', status: 'operational' },
        { name: 'Webhooks', status: 'operational' },
        { name: 'AI Services', status: process.env.ANTHROPIC_API_KEY ? 'degraded_possible' : 'unavailable' },
      ],
    });
  });
}
