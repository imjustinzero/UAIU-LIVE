import { useEffect, useState } from 'react';
import PublicPageShell from '@/components/PublicPageShell';

type Program = { program: string; registry: string; phase1: string; phase2: string; approvedAt: string; notes: string };

const C = { card: '#0f1623', border: '#1e293b', gold: '#facc15', muted: '#94a3b8', text: '#f2ead8' };

function SkeletonCard() {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '16px 20px' }}>
      <style>{`@keyframes pulse { 0%,100%{opacity:.5} 50%{opacity:1} }`}</style>
      {[120, 90, 60].map((w, i) => (
        <div key={i} style={{ background: '#1e293b', borderRadius: 4, height: 13, width: w, marginBottom: 8, animation: 'pulse 1.5s infinite' }} />
      ))}
    </div>
  );
}

function Badge({ children, yes }: { children: string; yes: boolean }) {
  const bg = yes ? '#14532d' : '#450a0a';
  const color = yes ? '#22c55e' : '#f87171';
  return (
    <span style={{ background: bg, color, borderRadius: 4, fontSize: 11, fontWeight: 700, padding: '2px 8px', letterSpacing: '0.04em' }}>
      {children}
    </span>
  );
}

export default function CorsiaPage() {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/public/corsia-programs', { cache: 'no-store' })
      .then((r) => r.json())
      .then((p) => { setPrograms(p.programs || []); setLoading(false); })
      .catch(() => { setPrograms([]); setLoading(false); });
  }, []);

  const filtered = programs.filter((p) => `${p.program} ${p.registry}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <PublicPageShell
      title="CORSIA Eligible Carbon Credits Checker | UAIU.LIVE"
      description="Check which carbon credit programs are approved for CORSIA Phase 1 and Phase 2. Covers all ICAO-approved standards."
      path="/corsia"
    >
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 'clamp(22px, 4vw, 32px)', color: C.gold, margin: '0 0 8px' }}>
          CORSIA Eligibility Checker
        </h1>
        <p style={{ color: C.muted, fontSize: 14, margin: 0 }}>
          ICAO-approved carbon credit programs for aviation emission offsetting under CORSIA Phase 1 and Phase 2.
        </p>
      </div>

      <input
        data-testid="input-corsia-search"
        type="search"
        placeholder="Search by program name, standard, or registry…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        style={{
          width: '100%', maxWidth: 500, display: 'block', marginBottom: 24,
          background: C.card, border: `1px solid ${C.border}`, borderRadius: 6,
          color: C.text, padding: '10px 14px', fontSize: 14,
          outline: 'none', boxSizing: 'border-box',
        }}
      />

      <div style={{ display: 'grid', gap: 12 }}>
        {loading && !q
          ? Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)
          : filtered.map((p) => (
            <div key={p.program} data-testid={`card-corsia-${p.program.replace(/\s+/g, '-').toLowerCase()}`} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '16px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 8 }}>
                <div>
                  <div style={{ color: C.text, fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{p.program}</div>
                  <span style={{ background: '#1e3a5f', color: '#7dd3fc', borderRadius: 4, fontSize: 11, fontWeight: 600, padding: '2px 8px' }}>{p.registry}</span>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ color: C.muted, fontSize: 12 }}>Phase 1:</span>
                  <Badge yes={p.phase1.toLowerCase() === 'yes'}>{p.phase1.toUpperCase()}</Badge>
                  <span style={{ color: C.muted, fontSize: 12 }}>Phase 2:</span>
                  <Badge yes={p.phase2.toLowerCase() === 'yes'}>{p.phase2.toUpperCase()}</Badge>
                </div>
              </div>
              <div style={{ color: C.muted, fontSize: 12 }}>
                Approved: {p.approvedAt} {p.notes ? `· ${p.notes}` : ''}
              </div>
            </div>
          ))}
        {!loading && filtered.length === 0 && q && (
          <p style={{ color: C.muted, fontSize: 14, textAlign: 'center', padding: '30px 0' }}>
            No programs match "{q}". Try a different search.
          </p>
        )}
      </div>
    </PublicPageShell>
  );
}
