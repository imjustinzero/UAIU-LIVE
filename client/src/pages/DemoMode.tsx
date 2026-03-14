import { useEffect, useRef, useState } from "react";

const demoListings = [
  {
    id: "rimba-raya",
    project: "Rimba Raya Biodiversity Reserve",
    type: "REDD+ Forest Conservation",
    registry: "Verra VCS",
    vintage: 2023,
    volume: 50000,
    price: 14.5,
    riskScore: 92,
    status: "CORSIA Eligible",
    location: "Central Kalimantan, Indonesia",
    serial: "VCS-2023-RR-001 through VCS-2023-RR-050000",
  },
  {
    id: "guyana",
    project: "Guyana Sheltered Forest Program",
    type: "Jurisdictional REDD+ (ART TREES)",
    registry: "ART TREES",
    vintage: 2024,
    volume: 120000,
    price: 18.75,
    riskScore: 97,
    status: "CORSIA Eligible — Phase 1 Approved",
    location: "Guyana, South America",
    serial: "ART-2024-GY-001 through ART-2024-GY-120000",
  },
  {
    id: "rebellion",
    project: "Rebellion Energy Methane Abatement Portfolio",
    type: "Methane Destruction — Superpollutant",
    registry: "Gold Standard",
    vintage: 2024,
    volume: 25000,
    price: 22,
    riskScore: 95,
    status: "Gold Standard Certified",
    location: "United States",
    serial: "GS-2024-RE-001 through GS-2024-RE-025000",
  },
  {
    id: "belize",
    project: "Blue Carbon Mangrove Restoration — Belize",
    type: "Blue Carbon — Coastal Wetland",
    registry: "Verra VCS",
    vintage: 2023,
    volume: 15000,
    price: 31,
    riskScore: 89,
    status: "Verra VCS Certified",
    location: "Belize, Central America",
    serial: "VCS-2023-BC-001 through VCS-2023-BC-015000",
  },
];

const ddSections = [
  "Section 1 — Registry Status: VERIFIED — Active on Verra VCS registry. Serial range confirmed. No retirement flags detected.",
  "Section 2 — CORSIA Eligibility: ELIGIBLE — Approved under ICAO CORSIA Phase 1 eligible emissions unit programs.",
  "Section 3 — Risk Score: 92/100 — Low risk. Third-party validated by DNV. Additionality confirmed. Permanence buffer 15%.",
  "Section 4 — Project Fundamentals: 64,000 hectares of protected lowland tropical rainforest. Est. 3.1M tonnes annual sequestration capacity. Active since 2013.",
  "Section 5 — Comparable Trades: Similar REDD+ VCS listings trading $13.80–$15.20/tonne in last 30 days. Current ask in range.",
  "Section 6 — Counterparty Assessment: Seller verified. KYB complete. 48h SLA confirmed. Escrow capable.",
  "Section 7 — Red Flags: NONE DETECTED",
  "Section 8 — Recommendation: PROCEED — Credits meet institutional procurement standards. Recommend RFQ submission at or near ask.",
];

const N_GEO_REFERENCE_LINE = "Voluntary Carbon Reference Price (Xpansiv CBL N-GEO): $0.56 per tonne — Last updated: March 13, 2026";

function TradingViewMiniSymbolOverview({ isDark = true }: { isDark?: boolean }) {
  const widgetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!widgetRef.current) return;

    widgetRef.current.innerHTML = "";

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-mini-symbol-overview.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify({
      symbol: "ICEEUR:EUA1!",
      width: "100%",
      height: "220",
      locale: "en",
      dateRange: "1D",
      colorTheme: isDark ? "dark" : "light",
      isTransparent: false,
      autosize: true,
      largeChartUrl: "",
    });

    widgetRef.current.appendChild(script);
  }, [isDark]);

  return (
    <div style={{ width: "100%", maxWidth: 960, margin: "0 auto" }}>
      <div style={{ fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", color: "#facc15", marginBottom: 10 }}>
        EU ETS Carbon Price — Live
      </div>
      <div className="tradingview-widget-container" style={{ width: "100%", border: "1px solid #3f3f46", background: "#111827" }}>
        <div className="tradingview-widget-container__widget" ref={widgetRef} />
      </div>
      <p style={{ marginTop: 10, fontSize: 12, color: "#cbd5e1" }}>{N_GEO_REFERENCE_LINE}</p>
    </div>
  );
}

export default function DemoMode() {
  const [selectedListing, setSelectedListing] = useState(demoListings[0]);
  const [ddLoading, setDdLoading] = useState(false);
  const [ddReady, setDdReady] = useState(false);
  const [rfqSubmitted, setRfqSubmitted] = useState(false);

  const onGenerateDd = (listingId: string) => {
    const listing = demoListings.find((l) => l.id === listingId) || demoListings[0];
    setSelectedListing(listing);
    setDdReady(false);
    setDdLoading(true);
    setTimeout(() => {
      setDdLoading(false);
      setDdReady(true);
    }, 3000);
  };

  const downloadAuditPack = async () => {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("UAIU.LIVE/X — Institutional Audit Pack", 14, 18);
    doc.setFontSize(11);
    const lines = [
      "Trade ID: UAIU-2026-0041",
      "Public verification: https://uaiu.live/verify/UAIU-2026-0041",
      "SHA-256: 8b1f6d67f3ca8d6c3819e74274f5e93a63ea9e7f2d3db8f1fce5d705d6b8a14c",
      "Registry serial range confirmed: VCS-2023-RR-001 through VCS-2023-RR-010000",
      "Escrow proof: FUNDS HELD — Pending Registry Verification",
      "Multi-sig approval: Sarah Chen (Chief Compliance Officer) APPROVED",
      "DD report summary: VERIFIED, CORSIA ELIGIBLE, risk 92/100, recommendation PROCEED",
      "Price prediction export: AI recommended counter $14.40, acceptance probability 74%",
      "Platform fee breakdown: Gross $144,000 / Fee $1,080 (0.75%) / Net settlement $142,920",
    ];
    lines.forEach((line, i) => doc.text(line, 14, 34 + i * 9));
    doc.save("UAIU-Audit-Pack-UAIU-2026-0041.pdf");
  };

  return (
    <div style={{ background: "#090d17", color: "#f8edd5", minHeight: "100vh", fontFamily: "Inter, sans-serif" }}>
      <div style={{ position: "sticky", top: 0, zIndex: 20, background: "#facc15", color: "#111827", textAlign: "center", padding: "10px 8px", fontWeight: 700, fontSize: 13 }}>
        DEMO MODE — All data is simulated for demonstration purposes
      </div>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: 20 }}>
        <h1>/x/demo — Institutional Carbon Trading Desk</h1>

        <section id="live-eu-ets" style={{ marginBottom: 16 }}>
          <TradingViewMiniSymbolOverview isDark />
        </section>

        <section id="market" style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 16 }}>
          <div style={{ border: "1px solid #3f3f46", padding: 14 }}>
            <h3>Live Listings</h3>
            {demoListings.map((l) => (
              <div key={l.id} style={{ borderTop: "1px solid #27272a", padding: "12px 0" }}>
                <strong>{l.project}</strong>
                <div>{l.type} · {l.registry} · Vintage {l.vintage}</div>
                <div>{l.location}</div>
                <div>{l.volume.toLocaleString()} tonnes · ${l.price.toFixed(2)}/tonne · Risk {l.riskScore}/100</div>
                <div>{l.status}</div>
                <div style={{ fontSize: 12, color: "#cbd5e1" }}>{l.serial}</div>
                <button onClick={() => onGenerateDd(l.id)} style={{ marginTop: 6 }}>Generate DD Report</button>
              </div>
            ))}
          </div>
          <div style={{ border: "1px solid #3f3f46", padding: 14 }}>
            <h3>Regulatory Calendar</h3>
            <div>🔴 EU ETS Maritime Q1 Surrender — April 30, 2026 — 52 days away</div>
            <div>🟡 CORSIA Phase 1 Annual Report — June 30, 2026 — 113 days away</div>
            <div>🟢 IMO CII Rating Submission — December 31, 2026 — 296 days away</div>
            <div>🟢 FuelEU Maritime Compliance — January 1, 2027 — 297 days away</div>
          </div>
        </section>

        <section id="portfolio" style={{ marginTop: 16, border: "1px solid #3f3f46", padding: 14 }}>
          <h3>Portfolio Dashboard — Meridian Shipping Group</h3>
          <div>Annual Carbon Budget: $2,400,000</div>
          <div>Spent to Date: $847,500 (35%)</div>
          <div>Remaining Budget: $1,552,500</div>
          <div>Total Tonnes Retired: 58,500t</div>
          <div>Open Positions: 2 active RFQs</div>
          <div>Compliance Status: EU ETS — ON TRACK</div>
          <div style={{ marginTop: 8, background: "#1f2937", height: 12, borderRadius: 6 }}>
            <div style={{ width: "35%", background: "#facc15", height: "100%", borderRadius: 6 }} />
          </div>
          <div style={{ fontSize: 12 }}>Alerts configured at 50% / 75% / 90%</div>
        </section>

        <section id="dd" style={{ marginTop: 16, border: "1px solid #3f3f46", padding: 14 }}>
          <h3>AI Due Diligence Report</h3>
          {ddLoading && <div>Generating institutional DD report for {selectedListing.project}...</div>}
          {ddReady && (
            <div>
              <h4>{selectedListing.project}</h4>
              {ddSections.map((s) => <p key={s}>{s}</p>)}
            </div>
          )}
        </section>

        <section id="rfq" style={{ marginTop: 16, border: "1px solid #3f3f46", padding: 14 }}>
          <h3>RFQ Workflow</h3>
          <div>Buyer: Meridian Shipping Group</div>
          <div>Credit Type: REDD+ / CORSIA Eligible</div>
          <div>Volume Requested: 10,000 tonnes</div>
          <div>Target Price: $14.25/tonne</div>
          <div>Delivery: Spot — within 30 days</div>
          <div>Registry Preference: Verra VCS or ART TREES</div>
          <div>Purpose: EU ETS Maritime Compliance — Q1 2026 Surrender</div>
          <button onClick={() => setRfqSubmitted(true)} style={{ marginTop: 8 }}>Submit Demo RFQ</button>
          {rfqSubmitted && <div style={{ marginTop: 10 }}>
            <strong>AI Trade Negotiator Output</strong>
            <div>Recommended Counter: $14.40/tonne</div>
            <div>Acceptance Probability: 74%</div>
            <div>Signal Rating: STRONG</div>
            <div>Counter Range: $14.20 — $14.65</div>
            <div>Notes: Seller has 2 competing RFQs. Move within 48 hours.</div>
          </div>}
        </section>

        <section id="escrow" style={{ marginTop: 16, border: "1px solid #3f3f46", padding: 14 }}>
          <h3>Escrow</h3>
          <div>Trade ID: UAIU-2026-0041</div>
          <div>Buyer: Meridian Shipping Group</div>
          <div>Seller: Rimba Raya Conservation LLC</div>
          <div>Volume: 10,000 tonnes</div>
          <div>Gross Value: $144,000</div>
          <div>Platform Fee (0.75%): $1,080</div>
          <div>Escrow Status: FUNDS HELD — Pending Registry Verification</div>
          <div>Created: {new Date().toLocaleDateString()}</div>
          <div>Expected Release: T+1</div>
        </section>

        <section id="multisig" style={{ marginTop: 16, border: "1px solid #3f3f46", padding: 14 }}>
          <h3>Multi-Sig Approval</h3>
          <div>Approver: Sarah Chen, Chief Compliance Officer, Meridian Shipping Group</div>
          <div>Status: APPROVED</div>
          <div>Timestamp: {new Date().toLocaleDateString()} at 09:14 AM</div>
          <div>Token: UAIU-MSIG-2026-0041-SC</div>
          <div>Notes: Approved for EU ETS Q1 2026 compliance surrender</div>
        </section>

        <section id="audit" style={{ marginTop: 16, border: "1px solid #3f3f46", padding: 14 }}>
          <h3>Audit Pack</h3>
          <p>Pre-built institutional PDF for Trade ID UAIU-2026-0041 with full verification and compliance artifact set.</p>
          <button onClick={downloadAuditPack}>Download Audit Pack</button>
        </section>
      </div>
    </div>
  );
}
