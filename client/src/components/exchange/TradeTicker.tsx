import { useEffect, useRef, useState } from "react";

export interface TickerTrade {
  id: string;
  side: string;
  standard: string;
  volume: number;
  price: number;
  ago: string;
}

function formatTrade(t: TickerTrade) {
  return `${t.id} · ${t.standard} · ${t.volume.toLocaleString()}t · €${t.price.toFixed(2)} · ${t.ago}`;
}

interface Props {
  newTrades?: TickerTrade[];
}

export function TradeTicker({ newTrades = [] }: Props) {
  const [trades, setTrades] = useState<TickerTrade[]>([]);
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
      position: 'fixed',
      top: 'clamp(64px, 8vh, 80px)',
      left: 0,
      right: 0,
      zIndex: 499,
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

      {trades.length === 0 ? (
        <div style={{
          flex: 1,
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 10,
          letterSpacing: '0.1em',
          color: 'rgba(242,234,216,0.6)',
          padding: '0 16px',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          Awaiting first trade — submit an RFQ to start.
        </div>
      ) : (
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
      )}
    </div>
  );
}
