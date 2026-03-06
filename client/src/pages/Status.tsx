import { useEffect, useState } from 'react';

export default function StatusPage() {
  const [data, setData] = useState<any>(null);
  useEffect(() => {
    fetch('/api/status/public').then(r => r.json()).then(setData).catch(() => setData({ status: 'unknown', components: [] }));
  }, []);
  return (
    <main style={{ maxWidth: 960, margin: '0 auto', padding: '48px 20px', color: '#e2e8f0' }}>
      <h1>Platform Status</h1>
      <p>Current status: <strong>{data?.status || 'loading'}</strong></p>
      <div style={{ display: 'grid', gap: 12 }}>
        {(data?.components || []).map((c: any) => (
          <div key={c.name} style={{ border: '1px solid #1e3050', padding: 16, background: '#0d1a2e' }}>
            <div>{c.name}</div>
            <div style={{ color: c.status === 'operational' ? '#22c55e' : '#eab308' }}>{c.status}</div>
          </div>
        ))}
      </div>
    </main>
  );
}
