const C = {
  ink2: '#0d1220',
  gold: '#d4a843',
  goldborder: 'rgba(212,168,67,0.22)',
  cream3: 'rgba(242,234,216,0.35)',
};

export function useETSPrice(baseMid = 63.40) {
  return { price: baseMid, change: 0, changePct: 0, spread: 0 };
}

interface Props {
  midPrice?: number;
}

export function OrderBook({ midPrice: _midPrice = 63.40 }: Props) {
  return (
    <div style={{ marginTop: 40, border: `1px solid ${C.goldborder}`, background: C.ink2 }}>
      <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.goldborder}` }}>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: C.gold }}>Order Book</div>
      </div>
      <div style={{ padding: '32px 20px', textAlign: 'center' }}>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: C.cream3, lineHeight: 1.7 }}>
          Live order book will be available once trading opens.
          <br />
          Submit an RFQ to trade now.
        </div>
      </div>
    </div>
  );
}
