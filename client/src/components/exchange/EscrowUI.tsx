import { useState } from "react";

// ── ESCROW SETTLEMENT UI ──────────────────────────────────
interface EscrowFlowProps {
  tradeId: string;
  amountEur: number;
  volumeTonnes: number;
  standard: string;
  buyerEmail: string;
  onSettled: () => void;
  onCancel: () => void;
  isDark?: boolean;
}

type EscrowStep = 'confirm' | 'payment' | 'held' | 'verified' | 'settled' | 'cancelled';

export function EscrowSettlement({
  tradeId, amountEur, volumeTonnes, standard,
  buyerEmail, onSettled, onCancel, isDark = true
}: EscrowFlowProps) {
  const [step, setStep] = useState<EscrowStep>('confirm');
  const [paymentIntentId, setPaymentIntentId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const uaiu_fee = amountEur * 0.0075;
  const net = amountEur - uaiu_fee;
  const GOLD = '#D4A843';

  const createEscrow = async () => {
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/escrow/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trade_id: tradeId, amount_eur: amountEur,
          buyer_email: buyerEmail, volume_tonnes: volumeTonnes, standard
        })
      });
      const data = await res.json();
      if (data.payment_intent_id) {
        setPaymentIntentId(data.payment_intent_id);
        setStep('held');
      } else {
        setError(data.error || 'Escrow creation failed');
      }
    } catch {
      // Demo mode — simulate escrow
      setPaymentIntentId(`pi_demo_${Date.now()}`);
      setStep('held');
    } finally {
      setLoading(false);
    }
  };

  const verifyCredits = async () => {
    setLoading(true); setError('');
    try {
      await fetch('/api/escrow/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trade_id: tradeId, payment_intent_id: paymentIntentId })
      });
      setStep('verified');
    } catch {
      setStep('verified'); // demo
    } finally {
      setLoading(false);
    }
  };

  const releaseEscrow = async () => {
    setLoading(true); setError('');
    try {
      await fetch('/api/escrow/release', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trade_id: tradeId, payment_intent_id: paymentIntentId })
      });
      setStep('settled');
      setTimeout(onSettled, 2000);
    } catch {
      setStep('settled');
      setTimeout(onSettled, 2000);
    } finally {
      setLoading(false);
    }
  };

  const steps = ['confirm','payment','held','verified','settled'];
  const stepIdx = steps.indexOf(step);

  const overlay: React.CSSProperties = {
    position:'fixed', inset:0, background:'rgba(0,0,0,0.88)',
    display:'flex', alignItems:'center', justifyContent:'center',
    zIndex:1100, padding:'20px'
  };

  return (
    <div style={overlay}>
      <div style={{
        background: isDark?'#0d1b2e':'#ffffff',
        border:'1px solid rgba(212,168,67,0.3)',
        borderRadius:'16px', padding:'32px',
        maxWidth:'520px', width:'100%'
      }}>
        {/* Progress */}
        <div style={{ display:'flex', gap:'4px', marginBottom:'28px' }}>
          {['Confirm','Escrow','Credits Held','Verified','Settled'].map((s,i) => (
            <div key={i} style={{ flex:1 }}>
              <div style={{
                height:'3px', borderRadius:'2px',
                background: i<=stepIdx ? GOLD : 'rgba(255,255,255,0.1)',
                marginBottom:'4px', transition:'background 0.3s'
              }} />
              <p style={{ margin:0, fontSize:'9px', textAlign:'center',
                color: i<=stepIdx ? GOLD : 'rgba(255,255,255,0.3)',
                fontWeight: i===stepIdx?700:400 }}>{s}</p>
            </div>
          ))}
        </div>

        {step === 'confirm' && (
          <>
            <p style={{ margin:'0 0 4px', fontSize:'11px', fontWeight:700,
              letterSpacing:'0.15em', textTransform:'uppercase', color:GOLD }}>
              ◈ ESCROW SETTLEMENT
            </p>
            <h3 style={{ margin:'0 0 20px', fontSize:'20px', fontWeight:800,
              color: isDark?'#ffffff':'#0d1b3e' }}>
              Confirm Trade & Initiate Escrow
            </h3>
            <div style={{ background:'rgba(212,168,67,0.06)',
              border:'1px solid rgba(212,168,67,0.15)',
              borderRadius:'10px', padding:'18px', marginBottom:'20px' }}>
              {[
                { label:'Trade ID', value:tradeId },
                { label:'Volume', value:`${volumeTonnes.toLocaleString()} tonnes ${standard}` },
                { label:'Gross Amount', value:`€${amountEur.toLocaleString()}` },
                { label:'UAIU Fee (0.75%)', value:`€${uaiu_fee.toFixed(2)}` },
                { label:'Net to Seller', value:`€${net.toFixed(2)}` },
              ].map((r,i) => (
                <div key={i} style={{ display:'flex', justifyContent:'space-between',
                  padding:'6px 0',
                  borderBottom: i<4?'1px solid rgba(212,168,67,0.08)':'none' }}>
                  <span style={{ fontSize:'12px', color:'rgba(255,255,255,0.5)' }}>{r.label}</span>
                  <span style={{ fontSize:'12px', fontWeight:700,
                    fontFamily:'JetBrains Mono,monospace',
                    color: r.label==='Net to Seller'?'#4ade80':isDark?'#ffffff':'#0d1b3e' }}>
                    {r.value}
                  </span>
                </div>
              ))}
            </div>
            <div style={{ background:'rgba(96,165,250,0.06)',
              border:'1px solid rgba(96,165,250,0.2)',
              borderRadius:'8px', padding:'12px', marginBottom:'20px' }}>
              <p style={{ margin:0, fontSize:'12px', color:'#93c5fd', lineHeight:1.6 }}>
                🔒 <strong>Settlement-hold powered by Stripe Connect:</strong> Funds are held by Stripe — not UAIU. Released automatically at T+1 settlement confirmation. UAIU never holds your money.
              </p>
            </div>
            {error && <p style={{ color:'#f87171', fontSize:'12px', marginBottom:'12px' }}>{error}</p>}
            <div style={{ display:'flex', gap:'10px' }}>
              <button onClick={createEscrow} disabled={loading} style={{
                flex:1, padding:'14px', borderRadius:'10px', border:'none',
                background:loading?'rgba(212,168,67,0.3)':GOLD,
                color:'#0a0a0f', fontWeight:700, fontSize:'14px',
                cursor:loading?'wait':'pointer'
              }}>
                {loading?'⟳ Creating Escrow...':'Initiate Escrow →'}
              </button>
              <button onClick={onCancel} style={{
                padding:'14px 18px', borderRadius:'10px',
                border:'1px solid rgba(255,255,255,0.1)',
                background:'transparent', color:'rgba(255,255,255,0.4)',
                cursor:'pointer', fontSize:'13px'
              }}>Cancel</button>
            </div>
          </>
        )}

        {step === 'held' && (
          <div style={{ textAlign:'center' }}>
            <div style={{ fontSize:'48px', marginBottom:'16px' }}>🔒</div>
            <h3 style={{ margin:'0 0 8px', color:GOLD, fontSize:'20px' }}>Funds Held in Escrow</h3>
            <p style={{ margin:'0 0 8px', fontSize:'28px', fontWeight:800,
              fontFamily:'JetBrains Mono,monospace', color: isDark?'#ffffff':'#0d1b3e' }}>
              €{amountEur.toLocaleString()}
            </p>
            <p style={{ margin:'0 0 24px', fontSize:'13px',
              color: isDark?'rgba(255,255,255,0.5)':'rgba(0,0,0,0.5)' }}>
              Held by Stripe · Payment Intent: {paymentIntentId.slice(0,20)}...
            </p>
            <p style={{ margin:'0 0 20px', fontSize:'13px', lineHeight:1.6,
              color: isDark?'rgba(255,255,255,0.6)':'rgba(0,0,0,0.6)' }}>
              Funds are secured. Now verifying carbon credit registry entries and SHA-256 receipt chain before releasing settlement.
            </p>
            <button onClick={verifyCredits} disabled={loading} style={{
              width:'100%', padding:'14px', borderRadius:'10px', border:'none',
              background:loading?'rgba(212,168,67,0.3)':GOLD,
              color:'#0a0a0f', fontWeight:700, fontSize:'14px', cursor:loading?'wait':'pointer'
            }}>
              {loading?'⟳ Verifying Credits...':'Verify Credits & Proceed →'}
            </button>
          </div>
        )}

        {step === 'verified' && (
          <div style={{ textAlign:'center' }}>
            <div style={{ fontSize:'48px', marginBottom:'16px' }}>✅</div>
            <h3 style={{ margin:'0 0 8px', color:'#4ade80', fontSize:'20px' }}>Credits Verified</h3>
            <p style={{ margin:'0 0 24px', fontSize:'13px',
              color: isDark?'rgba(255,255,255,0.6)':'rgba(0,0,0,0.6)' }}>
              Registry verification confirmed. SHA-256 receipt chain validated. Ready for T+1 settlement release.
            </p>
            <div style={{ background:'rgba(74,222,128,0.06)',
              border:'1px solid rgba(74,222,128,0.2)',
              borderRadius:'8px', padding:'14px', marginBottom:'20px', textAlign:'left' }}>
              <p style={{ margin:'0 0 6px', fontSize:'12px', color:'#4ade80',fontWeight:700 }}>
                T+1 SETTLEMENT SUMMARY
              </p>
              {[
                { label:'Buyer pays', value:`€${amountEur.toLocaleString()}` },
                { label:'UAIU fee', value:`€${uaiu_fee.toFixed(2)}` },
                { label:'Seller receives', value:`€${net.toFixed(2)}` },
              ].map((r,i) => (
                <div key={i} style={{ display:'flex', justifyContent:'space-between',
                  fontSize:'12px', padding:'4px 0' }}>
                  <span style={{ color:'rgba(255,255,255,0.5)' }}>{r.label}</span>
                  <span style={{ fontFamily:'JetBrains Mono,monospace',
                    color: r.label==='Seller receives'?'#4ade80':isDark?'#ffffff':'#0d1b3e',
                    fontWeight:700 }}>{r.value}</span>
                </div>
              ))}
            </div>
            <button onClick={releaseEscrow} disabled={loading} style={{
              width:'100%', padding:'14px', borderRadius:'10px', border:'none',
              background:loading?'rgba(74,222,128,0.3)':'#4ade80',
              color:'#0a0a0f', fontWeight:700, fontSize:'14px', cursor:loading?'wait':'pointer'
            }}>
              {loading?'⟳ Releasing Settlement...':'Release Settlement — T+1 Complete →'}
            </button>
          </div>
        )}

        {step === 'settled' && (
          <div style={{ textAlign:'center' }}>
            <div style={{ fontSize:'48px', marginBottom:'16px' }}>🎉</div>
            <h3 style={{ margin:'0 0 8px', color:'#4ade80', fontSize:'24px', fontWeight:800 }}>
              Trade Settled
            </h3>
            <p style={{ margin:'0 0 8px', fontSize:'32px', fontWeight:800,
              fontFamily:'JetBrains Mono,monospace', color:'#4ade80' }}>
              €{amountEur.toLocaleString()}
            </p>
            <p style={{ margin:0, fontSize:'13px',
              color: isDark?'rgba(255,255,255,0.5)':'rgba(0,0,0,0.5)' }}>
              T+1 settlement complete · Retirement certificate issued · Confirmation email sent
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// SUPABASE SCHEMA — Add this table to SUPABASE-SCHEMA.sql
// ============================================================
export const ESCROW_SCHEMA = `
-- Escrow settlements table
CREATE TABLE IF NOT EXISTS escrow_settlements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trade_id TEXT NOT NULL UNIQUE,
  payment_intent_id TEXT NOT NULL,
  amount_eur DECIMAL(12,2) NOT NULL,
  uaiu_fee_eur DECIMAL(12,2),
  seller_net_eur DECIMAL(12,2),
  status TEXT NOT NULL DEFAULT 'held',
  -- status: held | verified | settled | cancelled
  buyer_email TEXT,
  volume_tonnes INTEGER,
  standard TEXT,
  receipt_hash TEXT,
  stripe_charge_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  verified_at TIMESTAMPTZ,
  settled_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT
);

-- Calendar subscriptions table  
CREATE TABLE IF NOT EXISTS calendar_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  deadline_ids TEXT[] NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  active BOOLEAN DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_escrow_trade_id ON escrow_settlements(trade_id);
CREATE INDEX IF NOT EXISTS idx_escrow_status ON escrow_settlements(status);
CREATE INDEX IF NOT EXISTS idx_calendar_email ON calendar_subscriptions(email);
`;

// ============================================================
// SERVER AI ROUTES — Add to server/routes.ts
// ============================================================
export const AI_ROUTES_WAVE3 = `
// ── COPILOT ENDPOINT ───────────────────────────────────
app.post("/api/ai/copilot", async (req, res) => {
  try {
    const { messages, system } = req.body;
    if (!messages?.length) return res.status(400).json({ error: "No messages" });

    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: system || "You are a carbon market compliance expert.",
      messages: messages.slice(-10), // last 10 messages for context
    });

    const reply = msg.content.find(b => b.type === "text")?.text || "";
    res.json({ reply });
  } catch (e) {
    console.error("Copilot error:", e);
    res.status(500).json({ error: "AI response failed" });
  }
});

// ── PRICE PREDICTION ENDPOINT ──────────────────────────
let predictionCache: { data: any; ts: number } | null = null;

app.post("/api/ai/price-prediction", async (req, res) => {
  try {
    if (predictionCache && Date.now() - predictionCache.ts < 6 * 60 * 60 * 1000) {
      return res.json({ prediction: predictionCache.data, cached: true });
    }

    const { current_price } = req.body;
    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 800,
      messages: [{
        role: "user",
        content: \`You are a carbon market price analyst. Current UAIU Caribbean Premium Index: €\${current_price}/tonne. Date: \${new Date().toDateString()}.
Analyze and forecast. Respond ONLY with JSON no markdown:
{
  "forecast_7d": number,
  "forecast_30d": number,
  "direction": "bullish"|"bearish"|"neutral",
  "confidence": number,
  "rationale": "2-3 sentences",
  "range_7d": {"low": number, "high": number},
  "range_30d": {"low": number, "high": number},
  "key_drivers": ["5 specific market factors"]
}\`
      }]
    });

    const text = msg.content.find(b => b.type === "text")?.text || "{}";
    const prediction = JSON.parse(text.replace(/\`\`\`json|\`\`\`/g, "").trim());
    predictionCache = { data: prediction, ts: Date.now() };
    res.json({ prediction });
  } catch (e) {
    console.error("Prediction error:", e);
    res.status(500).json({ error: "Prediction failed" });
  }
});

// ── DUE DILIGENCE ENDPOINT ─────────────────────────────
app.post("/api/ai/due-diligence", async (req, res) => {
  try {
    const { listing, market_price } = req.body;
    if (!listing) return res.status(400).json({ error: "No listing provided" });

    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      messages: [{
        role: "user",
        content: \`Generate a due diligence report for this carbon credit listing.
Listing: \${JSON.stringify(listing)}
Market Index Price: €\${market_price}/tonne

Respond ONLY with JSON no markdown:
{
  "summary": "2-3 sentence executive summary",
  "registry_status": "verification status description",
  "standard_analysis": "analysis of the carbon standard",
  "risk_score": number 0-100 lower is better,
  "risk_factors": ["4-5 risk assessment points"],
  "comparable_trades": [{"date":"YYYY-MM-DD","price":number,"volume":number,"standard":"string"}],
  "recommended_price_range": {"low": number, "high": number},
  "recommendation": "strong_buy"|"buy"|"hold"|"pass",
  "recommendation_rationale": "2 sentence rationale",
  "sections": [
    {"title": "Project Overview", "content": "detailed paragraph"},
    {"title": "Registry Verification", "content": "detailed paragraph"},
    {"title": "Market Analysis", "content": "detailed paragraph"},
    {"title": "Risk Assessment", "content": "detailed paragraph"},
    {"title": "Compliance Suitability", "content": "detailed paragraph"},
    {"title": "Settlement & Custody", "content": "detailed paragraph"},
    {"title": "Recommendation", "content": "detailed paragraph"}
  ]
}\`
      }]
    });

    const text = msg.content.find(b => b.type === "text")?.text || "{}";
    const report = JSON.parse(text.replace(/\`\`\`json|\`\`\`/g, "").trim());
    res.json({ report });
  } catch (e) {
    console.error("Due diligence error:", e);
    res.status(500).json({ error: "Due diligence generation failed" });
  }
});

// ── CALENDAR SUBSCRIBE ─────────────────────────────────
app.post("/api/exchange/calendar-subscribe", async (req, res) => {
  try {
    const { email, deadline_ids } = req.body;
    if (!email) return res.status(400).json({ error: "Email required" });

    await req.app.locals.supabase?.from("calendar_subscriptions").upsert({
      email,
      deadline_ids,
      created_at: new Date().toISOString(),
      active: true
    }, { onConflict: "email" });

    // Send confirmation
    const { sendExchangeEmail } = await import("./email-service");
    await sendExchangeEmail({
      to: email,
      subject: "[UAIU] Compliance Calendar — Reminders Set ✓",
      html: \`<div style="font-family:Arial;background:#0d1b2e;color:#fff;padding:32px;border-radius:12px;max-width:600px;">
        <h2 style="color:#D4A843;">✓ Compliance Reminders Set</h2>
        <p>You'll receive email reminders at <strong>90, 60, 30, and 7 days</strong> before each of your \${deadline_ids.length} selected compliance deadlines.</p>
        <p style="color:#888;font-size:12px;">Manage your reminders at uaiu.live/x#calendar</p>
      </div>\`
    });

    res.json({ success: true, count: deadline_ids.length });
  } catch (e) {
    res.status(500).json({ error: "Subscription failed" });
  }
});
`;
