import { useEffect, useState } from 'react';
import PublicPageShell from '@/components/PublicPageShell';

type Series = {
  name: string; thisWeek: number; lastWeek: number; changePct: number;
  volume: number; trades: number; range: string;
};

const C = { card: '#0f1623', border: '#1e293b', gold: '#facc15', muted: '#94a3b8', text: '#f2ead8' };

function SkeletonCard() {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '20px 24px' }}>
      <style>{`@keyframes pulse { 0%,100%{opacity:.5} 50%{opacity:1} }`}</style>
      {[80, 120, 60].map((w, i) => (
        <div key={i} style={{ background: '#1e293b', borderRadius: 4, height: i === 1 ? 28 : 14, width: w, marginBottom: 10, animation: 'pulse 1.5s infinite' }} />
      ))}
    </div>
  );
}

export default function IndexPage() {
  const [rows, setRows] = useState<Series[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/public/index', { cache: 'no-store' })
      .then((r) => r.json())
      .then((p) => { setRows(p.indices || []); setLoading(false); })
      .catch(() => { setRows([]); setLoading(false); });
  }, []);

  return (
    <PublicPageShell
      title="UAIU Carbon Credit Price Index | UAIU.LIVE"
      description="Weekly institutional carbon credit price index by standard — EU ETS, Verra VCS, Gold Standard, and CORSIA. Updated every Monday 9am EST."
      path="/index"
    >
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 'clamp(22px, 4vw, 32px)', color: C.gold, margin: '0 0 8px' }}>
          UAIU Carbon Price Index
        </h1>
        <p style={{ color: C.muted, fontSize: 14, margin: 0 }}>Updated weekly · Monday 9am EST · Institutional settlement prices</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
        {loading
          ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
          : rows.map((r) => (
            <div key={r.name} data-testid={`card-index-${r.name.replace(/\s+/g, '-').toLowerCase()}`} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '20px 24px' }}>
              <div style={{ color: C.muted, fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{r.name}</div>
              <div style={{ color: C.gold, fontSize: 28, fontWeight: 700, marginBottom: 4 }}>
                €{r.thisWeek.toFixed(2)}
              </div>
              <div style={{ color: r.changePct >= 0 ? '#22c55e' : '#ef4444', fontSize: 14, fontWeight: 600, marginBottom: 10 }}>
                {r.changePct >= 0 ? '+' : ''}{r.changePct.toFixed(1)}% this week
              </div>
              <div style={{ color: C.muted, fontSize: 12, lineHeight: 1.7 }}>
                <div>Trades: {r.trades.toLocaleString()}</div>
                <div>Volume: {r.volume.toLocaleString()} tCO₂e</div>
                <div>Range: {r.range}</div>
              </div>
            </div>
          ))}
      </div>
    </PublicPageShell>
  );
}
