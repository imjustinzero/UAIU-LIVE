import { useEffect, useState } from 'react';

type StatusComponent = {
  name: string;
  status: string;
};

type PublicStatus = {
  status: string;
  message?: string;
  components: StatusComponent[];
};

export default function StatusPage() {
  const [data, setData] = useState<PublicStatus | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    fetch('/api/status/public', { signal: controller.signal, cache: 'no-store' })
      .then((r) => r.json())
      .then((payload: PublicStatus) => setData(payload))
      .catch(() => {
        if (!controller.signal.aborted) {
          setData({ status: 'unknown', components: [] });
        }
      });

    return () => controller.abort();
  }, []);

  return (
    <main style={{ maxWidth: 960, margin: '0 auto', padding: '48px 20px', color: '#e2e8f0' }}>
      <h1>Platform Status</h1>
      <p>Current status: <strong>{data?.status || 'loading'}</strong></p>
      <div style={{ display: 'grid', gap: 12 }}>
        {(data?.components || []).map((c) => (
          <div key={c.name} style={{ border: '1px solid #1e3050', padding: 16, background: '#0d1a2e' }}>
            <div>{c.name}</div>
            <div style={{ color: c.status === 'operational' ? '#22c55e' : '#eab308' }}>{c.status}</div>
          </div>
        ))}
      </div>
    </main>
  );
}
