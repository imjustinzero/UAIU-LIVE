import { useEffect, useMemo, useState } from 'react';

type Props = { adminKey: string; isDark?: boolean };

const C = {
  bg: '#05080f',
  surface: '#0d1a2e',
  border: '#1e3050',
  gold: '#d4a843',
  red: '#ef4444',
  green: '#22c55e',
  muted: '#94a3b8',
  text: '#e2e8f0',
};

export function EnterpriseOpsDashboard({ adminKey }: Props) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/ops/overview', { headers: { 'X-Admin-Key': adminKey } });
      if (!res.ok) throw new Error('Failed to load ops overview');
      setData(await res.json());
    } catch (e: any) {
      setError(e.message || 'Load failed');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { if (adminKey) load(); }, [adminKey]);

  const cards = useMemo(() => {
    if (!data) return [];
    return [
      ['Uptime', `${Math.floor((data.uptimeSec || 0) / 3600)}h`],
      ['RSS Memory', `${data.process?.rssMb || 0} MB`],
      ['Server Errors', `${data.counters?.server_errors || 0}`],
      ['Slow Routes', `${data.counters?.slow_routes || 0}`],
      ['Failed Webhooks', `${data.counters?.failed_webhooks || 0}`],
      ['Failed Signins', `${data.counters?.failed_signins || 0}`],
    ];
  }, [data]);

  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ color: C.gold, margin: 0 }}>Enterprise Ops Dashboard</h2>
        <button onClick={load} style={{ background: 'transparent', border: `1px solid ${C.border}`, color: C.text, padding: '8px 12px', cursor: 'pointer' }}>Refresh</button>
      </div>
      {error && <div style={{ color: C.red, marginBottom: 12 }}>{error}</div>}
      {loading && <div style={{ color: C.muted, marginBottom: 12 }}>Loading ops overview…</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12, marginBottom: 20 }}>
        {cards.map(([label, value]) => (
          <div key={label} style={{ background: C.surface, border: `1px solid ${C.border}`, padding: 16 }}>
            <div style={{ color: C.muted, fontSize: 12, marginBottom: 6 }}>{label}</div>
            <div style={{ color: C.text, fontSize: 22, fontWeight: 700 }}>{value}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16 }}>
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, padding: 16 }}>
          <div style={{ color: C.gold, fontWeight: 700, marginBottom: 12 }}>Slowest / busiest routes</div>
          <div style={{ display: 'grid', gap: 8 }}>
            {(data?.latency || []).slice(0, 12).map((row: any) => (
              <div key={row.route} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 8, color: C.text, fontSize: 13 }}>
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.route}</div>
                <div style={{ color: C.muted }}>avg {row.avgMs}ms</div>
                <div style={{ color: row.maxMs > 1500 ? C.red : C.green }}>max {row.maxMs}ms</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, padding: 16 }}>
          <div style={{ color: C.gold, fontWeight: 700, marginBottom: 12 }}>Recent events</div>
          <div style={{ display: 'grid', gap: 8 }}>
            {(data?.recentEvents || []).slice(0, 10).map((row: any, i: number) => (
              <div key={i} style={{ borderBottom: `1px solid ${C.border}`, paddingBottom: 8 }}>
                <div style={{ color: C.text, fontSize: 13 }}>{row.kind}</div>
                <div style={{ color: C.muted, fontSize: 11 }}>{new Date(row.at).toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
