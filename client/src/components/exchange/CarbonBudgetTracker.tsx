import { useState, useEffect } from "react";

// ── CARBON BUDGET TRACKER ─────────────────────────────────
// Corporate buyer sets annual carbon budget
// Tracks spend vs budget in real time
// Alerts when approaching limit
// Auto-suggests cheapest credits to cover remaining liability

interface BudgetTrade {
  id: string;
  date: string;
  tonnes: number;
  price_eur: number;
  standard: string;
}

interface Listing {
  id: string;
  name: string;
  standard: string;
  price: number;
  available_tonnes: number;
}

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
  { id:'l5', name:'East Delta Dena Zone', standard:'CAR', price:65.00, available_tonnes:25000 },
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
  onBuyListing
}: CarbonBudgetTrackerProps) {
  const [annualBudgetEur, setAnnualBudgetEur] = useState(500000);
  const [annualTargetTonnes, setAnnualTargetTonnes] = useState(20000);
  const [editing, setEditing] = useState(false);
  const [budgetInput, setBudgetInput] = useState('500000');
  const [tonnesInput, setTonnesInput] = useState('20000');
  const [alertDismissed, setAlertDismissed] = useState(false);

  const spentEur = trades.reduce((s, t) => s + (t.tonnes * t.price_eur), 0);
  const boughtTonnes = trades.reduce((s, t) => s + t.tonnes, 0);
  const remainingBudgetEur = annualBudgetEur - spentEur;
  const remainingTonnes = annualTargetTonnes - boughtTonnes;
  const budgetPct = Math.min(100, Math.round((spentEur / annualBudgetEur) * 100));
  const tonnesPct = Math.min(100, Math.round((boughtTonnes / annualTargetTonnes) * 100));

  const alertLevel = budgetPct >= 90 ? 'critical' : budgetPct >= 75 ? 'warning' : budgetPct >= 50 ? 'info' : 'safe';
  const alertColors = {
    critical: '#f87171', warning: '#D4A843', info: '#60a5fa', safe: '#4ade80'
  };
  const alertColor = alertColors[alertLevel];

  // Cheapest credits that fit remaining budget
  const suggestions = [...listings]
    .filter(l => l.price * 100 <= remainingBudgetEur && l.available_tonnes > 0)
    .sort((a, b) => a.price - b.price)
    .slice(0, 3)
    .map(l => ({
      ...l,
      affordable_tonnes: Math.floor(remainingBudgetEur / l.price),
      covers_remaining: Math.floor(remainingBudgetEur / l.price) >= remainingTonnes
    }));

  const GOLD = '#D4A843';
  const bg = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.04)';
  const cardBorder = '1px solid rgba(212,168,67,0.15)';

  return (
    <div style={{
      padding: 'clamp(60px,8vw,100px) clamp(20px,5vw,80px)',
      background: isDark ? '#08080f' : '#f0f4f8'
    }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end',
          marginBottom:'40px', flexWrap:'wrap', gap:'12px' }}>
          <div>
            <p style={{ margin:'0 0 8px', fontSize:'11px', fontWeight:700,
              letterSpacing:'0.15em', textTransform:'uppercase', color:GOLD }}>
              ◈ BUDGET MANAGEMENT
            </p>
            <h2 style={{ margin:0, fontSize:'clamp(24px,4vw,36px)', fontWeight:800,
              color: isDark?'#ffffff':'#0d1b3e', letterSpacing:'-0.02em' }}>
              Carbon Budget Tracker.
            </h2>
          </div>
          <button onClick={() => setEditing(!editing)} style={{
            padding:'8px 18px', borderRadius:'8px',
            border:`1px solid ${GOLD}44`, background:'transparent',
            color:GOLD, fontSize:'12px', fontWeight:600, cursor:'pointer'
          }}>
            {editing ? '✓ Save' : '⚙ Edit Budget'}
          </button>
        </div>

        {/* EDIT BUDGET */}
        {editing && (
          <div style={{
            background: bg, border: cardBorder, borderRadius:'12px',
            padding:'24px', marginBottom:'24px',
            display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px'
          }}>
            <div>
              <label style={{ display:'block', marginBottom:'6px', fontSize:'11px',
                fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase',
                color:'rgba(212,168,67,0.6)' }}>Annual Budget (EUR)</label>
              <input type="number" value={budgetInput}
                onChange={e => setBudgetInput(e.target.value)}
                onBlur={() => { setAnnualBudgetEur(parseInt(budgetInput)||500000); setEditing(false); }}
                style={{ width:'100%', padding:'10px 14px', borderRadius:'8px',
                  border:'1px solid rgba(212,168,67,0.2)',
                  background: isDark?'rgba(0,0,0,0.3)':'rgba(255,255,255,0.8)',
                  color: isDark?'#ffffff':'#0d1b3e', fontSize:'16px',
                  fontFamily:'JetBrains Mono,monospace', boxSizing:'border-box' }} />
            </div>
            <div>
              <label style={{ display:'block', marginBottom:'6px', fontSize:'11px',
                fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase',
                color:'rgba(212,168,67,0.6)' }}>Annual Target (Tonnes)</label>
              <input type="number" value={tonnesInput}
                onChange={e => setTonnesInput(e.target.value)}
                onBlur={() => { setAnnualTargetTonnes(parseInt(tonnesInput)||20000); setEditing(false); }}
                style={{ width:'100%', padding:'10px 14px', borderRadius:'8px',
                  border:'1px solid rgba(212,168,67,0.2)',
                  background: isDark?'rgba(0,0,0,0.3)':'rgba(255,255,255,0.8)',
                  color: isDark?'#ffffff':'#0d1b3e', fontSize:'16px',
                  fontFamily:'JetBrains Mono,monospace', boxSizing:'border-box' }} />
            </div>
          </div>
        )}

        {/* ALERT BANNER */}
        {alertLevel !== 'safe' && !alertDismissed && (
          <div style={{
            background: `${alertColor}11`,
            border: `1px solid ${alertColor}44`,
            borderLeft: `4px solid ${alertColor}`,
            borderRadius:'10px', padding:'14px 20px',
            marginBottom:'24px',
            display:'flex', justifyContent:'space-between', alignItems:'center'
          }}>
            <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
              <span style={{ fontSize:'18px' }}>
                {alertLevel==='critical'?'🚨':alertLevel==='warning'?'⚠️':'ℹ️'}
              </span>
              <div>
                <p style={{ margin:'0 0 2px', fontWeight:700, fontSize:'13px', color:alertColor }}>
                  {alertLevel==='critical' ? 'CRITICAL: Budget nearly exhausted' :
                   alertLevel==='warning' ? 'WARNING: 75% of budget used' :
                   'INFO: Budget halfway mark reached'}
                </p>
                <p style={{ margin:0, fontSize:'12px',
                  color: isDark?'rgba(255,255,255,0.6)':'rgba(0,0,0,0.6)' }}>
                  €{remainingBudgetEur.toLocaleString()} remaining for {remainingTonnes.toLocaleString()} tonnes still needed
                </p>
              </div>
            </div>
            <button onClick={() => setAlertDismissed(true)} style={{
              background:'transparent', border:'none',
              color:'rgba(255,255,255,0.3)', cursor:'pointer', fontSize:'16px'
            }}>✕</button>
          </div>
        )}

        {/* STATS GRID */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))',
          gap:'16px', marginBottom:'32px' }}>
          {[
            { label:'Annual Budget', value:`€${annualBudgetEur.toLocaleString()}`, sub:'allocated', color:GOLD },
            { label:'Spent to Date', value:`€${Math.round(spentEur).toLocaleString()}`, sub:`${budgetPct}% used`, color: alertColor },
            { label:'Remaining Budget', value:`€${Math.round(remainingBudgetEur).toLocaleString()}`, sub:'available', color:'#4ade80' },
            { label:'Tonnes Purchased', value:boughtTonnes.toLocaleString(), sub:`of ${annualTargetTonnes.toLocaleString()} target`, color:GOLD },
            { label:'Tonnes Remaining', value:remainingTonnes.toLocaleString(), sub:'still needed', color: tonnesPct>=90?'#f87171':GOLD },
            { label:'Avg Price Paid', value:trades.length?`€${(spentEur/boughtTonnes).toFixed(2)}`:'—', sub:'per tonne', color:'#60a5fa' },
          ].map((stat,i) => (
            <div key={i} style={{ background:bg, border:cardBorder,
              borderRadius:'12px', padding:'20px', textAlign:'center' }}>
              <p style={{ margin:'0 0 4px', fontSize:'10px', fontWeight:700,
                letterSpacing:'0.1em', textTransform:'uppercase',
                color:'rgba(212,168,67,0.6)' }}>{stat.label}</p>
              <p style={{ margin:'0 0 2px', fontFamily:'JetBrains Mono,monospace',
                fontSize:'22px', fontWeight:700, color:stat.color }}>{stat.value}</p>
              <p style={{ margin:0, fontSize:'11px',
                color: isDark?'rgba(255,255,255,0.4)':'rgba(0,0,0,0.4)' }}>{stat.sub}</p>
            </div>
          ))}
        </div>

        {/* PROGRESS BARS */}
        <div style={{ background:bg, border:cardBorder, borderRadius:'12px',
          padding:'24px', marginBottom:'24px' }}>
          <div style={{ marginBottom:'20px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'8px' }}>
              <span style={{ fontSize:'12px', fontWeight:700, color:'rgba(212,168,67,0.8)',
                letterSpacing:'0.05em' }}>BUDGET UTILIZATION</span>
              <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:'12px',
                color: isDark?'#ffffff':'#0d1b3e' }}>
                €{Math.round(spentEur).toLocaleString()} / €{annualBudgetEur.toLocaleString()}
              </span>
            </div>
            <div style={{ height:'12px', background:'rgba(255,255,255,0.08)',
              borderRadius:'6px', overflow:'hidden' }}>
              <div style={{ height:'100%', width:`${budgetPct}%`,
                background:`linear-gradient(90deg,${alertColor},${alertColor}88)`,
                borderRadius:'6px', transition:'width 0.8s ease' }} />
            </div>
            {[25,50,75,90].map(mark => (
              <div key={mark} style={{ position:'relative' }}>
                <div style={{
                  position:'absolute', left:`${mark}%`, top:'-12px',
                  width:'1px', height:'12px',
                  background:'rgba(255,255,255,0.1)'
                }} />
              </div>
            ))}
          </div>
          <div>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'8px' }}>
              <span style={{ fontSize:'12px', fontWeight:700, color:'rgba(212,168,67,0.8)',
                letterSpacing:'0.05em' }}>TONNAGE PROGRESS</span>
              <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:'12px',
                color: isDark?'#ffffff':'#0d1b3e' }}>
                {boughtTonnes.toLocaleString()} / {annualTargetTonnes.toLocaleString()} t
              </span>
            </div>
            <div style={{ height:'12px', background:'rgba(255,255,255,0.08)',
              borderRadius:'6px', overflow:'hidden' }}>
              <div style={{ height:'100%', width:`${tonnesPct}%`,
                background:'linear-gradient(90deg,#4ade80,#4ade8088)',
                borderRadius:'6px', transition:'width 0.8s ease' }} />
            </div>
          </div>
        </div>

        {/* AI SUGGESTIONS */}
        {remainingTonnes > 0 && suggestions.length > 0 && (
          <div style={{ background:bg, border:cardBorder, borderRadius:'12px', padding:'24px' }}>
            <p style={{ margin:'0 0 16px', fontSize:'12px', fontWeight:700,
              letterSpacing:'0.1em', textTransform:'uppercase', color:GOLD }}>
              ✦ AUTO-SUGGESTED CREDITS — cheapest available within your remaining budget
            </p>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))',
              gap:'12px' }}>
              {suggestions.map((s, i) => (
                <div key={i} style={{
                  background: s.covers_remaining
                    ? 'rgba(74,222,128,0.05)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${s.covers_remaining ? '#4ade8033' : 'rgba(212,168,67,0.1)'}`,
                  borderRadius:'10px', padding:'16px'
                }}>
                  {s.covers_remaining && (
                    <span style={{ fontSize:'10px', fontWeight:700, color:'#4ade80',
                      letterSpacing:'0.08em', display:'block', marginBottom:'6px' }}>
                      ✓ COVERS YOUR FULL REMAINING LIABILITY
                    </span>
                  )}
                  <p style={{ margin:'0 0 4px', fontSize:'13px', fontWeight:700,
                    color: isDark?'#ffffff':'#0d1b3e', lineHeight:1.3 }}>
                    {s.name}
                  </p>
                  <p style={{ margin:'0 0 10px', fontSize:'11px',
                    color: isDark?'rgba(255,255,255,0.5)':'rgba(0,0,0,0.5)' }}>
                    {s.standard} · €{s.price.toFixed(2)}/t · {s.affordable_tonnes.toLocaleString()}t affordable
                  </p>
                  <button onClick={() => onBuyListing?.(s)} style={{
                    width:'100%', padding:'8px', borderRadius:'7px', border:'none',
                    background: i===0 ? GOLD : 'rgba(212,168,67,0.15)',
                    color: i===0 ? '#0a0a0f' : GOLD,
                    fontWeight:700, fontSize:'12px', cursor:'pointer'
                  }}>
                    Buy {Math.min(s.affordable_tonnes, remainingTonnes).toLocaleString()} tonnes →
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
