import { useEffect, useState } from "react";

const C = {
  ink2: '#0d1220',
  gold: '#d4a843',
  goldborder: 'rgba(212,168,67,0.22)',
  cream: '#f2ead8',
  cream3: 'rgba(242,234,216,0.35)',
};

const F = { mono: "'JetBrains Mono', monospace" };

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

export function OrderBook() {
  return (
    <div style={{ marginTop: 40, border: `1px solid ${C.goldborder}`, background: C.ink2 }}>
      <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.goldborder}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: C.gold }}>Order Book</div>
      </div>
      <div style={{ padding: '24px 20px' }}>
        <p style={{ margin: 0, fontFamily: F.mono, fontSize: 12, color: C.cream, lineHeight: 1.8 }}>
          Live order book will be available once trading opens. Submit an RFQ to trade now.
        </p>
        <p style={{ margin: '10px 0 0', fontFamily: F.mono, fontSize: 10, color: C.cream3 }}>
          For immediate execution support, contact desk@uaiu.live.
        </p>
      </div>
    </div>
  );
}
