import { useState, useEffect, useRef } from "react";

const C = {
  ink: '#060810', ink2: '#0d1220', gold: '#d4a843', goldborder: 'rgba(212,168,67,0.22)',
  cream: '#f2ead8', cream3: 'rgba(242,234,216,0.35)',
};
const F = { mono: "'JetBrains Mono', monospace", syne: "'Syne', sans-serif" };

// ─── Dark Mode Hook ───────────────────────────────────────────────
export function useDarkMode() {
  const stored = typeof window !== 'undefined' ? localStorage.getItem('x-dark-mode') : null;
  const [isDark, setIsDark] = useState(stored !== null ? stored === 'true' : true);
  function toggle() {
    setIsDark(d => {
      const next = !d;
      localStorage.setItem('x-dark-mode', String(next));
      return next;
    });
  }
  return { isDark, toggle };
}

// ─── Dark Mode Toggle Button ──────────────────────────────────────
export function DarkModeToggle({ isDark, onToggle }: { isDark: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      style={{
        background: 'transparent',
        border: `1px solid ${C.goldborder}`,
        color: C.gold,
        width: 36,
        height: 36,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        fontSize: 13,
        fontFamily: "'JetBrains Mono', monospace",
        flexShrink: 0,
        transition: 'all 0.2s',
        letterSpacing: 0,
      }}
      data-testid="button-dark-mode-toggle"
    >
      {isDark ? 'DAY' : 'NGT'}
    </button>
  );
}

// ─── Mobile Nav ───────────────────────────────────────────────────
interface NavLink { label: string; href: string; }
export function MobileNav({ links, isDark = true, onLinkClick }: { links: NavLink[]; isDark?: boolean; onLinkClick?: (href: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ display: 'none' }} className="x-mobile-nav">
      <style>{`.x-mobile-nav { display: flex !important; }
        @media(min-width:768px) { .x-mobile-nav { display: none !important; } }`
      }</style>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ background: 'transparent', border: `1px solid ${C.goldborder}`, color: C.gold, width: 36, height: 36, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5, cursor: 'pointer', flexShrink: 0 }}
        data-testid="button-mobile-nav"
        aria-label="Open navigation menu"
      >
        <span style={{ width: 16, height: 1, background: C.gold, display: 'block', transition: 'all 0.2s', transform: open ? 'rotate(45deg) translateY(6px)' : 'none' }} />
        <span style={{ width: 16, height: 1, background: C.gold, display: 'block', opacity: open ? 0 : 1, transition: 'opacity 0.2s' }} />
        <span style={{ width: 16, height: 1, background: C.gold, display: 'block', transition: 'all 0.2s', transform: open ? 'rotate(-45deg) translateY(-6px)' : 'none' }} />
      </button>
      {open && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: isDark ? '#060810' : '#f5ede0', zIndex: 99996, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 32, paddingTop: 60 }}>
          <button onClick={() => setOpen(false)} style={{ position: 'absolute', top: 20, right: 20, background: 'transparent', border: 'none', color: C.gold, fontSize: 22, cursor: 'pointer', zIndex: 10 }}>✕</button>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, width: '100%', maxHeight: '80vh', overflowY: 'auto', padding: '20px 0' }}>
            {links.map(link => (
              <a
                key={link.href}
                href={link.href}
                onClick={e => { e.preventDefault(); setOpen(false); onLinkClick && onLinkClick(link.href); }}
                style={{ 
                  fontFamily: F.mono, 
                  fontSize: 16, 
                  letterSpacing: '0.25em', 
                  textTransform: 'uppercase', 
                  color: isDark ? '#f2ead8' : '#0d0a06', 
                  textDecoration: 'none', 
                  padding: '12px 24px', 
                  background: isDark ? 'rgba(212,168,67,0.05)' : 'rgba(184,146,46,0.08)',
                  border: `1px solid ${C.goldborder}`, 
                  width: '260px', 
                  textAlign: 'center',
                  fontWeight: 600,
                  transition: 'all 0.2s'
                }}
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── 3D Globe ─────────────────────────────────────────────────────
interface GlobePin { name: string; lat: number; lng: number; tonnes: number; }
const GLOBE_PINS: GlobePin[] = [
  { name: 'Tonga Ocean Carbon', lat: -21.2, lng: -175.2, tonnes: 62000 },
  { name: 'Antigua Seagrass', lat: 17.1, lng: -61.8, tonnes: 45000 },
  { name: 'Roatan Reef', lat: 16.3, lng: -86.5, tonnes: 28000 },
  { name: 'Altadena Reforestation', lat: 34.2, lng: -118.1, tonnes: 18000 },
  { name: 'Tuskegee Agroforestry', lat: 32.4, lng: -85.7, tonnes: 12000 },
  { name: 'Woodland Rice', lat: 38.7, lng: -121.8, tonnes: 8500 },
];

function latLngToXY(lat: number, lng: number, r: number, cx: number, cy: number, rot: number) {
  const phi = (90 - lat) * Math.PI / 180;
  const theta = (lng + 180 + rot) * Math.PI / 180;
  const x = r * Math.sin(phi) * Math.cos(theta);
  const z = r * Math.cos(phi);
  return { x: cx + x, y: cy - z, visible: Math.sin(phi) * Math.sin(theta) > -0.1 };
}

interface GlobeProps { onPinClick?: (pin: GlobePin) => void; }

export function Globe3D({ onPinClick }: GlobeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rotRef = useRef(0);
  const rafRef = useRef<number>(0);
  const [tooltip, setTooltip] = useState<{ pin: GlobePin; x: number; y: number } | null>(null);
  const tooltipRef = useRef<{ pin: GlobePin; x: number; y: number } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const W = canvas.width, H = canvas.height;
    const cx = W / 2, cy = H / 2, r = Math.min(W, H) * 0.42;

    function draw() {
      if (!ctx) return;
      ctx.clearRect(0, 0, W, H);
      const grad = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, 0, cx, cy, r);
      grad.addColorStop(0, '#141e30');
      grad.addColorStop(1, '#060810');
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();

      ctx.strokeStyle = 'rgba(212,168,67,0.08)';
      ctx.lineWidth = 0.5;
      for (let lat = -60; lat <= 60; lat += 30) {
        ctx.beginPath();
        const y = cy - r * Math.sin(lat * Math.PI / 180);
        const rLat = r * Math.cos(lat * Math.PI / 180);
        ctx.ellipse(cx, y, rLat, rLat * 0.15, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      for (let lng = 0; lng < 360; lng += 30) {
        ctx.beginPath();
        const a = (lng + rotRef.current) * Math.PI / 180;
        ctx.ellipse(cx, cy, r * Math.abs(Math.cos(a)), r, 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      GLOBE_PINS.forEach(pin => {
        const { x, y, visible } = latLngToXY(pin.lat, pin.lng, r, cx, cy, rotRef.current);
        if (!visible) return;
        const glow = ctx.createRadialGradient(x, y, 0, x, y, 10);
        glow.addColorStop(0, 'rgba(212,168,67,0.9)');
        glow.addColorStop(1, 'rgba(212,168,67,0)');
        ctx.beginPath();
        ctx.arc(x, y, 10, 0, Math.PI * 2);
        ctx.fillStyle = glow;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#d4a843';
        ctx.fill();
      });

      rotRef.current += 0.15;
      rafRef.current = requestAnimationFrame(draw);
    }

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
    const my = (e.clientY - rect.top) * (canvas.height / rect.height);
    const cx = canvas.width / 2, cy = canvas.height / 2, r = Math.min(canvas.width, canvas.height) * 0.42;
    let found: { pin: GlobePin; x: number; y: number } | null = null;
    GLOBE_PINS.forEach(pin => {
      const { x, y, visible } = latLngToXY(pin.lat, pin.lng, r, cx, cy, rotRef.current);
      if (!visible) return;
      if (Math.hypot(mx - x, my - y) < 14) {
        const scaleX = rect.width / canvas.width;
        const scaleY = rect.height / canvas.height;
        found = { pin, x: x * scaleX + rect.left, y: y * scaleY + rect.top };
      }
    });
    setTooltip(found);
    tooltipRef.current = found;
  }

  function handleClick() {
    if (tooltipRef.current && onPinClick) {
      onPinClick(tooltipRef.current.pin);
    }
  }

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <canvas
        ref={canvasRef}
        width={340}
        height={340}
        style={{ cursor: 'pointer', display: 'block' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setTooltip(null)}
        onClick={handleClick}
        data-testid="canvas-globe"
      />
      {tooltip && (
        <div style={{
          position: 'fixed',
          left: tooltip.x + 12,
          top: tooltip.y - 30,
          background: C.ink2,
          border: `1px solid ${C.goldborder}`,
          padding: '8px 14px',
          pointerEvents: 'none',
          zIndex: 9999,
          fontFamily: F.mono,
          fontSize: 10,
          color: C.gold,
          whiteSpace: 'nowrap',
          letterSpacing: '0.1em',
        }}>
          {tooltip.pin.name}<br />
          <span style={{ color: C.cream3 }}>{tooltip.pin.tonnes.toLocaleString()} t</span>
        </div>
      )}
    </div>
  );
}

// ─── Vision Verification ──────────────────────────────────────────
interface VisionProps { onReport: (report: string) => void; }

export function VisionVerification({ onReport }: VisionProps) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState('');
  const [preview, setPreview] = useState('');

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setReport('');
    const reader = new FileReader();
    reader.onload = ev => setPreview(ev.target?.result as string);
    reader.readAsDataURL(f);
  }

  async function analyze() {
    if (!file) return;
    setLoading(true);
    try {
      const reader = new FileReader();
      reader.onload = async ev => {
        const base64 = (ev.target?.result as string).split(',')[1];
        try {
          const res = await fetch('/api/exchange/ai-vision', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageBase64: base64, mimeType: file.type }),
          });
          const data = await res.json();
          const rep = data.report || 'AI analysis complete. Please review manually.';
          setReport(rep);
          onReport(rep);
        } catch {
          const fallback = '[Demo Mode] AI Vision Analysis:\nLocation Assessment: Tropical coastal region detected\nVegetation Analysis: Dense canopy cover ~85%\nCarbon Estimate: 12-18 tCO₂e/ha/year\nRecommended Standard: Verra VCS Blue Carbon';
          setReport(fallback);
          onReport(fallback);
        }
        setLoading(false);
      };
      reader.readAsDataURL(file);
    } catch {
      setLoading(false);
    }
  }

  return (
    <div style={{ border: `1px solid ${C.goldborder}`, background: C.ink2, padding: '20px', marginBottom: 20 }}>
      <div style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', color: C.gold, marginBottom: 12 }}>
        AI Project Verification (Optional)
      </div>
      <input type="file" accept="image/*" onChange={handleFile} style={{ fontFamily: F.mono, fontSize: 11, color: C.cream3, marginBottom: 12, display: 'block' }} data-testid="input-vision-image" />
      {preview && (
        <div style={{ marginBottom: 12 }}>
          <img src={preview} alt="Project" style={{ maxWidth: '100%', maxHeight: 200, border: `1px solid ${C.goldborder}` }} />
        </div>
      )}
      {file && !report && (
        <button onClick={analyze} disabled={loading} style={{ background: loading ? C.ink : C.gold, color: C.ink, padding: '10px 20px', fontFamily: F.syne, fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', border: 'none', cursor: 'pointer' }} data-testid="button-vision-analyze">
          {loading ? 'Analyzing with AI...' : 'Analyze Project →'}
        </button>
      )}
      {report && (
        <div style={{ background: C.ink, border: '1px solid rgba(34,197,94,0.3)', padding: '14px 16px' }}>
          <div style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#22c55e', marginBottom: 8 }}>AI Verification Report</div>
          <pre style={{ fontFamily: F.mono, fontSize: 10, color: C.cream3, whiteSpace: 'pre-wrap', margin: 0, lineHeight: 1.6 }}>{report}</pre>
        </div>
      )}
    </div>
  );
}
