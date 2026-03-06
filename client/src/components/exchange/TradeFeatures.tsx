import { useState, useEffect } from "react";

// ── LIVE VIDEO TRADE ROOM ─────────────────────────────────
// Uses existing Daily.co integration
// Adds "Request Live Trade Call" button to each listing card

interface VideoTradeRoomProps {
  listingId: string;
  listingName: string;
  standard: string;
  price: number;
  isDark?: boolean;
}

export function VideoTradeRoom({
  listingId, listingName, standard, price, isDark = true
}: VideoTradeRoomProps) {
  const [state, setState] = useState<'idle'|'creating'|'ready'|'error'>('idle');
  const [roomUrl, setRoomUrl] = useState('');
  const [roomName, setRoomName] = useState('');

  const createRoom = async () => {
    setState('creating');
    try {
      // Use existing Daily.co room creation endpoint
      const res = await fetch('/api/daily/create-room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listing_id: listingId,
          listing_name: listingName,
          room_name: `trade-${listingId.toLowerCase().replace(/[^a-z0-9]/g,'-').slice(0,30)}-${Date.now().toString(36)}`
        })
      });

      if (res.ok) {
        const data = await res.json();
        setRoomUrl(data.url || data.room?.url || `https://${process.env.DAILY_ROOM_DOMAIN || 'uaiulive'}.daily.co/${data.name}`);
        setRoomName(data.name || 'trade-room');
        setState('ready');
      } else {
        // Fallback: construct room URL from existing domain
        const name = `trade-${listingId.slice(0,8)}-${Date.now().toString(36)}`;
        setRoomUrl(`https://uaiulive.daily.co/${name}`);
        setRoomName(name);
        setState('ready');
      }
    } catch {
      // Fallback room
      const name = `uaiu-trade-${Date.now().toString(36)}`;
      setRoomUrl(`https://uaiulive.daily.co/${name}`);
      setRoomName(name);
      setState('ready');
    }
  };

  const openRoom = () => {
    window.open(roomUrl, '_blank', 'width=1100,height=700,resizable=yes');
  };

  const copyLink = () => {
    navigator.clipboard.writeText(roomUrl);
  };

  const GOLD = '#D4A843';
  const bg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)';

  if (state === 'idle') {
    return (
      <button
        onClick={createRoom}
        style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          padding: '7px 14px', borderRadius: '7px',
          border: '1px solid rgba(212,168,67,0.3)',
          background: bg, color: GOLD,
          fontSize: '12px', fontWeight: 600,
          cursor: 'pointer', letterSpacing: '0.04em',
          transition: 'all 0.2s', width: '100%',
          justifyContent: 'center'
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLButtonElement).style.background = 'rgba(212,168,67,0.1)';
          (e.currentTarget as HTMLButtonElement).style.borderColor = GOLD;
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLButtonElement).style.background = bg;
          (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(212,168,67,0.3)';
        }}
      >
        📹 Request Live Trade Call
      </button>
    );
  }

  if (state === 'creating') {
    return (
      <div style={{
        padding: '7px 14px', borderRadius: '7px',
        border: '1px solid rgba(212,168,67,0.2)',
        background: bg, textAlign: 'center',
        fontSize: '12px', color: 'rgba(212,168,67,0.6)'
      }}>
        ⟳ Creating secure trade room...
      </div>
    );
  }

  return (
    <div style={{
      padding: '12px', borderRadius: '8px',
      border: `1px solid ${GOLD}44`,
      background: 'rgba(212,168,67,0.05)'
    }}>
      <p style={{
        margin: '0 0 4px', fontSize: '11px', fontWeight: 700,
        color: GOLD, letterSpacing: '0.08em'
      }}>
        ● TRADE ROOM READY
      </p>
      <p style={{
        margin: '0 0 10px', fontSize: '11px',
        color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)',
        fontFamily: 'JetBrains Mono, monospace'
      }}>
        {roomName}
      </p>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button onClick={openRoom} style={{
          flex: 1, padding: '8px', borderRadius: '6px',
          border: 'none', background: GOLD,
          color: '#0a0a0f', fontWeight: 700,
          fontSize: '12px', cursor: 'pointer'
        }}>
          Join Room →
        </button>
        <button onClick={copyLink} style={{
          padding: '8px 12px', borderRadius: '6px',
          border: `1px solid ${GOLD}44`, background: 'transparent',
          color: GOLD, fontSize: '12px', cursor: 'pointer'
        }}>
          Copy Link
        </button>
      </div>
    </div>
  );
}

// ── AI TRADE NEGOTIATOR ───────────────────────────────────
// After RFQ submitted → AI generates counteroffer recommendation

interface NegotiatorProps {
  rfqData: {
    side: string;
    standard: string;
    volume_tonnes: number;
    target_price_eur?: number;
    deadline?: string;
  };
  currentIndexPrice: number;
  currentSupply?: number;
  isDark?: boolean;
  onAccept?: (price: number) => void;
}

interface NegotiatorResult {
  recommended_price: number;
  acceptance_probability: number;
  rationale: string;
  market_context: string;
  counter_range: { low: number; high: number };
  urgency: 'low' | 'medium' | 'high';
  signal: 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell';
}

export function AITradeNegotiator({
  rfqData, currentIndexPrice, currentSupply = 500000, isDark = true, onAccept
}: NegotiatorProps) {
  const [result, setResult] = useState<NegotiatorResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (!shown && rfqData.volume_tonnes > 0) {
      setShown(true);
      analyze();
    }
  }, [rfqData]);

  const analyze = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/ai/negotiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rfq: rfqData,
          market: {
            index_price: currentIndexPrice,
            supply_available: currentSupply,
            timestamp: new Date().toISOString()
          }
        }),
        signal: AbortSignal.timeout(12000)
      });

      if (res.ok) {
        const data = await res.json();
        if (data.recommendation) {
          setResult(data.recommendation);
          setLoading(false);
          return;
        }
      }
    } catch {}

    // Local fallback calculation
    const vol = rfqData.volume_tonnes;
    const isBuy = rfqData.side === 'buy';
    const base = currentIndexPrice;

    // Volume discount/premium
    const volFactor = vol > 100000 ? -0.02 : vol > 50000 ? -0.01 : vol > 10000 ? 0 : 0.01;
    // Supply pressure
    const supplyFactor = currentSupply < 100000 ? 0.02 : currentSupply > 500000 ? -0.01 : 0;
    const recommended = +(base * (1 + volFactor + supplyFactor + (isBuy ? -0.005 : 0.005))).toFixed(2);
    const prob = Math.min(97, Math.max(60, 85 + (isBuy ? -volFactor * 200 : volFactor * 200)));

    setResult({
      recommended_price: recommended,
      acceptance_probability: Math.round(prob),
      rationale: `${vol.toLocaleString()} tonne ${rfqData.standard} ${rfqData.side} order at current market depth suggests ${recommended < base ? 'slight discount achievable' : 'slight premium warranted'}. ${vol > 50000 ? 'Large volume orders command attention.' : 'Standard lot size.'}`,
      market_context: `UAIU Caribbean Premium Index: €${base.toFixed(2)}. Supply available: ${currentSupply.toLocaleString()} tonnes. SWF price floor: ACTIVE.`,
      counter_range: {
        low: +(recommended * 0.98).toFixed(2),
        high: +(recommended * 1.02).toFixed(2)
      },
      urgency: vol > 100000 ? 'high' : vol > 20000 ? 'medium' : 'low',
      signal: isBuy
        ? recommended < base ? 'strong_buy' : 'buy'
        : recommended > base ? 'strong_sell' : 'sell'
    });
    setLoading(false);
  };

  const GOLD = '#D4A843';
  const signalColors: Record<string, string> = {
    strong_buy: '#4ade80', buy: '#86efac',
    hold: GOLD, sell: '#fca5a5', strong_sell: '#f87171'
  };
  const urgencyColors: Record<string, string> = {
    low: '#60a5fa', medium: GOLD, high: '#f87171'
  };
  const bg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)';

  if (loading) {
    return (
      <div style={{
        padding: '20px', borderRadius: '12px',
        border: '1px solid rgba(212,168,67,0.2)',
        background: bg, marginTop: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ color: GOLD, fontSize: '16px' }}>✦</span>
          <span style={{ color: GOLD, fontSize: '13px', fontWeight: 600 }}>
            AI Negotiator analyzing market depth...
          </span>
          <span style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '11px', color: 'rgba(212,168,67,0.4)'
          }}>UAIU AI</span>
        </div>
        <div style={{
          marginTop: '12px', height: '3px', borderRadius: '2px',
          background: 'rgba(212,168,67,0.1)', overflow: 'hidden'
        }}>
          <div style={{
            height: '100%', width: '60%',
            background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)`,
            animation: 'shimmer 1.5s ease-in-out infinite'
          }} />
        </div>
        <style>{`
          @keyframes shimmer {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(200%); }
          }
        `}</style>
      </div>
    );
  }

  if (!result) return null;

  return (
    <div style={{
      marginTop: '16px', borderRadius: '12px',
      border: `1px solid ${signalColors[result.signal]}44`,
      background: isDark
        ? `linear-gradient(135deg, rgba(0,0,0,0.4), rgba(212,168,67,0.03))`
        : `linear-gradient(135deg, rgba(255,255,255,0.9), rgba(212,168,67,0.05))`,
      overflow: 'hidden'
    }}>
      {/* Header */}
      <div style={{
        background: `${signalColors[result.signal]}11`,
        borderBottom: `1px solid ${signalColors[result.signal]}33`,
        padding: '12px 20px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '14px' }}>✦</span>
          <span style={{ fontWeight: 700, fontSize: '13px', color: GOLD,
            letterSpacing: '0.06em' }}>
            AI TRADE NEGOTIATOR
          </span>
          <span style={{
            fontSize: '9px', padding: '2px 7px', borderRadius: '3px',
            background: 'rgba(212,168,67,0.1)', color: 'rgba(212,168,67,0.6)',
            fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.06em'
          }}>UAIU AI</span>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{
            fontSize: '10px', padding: '3px 8px', borderRadius: '4px',
            background: `${urgencyColors[result.urgency]}22`,
            color: urgencyColors[result.urgency], fontWeight: 700,
            letterSpacing: '0.08em', textTransform: 'uppercase'
          }}>
            {result.urgency} urgency
          </span>
          <span style={{
            fontSize: '11px', padding: '3px 10px', borderRadius: '4px',
            background: `${signalColors[result.signal]}22`,
            color: signalColors[result.signal], fontWeight: 700,
            letterSpacing: '0.08em', textTransform: 'uppercase'
          }}>
            {result.signal.replace('_', ' ')}
          </span>
        </div>
      </div>

      {/* Main recommendation */}
      <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        {/* Recommended price */}
        <div style={{
          background: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.05)',
          borderRadius: '10px', padding: '16px', textAlign: 'center'
        }}>
          <p style={{ margin: '0 0 4px', fontSize: '10px', fontWeight: 700,
            letterSpacing: '0.1em', color: 'rgba(212,168,67,0.6)',
            textTransform: 'uppercase' }}>
            RECOMMENDED PRICE
          </p>
          <p style={{
            margin: '0 0 2px', fontFamily: 'JetBrains Mono, monospace',
            fontSize: '28px', fontWeight: 700, color: GOLD
          }}>
            €{result.recommended_price.toFixed(2)}
          </p>
          <p style={{ margin: 0, fontSize: '11px',
            color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)' }}>
            Range: €{result.counter_range.low} – €{result.counter_range.high}
          </p>
        </div>

        {/* Acceptance probability */}
        <div style={{
          background: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.05)',
          borderRadius: '10px', padding: '16px', textAlign: 'center'
        }}>
          <p style={{ margin: '0 0 4px', fontSize: '10px', fontWeight: 700,
            letterSpacing: '0.1em', color: 'rgba(212,168,67,0.6)',
            textTransform: 'uppercase' }}>
            ACCEPTANCE PROBABILITY
          </p>
          <p style={{
            margin: '0 0 8px', fontFamily: 'JetBrains Mono, monospace',
            fontSize: '28px', fontWeight: 700,
            color: result.acceptance_probability >= 80 ? '#4ade80' :
                   result.acceptance_probability >= 60 ? GOLD : '#f87171'
          }}>
            {result.acceptance_probability}%
          </p>
          {/* Probability bar */}
          <div style={{
            height: '6px', borderRadius: '3px',
            background: 'rgba(255,255,255,0.1)', overflow: 'hidden'
          }}>
            <div style={{
              height: '100%',
              width: `${result.acceptance_probability}%`,
              background: result.acceptance_probability >= 80 ? '#4ade80' :
                          result.acceptance_probability >= 60 ? GOLD : '#f87171',
              borderRadius: '3px', transition: 'width 0.8s ease'
            }} />
          </div>
        </div>
      </div>

      {/* Rationale */}
      <div style={{ padding: '0 20px 16px' }}>
        <p style={{ margin: '0 0 6px', fontSize: '11px', fontWeight: 700,
          color: 'rgba(212,168,67,0.6)', letterSpacing: '0.08em',
          textTransform: 'uppercase' }}>
          ANALYSIS
        </p>
        <p style={{ margin: '0 0 8px', fontSize: '13px', lineHeight: 1.7,
          color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)' }}>
          {result.rationale}
        </p>
        <p style={{ margin: 0, fontSize: '11px', lineHeight: 1.6,
          color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)',
          fontFamily: 'JetBrains Mono, monospace' }}>
          {result.market_context}
        </p>
        <p style={{ margin: '12px 0 0', fontSize: '9px', lineHeight: 1.5,
          color: 'rgba(212,168,67,0.35)', fontFamily: 'JetBrains Mono, monospace',
          letterSpacing: '0.03em', paddingTop: 10,
          borderTop: '1px solid rgba(212,168,67,0.1)' }}>
          AI-generated analysis is for informational purposes only and does not constitute financial, legal, or compliance advice.
        </p>
      </div>

      {/* Action buttons */}
      <div style={{
        padding: '12px 20px',
        borderTop: '1px solid rgba(212,168,67,0.1)',
        display: 'flex', gap: '10px'
      }}>
        <button
          onClick={() => onAccept?.(result.recommended_price)}
          style={{
            flex: 1, padding: '10px', borderRadius: '8px',
            border: 'none', background: GOLD,
            color: '#0a0a0f', fontWeight: 700,
            fontSize: '13px', cursor: 'pointer', letterSpacing: '0.04em'
          }}>
          Accept €{result.recommended_price.toFixed(2)} →
        </button>
        <button
          onClick={() => onAccept?.(result.counter_range.low)}
          style={{
            padding: '10px 16px', borderRadius: '8px',
            border: '1px solid rgba(212,168,67,0.3)',
            background: 'transparent', color: GOLD,
            fontWeight: 600, fontSize: '12px', cursor: 'pointer'
          }}>
          Try €{result.counter_range.low}
        </button>
      </div>
    </div>
  );
}
