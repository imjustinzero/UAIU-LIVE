import { useEffect, useRef, useState } from "react";

const CO2_PER_SECOND = 1400;

export function CarbonClock() {
  const startRef = useRef(Date.now());
  const rafRef = useRef<number>(0);
  const [tonnes, setTonnes] = useState(0);

  useEffect(() => {
    function tick() {
      const elapsed = (Date.now() - startRef.current) / 1000;
      setTonnes(Math.floor(elapsed * CO2_PER_SECOND));
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return (
    <div style={{
      marginTop: 48,
      padding: '24px 32px',
      background: 'rgba(212,168,67,0.06)',
      border: '1px solid rgba(212,168,67,0.18)',
      display: 'inline-block',
      textAlign: 'center',
    }}>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: '0.25em', textTransform: 'uppercase', color: 'rgba(212,168,67,0.7)', marginBottom: 10 }}>
        Tonnes of CO₂ emitted since you opened this page
      </div>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 32, fontWeight: 700, color: '#d4a843', letterSpacing: '0.05em' }}>
        {tonnes.toLocaleString()}
      </div>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(242,234,216,0.3)', marginTop: 8 }}>
        ~1,400 tonnes/second globally · IPCC 2023
      </div>
    </div>
  );
}
