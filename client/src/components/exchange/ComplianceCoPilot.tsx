import { useState, useRef, useEffect } from "react";
import DOMPurify from "dompurify";

// ── AI COMPLIANCE CO-PILOT ────────────────────────────────
// Floating persistent AI assistant on every page
// Powered by UAIU AI
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

const SYSTEM_PROMPT = `You are the UAIU.LIVE/X Institutional Carbon Intelligence Assistant operating within the UAIU Holdings Corp carbon credit procurement and execution platform.

Role and scope:
- Assist institutional buyers, project developers, brokers, and compliance officers.
- Support registry navigation, credit evaluation, MRV workflow guidance, and transaction support.
- Do not provide financial advice or legal counsel.

Core capabilities:
- Verra VCS and Gold Standard registry guidance and project lookup support
- REDD+, biogas, cookstove, solar, and related methodology interpretation
- UVS 13-criterion meta-certification scoring interpretation
- UCPI (UAIU Carbon Price Index) market context and benchmarking
- ESG reporting support (SEC climate disclosure, CSRD, TCFD)
- SHA-256 audit-chain integrity checks and transaction evidence guidance
- IoT project monitoring interpretation and due-diligence checklist support
- White-label API onboarding guidance for institutional partners

Persona priorities:
- Institutional buyers: compliance grade, permanence, additionality, co-benefits
- Project developers: registry pathways, MRV, issuance timelines
- Brokers/intermediaries: deal structure, escrow, T+1 settlement mechanics
- ESG/compliance officers: regulatory alignment and disclosure-ready documentation

UAIU Exchange context:
- UCPI current price: €$INDEX_PRICE/tonne
- EU ETS spot reference: €$ETS_PRICE/tonne
- UCPI vs EU ETS spread: €$SPREAD/tonne
- User portfolio: $PORTFOLIO_TONNES tonnes purchased, €$PORTFOLIO_SPEND spend
- Annual target: $ANNUAL_TARGET tonnes
- Available listings: $LISTINGS

Boundaries and compliance behavior:
- Never present carbon credit prices as guaranteed; frame as indicative with UCPI context.
- Never execute or confirm a transaction without explicit user confirmation and escrow authorization.
- Do not provide legal opinions on contract terms; direct users to qualified counsel when needed.
- Do not claim direct registry API access; guide users through verified platform integrations.
- Flag missing additionality documentation before recommending progression.
- Surface risks when relevant: permanence/buffer pool adequacy, double-counting or double-claiming, vintage age (>10 years), missing third-party verification, cross-border legal risk.

Escalation:
- If a user describes a transaction over $500,000, a novel project type not covered by existing methodologies, or a legal-liability-heavy regulatory request, clearly recommend handoff to a human advisor and provide a concise structured briefing for that handoff.

Tone:
- Institutional, precise, and factual.
- Keep navigation/lookups short; provide detailed analysis for methodology and due diligence questions.
- If uncertain, state uncertainty explicitly and provide verification steps.`;

interface CoPilotProps {
  context?: CoPilotContext;
  isDark?: boolean;
  kycStatus?: string;
}

export function AIComplianceCoPilot({ context = {}, isDark = true, kycStatus = 'not_started' }: CoPilotProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [unread, setUnread] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const GOLD = '#D4A843';
  const isVerified = kycStatus === 'verified';

  // Welcome message on first open
  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{
        id: '0',
        role: 'assistant',
        content: `Hello. I’m your UAIU Institutional Carbon Intelligence Assistant.\n\nI can support registry navigation (Verra/Gold Standard), methodology and MRV interpretation, UCPI context, and compliance-ready due diligence workflows.\n\nHow can I support your transaction or compliance objective today?`,
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
    if (!isVerified) return;
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

  const formatMsg = (text: string) => {
    const sanitized = DOMPurify.sanitize(
      text.replace(/\n/g, "<br />"),
      { ALLOWED_TAGS: ['p', 'strong', 'em', 'ul', 'li', 'br'], ALLOWED_ATTR: [] }
    );
    return <span dangerouslySetInnerHTML={{ __html: sanitized }} />;
  };

  return (
    <>
      {/* FLOATING BUTTON */}
      <div style={{
        position: 'fixed', bottom: 'calc(24px + env(safe-area-inset-bottom, 0px))', right: '24px',
        zIndex: 9998, display: 'flex', flexDirection: 'column',
        alignItems: 'flex-end', gap: '8px',
        pointerEvents: 'none'
      }}>
        {!open && (
          <div className="copilot-label" style={{
            background: 'rgba(13,27,62,0.9)',
            border: '1px solid rgba(212,168,67,0.3)',
            borderRadius: '8px', padding: '8px 14px',
            fontSize: '12px', color: 'rgba(212,168,67,0.8)',
            fontWeight: 600, whiteSpace: 'nowrap',
            pointerEvents: 'auto'
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
            transition: 'all 0.2s',
            pointerEvents: 'auto'
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

        <style>{`
          @media (max-width: 480px) {
            .copilot-label { display: none !important; }
          }
        `}</style>
      </div>

      {/* CHAT PANEL */}
      {open && (
        <div style={{
          position: 'fixed', bottom: 'clamp(80px, 12vh, 96px)', right: 'clamp(12px, 4vw, 24px)',
          width: 'clamp(280px, calc(100vw - 48px), 420px)',
          height: 'clamp(350px, 60vh, 580px)',
          maxHeight: 'calc(100vh - 120px)',
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
                  POWERED BY UAIU AI
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
            {!isVerified && (
              <div style={{
                border: '1px solid rgba(212,168,67,0.35)',
                background: 'rgba(212,168,67,0.08)',
                color: GOLD,
                fontSize: '13px',
                lineHeight: 1.6,
                padding: '14px',
                borderRadius: '10px'
              }}>
                Complete identity verification to unlock full compliance support.
              </div>
            )}
            {isVerified && messages.map(msg => (
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
            {isVerified && loading && (
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
                  <button key={i} onClick={() => sendMessage(q)} disabled={!isVerified} style={{
                    padding: '4px 10px', borderRadius: '20px', fontSize: '10px',
                    border: '1px solid rgba(212,168,67,0.2)',
                    background: 'transparent', color: GOLD,
                    cursor: isVerified ? 'pointer' : 'not-allowed', fontWeight: 500, opacity: isVerified ? 1 : 0.55
                  }}>{q}</button>
                ))}
              </div>
            </div>
          )}

          {/* AI disclaimer */}
          <div style={{ padding: '6px 14px', borderTop: '1px solid rgba(212,168,67,0.08)' }}>
            <p style={{ margin: 0, fontSize: '9px', fontFamily: 'JetBrains Mono, monospace', color: 'rgba(242,234,216,0.2)', letterSpacing: '0.03em', lineHeight: 1.5 }}>
              AI-generated analysis is for informational purposes only and does not constitute financial, legal, or compliance advice.
            </p>
          </div>

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
              disabled={!isVerified}
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
              disabled={!isVerified || loading || !input.trim()}
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
