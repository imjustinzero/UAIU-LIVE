import PublicPageShell from '@/components/PublicPageShell';

const C = { card: '#0f1623', border: '#1e293b', gold: '#facc15', muted: '#94a3b8', text: '#f2ead8', code: '#0a0e1a', green: '#22c55e', blue: '#38bdf8' };

type Endpoint = {
  method: 'GET' | 'POST';
  path: string;
  description: string;
  exampleResponse: string;
  bodySchema?: string;
};

const endpoints: Endpoint[] = [
  {
    method: 'GET',
    path: '/api/public/ledger',
    description: 'Returns the full public trade ledger — all settled carbon credit trades, plus running totals.',
    exampleResponse: `{
  "totals": {
    "trades": 12,
    "retiredTco2e": 6800,
    "totalVolumeEur": 204000
  },
  "entries": [
    {
      "tradeId": "TRD-2024-0001",
      "timestamp": "2024-03-01T14:22:00Z",
      "creditType": "EU ETS",
      "registry": "Verra",
      "vintage": "2022",
      "volumeTco2e": 500,
      "priceRange": "€38–42/t",
      "framework": "EU ETS"
    }
  ]
}`,
  },
  {
    method: 'GET',
    path: '/api/public/index',
    description: 'Returns the weekly institutional carbon credit price index broken down by standard (EU ETS, VCS, Gold Standard, CORSIA).',
    exampleResponse: `{
  "indices": [
    {
      "name": "EU ETS",
      "thisWeek": 64.50,
      "lastWeek": 63.10,
      "changePct": 2.22,
      "volume": 48000,
      "trades": 9,
      "range": "€61.00–€66.50"
    }
  ],
  "updatedAt": "2024-03-04T09:00:00Z"
}`,
  },
  {
    method: 'GET',
    path: '/api/public/corsia-programs',
    description: 'Returns all ICAO-approved carbon credit programs eligible for CORSIA Phase 1 and Phase 2 offsetting.',
    exampleResponse: `{
  "programs": [
    {
      "program": "Verra VCS Aviation",
      "registry": "Verra",
      "phase1": "yes",
      "phase2": "yes",
      "approvedAt": "2021-06-30",
      "notes": "Approved for sectoral boundaries"
    }
  ],
  "count": 14
}`,
  },
  {
    method: 'GET',
    path: '/api/public/retirement-counter',
    description: 'Returns the platform-wide retirement counter — total number of retired trades and total volume of retirements in tCO₂e.',
    exampleResponse: `{
  "retiredCount": 7,
  "retiredVolumeTco2e": 4200
}`,
  },
  {
    method: 'GET',
    path: '/api/alerts/public-deadlines',
    description: 'Returns the next set of upcoming regulatory compliance deadlines with days remaining. Used to power the compliance calendar.',
    exampleResponse: `{
  "deadlines": [
    {
      "framework": "EU ETS Maritime",
      "dueDate": "2025-04-30",
      "daysRemaining": 48
    },
    {
      "framework": "FuelEU Maritime",
      "dueDate": "2025-05-31",
      "daysRemaining": 79
    }
  ]
}`,
  },
  {
    method: 'POST',
    path: '/api/alerts/subscribe',
    description: 'Subscribe to compliance deadline email alerts. Sends a confirmation email — the subscription is not active until confirmed.',
    bodySchema: `{
  "email": "compliance@airline.com",   // required, work email
  "organization": "Airline Corp",      // required
  "sector": "Aviation",                // optional: Shipping | Aviation | Industrial | Corporate | Other
  "frameworks": ["CORSIA", "EU ETS Aviation"],  // required, at least one
  "alertTiming": ["30 days before"]   // required, at least one
}`,
    exampleResponse: `{
  "ok": true,
  "message": "Confirmation email sent. Please verify your address."
}`,
  },
];

function MethodBadge({ method }: { method: 'GET' | 'POST' }) {
  const isPost = method === 'POST';
  return (
    <span style={{ background: isPost ? '#422006' : '#082f49', color: isPost ? '#fb923c' : C.blue, borderRadius: 4, fontSize: 11, fontWeight: 800, padding: '3px 8px', letterSpacing: '0.08em', marginRight: 10, flexShrink: 0 }}>
      {method}
    </span>
  );
}

export default function ApiDocsPage() {
  return (
    <PublicPageShell
      title="UAIU Carbon API — Public Endpoints | UAIU.LIVE"
      description="Public REST API for institutional carbon market data. Trade ledger, price index, CORSIA programs, retirement counters, and compliance deadline alerts."
      path="/api"
    >
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 'clamp(22px, 4vw, 32px)', color: C.gold, margin: '0 0 8px' }}>
          UAIU Carbon — Public API
        </h1>
        <p style={{ color: C.muted, fontSize: 14, margin: 0 }}>
          Public REST endpoints. No authentication required. All responses are JSON.
          Base URL: <code style={{ color: C.blue, fontSize: 13 }}>https://uaiu.live</code>
        </p>
      </div>

      <div style={{ display: 'grid', gap: 20 }}>
        {endpoints.map((ep) => (
          <div key={ep.path} data-testid={`card-endpoint-${ep.path.replace(/\//g, '-').slice(1)}`} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '20px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
              <MethodBadge method={ep.method} />
              <code style={{ color: C.text, fontSize: 14, fontFamily: 'monospace' }}>{ep.path}</code>
            </div>
            <p style={{ color: C.muted, fontSize: 13, margin: '0 0 16px' }}>{ep.description}</p>

            {ep.bodySchema && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ color: C.muted, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Request body</div>
                <pre style={{ background: C.code, border: `1px solid ${C.border}`, borderRadius: 6, padding: '14px 16px', fontSize: 12, color: '#86efac', overflowX: 'auto', margin: 0, lineHeight: 1.6 }}>
                  {ep.bodySchema}
                </pre>
              </div>
            )}

            <div>
              <div style={{ color: C.muted, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Example response</div>
              <pre style={{ background: C.code, border: `1px solid ${C.border}`, borderRadius: 6, padding: '14px 16px', fontSize: 12, color: '#7dd3fc', overflowX: 'auto', margin: 0, lineHeight: 1.6 }}>
                {ep.exampleResponse}
              </pre>
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 48, background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '24px', textAlign: 'center' }}>
        <p style={{ color: C.text, fontWeight: 600, fontSize: 15, margin: '0 0 8px' }}>Authenticated Trading API</p>
        <p style={{ color: C.muted, fontSize: 13, margin: '0 0 16px' }}>
          For authenticated trading, RFQ submission, escrow settlement, and portfolio data access, contact our institutional desk.
        </p>
        <a href="mailto:desk@uaiu.live" style={{ background: C.gold, color: '#111827', fontWeight: 700, fontSize: 14, borderRadius: 6, padding: '10px 24px', textDecoration: 'none', display: 'inline-block' }}>
          Contact desk@uaiu.live
        </a>
      </div>
    </PublicPageShell>
  );
}
