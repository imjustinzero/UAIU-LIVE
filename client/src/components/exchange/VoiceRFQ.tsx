import { useState, useRef, useEffect } from "react";

// ── VOICE RFQ ─────────────────────────────────────────────
// Press mic button → speak order → AI parses → form fills
// Uses Web Speech API (Chrome/Edge/Safari) with fallback

interface VoiceRFQProps {
  onParsed: (data: {
    side?: string;
    standard?: string;
    volume_tonnes?: number;
    target_price_eur?: number;
    deadline?: string;
    notes?: string;
  }) => void;
  isDark?: boolean;
}

type VoiceState = 'idle' | 'listening' | 'processing' | 'done' | 'error' | 'unsupported';

export function VoiceRFQ({ onParsed, isDark = true }: VoiceRFQProps) {
  const [state, setState] = useState<VoiceState>('idle');
  const [transcript, setTranscript] = useState('');
  const [result, setResult] = useState('');
  const [error, setError] = useState('');
  const [supported, setSupported] = useState(true);
  const [volume, setVolume] = useState(0); // mic volume visualizer
  const recognitionRef = useRef<any>(null);
  const animRef = useRef<number>();
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) setSupported(false);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    };
  }, []);

  const startListening = async () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { setState('unsupported'); return; }

    setTranscript('');
    setResult('');
    setError('');
    setState('listening');

    // Volume visualizer via AudioContext
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const dataArr = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(dataArr);
        const avg = dataArr.reduce((a,b) => a+b, 0) / dataArr.length;
        setVolume(Math.min(100, avg * 2));
        animRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {}

    const recognition = new SR();
    recognitionRef.current = recognition;
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 1;

    recognition.onresult = (e: any) => {
      const t = Array.from(e.results)
        .map((r: any) => r[0].transcript)
        .join(' ');
      setTranscript(t);
    };

    recognition.onend = () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      setVolume(0);
      if (transcript || recognitionRef.current?._finalTranscript) {
        parseWithAI(recognitionRef.current?._finalTranscript || transcript);
      } else {
        setState('idle');
      }
    };

    recognition.onerror = (e: any) => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      setVolume(0);
      if (e.error === 'no-speech') {
        setState('idle');
      } else {
        setError(`Mic error: ${e.error}`);
        setState('error');
      }
    };

    recognition.onresult = (e: any) => {
      let final = '';
      let interim = '';
      for (let i = 0; i < e.results.length; i++) {
        if (e.results[i].isFinal) final += e.results[i][0].transcript;
        else interim += e.results[i][0].transcript;
      }
      recognitionRef.current._finalTranscript = final;
      setTranscript(final || interim);
    };

    recognition.start();
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
  };

  const parseWithAI = async (text: string) => {
    if (!text?.trim()) { setState('idle'); return; }
    setState('processing');

    try {
      const res = await fetch('/api/ai/parse-rfq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
        signal: AbortSignal.timeout(12000)
      });

      if (res.ok) {
        const data = await res.json();
        if (data.rfq) {
          onParsed(data.rfq);
          setResult(`✓ Form filled: ${data.rfq.side?.toUpperCase() || 'BUY'} ${data.rfq.volume_tonnes?.toLocaleString() || '?'} tonnes ${data.rfq.standard || 'VCS'}`);
          setState('done');
          return;
        }
      }
    } catch {}

    // Fallback local parse
    const vol = text.match(/(\d[\d,]*)\s*(thousand|k)?\s*tonn/i);
    const price = text.match(/under|below|at\s+(\d+(?:\.\d+)?)\s*(?:euro|eur|€)/i);
    const parsed = {
      side: /sell/i.test(text) ? 'sell' : 'buy',
      standard: /corsia/i.test(text) ? 'CORSIA' :
                /gold/i.test(text) ? 'Gold Standard' :
                /acr/i.test(text) ? 'ACR' :
                /car\b/i.test(text) ? 'CAR' : 'VCS',
      volume_tonnes: vol ? parseInt(vol[1].replace(/,/g,'')) * (/thousand|k/i.test(vol[2]||'') ? 1000 : 1) : 5000,
      target_price_eur: price ? parseFloat(price[1]) : undefined,
      notes: text
    };
    onParsed(parsed);
    setResult(`✓ Form filled: ${parsed.side.toUpperCase()} ${parsed.volume_tonnes.toLocaleString()}t ${parsed.standard}`);
    setState('done');
  };

  const reset = () => {
    setState('idle');
    setTranscript('');
    setResult('');
    setError('');
  };

  // Pulse animation for mic bars
  const bars = Array.from({ length: 5 }, (_, i) => {
    const h = state === 'listening'
      ? Math.max(4, (volume / 100) * 32 * (0.6 + 0.4 * Math.sin(Date.now() / 200 + i)))
      : state === 'processing' ? 16 + 8 * Math.sin(Date.now() / 150 + i) : 4;
    return h;
  });

  const GOLD = '#D4A843';
  const bg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)';

  if (!supported) {
    return (
      <div style={{
        padding:'12px 16px', borderRadius:'8px',
        border:'1px solid rgba(212,168,67,0.2)', background:bg,
        fontSize:'12px', color:'rgba(255,255,255,0.4)', marginBottom:'16px'
      }}>
        Voice RFQ not supported in this browser. Use Chrome or Edge.
      </div>
    );
  }

  return (
    <div style={{ marginBottom: '20px' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '12px',
        padding: '12px 16px', borderRadius: '10px',
        border: `1px solid ${state === 'listening' ? GOLD : 'rgba(212,168,67,0.2)'}`,
        background: state === 'listening'
          ? 'rgba(212,168,67,0.08)'
          : bg,
        transition: 'all 0.3s',
        flexWrap: 'wrap'
      }}>
        {/* MIC BUTTON */}
        <button
          onClick={state === 'listening' ? stopListening : startListening}
          disabled={state === 'processing'}
          style={{
            width: '44px', height: '44px', borderRadius: '50%',
            border: `2px solid ${state === 'listening' ? GOLD : 'rgba(212,168,67,0.4)'}`,
            background: state === 'listening'
              ? `radial-gradient(circle, rgba(212,168,67,0.3), rgba(212,168,67,0.05))`
              : 'rgba(212,168,67,0.1)',
            cursor: state === 'processing' ? 'wait' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '20px', flexShrink: 0,
            animation: state === 'listening' ? 'pulse-mic 1.2s ease-in-out infinite' : 'none',
            boxShadow: state === 'listening' ? `0 0 20px rgba(212,168,67,0.4)` : 'none'
          }}
        >
          {state === 'processing' ? '⟳' : state === 'done' ? '✓' : '🎙'}
        </button>

        {/* VOLUME BARS */}
        {state === 'listening' && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '3px', height: '36px'
          }}>
            {[20, 35, 55, 35, 20].map((maxH, i) => (
              <div key={i} style={{
                width: '4px', borderRadius: '2px',
                background: GOLD,
                height: `${Math.max(4, (volume / 100) * maxH + 4)}px`,
                transition: 'height 0.05s ease',
                opacity: 0.7 + (i === 2 ? 0.3 : 0)
              }} />
            ))}
          </div>
        )}

        {/* STATUS TEXT */}
        <div style={{ flex: 1, minWidth: '120px' }}>
          {state === 'idle' && (
            <div>
              <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: GOLD }}>
                🎙 Voice RFQ
              </p>
              <p style={{ margin: 0, fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>
                Click mic and speak your order
              </p>
            </div>
          )}
          {state === 'listening' && (
            <div>
              <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: GOLD }}>
                Listening...
              </p>
              <p style={{ margin: 0, fontSize: '11px',
                color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)',
                fontStyle: transcript ? 'normal' : 'italic' }}>
                {transcript || '"Buy 50,000 tonnes VCS under 65 euros..."'}
              </p>
            </div>
          )}
          {state === 'processing' && (
            <div>
              <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: GOLD }}>
                AI is parsing your order...
              </p>
              <p style={{ margin: 0, fontSize: '11px', color: 'rgba(255,255,255,0.5)',
                fontFamily: 'JetBrains Mono, monospace' }}>
                "{transcript}"
              </p>
            </div>
          )}
          {state === 'done' && (
            <div>
              <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: '#4ade80' }}>
                {result}
              </p>
              <p style={{ margin: 0, fontSize: '11px', color: 'rgba(255,255,255,0.4)',
                fontFamily: 'JetBrains Mono, monospace' }}>
                "{transcript}"
              </p>
              <p style={{ margin: '8px 0 0', fontSize: '9px', color: 'rgba(212,168,67,0.4)', fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.03em', lineHeight: 1.5 }}>
                AI-generated analysis is for informational purposes only and does not constitute financial, legal, or compliance advice.
              </p>
            </div>
          )}
          {state === 'error' && (
            <p style={{ margin: 0, fontSize: '13px', color: '#f87171' }}>{error}</p>
          )}
        </div>

        {/* RESET */}
        {(state === 'done' || state === 'error') && (
          <button onClick={reset} style={{
            padding: '6px 12px', borderRadius: '6px',
            border: '1px solid rgba(212,168,67,0.3)',
            background: 'transparent', color: GOLD,
            fontSize: '11px', cursor: 'pointer', fontWeight: 600
          }}>
            ↺ Again
          </button>
        )}
      </div>

      <style>{`
        @keyframes pulse-mic {
          0%, 100% { box-shadow: 0 0 10px rgba(212,168,67,0.3); }
          50% { box-shadow: 0 0 25px rgba(212,168,67,0.6), 0 0 50px rgba(212,168,67,0.2); }
        }
      `}</style>
    </div>
  );
}
