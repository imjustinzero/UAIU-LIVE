import { useEffect, useState, useRef } from "react";

const C = {
  ink: '#060810',
  ink2: '#0d1220',
  ink3: '#141e30',
  gold: '#d4a843',
  goldborder: 'rgba(212,168,67,0.22)',
  cream: '#f2ead8',
  cream3: 'rgba(242,234,216,0.35)',
  green: '#22c55e',
  greenfaint: 'rgba(34,197,94,0.06)',
  red: '#ef4444',
  redfaint: 'rgba(239,68,68,0.06)',
};

const F = { mono: "'JetBrains Mono', monospace", syne: "'Syne', sans-serif" };

interface Level { price: number; volume: number; total: number; }

function genLevels(mid: number, side: 'bid' | 'ask', count = 5): Level[] {
  const levels: Level[] = [];
  let total = 0;
  for (let i = 0; i < count; i++) {
    const spread = (i + 1) * (0.05 + Math.random() * 0.08);
    const price = side === 'bid' ? mid - spread : mid + spread;
    const volume = Math.floor(500 + Math.random() * 9500);
    total += volume;
    levels.push({ price, volume, total });
  }
  return levels;
}

function jitter(levels: Level[], mid: number, side: 'bid' | 'ask'): Level[] {
  return levels.map((l, i) => {
    const delta = (Math.random() - 0.5) * 0.04;
    const newPrice = l.price + delta;
    const newVol = Math.max(100, l.volume + Math.floor((Math.random() - 0.5) * 800));
    const newTotal = levels.slice(0, i + 1).reduce((s, _, j) => {
      return s + (j === i ? newVol : levels[j].volume);
    }, 0);
    return { price: newPrice, volume: newVol, total: newTotal };
  });
}

export function useETSPrice(baseMid = 63.40) {
  const [price, setPrice] = useState(baseMid - 3.2);
  const [change, setChange] = useState(-0.41);
  const [changePct, setChangePct] = useState(-0.64);
  const [spread, setSpread] = useState(baseMid - (baseMid - 3.2));

  useEffect(() => {
    const interval = setInterval(() => {
      setPrice(prev => {
        const next = prev + (Math.random() - 0.5) * 0.08;
        const clamped = Math.max(58, Math.min(72, next));
        setChange(+(clamped - (baseMid - 3.2)).toFixed(2));
        setChangePct(+((clamped - (baseMid - 3.2)) / (baseMid - 3.2) * 100).toFixed(2));
        setSpread(+(baseMid - clamped).toFixed(2));
        return clamped;
      });
    }, 6000);
    return () => clearInterval(interval);
  }, [baseMid]);

  return { price, change, changePct, spread };
}

interface Props {
  midPrice?: number;
}

export function OrderBook({ midPrice = 63.40 }: Props) {
  const [bids, setBids] = useState<Level[]>(() => genLevels(midPrice, 'bid'));
  const [asks, setAsks] = useState<Level[]>(() => genLevels(midPrice, 'ask'));
  const spreadVal = asks[0] && bids[0] ? asks[0].price - bids[0].price : 0;
  const midRef = useRef(midPrice);
  midRef.current = midPrice;

  useEffect(() => {
    const interval = setInterval(() => {
      setBids(prev => jitter(prev, midRef.current, 'bid'));
      setAsks(prev => jitter(prev, midRef.current, 'ask'));
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  const col: React.CSSProperties = { fontFamily: F.mono, fontSize: 10, color: C.cream3, letterSpacing: '0.12em', textTransform: 'uppercase', padding: '8px 12px', textAlign: 'right' as const };
  const cell = (color: string): React.CSSProperties => ({ fontFamily: F.mono, fontSize: 11, color, padding: '7px 12px', textAlign: 'right' as const, borderTop: `1px solid rgba(212,168,67,0.07)` });

  return (
    <div style={{ marginTop: 40, border: `1px solid ${C.goldborder}`, background: C.ink2 }}>
      <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.goldborder}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: C.gold }}>Order Book</div>
        <div style={{ fontFamily: F.mono, fontSize: 9, color: C.cream3, letterSpacing: '0.1em' }}>Spread: <span style={{ color: C.gold }}>€{spreadVal.toFixed(3)}</span></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', background: C.ink3 }}>
            <div style={col}>Price</div><div style={col}>Volume</div><div style={col}>Total</div>
          </div>
          {asks.slice().reverse().map((a, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', position: 'relative' }}>
              <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, background: C.redfaint, width: `${Math.min(100, (a.volume / 10000) * 100)}%` }} />
              <div style={cell(C.red)}>€{a.price.toFixed(2)}</div>
              <div style={cell(C.cream)}>{a.volume.toLocaleString()}</div>
              <div style={cell(C.cream3)}>{a.total.toLocaleString()}</div>
            </div>
          ))}
          <div style={{ textAlign: 'center', padding: '10px', borderTop: `1px solid ${C.goldborder}`, fontFamily: F.mono, fontSize: 10, color: C.gold, letterSpacing: '0.12em' }}>
            ASKS ▲
          </div>
        </div>
        <div style={{ borderLeft: `1px solid ${C.goldborder}` }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', background: C.ink3 }}>
            <div style={col}>Price</div><div style={col}>Volume</div><div style={col}>Total</div>
          </div>
          {bids.map((b, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', position: 'relative' }}>
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, background: C.greenfaint, width: `${Math.min(100, (b.volume / 10000) * 100)}%` }} />
              <div style={cell(C.green)}>€{b.price.toFixed(2)}</div>
              <div style={cell(C.cream)}>{b.volume.toLocaleString()}</div>
              <div style={cell(C.cream3)}>{b.total.toLocaleString()}</div>
            </div>
          ))}
          <div style={{ textAlign: 'center', padding: '10px', borderTop: `1px solid ${C.goldborder}`, fontFamily: F.mono, fontSize: 10, color: C.green, letterSpacing: '0.12em' }}>
            BIDS ▼
          </div>
        </div>
      </div>
    </div>
  );
}
