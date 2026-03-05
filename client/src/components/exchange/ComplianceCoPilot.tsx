import { useState, useRef, useEffect } from "react";

// ── AI COMPLIANCE CO-PILOT ────────────────────────────────
// Floating persistent AI assistant on every page
// Powered by Claude Sonnet
// Knows the user's portfolio, current listings, market prices

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface CoPilotContext {
  portfolioTonnes?: number;
  portfolioSpend?: number;
  annualTarget?: number;
  currentIndexPrice?: number;
  etsPrice?: number;
  accountType?: string;
  listings?: { name: string; standard: string; price: number; tonnes: number }[];
}

const QUICK_QUESTIONS = [
  "How many credits do I need for Q3 EU ETS?",
  "What's the cheapest CORSIA credit available?",
  "Explain the Caribbean premium vs EU ETS",
  "When is my next compliance deadline?",
  "What's T+1 settlement mean?",
  "How does the SWF price floor work?",
];

const SYSTEM_PROMPT = `You are the UAIU Carbon Compliance Co-Pilot — an expert AI assistant for the UAIU.LIVE/X institutional carbon credit exchange.

You are a carbon market expert who knows:
- EU ETS mechanics, deadlines, surrender requirements, fines (€100/tonne for non-compliance)
- CORSIA Phase 1 aviation offsetting requirements
- IMO CII ratings and GHG strategy for maritime
- FuelEU Maritime regulations
- VCS, Gold Standard, ACR, CAR, CORSIA Eligible Unit verification standards
- Carbon credit pricing, spreads, and market dynamics
- How to calculate carbon liability from emissions data

UAIU Exchange context:
- Caribbean Premium Index current price: $INDEX_PRICE/tonne
- EU ETS spot: $ETS_PRICE/tonne  
- Caribbean premium spread: $SPREAD/tonne
- User portfolio: $PORTFOLIO_TONNES tonnes purchased, $PORTFOLIO_SPEND EUR spent
- Annual target: $ANNUAL_TARGET tonnes
- Available listings: $LISTINGS

When users ask compliance questions:
1. Give a direct, specific answer with numbers
2. If they need to buy credits, tell them exactly how many and at what price
3. Reference their portfolio data when relevant
4. Be concise — max 3-4 sentences unless they ask for detail
5. Always end with a concrete next action they can take on UAIU.LIVE/X

You are NOT a lawyer. Remind users to verify with their compliance officer for final decisions.`;

interface CoPilotProps {
  context?: CoPilotContext;
  isDark?: boolean;
}

export function AIComplianceCoPilot({ context = {}, isDark = true }: CoPilotProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [unread, setUnread] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const GOLD = '#D4A843';

  // Welcome message on first open
  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{
        id: '0',
        role: 'assistant',
        content: `Hello! I'm your Carbon Compliance Co-Pilot powered by Claude.\n\nI can help you with EU ETS obligations, CORSIA requirements, IMO compliance, credit calculations, and anything on UAIU.LIVE/X.\n\nWhat do you need help with today?`,
        timestamp: new Date()
      }]);
    }
    if (open) {
      setUnread(0);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const buildSystemPrompt = () => {
    return SYSTEM_PROMPT
      .replace('$INDEX_PRICE', String(context.currentIndexPrice || 64.20))
      .replace('$ETS_PRICE', String(context.etsPrice || 63.10))
      .replace('$SPREAD', String(((context.currentIndexPrice||64.20) - (context.etsPrice||63.10)).toFixed(2)))
      .replace('$PORTFOLIO_TONNES', String(context.portfolioTonnes || 0))
      .replace('$PORTFOLIO_SPEND', String(context.portfolioSpend || 0))
      .replace('$ANNUAL_TARGET', String(context.annualTarget || 'not set'))
      .replace('$LISTINGS', context.listings
        ? context.listings.slice(0,5).map(l => `${l.name} (${l.standard}) €${l.price}/t`).join(', ')
        : 'SwissX B100 CORSIA €64.20, Tonga VCS €71.50, Roatan REDD++ €58.80');
  };

  const sendMessage = async (text?: string) => {
    const messageText = text || input.trim();
    if (!messageText) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: messageText,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    // Build history for API
    const history = [...messages, userMsg].map(m => ({
      role: m.role,
      content: m.content
    }));

    try {
      const res = await fetch('/api/ai/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: history,
          system: buildSystemPrompt()
        }),
        signal: AbortSignal.timeout(20000)
      });

      let reply = '';
      if (res.ok) {
        const data = await res.json();
        reply = data.reply || '';
      }

      if (!reply) {
        // Intelligent fallback
        reply = generateFallback(messageText, context);
      }

      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: reply,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, assistantMsg]);
      if (!open) setUnread(prev => prev + 1);
    } catch {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: generateFallback(messageText, context),
        timestamp: new Date()
      }]);
    } finally {
      setLoading(false);
    }
  };

  const generateFallback = (q: string, ctx: CoPilotContext): string => {
    const ql = q.toLowerCase();
    if (ql.includes('how many') || ql.includes('need')) {
      const remaining = (ctx.annualTarget || 10000) - (ctx.portfolioTonnes || 0);
      return `Based on your portfolio, you've purchased ${(ctx.portfolioTonnes||0).toLocaleString()} tonnes against your ${(ctx.annualTarget||10000).toLocaleString()} tonne target. You still need ${remaining.toLocaleString()} tonnes. At the current index price of €${ctx.currentIndexPrice||64.20}/tonne, that's approximately €${(remaining*(ctx.currentIndexPrice||64.20)).toLocaleString()} to cover your full liability. I recommend submitting an RFQ on UAIU.LIVE/X#rfq.`;
    }
    if (ql.includes('corsia')) {
      return `CORSIA Phase 1 covers 2021-2035. Airlines must offset growth above 85% of their 2019 baseline emissions. The deadline for cancelling eligible units for the 2026 compliance year is December 15, 2026. UAIU has SwissX B100 CORSIA-eligible credits available at €${ctx.currentIndexPrice||64.20}/tonne with a sovereign price floor guarantee.`;
    }
    if (ql.includes('eu ets') || ql.includes('deadline')) {
      return `Key EU ETS 2026 deadlines: Verified emissions report due March 31, surrender allowances due September 30. Non-compliance fine is €100/tonne. Caribbean credits on UAIU.LIVE/X are EU ETS eligible at €${ctx.currentIndexPrice||64.20}/tonne — a €${((ctx.currentIndexPrice||64.20)-(ctx.etsPrice||63.10)).toFixed(2)} premium over spot with sovereign price floor protection.`;
    }
    if (ql.includes('price') || ql.includes('spread')) {
      return `Current UAIU Caribbean Premium Index: €${ctx.currentIndexPrice||64.20}/tonne. EU ETS spot: €${ctx.etsPrice||63.10}/tonne. Caribbean premium: +€${((ctx.currentIndexPrice||64.20)-(ctx.etsPrice||63.10)).toFixed(2)}/tonne. The premium reflects blue carbon quality, SWF price floor protection, and verified registry provenance. Most institutional buyers consider this a fair premium for compliance certainty.`;
    }
    return `Great question. For specific compliance calculations, please submit an RFQ at UAIU.LIVE/X#rfq or contact us at info@uaiu.live. I can help with general carbon market questions — what specifically would you like to know about EU ETS, CORSIA, or our available credits?`;
  };

  const formatMsg = (text: string) => text.split('\n').map((line, i) => (
    <span key={i}>{line}{i < text.split('\n').length - 1 && <br />}</span>
  ));

  return (
    <>
      {/* FLOATING BUTTON */}
      <div style={{
        position: 'fixed', bottom: '24px', right: '24px',
        zIndex: 9998, display: 'flex', flexDirection: 'column',
        alignItems: 'flex-end', gap: '8px'
      }}>
        {!open && (
          <div style={{
            background: 'rgba(13,27,62,0.9)',
            border: '1px solid rgba(212,168,67,0.3)',
            borderRadius: '8px', padding: '8px 14px',
            fontSize: '12px', color: 'rgba(212,168,67,0.8)',
            fontWeight: 600, whiteSpace: 'nowrap'
          }}>
            Carbon Compliance Co-Pilot ✦
          </div>
        )}
        <button
          onClick={() => setOpen(!open)}
          style={{
            width: '56px', height: '56px', borderRadius: '50%',
            border: `2px solid ${GOLD}`,
            background: open
              ? '#0d1b3e'
              : 'linear-gradient(135deg,#0d1b3e,#1a3060)',
            cursor: 'pointer', fontSize: '22px',
            boxShadow: `0 4px 20px rgba(212,168,67,0.3)`,
            position: 'relative',
            transition: 'all 0.2s'
          }}
        >
          {open ? '✕' : '✦'}
          {unread > 0 && !open && (
            <span style={{
              position: 'absolute', top: '-4px', right: '-4px',
              background: '#f87171', color: '#fff',
              borderRadius: '10px', padding: '1px 6px',
              fontSize: '10px', fontWeight: 700, minWidth: '18px',
              textAlign: 'center'
            }}>{unread}</span>
          )}
        </button>
      </div>

      {/* CHAT PANEL */}
      {open && (
        <div style={{
          position: 'fixed', bottom: '96px', right: '24px',
          width: 'clamp(300px, 90vw, 420px)',
          height: 'clamp(400px, 70vh, 580px)',
          background: isDark ? '#0d1b2e' : '#ffffff',
          border: `1px solid ${GOLD}44`,
          borderRadius: '16px', zIndex: 9997,
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          overflow: 'hidden'
        }}>
          {/* Header */}
          <div style={{
            padding: '14px 18px', flexShrink: 0,
            background: 'linear-gradient(135deg,#0d1b3e,#1a3060)',
            borderBottom: `1px solid ${GOLD}33`
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ margin: 0, fontWeight: 700, fontSize: '14px', color: GOLD,
                  letterSpacing: '0.04em' }}>
                  ✦ Compliance Co-Pilot
                </p>
                <p style={{ margin: '2px 0 0', fontSize: '10px',
                  color: 'rgba(212,168,67,0.5)', letterSpacing: '0.06em' }}>
                  POWERED BY CLAUDE SONNET
                </p>
              </div>
              <div style={{
                width: '8px', height: '8px', borderRadius: '50%',
                background: '#4ade80',
                boxShadow: '0 0 8px #4ade80'
              }} />
            </div>
          </div>

          {/* Messages */}
          <div style={{
            flex: 1, overflowY: 'auto', padding: '14px',
            display: 'flex', flexDirection: 'column', gap: '10px'
          }}>
            {messages.map(msg => (
              <div key={msg.id} style={{
                display: 'flex',
                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start'
              }}>
                {msg.role === 'assistant' && (
                  <div style={{
                    width: '24px', height: '24px', borderRadius: '50%',
                    background: 'rgba(212,168,67,0.2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '12px', flexShrink: 0, marginRight: '6px',
                    marginTop: '2px', color: GOLD
                  }}>✦</div>
                )}
                <div style={{
                  maxWidth: '82%', padding: '10px 13px', borderRadius: '12px',
                  background: msg.role === 'user'
                    ? 'rgba(212,168,67,0.12)'
                    : isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                  border: `1px solid ${msg.role === 'user'
                    ? 'rgba(212,168,67,0.2)' : 'rgba(255,255,255,0.06)'}`,
                  fontSize: '13px', lineHeight: 1.6,
                  color: isDark ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.85)',
                  borderBottomRightRadius: msg.role === 'user' ? '4px' : '12px',
                  borderBottomLeftRadius: msg.role === 'assistant' ? '4px' : '12px'
                }}>
                  {formatMsg(msg.content)}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0' }}>
                <div style={{
                  width: '24px', height: '24px', borderRadius: '50%',
                  background: 'rgba(212,168,67,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '12px', color: GOLD
                }}>✦</div>
                <div style={{
                  padding: '10px 14px', borderRadius: '12px',
                  background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  display: 'flex', gap: '4px', alignItems: 'center'
                }}>
                  {[0,1,2].map(i => (
                    <div key={i} style={{
                      width: '6px', height: '6px', borderRadius: '50%',
                      background: GOLD, opacity: 0.7,
                      animation: `bounce 1.2s ease-in-out ${i*0.2}s infinite`
                    }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Questions */}
          {messages.length <= 1 && (
            <div style={{
              padding: '8px 14px', flexShrink: 0,
              borderTop: '1px solid rgba(212,168,67,0.08)'
            }}>
              <p style={{ margin: '0 0 6px', fontSize: '10px', fontWeight: 700,
                color: 'rgba(212,168,67,0.4)', letterSpacing: '0.08em' }}>
                QUICK QUESTIONS
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                {QUICK_QUESTIONS.slice(0, 4).map((q, i) => (
                  <button key={i} onClick={() => sendMessage(q)} style={{
                    padding: '4px 10px', borderRadius: '20px', fontSize: '10px',
                    border: '1px solid rgba(212,168,67,0.2)',
                    background: 'transparent', color: GOLD,
                    cursor: 'pointer', fontWeight: 500
                  }}>{q}</button>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <div style={{
            padding: '10px 12px', flexShrink: 0,
            borderTop: '1px solid rgba(212,168,67,0.1)',
            display: 'flex', gap: '8px', alignItems: 'center'
          }}>
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              placeholder="Ask about compliance, credits, deadlines..."
              style={{
                flex: 1, padding: '9px 12px', borderRadius: '8px',
                border: '1px solid rgba(212,168,67,0.15)',
                background: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.8)',
                color: isDark ? '#ffffff' : '#0d1b3e',
                fontSize: '13px', outline: 'none', fontFamily: 'inherit'
              }}
            />
            <button
              onClick={() => sendMessage()}
              disabled={loading || !input.trim()}
              style={{
                width: '36px', height: '36px', borderRadius: '8px',
                border: 'none', flexShrink: 0,
                background: input.trim() && !loading ? GOLD : 'rgba(212,168,67,0.2)',
                color: input.trim() && !loading ? '#0a0a0f' : GOLD,
                fontWeight: 700, fontSize: '16px', cursor: 'pointer'
              }}>→</button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-6px); }
        }
      `}</style>
    </>
  );
}
