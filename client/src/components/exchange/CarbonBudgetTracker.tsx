import { useState } from "react";

const C = {
  ink: '#060810', ink2: '#0d1220', ink3: '#141e30',
  gold: '#d4a843', goldfaint: 'rgba(212,168,67,0.10)',
  goldborder: 'rgba(212,168,67,0.22)',
  cream: '#f2ead8', cream2: 'rgba(242,234,216,0.7)',
  cream3: 'rgba(242,234,216,0.35)', cream4: 'rgba(242,234,216,0.12)',
  green: '#22c55e', red: '#ef4444', amber: '#f59e0b', blue: '#60a5fa',
};
const F = {
  mono: "'JetBrains Mono', monospace",
  syne: "'Syne', sans-serif",
  playfair: "'Playfair Display', serif",
};

interface BudgetTrade { id: string; date: string; tonnes: number; price_eur: number; standard: string; }
interface Listing { id: string; name: string; standard: string; price: number; available_tonnes: number; }
interface CarbonBudgetTrackerProps {
  trades?: BudgetTrade[];
  listings?: Listing[];
  isDark?: boolean;
  onBuyListing?: (listing: Listing) => void;
}

const MOCK_LISTINGS: Listing[] = [
  { id:'l1', name:'SwissX B100 Caribbean Biofuel', standard:'CORSIA', price:64.20, available_tonnes:500000 },
  { id:'l2', name:'Tonga Coral Restoration', standard:'VCS', price:71.50, available_tonnes:280000 },
  { id:'l3', name:'Roatan REDD++ Forest', standard:'VCS REDD++', price:58.80, available_tonnes:180000 },
  { id:'l4', name:'Tuskegee Regenerative City', standard:'ACR', price:62.40, available_tonnes:40000 },
];

const MOCK_TRADES: BudgetTrade[] = [
  { id:'t1', date:'2026-01-15', tonnes:5000, price_eur:62.80, standard:'VCS' },
  { id:'t2', date:'2026-02-03', tonnes:8000, price_eur:63.40, standard:'CORSIA' },
  { id:'t3', date:'2026-02-28', tonnes:3200, price_eur:64.10, standard:'VCS' },
];

export function CarbonBudgetTracker({
  trades = MOCK_TRADES,
  listings = MOCK_LISTINGS,
  isDark = true,
  onBuyListing,
}: CarbonBudgetTrackerProps) {
  const [annualBudgetEur, setAnnualBudgetEur] = useState(500000);
  const [annualTargetTonnes, setAnnualTargetTonnes] = useState(20000);
  const [editing, setEditing] = useState(false);
  const [budgetInput, setBudgetInput] = useState('500000');
  const [tonnesInput, setTonnesInput] = useState('20000');

  const spentEur = trades.reduce((s, t) => s + (t.tonnes * t.price_eur), 0);
  const boughtTonnes = trades.reduce((s, t) => s + t.tonnes, 0);
  const remainingBudgetEur = annualBudgetEur - spentEur;
  const remainingTonnes = annualTargetTonnes - boughtTonnes;
  const budgetPct = Math.min(100, Math.round((spentEur / annualBudgetEur) * 100));
  const tonnesPct = Math.min(100, Math.round((boughtTonnes / annualTargetTonnes) * 100));

  const alertLevel = budgetPct >= 90 ? 'critical' : budgetPct >= 75 ? 'warning' : budgetPct >= 50 ? 'info' : 'safe';
  const alertColor = alertLevel === 'critical' ? C.red : alertLevel === 'warning' ? C.gold : alertLevel === 'info' ? C.blue : C.green;
  const alertLabel = alertLevel === 'critical' ? 'CRITICAL — Budget nearly exhausted' : alertLevel === 'warning' ? 'WARNING — 75% of budget consumed' : 'INFO — Budget halfway mark reached';

  const suggestions = [...listings]
    .filter(l => l.price * 100 <= remainingBudgetEur && l.available_tonnes > 0)
    .sort((a, b) => a.price - b.price)
    .slice(0, 3)
    .map(l => ({
      ...l,
      affordable_tonnes: Math.floor(remainingBudgetEur / l.price),
      covers_remaining: Math.floor(remainingBudgetEur / l.price) >= remainingTonnes,
    }));

  const fi: React.CSSProperties = {
    width: '100%', background: C.ink3, border: `1px solid ${C.goldborder}`,
    color: C.cream, padding: '12px 14px', fontFamily: F.mono, fontSize: 13,
    outline: 'none', boxSizing: 'border-box',
  };

  return (
    <div style={{ background: C.ink2, maxWidth: 1440, margin: '0 auto', padding: 'clamp(60px,7vw,100px) clamp(24px,5vw,80px)' }}>

      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 48, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: '0.25em', textTransform: 'uppercase', color: C.gold, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ width: 24, height: 1, background: C.gold, display: 'inline-block' }} />
            Budget Management
          </div>
          <h2 style={{ fontFamily: F.playfair, fontSize: 'clamp(28px,4vw,44px)', fontWeight: 900, color: C.cream, margin: 0, letterSpacing: '-0.02em' }}>
            Carbon Budget<br /><em style={{ color: C.gold, fontStyle: 'italic' }}>Tracker.</em>
          </h2>
        </div>
        <button
          onClick={() => setEditing(!editing)}
          style={{ padding: '12px 24px', background: 'transparent', border: `1px solid ${C.goldborder}`, color: C.gold, fontFamily: F.mono, fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', cursor: 'pointer' }}
          data-testid="button-edit-budget"
        >
          {editing ? 'Save Budget' : 'Edit Budget'}
        </button>
      </div>

      {/* EDIT BUDGET PANEL */}
      {editing && (
        <div style={{ background: C.ink, border: `1px solid ${C.goldborder}`, padding: '28px 32px', marginBottom: 28, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          <div>
            <label style={{ display: 'block', marginBottom: 8, fontFamily: F.mono, fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', color: C.cream3 }}>Annual Budget (EUR)</label>
            <input type="number" value={budgetInput}
              onChange={e => setBudgetInput(e.target.value)}
              onBlur={() => { setAnnualBudgetEur(parseInt(budgetInput) || 500000); setEditing(false); }}
              style={fi} data-testid="input-annual-budget" />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 8, fontFamily: F.mono, fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', color: C.cream3 }}>Annual Target (Tonnes CO₂)</label>
            <input type="number" value={tonnesInput}
              onChange={e => setTonnesInput(e.target.value)}
              onBlur={() => { setAnnualTargetTonnes(parseInt(tonnesInput) || 20000); setEditing(false); }}
              style={fi} data-testid="input-annual-tonnes" />
          </div>
        </div>
      )}

      {/* ALERT BANNER */}
      {alertLevel !== 'safe' && (
        <div style={{ background: `${alertColor}11`, border: `1px solid ${alertColor}44`, padding: '16px 24px', marginBottom: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
          <div>
            <div style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: '0.12em', fontWeight: 700, color: alertColor, marginBottom: 4 }}>{alertLabel}</div>
            <div style={{ fontFamily: F.mono, fontSize: 11, color: C.cream3 }}>€{Math.round(remainingBudgetEur).toLocaleString()} remaining · {remainingTonnes.toLocaleString()} tonnes still needed</div>
          </div>
          <div style={{ fontFamily: F.mono, fontSize: 22, fontWeight: 900, color: alertColor }}>{budgetPct}%</div>
        </div>
      )}

      {/* STATS GRID */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 1, background: C.goldborder, border: `1px solid ${C.goldborder}`, marginBottom: 32 }}>
        {[
          { label: 'Annual Budget', val: `€${annualBudgetEur.toLocaleString()}`, sub: 'allocated', color: C.gold },
          { label: 'Spent to Date', val: `€${Math.round(spentEur).toLocaleString()}`, sub: `${budgetPct}% used`, color: alertColor },
          { label: 'Remaining', val: `€${Math.round(remainingBudgetEur).toLocaleString()}`, sub: 'available', color: C.green },
          { label: 'Tonnes Bought', val: boughtTonnes.toLocaleString(), sub: `of ${annualTargetTonnes.toLocaleString()} t target`, color: C.cream },
          { label: 'Still Needed', val: remainingTonnes > 0 ? remainingTonnes.toLocaleString() : '—', sub: 'tonnes', color: tonnesPct >= 90 ? C.red : C.cream2 },
          { label: 'Avg Price Paid', val: trades.length ? `€${(spentEur / boughtTonnes).toFixed(2)}` : '—', sub: 'per tonne CO₂', color: C.blue },
        ].map((stat, i) => (
          <div key={i} style={{ background: C.ink2, padding: '24px 20px', textAlign: 'center' }}>
            <div style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', color: C.cream3, marginBottom: 10 }}>{stat.label}</div>
            <div style={{ fontFamily: F.playfair, fontSize: 24, fontWeight: 900, color: stat.color, lineHeight: 1, marginBottom: 6 }}>{stat.val}</div>
            <div style={{ fontFamily: F.mono, fontSize: 10, color: C.cream4 }}>{stat.sub}</div>
          </div>
        ))}
      </div>

      {/* PROGRESS BARS */}
      <div style={{ background: C.ink, border: `1px solid ${C.goldborder}`, padding: '32px 36px', marginBottom: 28 }}>
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', color: C.cream3 }}>Budget Utilization</div>
            <div style={{ fontFamily: F.mono, fontSize: 12, color: C.cream }}>€{Math.round(spentEur).toLocaleString()} / €{annualBudgetEur.toLocaleString()}</div>
          </div>
          <div style={{ height: 8, background: C.ink3, position: 'relative' }}>
            <div style={{ position: 'absolute', inset: 0, width: `${budgetPct}%`, background: alertColor, transition: 'width 0.8s ease' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
            {[0, 25, 50, 75, 100].map(m => (
              <div key={m} style={{ fontFamily: F.mono, fontSize: 9, color: C.cream4 }}>{m}%</div>
            ))}
          </div>
        </div>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', color: C.cream3 }}>Tonnage Progress</div>
            <div style={{ fontFamily: F.mono, fontSize: 12, color: C.cream }}>{boughtTonnes.toLocaleString()} / {annualTargetTonnes.toLocaleString()} t</div>
          </div>
          <div style={{ height: 8, background: C.ink3, position: 'relative' }}>
            <div style={{ position: 'absolute', inset: 0, width: `${tonnesPct}%`, background: C.green, transition: 'width 0.8s ease' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
            {[0, 25, 50, 75, 100].map(m => (
              <div key={m} style={{ fontFamily: F.mono, fontSize: 9, color: C.cream4 }}>{m}%</div>
            ))}
          </div>
        </div>
      </div>

      {/* TRADE HISTORY */}
      {trades.length > 0 && (
        <div style={{ background: C.ink, border: `1px solid ${C.goldborder}`, marginBottom: 28 }}>
          <div style={{ padding: '20px 24px', borderBottom: `1px solid ${C.goldborder}` }}>
            <div style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', color: C.gold }}>Trade History — {trades.length} transaction{trades.length !== 1 ? 's' : ''}</div>
          </div>
          {trades.map((t, i) => (
            <div key={t.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 16, padding: '16px 24px', borderBottom: i < trades.length - 1 ? `1px solid ${C.goldborder}` : 'none', alignItems: 'center' }}>
              <div>
                <div style={{ fontFamily: F.mono, fontSize: 9, color: C.cream3, marginBottom: 4 }}>Standard</div>
                <div style={{ fontFamily: F.syne, fontSize: 13, color: C.cream }}>{t.standard}</div>
              </div>
              <div>
                <div style={{ fontFamily: F.mono, fontSize: 9, color: C.cream3, marginBottom: 4 }}>Date</div>
                <div style={{ fontFamily: F.mono, fontSize: 11, color: C.cream2 }}>{t.date}</div>
              </div>
              <div>
                <div style={{ fontFamily: F.mono, fontSize: 9, color: C.cream3, marginBottom: 4 }}>Tonnes</div>
                <div style={{ fontFamily: F.syne, fontSize: 13, fontWeight: 700, color: C.green }}>{t.tonnes.toLocaleString()} t</div>
              </div>
              <div>
                <div style={{ fontFamily: F.mono, fontSize: 9, color: C.cream3, marginBottom: 4 }}>Cost</div>
                <div style={{ fontFamily: F.syne, fontSize: 13, fontWeight: 700, color: C.cream }}>€{Math.round(t.tonnes * t.price_eur).toLocaleString()}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* AI SUGGESTIONS */}
      {remainingTonnes > 0 && suggestions.length > 0 && (
        <div style={{ background: C.ink, border: `1px solid ${C.goldborder}` }}>
          <div style={{ padding: '20px 24px', borderBottom: `1px solid ${C.goldborder}` }}>
            <div style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', color: C.gold }}>Recommended Credits — Cheapest within remaining budget</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 1, background: C.goldborder }}>
            {suggestions.map((s, i) => (
              <div key={i} style={{ background: s.covers_remaining ? `${C.green}08` : C.ink2, padding: '24px' }}>
                {s.covers_remaining && (
                  <div style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.green, marginBottom: 10 }}>Covers Full Remaining Liability</div>
                )}
                <div style={{ fontFamily: F.playfair, fontSize: 16, fontWeight: 700, color: C.cream, marginBottom: 4, lineHeight: 1.3 }}>{s.name}</div>
                <div style={{ fontFamily: F.mono, fontSize: 10, color: C.cream3, marginBottom: 16 }}>{s.standard} · €{s.price.toFixed(2)}/t · {s.affordable_tonnes.toLocaleString()}t affordable</div>
                <button
                  onClick={() => onBuyListing?.(s)}
                  style={{ width: '100%', padding: '12px 0', background: i === 0 ? C.gold : 'transparent', border: `1px solid ${i === 0 ? C.gold : C.goldborder}`, color: i === 0 ? C.ink : C.gold, fontFamily: F.mono, fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 700, cursor: 'pointer' }}
                  data-testid={`button-buy-suggestion-${i}`}
                >
                  Buy {Math.min(s.affordable_tonnes, remainingTonnes).toLocaleString()} tonnes
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
