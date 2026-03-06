export function IncidentBanner({ status, message }: { status: 'ok' | 'degraded' | 'incident'; message: string }) {
  const color = status === 'ok' ? '#22c55e' : status === 'degraded' ? '#eab308' : '#ef4444';
  return (
    <div style={{ border: `1px solid ${color}`, background: 'rgba(255,255,255,0.02)', padding: 12, marginBottom: 16 }}>
      <strong style={{ color }}>{status.toUpperCase()}</strong>
      <div style={{ color: '#e2e8f0', marginTop: 6 }}>{message}</div>
    </div>
  );
}
