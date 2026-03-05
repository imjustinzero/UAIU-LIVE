import { useEffect, useRef, useState } from "react";

export interface TickerTrade {
  id: string;
  side: string;
  standard: string;
  volume: number;
  price: number;
  ago: string;
}

const SEED_TRADES: TickerTrade[] = [
  { id: 'UAIU-BUY-847291', side: 'BUY', standard: 'VCS', volume: 2400, price: 64.20, ago: '2m ago' },
  { id: 'UAIU-SELL-391047', side: 'SELL', standard: 'EU ETS', volume: 5000, price: 63.85, ago: '4m ago' },
  { id: 'UAIU-BUY-102938', side: 'BUY', standard: 'Gold Std', volume: 800, price: 18.90, ago: '7m ago' },
  { id: 'UAIU-BUY-774521', side: 'BUY', standard: 'SwissX B100', volume: 12000, price: 71.40, ago: '11m ago' },
  { id: 'UAIU-SELL-448302', side: 'SELL', standard: 'Blue Carbon', volume: 3200, price: 45.50, ago: '15m ago' },
  { id: 'UAIU-BUY-901234', side: 'BUY', standard: 'CORSIA', volume: 7500, price: 29.70, ago: '19m ago' },
  { id: 'UAIU-BUY-234521', side: 'BUY', standard: 'VCS', volume: 1800, price: 12.40, ago: '23m ago' },
  { id: 'UAIU-SELL-667890', side: 'SELL', standard: 'EU ETS', volume: 9000, price: 63.40, ago: '28m ago' },
  { id: 'UAIU-BUY-112233', side: 'BUY', standard: 'REDD++', volume: 4400, price: 58.20, ago: '33m ago' },
  { id: 'UAIU-BUY-998877', side: 'BUY', standard: 'EU Aviation', volume: 6200, price: 68.20, ago: '41m ago' },
  { id: 'UAIU-SELL-554433', side: 'SELL', standard: 'Gold Std', volume: 2100, price: 18.70, ago: '48m ago' },
  { id: 'UAIU-BUY-321098', side: 'BUY', standard: 'SwissX B100', volume: 15000, price: 71.80, ago: '55m ago' },
];

function formatTrade(t: TickerTrade) {
  return `${t.id} · ${t.standard} · ${t.volume.toLocaleString()}t · €${t.price.toFixed(2)} · ${t.ago}`;
}

interface Props {
  newTrades?: TickerTrade[];
}

export function TradeTicker({ newTrades = [] }: Props) {
  const [trades, setTrades] = useState<TickerTrade[]>(SEED_TRADES);
  const prevNewLen = useRef(0);

  useEffect(() => {
    if (newTrades.length > prevNewLen.current) {
      setTrades(prev => [...newTrades.slice(prevNewLen.current), ...prev].slice(0, 20));
      prevNewLen.current = newTrades.length;
    }
  }, [newTrades]);

  const allTrades = [...trades, ...trades];

  return (
    <div style={{
      background: '#060810',
      borderBottom: '1px solid rgba(212,168,67,0.22)',
      height: 36,
      overflow: 'hidden',
      display: 'flex',
      alignItems: 'center',
      position: 'sticky',
      top: 0,
      zIndex: 600,
    }}>
      <div style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 9,
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        color: '#d4a843',
        whiteSpace: 'nowrap',
        padding: '0 16px',
        borderRight: '1px solid rgba(212,168,67,0.2)',
        flexShrink: 0,
        opacity: 0.7,
      }}>
        LIVE TRADES
      </div>
      <div style={{ overflow: 'hidden', flex: 1 }}>
        <div style={{
          display: 'flex',
          animation: 'tickerMove 80s linear infinite',
          whiteSpace: 'nowrap',
        }}>
          {allTrades.map((t, i) => (
            <span key={i} style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 9,
              letterSpacing: '0.12em',
              color: t.side === 'BUY' ? '#22c55e' : '#ef4444',
              padding: '0 28px',
              borderRight: '1px solid rgba(212,168,67,0.1)',
            }}>
              {formatTrade(t)}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
