import { useEffect, useState, useRef, useCallback } from "react";

// ── TERMINAL MODE ─────────────────────────────────────────
// Press 'T' anywhere on the exchange to toggle terminal mode
// Full screen Bloomberg-style green-on-black terminal

interface TerminalTrade {
  id: string;
  side: string;
  standard: string;
  volume: number;
  price: number;
  time: string;
}

interface TerminalListing {
  name: string;
  standard: string;
  volume: number;
  price: number;
  origin: string;
  status: string;
}

interface TerminalModeProps {
  listings?: TerminalListing[];
  trades?: TerminalTrade[];
  indexPrice?: number;
  etsPrice?: number;
}

const TERMINAL_LINES = [
  "UAIU.LIVE/X CARBON EXCHANGE TERMINAL v2.1.0",
  "CONNECTED TO SUPABASE REALTIME ............. OK",
  "ANTHROPIC AI ENGINE ........................ ACTIVE",
  "SWISSX CARBON UNION REGISTRY .............. LINKED",
  "EU ETS PRICE FEED ......................... STREAMING",
  "SHA-256 RECEIPT CHAIN ..................... VERIFIED",
  "SOVEREIGN WEALTH FUND FLOOR ............... ACTIVE",
  "─".repeat(72),
];

const MOCK_LISTINGS: TerminalListing[] = [
  { name:"SWISSX B100 CARIBBEAN BIOFUEL", standard:"CORSIA", volume:500000, price:64.20, origin:"ANTIGUA", status:"LIVE" },
  { name:"TONGA CORAL RESTORATION BLUE CARBON", standard:"VCS", volume:280000, price:71.50, origin:"TONGA", status:"LIVE" },
  { name:"ROATAN REDD++ FOREST CONSERVATION", standard:"VCS REDD++", volume:180000, price:58.80, origin:"HONDURAS", status:"LIVE" },
  { name:"TUSKEGEE REGENERATIVE CITY", standard:"ACR", volume:40000, price:62.40, origin:"ALABAMA USA", status:"IN REVIEW" },
  { name:"EAST DELTA DENA REGENERATIVE ZONE", standard:"CAR", volume:25000, price:65.00, origin:"CALIFORNIA USA", status:"IN REVIEW" },
  { name:"ANTIGUA COASTAL RESILIENCE", standard:"GOLD STANDARD", volume:95000, price:68.90, origin:"ANTIGUA", status:"PENDING" },
];

const MOCK_TRADES: TerminalTrade[] = [
  { id:"UAIU-BUY-847291", side:"BUY", standard:"VCS", volume:2400, price:64.20, time:"14:22:18" },
  { id:"UAIU-SELL-193847", side:"SELL", standard:"CORSIA", volume:5000, price:58.80, time:"14:19:44" },
  { id:"UAIU-BUY-002841", side:"BUY", standard:"GOLD", volume:1200, price:71.50, time:"14:15:02" },
  { id:"UAIU-BUY-774920", side:"BUY", standard:"VCS", volume:8000, price:63.40, time:"14:08:33" },
  { id:"UAIU-SELL-009182", side:"SELL", standard:"ACR", volume:3500, price:61.90, time:"13:55:17" },
];

export function TerminalMode({
  listings = MOCK_LISTINGS,
  trades = [],
  indexPrice = 0,
  etsPrice = 0
}: TerminalModeProps) {
  const [active, setActive] = useState(false);
  const [bootLines, setBootLines] = useState<string[]>([]);
  const [booted, setBooted] = useState(false);
  const [time, setTime] = useState(new Date());
  const [cursor, setCursor] = useState(true);
  const [activePanel, setActivePanel] = useState<'market'|'trades'|'rfq'|'intel'>('market');
  const [command, setCommand] = useState('');
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const bootRef = useRef(false);

  // Hotkey T
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'T' && !e.ctrlKey && !e.metaKey &&
          !(e.target instanceof HTMLInputElement) &&
          !(e.target instanceof HTMLTextAreaElement)) {
        setActive(prev => !prev);
      }
      if (e.key === 'Escape') setActive(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Boot sequence
  useEffect(() => {
    if (!active || bootRef.current) return;
    bootRef.current = true;
    setBootLines([]);
    setBooted(false);
    let i = 0;
    const next = () => {
      if (i < TERMINAL_LINES.length) {
        setBootLines(prev => [...prev, TERMINAL_LINES[i]]);
        i++;
        setTimeout(next, i === 0 ? 0 : 120);
      } else {
        setTimeout(() => setBooted(true), 300);
      }
    };
    next();
  }, [active]);

  useEffect(() => {
    if (!active) { bootRef.current = false; setBootLines([]); setBooted(false); }
  }, [active]);

  // Clock
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, [active]);

  // Cursor blink
  useEffect(() => {
    const t = setInterval(() => setCursor(p => !p), 530);
    return () => clearInterval(t);
  }, []);

  const handleCommand = useCallback((cmd: string) => {
    const c = cmd.trim().toUpperCase();
    setCommandHistory(prev => [...prev, `> ${cmd}`, processCommand(c)]);
    setCommand('');
  }, []);

  const processCommand = (c: string): string => {
    if (c === 'HELP') return 'Commands: MARKET · TRADES · RFQ · INTEL · CLEAR · EXIT · PRICE · SPREAD';
    if (c === 'MARKET') { setActivePanel('market'); return 'Panel: MARKET LISTINGS'; }
    if (c === 'TRADES') { setActivePanel('trades'); return 'Panel: RECENT TRADES'; }
    if (c === 'RFQ') { setActivePanel('rfq'); return 'Panel: RFQ DESK'; }
    if (c === 'INTEL') { setActivePanel('intel'); return 'Panel: AI INTELLIGENCE'; }
    if (c === 'EXIT' || c === 'QUIT') { setActive(false); return 'Closing terminal...'; }
    if (c === 'CLEAR') { setCommandHistory([]); return ''; }
    if (c === 'PRICE') return `UAIU_CARIB_PREMIUM: €${indexPrice.toFixed(2)} · EU ETS SPOT: €${etsPrice.toFixed(2)}`;
    if (c === 'SPREAD') return `CARIBBEAN PREMIUM SPREAD: +€${(indexPrice - etsPrice).toFixed(2)} vs EU ETS`;
    if (c.startsWith('BUY ') || c.startsWith('SELL ')) return `ORDER RECEIVED: ${c} — Submit via RFQ Desk to execute`;
    return `Unknown command: ${c.toLowerCase()}. Type HELP for commands.`;
  };

  const G = '#00ff41';     // matrix green
  const DG = '#00cc33';    // dim green
  const YW = '#D4A843';    // gold
  const RD = '#ff4444';    // red
  const BG = '#000000';    // pure black
  const GB = '#001100';    // dark green bg

  const mono: React.CSSProperties = { fontFamily: "'Courier New', Courier, monospace" };

  if (!active) {
    return (
      <div style={{
        position:'fixed', bottom:'20px', right:'20px',
        background:'rgba(0,0,0,0.8)', border:'1px solid rgba(0,255,65,0.3)',
        borderRadius:'6px', padding:'6px 12px', zIndex:9000,
        cursor:'pointer', ...mono
      }} onClick={() => setActive(true)}>
        <span style={{fontSize:'10px', color:DG, letterSpacing:'0.1em'}}>
          PRESS <span style={{color:G, fontWeight:700}}>[T]</span> FOR TERMINAL
        </span>
      </div>
    );
  }

  return (
    <div style={{
      position:'fixed', inset:0, background:BG, zIndex:9999,
      display:'flex', flexDirection:'column', ...mono,
      overflow:'hidden'
    }}>
      {/* TOP BAR */}
      <div style={{
        background:GB, borderBottom:`1px solid ${DG}`,
        padding:'6px 16px', display:'flex', justifyContent:'space-between',
        alignItems:'center', flexShrink:0
      }}>
        <div style={{display:'flex', gap:'24px', alignItems:'center'}}>
          <span style={{color:YW, fontWeight:700, fontSize:'13px', letterSpacing:'0.1em'}}>
            UAIU.LIVE/X
          </span>
          <span style={{color:G, fontSize:'11px'}}>CARBON EXCHANGE TERMINAL</span>
          <span style={{color:DG, fontSize:'10px'}}>
            CARIB: <span style={{color:G}}>€{indexPrice.toFixed(2)}</span>
          </span>
          <span style={{color:DG, fontSize:'10px'}}>
            EU ETS: <span style={{color:'#88ff88'}}>€{etsPrice.toFixed(2)}</span>
          </span>
          <span style={{color:DG, fontSize:'10px'}}>
            SPREAD: <span style={{color:YW}}>+€{(indexPrice-etsPrice).toFixed(2)}</span>
          </span>
        </div>
        <div style={{display:'flex', gap:'16px', alignItems:'center'}}>
          <span style={{color:G, fontSize:'11px', letterSpacing:'0.08em'}}>
            {time.toLocaleTimeString('en-US',{hour12:false})} UTC
          </span>
          <span style={{
            background:'#001a00', border:`1px solid ${DG}`,
            color:G, fontSize:'10px', padding:'2px 8px', borderRadius:'3px',
            letterSpacing:'0.08em'
          }}>LIVE</span>
          <button onClick={() => setActive(false)} style={{
            background:'transparent', border:`1px solid ${RD}`,
            color:RD, fontSize:'11px', padding:'2px 10px',
            cursor:'pointer', borderRadius:'3px', ...mono
          }}>ESC</button>
        </div>
      </div>

      {!booted ? (
        // BOOT SCREEN
        <div style={{flex:1, padding:'24px 32px', overflowY:'auto'}}>
          {bootLines.map((line, i) => (
            <div key={i} style={{
              color: line.startsWith('─') ? DG : line.includes('OK') || line.includes('ACTIVE') || line.includes('LINKED') || line.includes('STREAMING') || line.includes('VERIFIED') ? G : '#88ff88',
              fontSize:'13px', lineHeight:'1.8', letterSpacing:'0.04em'
            }}>
              {line}
            </div>
          ))}
          {bootLines.length > 0 && !booted && (
            <span style={{color:G, fontSize:'13px'}}>
              INITIALIZING{cursor ? '█' : ' '}
            </span>
          )}
        </div>
      ) : (
        <div style={{flex:1, display:'flex', overflow:'hidden'}}>
          {/* LEFT: NAV PANEL */}
          <div style={{
            width:'160px', background:GB, borderRight:`1px solid ${DG}`,
            padding:'12px 0', flexShrink:0
          }}>
            {[
              {key:'market', label:'F1 MARKET'},
              {key:'trades', label:'F2 TRADES'},
              {key:'rfq',    label:'F3 RFQ DESK'},
              {key:'intel',  label:'F4 INTEL'},
            ].map(({key,label}) => (
              <div
                key={key}
                onClick={() => setActivePanel(key as any)}
                style={{
                  padding:'8px 16px', cursor:'pointer', fontSize:'11px',
                  letterSpacing:'0.08em', color: activePanel===key ? BG : DG,
                  background: activePanel===key ? G : 'transparent',
                  borderLeft: activePanel===key ? `3px solid ${YW}` : '3px solid transparent',
                  transition:'all 0.1s'
                }}
              >
                {label}
              </div>
            ))}
            <div style={{
              marginTop:'20px', padding:'16px',
              borderTop:`1px solid ${DG}`
            }}>
              <div style={{fontSize:'9px', color:DG, letterSpacing:'0.08em', marginBottom:'4px'}}>
                SWF FLOOR
              </div>
              <div style={{fontSize:'12px', color:YW, fontWeight:700}}>ACTIVE</div>
              <div style={{fontSize:'9px', color:DG, marginTop:'8px'}}>REGISTRY</div>
              <div style={{fontSize:'11px', color:G}}>LINKED</div>
              <div style={{fontSize:'9px', color:DG, marginTop:'8px'}}>AI ENGINE</div>
              <div style={{fontSize:'11px', color:G}}>ONLINE</div>
            </div>
          </div>

          {/* MAIN PANEL */}
          <div style={{flex:1, display:'flex', flexDirection:'column', overflow:'hidden'}}>
            {/* PANEL HEADER */}
            <div style={{
              background:GB, borderBottom:`1px solid ${DG}`,
              padding:'6px 16px', flexShrink:0, display:'flex', gap:'32px'
            }}>
              {activePanel === 'market' && (
                <>
                  <span style={{color:DG,fontSize:'10px'}}>LISTINGS: <span style={{color:G}}>{listings.length}</span></span>
                  <span style={{color:DG,fontSize:'10px'}}>LIVE: <span style={{color:G}}>{listings.filter(l=>l.status==='LIVE').length}</span></span>
                  <span style={{color:DG,fontSize:'10px'}}>TOTAL SUPPLY: <span style={{color:G}}>{listings.reduce((s,l)=>s+l.volume,0).toLocaleString()}t</span></span>
                </>
              )}
              {activePanel === 'trades' && (
                <span style={{color:DG,fontSize:'10px'}}>RECENT TRADES: <span style={{color:G}}>{trades.length}</span></span>
              )}
              {activePanel === 'rfq' && (
                <span style={{color:G,fontSize:'10px'}}>RFQ DESK — TYPE ORDERS BELOW</span>
              )}
              {activePanel === 'intel' && (
                <span style={{color:G,fontSize:'10px'}}>AI MARKET INTELLIGENCE — CLAUDE SONNET</span>
              )}
            </div>

            {/* PANEL CONTENT */}
            <div style={{flex:1, overflowY:'auto', padding:'8px 0'}}>

              {activePanel === 'market' && (
                <table style={{width:'100%', borderCollapse:'collapse', fontSize:'12px'}}>
                  <thead>
                    <tr style={{background:GB}}>
                      {['PROJECT','STANDARD','VOLUME (t)','PRICE €/t','ORIGIN','STATUS'].map(h => (
                        <th key={h} style={{
                          padding:'6px 16px', textAlign:'left',
                          color:YW, fontWeight:700, fontSize:'10px',
                          letterSpacing:'0.1em', borderBottom:`1px solid ${DG}`
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {listings.map((l,i) => (
                      <tr key={i} style={{
                        borderBottom:`1px solid #001800`,
                        background: i%2===0 ? '#000800' : BG
                      }}>
                        <td style={{padding:'8px 16px',color:G,fontWeight:700,fontSize:'11px'}}>{l.name}</td>
                        <td style={{padding:'8px 16px',color:'#88ff88',fontSize:'11px'}}>{l.standard}</td>
                        <td style={{padding:'8px 16px',color:G,fontSize:'11px'}}>{l.volume.toLocaleString()}</td>
                        <td style={{padding:'8px 16px',color:YW,fontWeight:700,fontSize:'12px'}}>€{l.price.toFixed(2)}</td>
                        <td style={{padding:'8px 16px',color:DG,fontSize:'11px'}}>{l.origin}</td>
                        <td style={{padding:'8px 16px'}}>
                          <span style={{
                            fontSize:'10px', fontWeight:700, letterSpacing:'0.08em',
                            color: l.status==='LIVE' ? G : l.status==='IN REVIEW' ? YW : '#888888'
                          }}>{l.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {activePanel === 'trades' && (
                <table style={{width:'100%', borderCollapse:'collapse', fontSize:'12px'}}>
                  <thead>
                    <tr style={{background:GB}}>
                      {['TRADE ID','SIDE','STANDARD','VOLUME (t)','PRICE €/t','TIME'].map(h => (
                        <th key={h} style={{
                          padding:'6px 16px', textAlign:'left',
                          color:YW, fontWeight:700, fontSize:'10px',
                          letterSpacing:'0.1em', borderBottom:`1px solid ${DG}`
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {trades.map((t,i) => (
                      <tr key={i} style={{
                        borderBottom:`1px solid #001800`,
                        background: i%2===0 ? '#000800' : BG
                      }}>
                        <td style={{padding:'8px 16px',color:G,fontFamily:'Courier New',fontSize:'11px'}}>{t.id}</td>
                        <td style={{padding:'8px 16px',fontWeight:700,fontSize:'11px',
                          color:t.side==='BUY'?'#00ff88':RD}}>{t.side}</td>
                        <td style={{padding:'8px 16px',color:'#88ff88',fontSize:'11px'}}>{t.standard}</td>
                        <td style={{padding:'8px 16px',color:G,fontSize:'11px'}}>{t.volume.toLocaleString()}</td>
                        <td style={{padding:'8px 16px',color:YW,fontWeight:700}}>€{t.price.toFixed(2)}</td>
                        <td style={{padding:'8px 16px',color:DG,fontSize:'11px'}}>{t.time}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {activePanel === 'rfq' && (
                <div style={{padding:'16px 24px'}}>
                  <div style={{color:DG,fontSize:'11px',marginBottom:'16px',lineHeight:2}}>
                    <div>SYNTAX: BUY [VOLUME] [STANDARD] [MAX_PRICE]</div>
                    <div>SYNTAX: SELL [VOLUME] [STANDARD] [MIN_PRICE]</div>
                    <div>EXAMPLE: BUY 50000 VCS 65.00</div>
                    <div>EXAMPLE: SELL 120000 CORSIA 58.50</div>
                    <div style={{color:'#005500',marginTop:'8px'}}>─────────────────────────────────────────</div>
                  </div>
                  {commandHistory.filter((_,i)=>i>commandHistory.length-12).map((line,i) => (
                    <div key={i} style={{
                      color: line.startsWith('>') ? G : '#88ff88',
                      fontSize:'12px', lineHeight:'1.8',
                      fontWeight: line.startsWith('>') ? 700 : 400
                    }}>{line}</div>
                  ))}
                </div>
              )}

              {activePanel === 'intel' && (
                <div style={{padding:'16px 24px'}}>
                  {[
                    {
                      tag:'EU ETS UPDATE',
                      text:'Carbon allowances hold above €63 amid tightening supply. Analysts expect further compression through Q3 as free allocations phase down for maritime operators under FuelEU Maritime regulation.',
                      signal:'BULLISH'
                    },
                    {
                      tag:'MARITIME COMPLIANCE',
                      text:'Cruise sector faces €2.1B carbon liability in 2026. Caribbean-origin credits with sovereign price floor protection drawing strong institutional interest. CORSIA Phase 1 demand accelerating.',
                      signal:'BULLISH'
                    },
                    {
                      tag:'CARIBBEAN SUPPLY',
                      text:'SwissX blue carbon projects in Tonga and Antigua entering ACR verification pipeline. Verified supply expected to reach institutional market within 60 days. Pre-sale RFQs processing.',
                      signal:'NEUTRAL'
                    },
                  ].map((card,i) => (
                    <div key={i} style={{
                      borderLeft:`3px solid ${G}`, paddingLeft:'16px',
                      marginBottom:'20px'
                    }}>
                      <div style={{color:YW,fontSize:'10px',fontWeight:700,
                        letterSpacing:'0.12em',marginBottom:'6px'}}>
                        [{card.tag}] — <span style={{color:G}}>{card.signal}</span>
                      </div>
                      <div style={{color:'#88ff88',fontSize:'12px',lineHeight:1.8}}>{card.text}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* COMMAND INPUT */}
            <div style={{
              background:GB, borderTop:`1px solid ${DG}`,
              padding:'8px 16px', flexShrink:0,
              display:'flex', alignItems:'center', gap:'8px'
            }}>
              <span style={{color:G, fontSize:'13px', fontWeight:700}}>UAIU:~$</span>
              <input
                ref={inputRef}
                value={command}
                onChange={e => setCommand(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleCommand(command);
                }}
                placeholder="type command or order... (HELP for list)"
                autoFocus
                style={{
                  flex:1, background:'transparent', border:'none', outline:'none',
                  color:G, fontSize:'13px', ...mono,
                  caretColor:G
                }}
              />
              {cursor && <span style={{color:G, fontSize:'13px'}}>█</span>}
            </div>
          </div>

          {/* RIGHT: TICKER PANEL */}
          <div style={{
            width:'180px', background:GB, borderLeft:`1px solid ${DG}`,
            padding:'12px 8px', flexShrink:0, overflowY:'auto'
          }}>
            <div style={{color:YW,fontSize:'10px',fontWeight:700,
              letterSpacing:'0.1em',marginBottom:'12px',textAlign:'center'}}>
              LIVE INDEX
            </div>
            {[
              {label:'CARIB PREMIUM', value:`€${indexPrice.toFixed(2)}`, color:G},
              {label:'EU ETS SPOT', value:`€${etsPrice.toFixed(2)}`, color:'#88ff88'},
              {label:'SPREAD', value:`+€${(indexPrice-etsPrice).toFixed(2)}`, color:YW},
              {label:'24H VOL', value:'128,400t', color:G},
              {label:'LIVE LISTINGS', value:`${listings.length}`, color:G},
              {label:'SWF FLOOR', value:'ACTIVE', color:G},
            ].map(({label,value,color},i) => (
              <div key={i} style={{
                borderBottom:`1px solid #001800`, padding:'8px 4px',
                textAlign:'center'
              }}>
                <div style={{fontSize:'9px',color:DG,letterSpacing:'0.08em',marginBottom:'3px'}}>{label}</div>
                <div style={{fontSize:'13px',fontWeight:700,color}}>{value}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
