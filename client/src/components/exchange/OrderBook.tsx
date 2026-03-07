const C = {
  ink2: '#0d1220',
  gold: '#d4a843',
  goldborder: 'rgba(212,168,67,0.22)',
  cream3: 'rgba(242,234,216,0.35)',
};

const F = { mono: "'JetBrains Mono', monospace" };

export function useETSPrice(baseMid = 63.40) {
  return { price: baseMid, change: 0, changePct: 0, spread: 0 };
}

export function OrderBook() {
  return (
    <div style={{ marginTop: 40, border: `1px solid ${C.goldborder}`, background: C.ink2 }}>
      <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.goldborder}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: C.gold }}>Order Book</div>
      </div>
      <div style={{ padding: '24px 20px' }}>
        <p style={{ margin: 0, fontFamily: F.mono, fontSize: 12, color: C.cream3, lineHeight: 1.8 }}>
          Live order book will be available once trading opens. Submit an RFQ to trade now.
        </p>
        <p style={{ margin: '10px 0 0', fontFamily: F.mono, fontSize: 10, color: C.cream3 }}>
          For immediate execution support, contact desk@uaiu.live.
        </p>
      </div>
    </div>
  );
}
