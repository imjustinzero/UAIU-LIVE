import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import PublicPageShell from '@/components/PublicPageShell';

type LedgerEntry = {
  tradeId: string; timestamp: string; creditType: string; registry: string;
  vintage: string; volumeTco2e: number; priceRange: string; framework: string;
};
type LedgerPayload = {
  totals: { trades: number; retiredTco2e: number; totalVolumeEur: number };
  entries: LedgerEntry[];
};

const C = { card: '#0f1623', border: '#1e293b', gold: '#facc15', muted: '#94a3b8', text: '#f2ead8', altRow: '#0b1120' };

function SkeletonRow() {
  return (
    <tr>
      {Array.from({ length: 8 }).map((_, i) => (
        <td key={i} style={{ padding: '10px 12px' }}>
          <div style={{ background: '#1e293b', borderRadius: 4, height: 14, width: i === 0 ? 90 : i === 2 ? 70 : 50, animation: 'pulse 1.5s infinite' }} />
        </td>
      ))}
    </tr>
  );
}

export default function LedgerPage() {
  const [data, setData] = useState<LedgerPayload | null>(null);

  useEffect(() => {
    fetch('/api/public/ledger', { cache: 'no-store' })
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData({ totals: { trades: 0, retiredTco2e: 0, totalVolumeEur: 0 }, entries: [] }));
  }, []);

  const loading = data === null;
  const empty = !loading && data!.entries.length === 0;

  return (
    <PublicPageShell
      title="Public Carbon Credit Trade Ledger | UAIU.LIVE"
      description="Transparent public record of all carbon credit trades settled on UAIU.LIVE/X. Includes registry, vintage, volume, and SHA-256 audit hash."
      path="/ledger"
    >
      <style>{`@keyframes pulse { 0%,100%{opacity:.5} 50%{opacity:1} }`}</style>

      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 'clamp(22px, 4vw, 32px)', color: C.gold, margin: '0 0 8px' }}>
          Public Trade Ledger
        </h1>
        <p data-testid="text-ledger-totals" style={{ color: C.muted, fontSize: 14, margin: 0 }}>
          {loading ? 'Loading…' : `${data!.totals.trades.toLocaleString()} trades · ${data!.totals.retiredTco2e.toLocaleString()} tCO₂e retired · €${data!.totals.totalVolumeEur.toLocaleString()} volume`}
        </p>
      </div>

      {empty ? (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <p style={{ color: C.muted, fontSize: 15, marginBottom: 16 }}>
            No settled trades yet. Trades appear here after escrow settlement.
          </p>
          <Link href="/x" style={{ color: C.gold, fontWeight: 600, textDecoration: 'none', fontSize: 14 }}>
            Trade on UAIU.LIVE/X →
          </Link>
        </div>
      ) : (
        <div style={{ overflowX: 'auto', borderRadius: 8, border: `1px solid ${C.border}` }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: C.card }}>
                {['Trade ID', 'Date', 'Credit Type', 'Registry', 'Vintage', 'Volume', 'Price Range', 'Framework'].map((col) => (
                  <th key={col} style={{ padding: '10px 12px', textAlign: 'left', color: C.gold, fontWeight: 600, whiteSpace: 'nowrap', borderBottom: `1px solid ${C.border}` }}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} />)
                : data!.entries.map((e, idx) => (
                  <tr key={e.tradeId} data-testid={`row-ledger-${e.tradeId}`} style={{ background: idx % 2 === 0 ? C.altRow : C.card, borderBottom: `1px solid ${C.border}` }}>
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace', color: C.text, whiteSpace: 'nowrap' }}>{e.tradeId}</td>
                    <td style={{ padding: '10px 12px', color: C.muted, whiteSpace: 'nowrap' }}>{new Date(e.timestamp).toLocaleDateString()}</td>
                    <td style={{ padding: '10px 12px', color: C.text }}>{e.creditType}</td>
                    <td style={{ padding: '10px 12px', color: C.muted }}>{e.registry}</td>
                    <td style={{ padding: '10px 12px', color: C.muted }}>{e.vintage}</td>
                    <td style={{ padding: '10px 12px', color: C.text, whiteSpace: 'nowrap' }}>{e.volumeTco2e.toLocaleString()} tCO₂e</td>
                    <td style={{ padding: '10px 12px', color: C.muted }}>{e.priceRange}</td>
                    <td style={{ padding: '10px 12px', color: C.muted }}>{e.framework}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </PublicPageShell>
  );
}
