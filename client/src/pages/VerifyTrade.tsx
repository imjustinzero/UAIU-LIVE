import { useEffect, useState } from "react";
import { useParams } from "wouter";

const C = {
  ink: '#060810',
  ink2: '#0d1220',
  gold: '#d4a843',
  goldborder: 'rgba(212,168,67,0.22)',
  cream: '#f2ead8',
  cream3: 'rgba(242,234,216,0.35)',
  green: '#22c55e',
};

interface TradeVerification {
  verified: boolean;
  tradeId: string;
  standard: string;
  volumeTonnes: number;
  grossEur: number;
  settledAt: string;
  receiptHash: string;
}

export default function VerifyTrade() {
  const params = useParams<{ hash: string }>();
  const hash = params.hash || '';
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<TradeVerification | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!hash) { setError('No receipt hash provided.'); setLoading(false); return; }
    fetch(`/api/exchange/verify/${encodeURIComponent(hash)}`)
      .then(r => r.ok ? r.json() : r.json().then((e: any) => Promise.reject(e.error || 'Trade not found')))
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(typeof e === 'string' ? e : 'Trade not found — contact desk@uaiu.live'); setLoading(false); });
  }, [hash]);

  return (
    <div style={{ minHeight: '100vh', background: C.ink, color: C.cream, fontFamily: "'Syne', sans-serif", padding: '80px 20px' }}>
      <div style={{ maxWidth: 820, margin: '0 auto', background: C.ink2, border: `1px solid ${C.goldborder}`, padding: '32px 28px' }}>
        <h1 style={{ margin: '0 0 6px', color: C.gold, fontSize: 28, fontFamily: "'Playfair Display', serif" }}>Public Trade Verification</h1>
        <p style={{ margin: '0 0 24px', color: C.cream3, fontSize: 13, fontFamily: "'JetBrains Mono', monospace" }}>UAIU.LIVE/X receipt hash verification</p>

        <div style={{ padding: '14px 16px', border: `1px solid ${C.goldborder}`, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, wordBreak: 'break-all', color: C.cream3, marginBottom: 20 }}>
          Hash: {hash || 'n/a'}
        </div>

        {loading && (
          <p style={{ color: C.cream3, fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>Verifying receipt…</p>
        )}

        {!loading && error && (
          <div style={{ padding: '14px 16px', border: '1px solid rgba(239,68,68,0.4)', color: '#fca5a5', fontSize: 13, fontFamily: "'JetBrains Mono', monospace" }}>
            {error}
          </div>
        )}

        {!loading && data && (
          <div style={{ display: 'grid', gap: 10 }}>
            {([
              ['Trade ID', data.tradeId],
              ['Standard', data.standard],
              ['Volume', `${Number(data.volumeTonnes || 0).toLocaleString()} tonnes`],
              ['Gross Amount', `€${Number(data.grossEur || 0).toLocaleString()}`],
              ['Settled At', data.settledAt ? new Date(data.settledAt).toISOString() : 'n/a'],
              ['Receipt Hash', data.receiptHash],
            ] as [string, string][]).map(([k, v]) => (
              <div key={k} style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 12, borderBottom: `1px solid ${C.goldborder}`, paddingBottom: 8 }}>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.cream3 }}>{k}</div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, wordBreak: 'break-word' }}>{v}</div>
              </div>
            ))}
            <div style={{ marginTop: 8, color: C.green, fontFamily: "'JetBrains Mono', monospace", fontSize: 13, letterSpacing: '0.1em' }}>
              VERIFIED
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
