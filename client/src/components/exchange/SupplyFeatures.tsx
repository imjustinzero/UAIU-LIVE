import { useState } from "react";

const C = {
  ink: '#060810', ink2: '#0d1220', ink3: '#141e30', ink4: '#1c2840',
  gold: '#d4a843', gold2: '#f0c96a', goldfaint: 'rgba(212,168,67,0.12)',
  goldborder: 'rgba(212,168,67,0.22)', cream: '#f2ead8',
  cream2: 'rgba(242,234,216,0.7)', cream3: 'rgba(242,234,216,0.35)',
  cream4: 'rgba(242,234,216,0.1)', green: '#22c55e',
};
const F = { mono: "'JetBrains Mono', monospace", syne: "'Syne', sans-serif", playfair: "'Playfair Display', serif" };

const CROP_FACTORS: Record<string, number> = {
  'Rice': 0.85,
  'Dairy': 1.20,
  'Almonds': 0.45,
  'Walnuts': 0.38,
  'Tomatoes': 0.22,
  'Row Crops': 0.55,
  'Cover Crops': 0.65,
  'Other': 0.40,
};

const PRACTICE_BONUSES: Record<string, number> = {
  'No-till': 0.15,
  'Cover crops': 0.12,
  'Alternate wet/dry': 0.18,
  'Manure digester': 0.25,
  'Drip irrigation': 0.08,
};

const CA_COUNTIES = ['Alameda','Alpine','Amador','Butte','Calaveras','Colusa','Contra Costa','Del Norte','El Dorado','Fresno','Glenn','Humboldt','Imperial','Inyo','Kern','Kings','Lake','Lassen','Los Angeles','Madera','Marin','Mariposa','Mendocino','Merced','Modoc','Mono','Monterey','Napa','Nevada','Orange','Placer','Plumas','Riverside','Sacramento','San Benito','San Bernardino','San Diego','San Francisco','San Joaquin','San Luis Obispo','San Mateo','Santa Barbara','Santa Clara','Santa Cruz','Shasta','Sierra','Siskiyou','Solano','Sonoma','Stanislaus','Sutter','Tehama','Trinity','Tulare','Tuolumne','Ventura','Yolo','Yuba'];

const fi: React.CSSProperties = { width: '100%', background: C.ink2, border: `1px solid ${C.goldborder}`, color: C.cream, padding: '13px 16px', fontFamily: F.mono, fontSize: 12, outline: 'none', boxSizing: 'border-box' };
const fl: React.CSSProperties = { fontFamily: F.mono, fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', color: C.cream3, display: 'block', marginBottom: 8 };

interface FarmProps {
  currentIndexPrice?: number;
  onSubmitFarm?: (data: any) => void;
}

export function FarmCarbonCalculator({ currentIndexPrice = 67.43, onSubmitFarm }: FarmProps) {
  const [farmName, setFarmName] = useState('');
  const [cropType, setCropType] = useState('');
  const [acreage, setAcreage] = useState('');
  const [county, setCounty] = useState('');
  const [practices, setPractices] = useState<string[]>([]);
  const [result, setResult] = useState<any>(null);

  function togglePractice(p: string) {
    setPractices(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);
  }

  function calculate() {
    if (!farmName || !cropType || !acreage || !county) {
      return;
    }
    const baseFactor = CROP_FACTORS[cropType] || 0.4;
    const practiceBonus = practices.reduce((s, p) => s + (PRACTICE_BONUSES[p] || 0), 0);
    const totalFactor = baseFactor + practiceBonus;
    const acres = parseFloat(acreage);
    const tonnes = Math.round(acres * totalFactor * 3.5);
    const grossEur = tonnes * currentIndexPrice;
    setResult({ farmName, cropType, acreage: acres, county, practices, tonnes, grossEur, factor: totalFactor });
  }

  return (
    <section id="calculator" style={{ background: C.ink2, borderTop: `1px solid ${C.goldborder}`, borderBottom: `1px solid ${C.goldborder}` }}>
      <div style={{ maxWidth: 1440, margin: '0 auto', padding: '100px 52px' }}>
        <div style={{ marginBottom: 56 }}>
          <div style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: '0.25em', textTransform: 'uppercase', color: C.gold, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ width: 24, height: 1, background: C.gold, display: 'inline-block' }} />
            Farm Carbon Calculator
          </div>
          <h2 style={{ fontFamily: F.playfair, fontSize: 'clamp(32px,4vw,52px)', fontWeight: 900, color: C.cream, margin: 0, lineHeight: 1.1 }}>
            Estimate your farm's carbon value.
          </h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48, alignItems: 'start' }}>
          <div>
            <div style={{ marginBottom: 20 }}><label style={fl}>Farm Name *</label><input style={fi} type="text" placeholder="Your Farm Name" value={farmName} onChange={e => setFarmName(e.target.value)} data-testid="input-farm-name" /></div>
            <div style={{ marginBottom: 20 }}>
              <label style={fl}>Crop Type *</label>
              <select style={{ ...fi, backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%23d4a843'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 14px center', cursor: 'pointer' }} value={cropType} onChange={e => setCropType(e.target.value)} data-testid="select-farm-crop">
                <option value="">Select crop type</option>
                {Object.keys(CROP_FACTORS).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 20 }}><label style={fl}>Acreage *</label><input style={fi} type="number" placeholder="Total acres" value={acreage} onChange={e => setAcreage(e.target.value)} data-testid="input-farm-acreage" /></div>
            <div style={{ marginBottom: 20 }}>
              <label style={fl}>County *</label>
              <select style={{ ...fi, backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%23d4a843'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 14px center', cursor: 'pointer' }} value={county} onChange={e => setCounty(e.target.value)} data-testid="select-farm-county">
                <option value="">Select county</option>
                {CA_COUNTIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 28 }}>
              <label style={fl}>Current Practices</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {Object.keys(PRACTICE_BONUSES).map(p => (
                  <label key={p} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontFamily: F.mono, fontSize: 10, letterSpacing: '0.1em', color: practices.includes(p) ? C.gold : C.cream3, padding: '8px 14px', border: `1px solid ${practices.includes(p) ? C.gold : C.goldborder}`, background: practices.includes(p) ? C.goldfaint : 'transparent', transition: 'all 0.2s' }}>
                    <input type="checkbox" checked={practices.includes(p)} onChange={() => togglePractice(p)} style={{ accentColor: C.gold }} data-testid={`check-practice-${p.replace(/\s/g,'-').toLowerCase()}`} />
                    {p}
                  </label>
                ))}
              </div>
            </div>
            <button onClick={calculate} style={{ background: C.gold, color: C.ink, padding: '16px 36px', fontFamily: F.syne, fontSize: 12, fontWeight: 800, letterSpacing: '0.15em', textTransform: 'uppercase', border: 'none', cursor: 'pointer' }} data-testid="button-calculate-farm">
              Calculate Carbon Value →
            </button>
          </div>

          <div>
            {result ? (
              <div style={{ background: C.ink, border: `1px solid ${C.goldborder}`, padding: '40px 36px', position: 'relative' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg,transparent,${C.gold},transparent)` }} />
                <div style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', color: C.gold, marginBottom: 8 }}>Estimated Annual Carbon</div>
                <div style={{ fontFamily: F.playfair, fontSize: 56, fontWeight: 900, color: C.gold, lineHeight: 1, marginBottom: 4 }}>{result.tonnes.toLocaleString()}</div>
                <div style={{ fontFamily: F.mono, fontSize: 11, color: C.cream3, marginBottom: 32 }}>metric tonnes CO₂e / year</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 28 }}>
                  {[
                    { label: 'Gross Value', val: `€${result.grossEur.toLocaleString(undefined, { maximumFractionDigits: 0 })}` },
                    { label: 'At Index Price', val: `€${currentIndexPrice.toFixed(2)}/t` },
                    { label: 'Farm', val: result.farmName },
                    { label: 'County', val: result.county },
                    { label: 'Crop', val: result.cropType },
                    { label: 'Acreage', val: `${result.acreage.toLocaleString()} ac` },
                  ].map(({ label, val }) => (
                    <div key={label}>
                      <div style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', color: C.cream3, marginBottom: 4 }}>{label}</div>
                      <div style={{ fontFamily: F.syne, fontSize: 15, fontWeight: 700, color: C.cream }}>{val}</div>
                    </div>
                  ))}
                </div>
                <button onClick={() => onSubmitFarm && onSubmitFarm(result)} style={{ width: '100%', background: C.gold, color: C.ink, padding: '16px', fontFamily: F.syne, fontSize: 12, fontWeight: 800, letterSpacing: '0.15em', textTransform: 'uppercase', border: 'none', cursor: 'pointer' }} data-testid="button-list-farm-credits">
                  List These Credits →
                </button>
              </div>
            ) : (
              <div style={{ background: C.ink, border: `1px solid ${C.goldborder}`, padding: '40px 36px', textAlign: 'center' }}>
                <div style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', color: C.cream3, marginBottom: 24 }}>Your estimate will appear here</div>
                <div style={{ fontFamily: F.playfair, fontSize: 18, color: C.cream3, lineHeight: 1.6 }}>Fill in your farm details and click Calculate to see your estimated annual carbon tonnage and market value at current index prices.</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

const PIPELINE_PROJECTS = [
  { name: 'Antigua Coastal Seagrass Restoration', location: 'Antigua & Barbuda', flag: '🇦🇬', standard: 'Blue Carbon / VCS', tonnes: 45000, expectedListing: 'Q2 2025', status: 'In Review' },
  { name: 'Roatan Reef Regeneration', location: 'Honduras', flag: '🇭🇳', standard: 'Gold Standard', tonnes: 28000, expectedListing: 'Q2 2025', status: 'In Review' },
  { name: 'Tonga Ocean Carbon Sink', location: 'Kingdom of Tonga', flag: '🇹🇴', standard: 'Blue Carbon / VCS', tonnes: 62000, expectedListing: 'Q3 2025', status: 'Pending' },
  { name: 'Altadena Reforestation Initiative', location: 'California, USA', flag: '🇺🇸', standard: 'ACR Protocol', tonnes: 18000, expectedListing: 'Q1 2025', status: 'Verified' },
  { name: 'Tuskegee Agroforestry Carbon', location: 'Alabama, USA', flag: '🇺🇸', standard: 'VCS — Gold Standard', tonnes: 12000, expectedListing: 'Q1 2025', status: 'Live' },
  { name: 'Woodland Rice & Cover Crop', location: 'California, USA', flag: '🇺🇸', standard: 'CAR Protocol', tonnes: 8500, expectedListing: 'Q2 2025', status: 'Pending' },
];

const STATUS_COLORS: Record<string, string> = {
  'Pending': C.cream3,
  'In Review': '#f59e0b',
  'Verified': '#22c55e',
  'Live': C.gold,
};

export function ProjectPipeline() {
  return (
    <section id="pipeline" style={{ background: C.ink, borderTop: `1px solid ${C.goldborder}` }}>
      <div style={{ maxWidth: 1440, margin: '0 auto', padding: '100px 52px' }}>
        <div style={{ marginBottom: 56 }}>
          <div style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: '0.25em', textTransform: 'uppercase', color: C.gold, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ width: 24, height: 1, background: C.gold, display: 'inline-block' }} />
            Verification Pipeline
          </div>
          <h2 style={{ fontFamily: F.playfair, fontSize: 'clamp(32px,4vw,52px)', fontWeight: 900, color: C.cream, margin: 0, lineHeight: 1.1 }}>
            Projects in queue.
          </h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 24 }}>
          {PIPELINE_PROJECTS.map((p, i) => (
            <div key={i} style={{ background: C.ink2, border: `1px solid ${C.goldborder}`, padding: '28px 24px', position: 'relative' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', color: STATUS_COLORS[p.status] || C.cream3, border: `1px solid ${STATUS_COLORS[p.status] || C.goldborder}`, padding: '4px 10px' }}>{p.status}</div>
                <div style={{ fontFamily: F.mono, fontSize: 18 }}>{p.flag}</div>
              </div>
              <div style={{ fontFamily: F.syne, fontSize: 15, fontWeight: 700, color: C.cream, lineHeight: 1.4, marginBottom: 8 }}>{p.name}</div>
              <div style={{ fontFamily: F.mono, fontSize: 10, color: C.cream3, marginBottom: 16 }}>{p.location}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[
                  { label: 'Standard', val: p.standard },
                  { label: 'Est. Tonnes', val: p.tonnes.toLocaleString() },
                  { label: 'Expected Listing', val: p.expectedListing },
                ].map(({ label, val }) => (
                  <div key={label} style={{ gridColumn: label === 'Standard' ? 'span 2' : undefined }}>
                    <div style={{ fontFamily: F.mono, fontSize: 8, letterSpacing: '0.15em', textTransform: 'uppercase', color: C.cream3, marginBottom: 3 }}>{label}</div>
                    <div style={{ fontFamily: F.syne, fontSize: 12, color: C.gold }}>{val}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
