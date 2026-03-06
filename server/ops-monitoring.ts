import type { Request, Response, NextFunction } from 'express';
import os from 'os';

type CounterMap = Record<string, number>;
type TimedEvent = { at: string; kind: string; detail?: any };

type OpsState = {
  startedAt: string;
  counters: CounterMap;
  routeLatencyMs: Record<string, { count: number; total: number; max: number }>;
  events: TimedEvent[];
  restarts: number;
};

const state: OpsState = {
  startedAt: new Date().toISOString(),
  counters: {},
  routeLatencyMs: {},
  events: [],
  restarts: 1,
};

function inc(key: string, by = 1) {
  state.counters[key] = (state.counters[key] || 0) + by;
}

export function recordOpsEvent(kind: string, detail?: any) {
  state.events.unshift({ at: new Date().toISOString(), kind, detail });
  if (state.events.length > 300) state.events.length = 300;
  inc(`event:${kind}`);
}

export function getOpsState() {
  const uptimeSec = Math.floor(process.uptime());
  return {
    ...state,
    uptimeSec,
    process: {
      pid: process.pid,
      rssMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
      heapUsedMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      node: process.version,
      hostname: os.hostname(),
      loadavg: os.loadavg(),
      cpuCount: os.cpus().length,
    },
  };
}

export function createOpsMonitoringMiddleware() {
  return function opsMonitoring(req: Request, res: Response, next: NextFunction) {
    const started = Date.now();
    res.on('finish', () => {
      const ms = Date.now() - started;
      const key = `${req.method} ${req.path}`;
      const cur = state.routeLatencyMs[key] || { count: 0, total: 0, max: 0 };
      cur.count += 1;
      cur.total += ms;
      cur.max = Math.max(cur.max, ms);
      state.routeLatencyMs[key] = cur;

      if (res.statusCode >= 500) {
        inc('server_errors');
        recordOpsEvent('server_error', { route: key, statusCode: res.statusCode, ms });
      }
      if (ms > 1500) {
        inc('slow_routes');
        recordOpsEvent('slow_route', { route: key, statusCode: res.statusCode, ms });
      }
      if (req.path.includes('/webhook') && res.statusCode >= 400) {
        inc('failed_webhooks');
      }
      if (req.path.includes('/signin') && (res.statusCode === 401 || res.statusCode === 429)) {
        inc('failed_signins');
      }
    });
    next();
  };
}
