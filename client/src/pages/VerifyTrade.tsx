import { useEffect, useState } from "react";
import { useRoute } from "wouter";

type VerifyResponse = {
  verified: true;
  tradeId: string;
  standard: string;
  volumeTonnes: number;
  grossEur: number;
  settledAt: string;
  receiptHash: string;
};

const C = {
  ink: '#060810',
  ink2: '#0d1220',
  gold: '#d4a843',
  goldborder: 'rgba(212,168,67,0.22)',
  cream: '#f2ead8',
  cream3: 'rgba(242,234,216,0.6)',
};

export default function VerifyTrade() {
  const [match, params] = useRoute<{ hash: string }>("/x/verify/:hash");
  const hash = params?.hash || '';
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<VerifyResponse | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!match || !hash) return;
    let mounted = true;
    setLoading(true);
    setError('');
    fetch(`/api/exchange/verify/${encodeURIComponent(hash)}`)
      .then(async (r) => {
        if (!r.ok) throw new Error('not_found');
        return r.json();
      })
      .then((body) => {
        if (!mounted) return;
        setData(body);
      })
      .catch(() => {
        if (!mounted) return;
        setError('Trade not found — contact desk@uaiu.live');
      })
      .finally(() => mounted && setLoading(false));

    return () => {
      mounted = false;
    };
  }, [match, hash]);

  return (
    <div style={{ minHeight: '100vh', background: C.ink, color: C.cream, fontFamily: "'Syne', sans-serif", padding: '80px 20px' }}>
      <div style={{ maxWidth: 820, margin: '0 auto', background: C.ink2, border: `1px solid ${C.goldborder}`, padding: '32px 28px' }}>
        <h1 style={{ margin: '0 0 6px', color: C.gold, fontSize: 28, fontFamily: "'Playfair Display', serif" }}>Public Trade Verification</h1>
        <p style={{ margin: 0, color: C.cream3, fontSize: 13 }}>UAIU.LIVE/X receipt hash verification.</p>

        <div style={{ marginTop: 22, padding: '14px 16px', border: `1px solid ${C.goldborder}`, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, wordBreak: 'break-all', color: C.cream3 }}>
          Hash: {hash || 'n/a'}
        </div>

        {loading && <p style={{ marginTop: 20, color: C.cream3 }}>Verifying receipt…</p>}

        {!loading && error && (
          <div style={{ marginTop: 20, padding: '14px 16px', border: '1px solid rgba(239,68,68,0.4)', color: '#fca5a5', fontSize: 13 }}>
            {error}
          </div>
        )}

        {!loading && data && (
          <div style={{ marginTop: 20, display: 'grid', gap: 10 }}>
            {[
              ['Trade ID', data.tradeId],
              ['Standard', data.standard],
              ['Volume', `${Number(data.volumeTonnes || 0).toLocaleString()} tonnes`],
              ['Gross Amount', `€${Number(data.grossEur || 0).toLocaleString()}`],
              ['Settled At', data.settledAt ? new Date(data.settledAt).toISOString() : 'n/a'],
              ['Receipt Hash', data.receiptHash],
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 12, borderBottom: `1px solid ${C.goldborder}`, paddingBottom: 8 }}>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.cream3 }}>{k}</div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, wordBreak: 'break-word' }}>{v}</div>
              </div>
            ))}
            <div style={{ marginTop: 6, color: '#4ade80', fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>✓ Verified</div>
          </div>
        )}
      </div>
    </div>
  );
}
