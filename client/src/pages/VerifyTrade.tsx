import { useEffect, useMemo, useState } from "react";
import { useRoute } from "wouter";
import { useSEO } from "@/lib/seo";

type VerifyResponse = {
  verified: boolean;
  tradeId: string;
  creditType: string;
  vintageYear: number | null;
  registry: string;
  registryReference: string;
  quantity: number;
  pricePerTonne: number;
  totalValue: number;
  buyer: string;
  sellerName: string;
  settlementDate: string;
  receiptHash: string;
  verifyOnRegistryUrl?: string | null;
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
  const [matchX, paramsX] = useRoute<{ hash: string }>("/x/verify/:hash");
  const [matchRoot, paramsRoot] = useRoute<{ hash: string }>("/verify/:hash");
  const hash = paramsX?.hash || paramsRoot?.hash || '';
  const match = matchX || matchRoot;
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<VerifyResponse | null>(null);
  const [error, setError] = useState('');

  const ogDescription = useMemo(() => {
    if (!data) return 'Public verification record for a settled UAIU carbon trade.';
    return `${data.tradeId} · ${data.creditType} · ${data.quantity.toLocaleString()} tCO₂e · €${data.totalValue.toLocaleString()}`;
  }, [data]);

  useSEO({
    title: 'Verified Carbon Trade — UAIU.LIVE/X',
    description: ogDescription,
    path: `/verify/${encodeURIComponent(hash || 'trade')}`,
    ogType: 'article',
  });

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
      .then((body: VerifyResponse) => {
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

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // no-op
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: C.ink, color: C.cream, fontFamily: "'Syne', sans-serif", padding: '80px 20px' }}>
      <div style={{ maxWidth: 860, margin: '0 auto', background: C.ink2, border: `1px solid ${C.goldborder}`, padding: '32px 28px' }}>
        <h1 style={{ margin: '0 0 6px', color: C.gold, fontSize: 28, fontFamily: "'Playfair Display', serif" }}>Public Trade Verification</h1>
        <p style={{ margin: 0, color: C.cream3, fontSize: 13 }}>UAIU.LIVE/X public settlement receipt verification.</p>

        {loading && <p style={{ marginTop: 20, color: C.cream3 }}>Verifying receipt…</p>}

        {!loading && error && (
          <div style={{ marginTop: 20, padding: '14px 16px', border: '1px solid rgba(239,68,68,0.4)', color: '#fca5a5', fontSize: 13 }}>
            {error}
          </div>
        )}

        {!loading && data && (
          <div style={{ marginTop: 20, display: 'grid', gap: 10 }}>
            {[
              ['Trade ID', data.tradeId, true],
              ['Credit Type', data.creditType],
              ['Vintage Year', data.vintageYear ? String(data.vintageYear) : 'N/A'],
              ['Registry', data.registry],
              ['Registry Reference', data.registryReference],
              ['Quantity', `${Number(data.quantity || 0).toLocaleString()} tonnes`],
              ['Price per Tonne', `€${Number(data.pricePerTonne || 0).toLocaleString()}`],
              ['Total Value', `€${Number(data.totalValue || 0).toLocaleString()}`],
              ['Buyer', data.buyer],
              ['Seller', data.sellerName],
              ['Settlement Date', data.settlementDate ? new Date(data.settlementDate).toISOString() : 'n/a'],
              ['SHA-256 Receipt Hash', data.receiptHash, true],
            ].map(([k, v, canCopy]) => (
              <div key={String(k)} style={{ display: 'grid', gridTemplateColumns: '200px 1fr auto', gap: 12, borderBottom: `1px solid ${C.goldborder}`, paddingBottom: 8, alignItems: 'center' }}>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.cream3 }}>{k}</div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, wordBreak: 'break-word' }}>{v}</div>
                {canCopy ? (
                  <button onClick={() => copy(String(v))} style={{ border: `1px solid ${C.goldborder}`, background: 'transparent', color: C.gold, fontSize: 10, padding: '4px 8px', cursor: 'pointer' }}>
                    Copy
                  </button>
                ) : <div />}
              </div>
            ))}

            {data.verifyOnRegistryUrl && (
              <a href={data.verifyOnRegistryUrl} target="_blank" rel="noreferrer" style={{ color: C.gold, fontFamily: "'JetBrains Mono', monospace", fontSize: 12, marginTop: 6 }}>
                Verify on Registry →
              </a>
            )}
            <div style={{ marginTop: 6, color: '#4ade80', fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>✓ Verified</div>
          </div>
        )}
      </div>
    </div>
  );
}
