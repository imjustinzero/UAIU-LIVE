const BASE_PRICES: Record<string, number> = {
  'EU ETS':    63.40,
  'VCS B100':  71.80,
  'GOLD STD':  58.20,
  'BLUE CARB': 45.60,
  'CORSIA':    29.70,
  'REC':       22.40,
};

interface PricePoint { time: number; open: number; high: number; low: number; close: number; }
interface LivePrice  { symbol: string; price: number; change: number; changePct: number; up: boolean; }

const history: Record<string, PricePoint[]> = {};
const current: Record<string, number> = { ...BASE_PRICES };

function randomWalk(price: number, volatility = 0.008): number {
  const change = price * volatility * (Math.random() * 2 - 1);
  const drift  = price * 0.0002;
  return Math.max(price * 0.5, price + change + drift);
}

function buildHistory(symbol: string, basePrice: number): PricePoint[] {
  const points: PricePoint[] = [];
  let price = basePrice * (0.85 + Math.random() * 0.1);
  const now = Date.now();
  for (let i = 90; i >= 0; i--) {
    const open  = price;
    const c1    = randomWalk(price, 0.012);
    const c2    = randomWalk(c1, 0.012);
    const high  = Math.max(open, c1, c2) * (1 + Math.random() * 0.005);
    const low   = Math.min(open, c1, c2) * (1 - Math.random() * 0.005);
    const close = c2;
    points.push({ time: now - i * 86400000, open, high, low, close });
    price = close;
  }
  return points;
}

for (const [sym, price] of Object.entries(BASE_PRICES)) {
  history[sym] = buildHistory(sym, price);
  current[sym] = history[sym][history[sym].length - 1].close;
}

setInterval(() => {
  for (const sym of Object.keys(current)) {
    const prev  = current[sym];
    const next  = randomWalk(prev, 0.003);
    current[sym] = next;
    const last  = history[sym][history[sym].length - 1];
    last.close  = next;
    last.high   = Math.max(last.high, next);
    last.low    = Math.min(last.low,  next);
  }
}, 30000);

export function getLivePrices(): LivePrice[] {
  return Object.entries(current).map(([symbol, price]) => {
    const pts   = history[symbol];
    const prev  = pts[pts.length - 2]?.close ?? price;
    const change    = price - prev;
    const changePct = (change / prev) * 100;
    return { symbol, price: +price.toFixed(2), change: +change.toFixed(2), changePct: +changePct.toFixed(2), up: change >= 0 };
  });
}

export function getPriceHistory(symbol: string): PricePoint[] {
  return history[symbol] ?? [];
}

export function getAllSymbols(): string[] {
  return Object.keys(BASE_PRICES);
}
