import { useState, useEffect, useRef } from "react";

const C = {
  ink: '#060810', ink2: '#0d1220', ink3: '#141e30',
  gold: '#d4a843', gold2: '#f0c96a', goldfaint: 'rgba(212,168,67,0.12)',
  goldborder: 'rgba(212,168,67,0.22)', cream: '#f2ead8',
  cream2: 'rgba(242,234,216,0.7)', cream3: 'rgba(242,234,216,0.35)',
  cream4: 'rgba(242,234,216,0.1)', green: '#22c55e',
};
const F = { mono: "'JetBrains Mono', monospace", syne: "'Syne', sans-serif", playfair: "'Playfair Display', serif" };

interface ParsedRFQ {
  side?: string;
  standard?: string;
  volume_tonnes?: number;
  target_price_eur?: number;
  deadline?: string;
  notes?: string;
}

interface ClaudeRFQProps {
  onParsed: (data: ParsedRFQ) => void;
}

export function ClaudeRFQAssistant({ onParsed }: ClaudeRFQProps) {
  const [expanded, setExpanded] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState('');
  const [parsed, setParsed] = useState<ParsedRFQ | null>(null);

  async function runAssistant() {
    if (!input.trim()) return;
    setLoading(true);
    setResponse('');
    setParsed(null);
    try {
      const res = await fetch('/api/exchange/ai-rfq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: input }),
      });
      const data = await res.json();
      if (data.parsed) {
        setParsed(data.parsed);
        setResponse(data.summary || 'RFQ fields extracted successfully.');
      } else {
        setResponse(data.error || 'Unable to parse your request. Please try again with more detail.');
      }
    } catch {
      setResponse('AI Assistant unavailable. Please fill the form manually.');
    }
    setLoading(false);
  }

  return (
    <div style={{ marginBottom: 32, border: `1px solid ${C.goldborder}`, background: C.ink2 }}>
      <button
        onClick={() => setExpanded(e => !e)}
        style={{ width: '100%', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'none', border: 'none', cursor: 'pointer' }}
        data-testid="button-ai-rfq-toggle"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 8, height: 8, background: C.gold, borderRadius: '50%' }} />
          <span style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: C.gold }}>Try AI Assistant</span>
          <span style={{ fontFamily: F.mono, fontSize: 9, color: C.cream3 }}>— Describe what you need in plain English</span>
        </div>
        <span style={{ color: C.gold, fontSize: 14 }}>{expanded ? '−' : '+'}</span>
      </button>

      {expanded && (
        <div style={{ padding: '0 20px 20px' }}>
          <div style={{ position: 'relative' }}>
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder='e.g. "I need 50,000 tonnes of blue carbon credits for EU ETS compliance by Q3 2025"'
              rows={3}
              style={{ width: '100%', background: C.ink, border: `1px solid ${C.goldborder}`, color: C.cream, padding: '12px 16px', fontFamily: F.mono, fontSize: 12, outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
              data-testid="input-ai-rfq"
            />
          </div>
          <button
            onClick={runAssistant}
            disabled={loading || !input.trim()}
            style={{ marginTop: 10, background: loading ? C.ink3 : C.gold, color: C.ink, padding: '11px 24px', fontFamily: F.syne, fontSize: 11, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', border: 'none', cursor: loading ? 'not-allowed' : 'pointer' }}
            data-testid="button-ai-rfq-run"
          >
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ display: 'inline-block', width: 6, height: 6, background: C.gold, borderRadius: '50%', animation: 'pulseAnim 1s infinite' }} />
                <span style={{ color: C.gold }}>Analyzing...</span>
              </span>
            ) : 'Parse with AI →'}
          </button>

          {response && (
            <div style={{ marginTop: 14, padding: '14px 16px', background: C.ink, border: `1px solid ${parsed ? 'rgba(34,197,94,0.3)' : C.goldborder}` }}>
              <div style={{ fontFamily: F.mono, fontSize: 11, color: parsed ? C.green : C.cream3, marginBottom: parsed ? 12 : 0 }}>{response}</div>
              {parsed && (
                <button
                  onClick={() => onParsed(parsed)}
                  style={{ marginTop: 8, background: C.green, color: C.ink, padding: '9px 20px', fontFamily: F.syne, fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', border: 'none', cursor: 'pointer' }}
                  data-testid="button-ai-rfq-apply"
                >
                  Apply to Form →
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface IntelCard { eyebrow: string; headline: string; summary: string; }

const MOCK_INTEL: IntelCard[] = [
  {
    eyebrow: 'EU ETS Market',
    headline: 'European allowances hold above €63 amid power sector demand surge',
    summary: 'EUA futures remained resilient this week as utility buyers absorbed supply ahead of winter. Analysts cite tightening supply caps under Phase IV as the primary price floor mechanism.',
  },
  {
    eyebrow: 'Shipping Emissions',
    headline: 'IMO 2030 compliance deadline accelerates Caribbean blue carbon demand',
    summary: 'Shipping companies facing 2030 CII ratings are moving early into verified Caribbean blue carbon credits. UAIU sources report 3x inquiry volume vs same period last year.',
  },
  {
    eyebrow: 'Caribbean Carbon Supply',
    headline: 'Antigua and Roatan projects enter final verification; listing expected Q2',
    summary: 'Two flagship Caribbean carbon projects — Antigua coastal seagrass and Roatan reef restoration — have cleared SwissX preliminary review and are expected to list on UAIU.LIVE/X in Q2.',
  },
];

interface AIIntelProps {
  refreshIntervalMs?: number;
}

export function AIMarketIntelligence({ refreshIntervalMs = 4 * 60 * 60 * 1000 }: AIIntelProps) {
  const [cards, setCards] = useState<IntelCard[]>(MOCK_INTEL);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  async function fetchIntelligence() {
    setLoading(true);
    try {
      const res = await fetch('/api/exchange/ai-intelligence', { method: 'POST' });
      const data = await res.json();
      if (data.cards && Array.isArray(data.cards) && data.cards.length === 3) {
        setCards(data.cards);
        setLastUpdated(new Date());
      }
    } catch {
      // silent — keep mock data
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchIntelligence();
    const interval = setInterval(fetchIntelligence, refreshIntervalMs);
    return () => clearInterval(interval);
  }, []);

  return (
    <section id="intelligence" style={{ background: C.ink2, borderTop: `1px solid ${C.goldborder}`, borderBottom: `1px solid ${C.goldborder}` }}>
      <div style={{ maxWidth: 1440, margin: '0 auto', padding: '100px 52px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 56, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: '0.25em', textTransform: 'uppercase', color: C.gold, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ width: 24, height: 1, background: C.gold, display: 'inline-block' }} />
              AI Market Intelligence
              {loading && <span style={{ fontFamily: F.mono, fontSize: 9, color: C.cream3 }}>— refreshing...</span>}
            </div>
            <h2 style={{ fontFamily: F.playfair, fontSize: 'clamp(32px,4vw,52px)', fontWeight: 900, color: C.cream, margin: 0, lineHeight: 1.1 }}>
              The daily briefing.
            </h2>
          </div>
          <div style={{ fontFamily: F.mono, fontSize: 9, color: C.cream3, letterSpacing: '0.12em' }}>
            Updated {lastUpdated.toLocaleTimeString()} · Powered by Claude
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 24 }}>
          {cards.map((card, i) => (
            <div key={i} style={{ background: C.ink, border: `1px solid ${C.goldborder}`, padding: '36px 32px', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg,transparent,${C.gold},transparent)` }} />
              <div style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: '0.22em', textTransform: 'uppercase', color: C.gold, marginBottom: 16 }}>{card.eyebrow}</div>
              <div style={{ fontFamily: F.playfair, fontSize: 18, fontWeight: 700, color: C.cream, lineHeight: 1.4, marginBottom: 16 }}>{card.headline}</div>
              <div style={{ fontFamily: F.syne, fontSize: 13, color: C.cream3, lineHeight: 1.7 }}>{card.summary}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
