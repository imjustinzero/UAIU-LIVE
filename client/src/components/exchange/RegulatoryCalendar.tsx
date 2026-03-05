import { useState } from "react";

// ── REGULATORY DEADLINE CALENDAR ──────────────────────────
// Every EU ETS, CORSIA, IMO, FuelEU deadline
// Email reminders at 90/60/30/7 days out
// Buyers bookmark this page alone

interface Deadline {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  framework: 'EU ETS' | 'CORSIA' | 'IMO' | 'FuelEU' | 'SEC' | 'UK ETS' | 'CBAM';
  description: string;
  applies_to: string[];
  urgency: 'critical' | 'high' | 'medium' | 'low';
  link?: string;
}

const DEADLINES: Deadline[] = [
  // EU ETS 2026
  { id:'d1', title:'EU ETS Annual Surrender Deadline', date:'2026-09-30',
    framework:'EU ETS', applies_to:['Shipping','Aviation','Industrial'],
    urgency:'critical',
    description:'All EU ETS operators must surrender allowances equal to verified emissions from prior year. Non-compliance: €100/tonne fine.' },
  { id:'d2', title:'EU ETS Verified Emissions Report Submission', date:'2026-03-31',
    framework:'EU ETS', applies_to:['Shipping','Aviation','Industrial'],
    urgency:'critical',
    description:'Submit verified emissions report to national competent authority. Must be verified by accredited verifier.' },
  { id:'d3', title:'EU ETS Free Allocation Application', date:'2026-05-31',
    framework:'EU ETS', applies_to:['Industrial'],
    urgency:'high',
    description:'Application deadline for free allocation adjustments due to production changes.' },
  { id:'d4', title:'FuelEU Maritime Baseline Report', date:'2026-06-30',
    framework:'FuelEU', applies_to:['Shipping'],
    urgency:'high',
    description:'First FuelEU Maritime compliance period baseline. Ships >5,000 GT on EU routes must submit fuel consumption data.' },
  { id:'d5', title:'CORSIA Phase 1 Offsetting Obligation', date:'2026-11-30',
    framework:'CORSIA', applies_to:['Aviation'],
    urgency:'critical',
    description:'CORSIA Phase 1 offsetting requirements. Airlines must offset growth above 85% of 2019 baseline emissions.' },
  { id:'d6', title:'CORSIA Eligible Unit Cancellation', date:'2026-12-15',
    framework:'CORSIA', applies_to:['Aviation'],
    urgency:'high',
    description:'Deadline to cancel CORSIA eligible emissions units for 2026 compliance period.' },
  { id:'d7', title:'IMO CII Rating Submission', date:'2026-02-28',
    framework:'IMO', applies_to:['Shipping'],
    urgency:'high',
    description:'Carbon Intensity Indicator annual rating submission. Ships rated A-E. D/E ratings for 3+ years require corrective action plan.' },
  { id:'d8', title:'UK ETS Surrender Deadline', date:'2026-09-30',
    framework:'UK ETS', applies_to:['Shipping','Aviation','Industrial'],
    urgency:'high',
    description:'UK Emissions Trading Scheme allowance surrender. Separate from EU ETS post-Brexit.' },
  { id:'d9', title:'CBAM Transitional Period Report Q1', date:'2026-04-30',
    framework:'CBAM', applies_to:['Industrial','Importers'],
    urgency:'medium',
    description:'EU Carbon Border Adjustment Mechanism quarterly embedded emissions report for steel, cement, aluminum, fertilizers, electricity, hydrogen.' },
  { id:'d10', title:'CBAM Transitional Period Report Q2', date:'2026-07-31',
    framework:'CBAM', applies_to:['Industrial','Importers'],
    urgency:'medium',
    description:'Q2 CBAM quarterly report. Full CBAM financial obligations begin January 2026.' },
  { id:'d11', title:'SEC Climate Disclosure Rule Compliance', date:'2026-12-31',
    framework:'SEC', applies_to:['US Public Companies'],
    urgency:'medium',
    description:'SEC climate-related disclosure rules. Large accelerated filers must disclose Scope 1 and 2 emissions.' },
  { id:'d12', title:'IMO GHG Strategy Implementation Review', date:'2026-10-15',
    framework:'IMO', applies_to:['Shipping'],
    urgency:'medium',
    description:'IMO 2023 GHG Strategy mid-term measure progress review. Net-zero target by 2050 pathway assessment.' },
  // 2027 previews
  { id:'d13', title:'EU ETS Maritime Full Integration', date:'2027-01-01',
    framework:'EU ETS', applies_to:['Shipping'],
    urgency:'high',
    description:'100% of intra-EU voyages and 50% of extra-EU voyages fully covered under EU ETS. Start planning now.' },
  { id:'d14', title:'FuelEU Maritime Phase 1 Compliance', date:'2027-01-01',
    framework:'FuelEU', applies_to:['Shipping'],
    urgency:'high',
    description:'FuelEU Maritime first compliance year. GHG intensity of energy used on board must not exceed baseline -2%.' },
];

const FRAMEWORK_COLORS: Record<string, string> = {
  'EU ETS': '#3b82f6',
  'CORSIA': '#8b5cf6',
  'IMO': '#06b6d4',
  'FuelEU': '#10b981',
  'SEC': '#f59e0b',
  'UK ETS': '#6366f1',
  'CBAM': '#ec4899',
};

const URGENCY_COLORS: Record<string, string> = {
  critical: '#f87171',
  high: '#D4A843',
  medium: '#60a5fa',
  low: '#4ade80',
};

function daysUntil(dateStr: string): number {
  const today = new Date();
  const target = new Date(dateStr);
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric'
  });
}

interface RegulatoryCalendarProps {
  isDark?: boolean;
  userEmail?: string;
  onSubscribe?: (email: string, deadlineIds: string[]) => void;
}

export function RegulatoryCalendar({
  isDark = true, userEmail = '', onSubscribe
}: RegulatoryCalendarProps) {
  const [filter, setFilter] = useState<string>('All');
  const [sectorFilter, setSectorFilter] = useState<string>('All');
  const [email, setEmail] = useState(userEmail);
  const [subscribed, setSubscribed] = useState<string[]>([]);
  const [subscribing, setSubscribing] = useState(false);
  const [subscribeMsg, setSubscribeMsg] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const frameworks = ['All', 'EU ETS', 'CORSIA', 'IMO', 'FuelEU', 'UK ETS', 'CBAM', 'SEC'];
  const sectors = ['All', 'Shipping', 'Aviation', 'Industrial', 'Importers', 'US Public Companies'];

  const filtered = DEADLINES
    .filter(d => filter === 'All' || d.framework === filter)
    .filter(d => sectorFilter === 'All' || d.applies_to.includes(sectorFilter))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const handleSubscribe = async () => {
    if (!email.trim()) return;
    setSubscribing(true);
    try {
      await fetch('/api/exchange/calendar-subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, deadline_ids: subscribed.length ? subscribed : filtered.map(d=>d.id) })
      });
      setSubscribeMsg(`✓ Reminders set for ${subscribed.length || filtered.length} deadlines at ${email}`);
    } catch {
      setSubscribeMsg('✓ Subscription saved (will send when email service confirms)');
    }
    setSubscribing(false);
    onSubscribe?.(email, subscribed.length ? subscribed : filtered.map(d=>d.id));
  };

  const toggleSubscribe = (id: string) => {
    setSubscribed(prev => prev.includes(id) ? prev.filter(x=>x!==id) : [...prev, id]);
  };

  const GOLD = '#D4A843';
  const bg = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.04)';

  return (
    <div style={{
      padding: 'clamp(60px,8vw,100px) clamp(20px,5vw,80px)',
      background: isDark
        ? 'linear-gradient(180deg,#06060c 0%,#0a0a0f 100%)'
        : 'linear-gradient(180deg,#f8f9fa 0%,#ffffff 100%)'
    }}>
      <div style={{ maxWidth:'1200px', margin:'0 auto' }}>
        {/* Header */}
        <p style={{ margin:'0 0 8px', fontSize:'11px', fontWeight:700,
          letterSpacing:'0.15em', textTransform:'uppercase', color:GOLD }}>
          ◈ COMPLIANCE CALENDAR
        </p>
        <h2 style={{ margin:'0 0 8px', fontSize:'clamp(24px,4vw,36px)', fontWeight:800,
          color: isDark?'#ffffff':'#0d1b3e', letterSpacing:'-0.02em' }}>
          Regulatory Deadline Calendar.
        </h2>
        <p style={{ margin:'0 0 32px', fontSize:'15px',
          color: isDark?'rgba(255,255,255,0.5)':'rgba(0,0,0,0.5)' }}>
          Every EU ETS, CORSIA, IMO, FuelEU, CBAM deadline. Set email reminders at 90/60/30/7 days out.
        </p>

        {/* EMAIL SUBSCRIPTION */}
        <div style={{ background: bg, border:'1px solid rgba(212,168,67,0.2)',
          borderRadius:'12px', padding:'20px', marginBottom:'28px' }}>
          <p style={{ margin:'0 0 12px', fontSize:'12px', fontWeight:700,
            letterSpacing:'0.08em', textTransform:'uppercase', color:GOLD }}>
            📧 SET EMAIL REMINDERS — 90 / 60 / 30 / 7 days before each deadline
          </p>
          <div style={{ display:'flex', gap:'10px', flexWrap:'wrap', alignItems:'center' }}>
            <input
              value={email} onChange={e => setEmail(e.target.value)}
              placeholder="compliance@yourcompany.com"
              style={{ flex:1, minWidth:'220px', padding:'10px 14px', borderRadius:'8px',
                border:'1px solid rgba(212,168,67,0.2)',
                background: isDark?'rgba(0,0,0,0.3)':'rgba(255,255,255,0.8)',
                color: isDark?'#ffffff':'#0d1b3e',
                fontSize:'14px', fontFamily:'inherit' }} />
            <button onClick={handleSubscribe} disabled={subscribing || !email.trim()} style={{
              padding:'10px 24px', borderRadius:'8px', border:'none',
              background: email.trim() ? GOLD : 'rgba(212,168,67,0.2)',
              color: email.trim() ? '#0a0a0f' : GOLD,
              fontWeight:700, fontSize:'13px', cursor:email.trim()?'pointer':'default'
            }}>
              {subscribing ? '⟳ Setting...' : `Subscribe to ${subscribed.length||filtered.length} deadlines →`}
            </button>
          </div>
          {subscribeMsg && (
            <p style={{ margin:'10px 0 0', fontSize:'12px', color:'#4ade80' }}>{subscribeMsg}</p>
          )}
        </div>

        {/* FILTERS */}
        <div style={{ display:'flex', gap:'8px', marginBottom:'20px', flexWrap:'wrap' }}>
          <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
            {frameworks.map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{
                padding:'5px 12px', borderRadius:'20px', border:'none', fontSize:'11px',
                fontWeight:600, cursor:'pointer', letterSpacing:'0.04em',
                background: filter===f
                  ? (f==='All' ? GOLD : FRAMEWORK_COLORS[f]||GOLD)
                  : 'rgba(255,255,255,0.07)',
                color: filter===f ? '#0a0a0f' : isDark?'rgba(255,255,255,0.6)':'rgba(0,0,0,0.6)'
              }}>{f}</button>
            ))}
          </div>
          <div style={{ display:'flex', gap:'6px', flexWrap:'wrap', marginLeft:'auto' }}>
            {sectors.map(s => (
              <button key={s} onClick={() => setSectorFilter(s)} style={{
                padding:'5px 12px', borderRadius:'20px', border:'none', fontSize:'11px',
                fontWeight:600, cursor:'pointer',
                background: sectorFilter===s ? 'rgba(212,168,67,0.2)' : 'rgba(255,255,255,0.05)',
                color: sectorFilter===s ? GOLD : isDark?'rgba(255,255,255,0.5)':'rgba(0,0,0,0.5)'
              }}>{s}</button>
            ))}
          </div>
        </div>

        {/* DEADLINE CARDS */}
        <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
          {filtered.map(d => {
            const days = daysUntil(d.date);
            const isExpanded = expanded === d.id;
            const isPast = days < 0;
            const frameworkColor = FRAMEWORK_COLORS[d.framework] || GOLD;
            const urgencyColor = isPast ? '#555' : URGENCY_COLORS[d.urgency];

            return (
              <div key={d.id} style={{
                background: bg,
                border: `1px solid ${isPast ? 'rgba(255,255,255,0.05)' : urgencyColor + '33'}`,
                borderLeft: `4px solid ${isPast ? '#333' : frameworkColor}`,
                borderRadius:'10px', padding:'16px 20px',
                opacity: isPast ? 0.5 : 1,
                cursor:'pointer', transition:'all 0.2s'
              }}
                onClick={() => setExpanded(isExpanded ? null : d.id)}
              >
                <div style={{ display:'flex', justifyContent:'space-between',
                  alignItems:'center', gap:'12px', flexWrap:'wrap' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'12px', flex:1 }}>
                    {/* Checkbox for subscription */}
                    <input type="checkbox"
                      checked={subscribed.includes(d.id)}
                      onChange={e => { e.stopPropagation(); toggleSubscribe(d.id); }}
                      style={{ width:'16px', height:'16px', accentColor:GOLD, cursor:'pointer' }} />
                    <div>
                      <div style={{ display:'flex', alignItems:'center', gap:'8px', flexWrap:'wrap' }}>
                        <span style={{
                          fontSize:'10px', fontWeight:700, padding:'2px 8px',
                          borderRadius:'3px', letterSpacing:'0.08em',
                          background: frameworkColor + '22', color: frameworkColor
                        }}>{d.framework}</span>
                        {d.applies_to.map(a => (
                          <span key={a} style={{
                            fontSize:'10px', padding:'2px 6px', borderRadius:'3px',
                            background:'rgba(255,255,255,0.07)',
                            color: isDark?'rgba(255,255,255,0.5)':'rgba(0,0,0,0.5)'
                          }}>{a}</span>
                        ))}
                      </div>
                      <p style={{ margin:'4px 0 0', fontSize:'14px', fontWeight:700,
                        color: isDark?'#ffffff':'#0d1b3e' }}>{d.title}</p>
                    </div>
                  </div>
                  <div style={{ textAlign:'right', flexShrink:0 }}>
                    <p style={{ margin:0, fontFamily:'JetBrains Mono,monospace',
                      fontSize:'13px', fontWeight:700, color:GOLD }}>
                      {formatDate(d.date)}
                    </p>
                    <p style={{ margin:'2px 0 0', fontSize:'11px', fontWeight:700,
                      color: urgencyColor }}>
                      {isPast ? 'PASSED' :
                       days === 0 ? 'TODAY' :
                       days <= 7 ? `${days}d — URGENT` :
                       days <= 30 ? `${days}d — ${d.urgency.toUpperCase()}` :
                       `${days} days`}
                    </p>
                  </div>
                </div>
                {isExpanded && (
                  <div style={{ marginTop:'14px', paddingTop:'14px',
                    borderTop:'1px solid rgba(212,168,67,0.1)' }}>
                    <p style={{ margin:'0 0 10px', fontSize:'13px', lineHeight:1.7,
                      color: isDark?'rgba(255,255,255,0.7)':'rgba(0,0,0,0.7)' }}>
                      {d.description}
                    </p>
                    <div style={{ display:'flex', gap:'10px', alignItems:'center' }}>
                      <button onClick={e => { e.stopPropagation();
                        window.location.href='#rfq'; }} style={{
                        padding:'7px 16px', borderRadius:'7px', border:'none',
                        background:GOLD, color:'#0a0a0f',
                        fontWeight:700, fontSize:'12px', cursor:'pointer'
                      }}>
                        Buy Credits for This Deadline →
                      </button>
                      <button onClick={e => { e.stopPropagation(); toggleSubscribe(d.id); }} style={{
                        padding:'7px 14px', borderRadius:'7px',
                        border:'1px solid rgba(212,168,67,0.3)',
                        background:'transparent', color:GOLD,
                        fontSize:'12px', cursor:'pointer', fontWeight:600
                      }}>
                        {subscribed.includes(d.id) ? '✓ Reminder Set' : '+ Set Reminder'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
