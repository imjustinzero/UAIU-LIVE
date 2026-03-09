import { useState, useMemo, useEffect } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowLeft, ArrowRight, ChevronRight, FileText, ShieldCheck,
  TrendingUp, Lock, Download, CheckCircle, Clock, AlertTriangle,
  BarChart2, Leaf, Building2, Mail,
} from "lucide-react";

const C = {
  bg: "#090d17",
  card: "#0f1623",
  border: "#1e293b",
  gold: "#facc15",
  goldDim: "#a37e10",
  text: "#f8edd5",
  muted: "#94a3b8",
  green: "#22c55e",
  amber: "#f59e0b",
  red: "#ef4444",
};

const demoListings = [
  { id: "rimba", project: "Rimba Raya Biodiversity Reserve", type: "REDD+ Forest Conservation", registry: "Verra VCS", vintage: 2023, volume: 50000, price: 14.5, risk: 92, status: "CORSIA Eligible", location: "Central Kalimantan, Indonesia", serial: "VCS-2023-RR-001–050000" },
  { id: "guyana", project: "Guyana Sheltered Forest Program", type: "Jurisdictional REDD+ (ART TREES)", registry: "ART TREES", vintage: 2024, volume: 120000, price: 18.75, risk: 97, status: "CORSIA Eligible — Phase 1", location: "Guyana, South America", serial: "ART-2024-GY-001–120000" },
  { id: "rebellion", project: "Rebellion Energy Methane Abatement", type: "Methane Destruction — Superpollutant", registry: "Gold Standard", vintage: 2024, volume: 25000, price: 22.0, risk: 95, status: "Gold Standard Certified", location: "United States", serial: "GS-2024-RE-001–025000" },
  { id: "belize", project: "Blue Carbon Mangrove Restoration — Belize", type: "Blue Carbon — Coastal Wetland", registry: "Verra VCS", vintage: 2023, volume: 15000, price: 31.0, risk: 89, status: "Verra VCS Certified", location: "Belize, Central America", serial: "VCS-2023-BC-001–015000" },
];

const ddSections = [
  { label: "Registry Status", value: "VERIFIED", detail: "Active on Verra VCS registry. Serial range confirmed. No retirement flags detected.", ok: true },
  { label: "CORSIA Eligibility", value: "ELIGIBLE", detail: "Approved under ICAO CORSIA Phase 1 eligible emissions unit programs.", ok: true },
  { label: "Risk Score", value: "92 / 100", detail: "Low risk. Third-party validated by DNV. Additionality confirmed. Permanence buffer 15%.", ok: true },
  { label: "Project Fundamentals", value: "STRONG", detail: "64,000 hectares protected rainforest. 3.1M tonnes annual sequestration. Active since 2013.", ok: true },
  { label: "Comparable Trades", value: "IN RANGE", detail: "Similar REDD+ VCS credits: $13.80–$15.20/tonne in last 30 days. Current ask within market range.", ok: true },
  { label: "Counterparty", value: "VERIFIED", detail: "Seller KYB complete. 48h SLA confirmed. Stripe Connect escrow capable.", ok: true },
  { label: "Red Flags", value: "NONE DETECTED", detail: "No adverse media, no registry disputes, no linked retirements.", ok: true },
  { label: "Recommendation", value: "PROCEED", detail: "Credits meet institutional procurement standards. Recommend RFQ at or near ask price.", ok: true },
];

const incomingBids = [
  { buyer: "Meridian Shipping Group", volume: 10000, bid: 14.25, ask: 14.5, deadline: "48 hours", purpose: "EU ETS Q1 Maritime Surrender" },
  { buyer: "Nordic Aviation Partners AS", volume: 5000, bid: 14.10, ask: 14.5, deadline: "72 hours", purpose: "CORSIA Phase 1 Offset" },
  { buyer: "Atlantis Steel GmbH", volume: 20000, bid: 13.95, ask: 14.5, deadline: "5 days", purpose: "Voluntary ESG Retirement" },
];

const randomDelta = () => +(Math.random() * 0.06 - 0.03).toFixed(2);

function StepDots({ total, current }: { total: number; current: number }) {
  return (
    <div style={{ display: "flex", gap: 6, justifyContent: "center", margin: "16px 0 8px" }}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: i === current ? C.gold : C.border, transition: "background 0.2s" }} />
      ))}
    </div>
  );
}

function StatusBadge({ status }: { status: "ok" | "warn" | "urgent" | "info" }) {
  const map = { ok: { bg: "#14532d", color: C.green, label: "ON TRACK" }, warn: { bg: "#78350f", color: C.amber, label: "DUE SOON" }, urgent: { bg: "#7f1d1d", color: C.red, label: "URGENT" }, info: { bg: "#1e3a5f", color: "#60a5fa", label: "UPCOMING" } };
  const s = map[status];
  return <span style={{ background: s.bg, color: s.color, fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 4, letterSpacing: "0.05em" }}>{s.label}</span>;
}

function RiskBadge({ score }: { score: number }) {
  const color = score >= 95 ? C.green : score >= 88 ? C.amber : C.red;
  return <span style={{ background: "#1e293b", color, fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 4 }}>Risk {score}/100</span>;
}

function SectionCard({ title, icon: Icon, children }: { title: string; icon?: any; children: React.ReactNode }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: "20px 22px", marginBottom: 16 }}>
      {title && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          {Icon && <Icon size={16} color={C.gold} />}
          <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, color: C.gold, fontWeight: 600 }}>{title}</span>
        </div>
      )}
      {children}
    </div>
  );
}

function NavRow({ step, total, onPrev, onNext, prevLabel = "← Previous", nextLabel = "Next Step →", nextDisabled = false }: any) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 20 }}>
      <Button variant="outline" onClick={onPrev} disabled={step === 0} style={{ borderColor: C.border, color: C.muted, background: "transparent" }}>
        <ArrowLeft size={14} style={{ marginRight: 6 }} />{prevLabel}
      </Button>
      <span style={{ color: C.muted, fontSize: 12 }}>Step {step + 1} of {total}</span>
      <Button onClick={onNext} disabled={nextDisabled} style={{ background: C.gold, color: "#111827", fontWeight: 700 }}>
        {nextLabel}<ArrowRight size={14} style={{ marginLeft: 6 }} />
      </Button>
    </div>
  );
}

function BuyerFlow() {
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState(demoListings[0]);
  const [ddLoading, setDdLoading] = useState(false);
  const [ddReady, setDdReady] = useState(false);
  const [rfqDone, setRfqDone] = useState(false);
  const TOTAL = 6;

  const startDd = () => { setDdReady(false); setDdLoading(true); setTimeout(() => { setDdLoading(false); setDdReady(true); }, 3000); };

  const downloadAuditPack = async () => {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF();
    doc.setFontSize(15);
    doc.text("UAIU.LIVE/X — Institutional Audit Pack", 14, 18);
    doc.setFontSize(10);
    const lines = [
      "Trade ID: UAIU-2026-0041",
      "Public verification: https://uaiu.live/verify/UAIU-2026-0041",
      "SHA-256: 8b1f6d67f3ca8d6c3819e74274f5e93a63ea9e7f2d3db8f1fce5d705d6b8a14c",
      `Project: ${selected.project}`,
      `Registry serial range: ${selected.serial}`,
      "Escrow proof: FUNDS HELD — Pending Registry Verification",
      "Multi-sig approval: Sarah Chen (CCO, Meridian Shipping Group) — APPROVED",
      "DD report: VERIFIED, CORSIA ELIGIBLE, Risk 92/100, Recommendation: PROCEED",
      "Price prediction: AI counter $14.40, acceptance probability 74%",
      "Platform fee: Gross $144,000 / Fee $1,080 (0.75%) / Net $142,920",
    ];
    lines.forEach((l, i) => doc.text(l, 14, 34 + i * 9));
    doc.save("UAIU-Audit-Pack-UAIU-2026-0041.pdf");
  };

  return (
    <div>
      <StepDots total={TOTAL} current={step} />

      {step === 0 && (
        <div>
          <SectionCard title="Browse Live Listings" icon={Leaf}>
            {demoListings.map((l) => (
              <div key={l.id} style={{ borderTop: `1px solid ${C.border}`, padding: "14px 0", display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <div style={{ fontWeight: 600, color: C.text, marginBottom: 3 }}>{l.project}</div>
                  <div style={{ color: C.muted, fontSize: 13 }}>{l.type}</div>
                  <div style={{ color: C.muted, fontSize: 12 }}>{l.location}</div>
                  <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                    <span style={{ background: "#1e293b", color: "#60a5fa", fontSize: 11, padding: "2px 8px", borderRadius: 4 }}>{l.registry}</span>
                    <span style={{ background: "#1e293b", color: C.muted, fontSize: 11, padding: "2px 8px", borderRadius: 4 }}>Vintage {l.vintage}</span>
                    <RiskBadge score={l.risk} />
                  </div>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{l.status}</div>
                </div>
                <div style={{ textAlign: "right", minWidth: 140 }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: C.gold }}>${l.price.toFixed(2)}<span style={{ fontSize: 13, fontWeight: 400, color: C.muted }}>/tonne</span></div>
                  <div style={{ color: C.muted, fontSize: 12 }}>{l.volume.toLocaleString()} tonnes available</div>
                  <Button size="sm" onClick={() => { setSelected(l); setStep(1); setDdReady(false); }} style={{ marginTop: 8, background: C.gold, color: "#111827", fontWeight: 700 }}>
                    Select <ChevronRight size={13} />
                  </Button>
                </div>
              </div>
            ))}
          </SectionCard>
          <div style={{ textAlign: "right" }}>
            <Button style={{ background: C.gold, color: "#111827", fontWeight: 700 }} onClick={() => setStep(1)}>
              Next Step <ArrowRight size={14} style={{ marginLeft: 6 }} />
            </Button>
          </div>
        </div>
      )}

      {step === 1 && (
        <div>
          <SectionCard title="AI Due Diligence Report" icon={ShieldCheck}>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontWeight: 600, color: C.text }}>{selected.project}</div>
              <div style={{ color: C.muted, fontSize: 13 }}>{selected.registry} · Vintage {selected.vintage} · {selected.volume.toLocaleString()} tonnes</div>
            </div>
            {!ddReady && !ddLoading && (
              <Button onClick={startDd} style={{ background: C.gold, color: "#111827", fontWeight: 700 }}>
                Generate DD Report
              </Button>
            )}
            {ddLoading && (
              <div style={{ color: C.muted, fontSize: 14, padding: "16px 0" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 18, height: 18, border: `2px solid ${C.gold}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                  Generating institutional DD report for {selected.project}...
                </div>
                <div style={{ color: C.muted, fontSize: 12, marginTop: 8 }}>Cross-referencing Verra VCS registry · CORSIA eligibility database · DNV validation records</div>
              </div>
            )}
            {ddReady && (
              <div>
                {ddSections.map((s) => (
                  <div key={s.label} style={{ display: "flex", gap: 12, padding: "10px 0", borderTop: `1px solid ${C.border}` }}>
                    <CheckCircle size={15} color={C.green} style={{ marginTop: 2, flexShrink: 0 }} />
                    <div>
                      <span style={{ color: C.muted, fontSize: 12 }}>{s.label}: </span>
                      <span style={{ color: C.gold, fontWeight: 700, fontSize: 12 }}>{s.value}</span>
                      <div style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>{s.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
          <NavRow step={step} total={TOTAL} onPrev={() => setStep(0)} onNext={() => setStep(2)} nextDisabled={!ddReady} nextLabel={ddReady ? "Next Step →" : "Generate report first"} />
        </div>
      )}

      {step === 2 && (
        <div>
          <SectionCard title="Submit RFQ" icon={FileText}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              {[
                ["Buyer", "Meridian Shipping Group"],
                ["Contact", "Sarah Chen, Chief Compliance Officer"],
                ["Credit Type", "REDD+ / CORSIA Eligible"],
                ["Volume Requested", "10,000 tonnes"],
                ["Target Price", "$14.25 / tonne"],
                ["Delivery", "Spot — within 30 days"],
                ["Registry Preference", "Verra VCS or ART TREES"],
                ["Purpose", "EU ETS Maritime Compliance — Q1 2026"],
              ].map(([k, v]) => (
                <div key={k}>
                  <div style={{ color: C.muted, fontSize: 11, marginBottom: 2 }}>{k}</div>
                  <div style={{ color: C.text, fontSize: 13, fontWeight: 500 }}>{v}</div>
                </div>
              ))}
            </div>
            <Button onClick={() => { setRfqDone(true); setStep(3); }} style={{ marginTop: 18, background: C.gold, color: "#111827", fontWeight: 700 }}>
              Submit RFQ
            </Button>
          </SectionCard>
          <NavRow step={step} total={TOTAL} onPrev={() => setStep(1)} onNext={() => { setRfqDone(true); setStep(3); }} />
        </div>
      )}

      {step === 3 && (
        <div>
          <SectionCard title="AI Trade Negotiator" icon={TrendingUp}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              <div style={{ background: "#0a1628", border: `1px solid ${C.border}`, borderRadius: 6, padding: 16, textAlign: "center" }}>
                <div style={{ color: C.muted, fontSize: 12 }}>Recommended Counter</div>
                <div style={{ color: C.gold, fontSize: 30, fontWeight: 700 }}>$14.40</div>
                <div style={{ color: C.muted, fontSize: 11 }}>per tonne</div>
              </div>
              <div style={{ background: "#0a1628", border: `1px solid ${C.border}`, borderRadius: 6, padding: 16, textAlign: "center" }}>
                <div style={{ color: C.muted, fontSize: 12 }}>Acceptance Probability</div>
                <div style={{ color: C.green, fontSize: 30, fontWeight: 700 }}>74%</div>
                <div style={{ color: C.muted, fontSize: 11 }}>signal: STRONG</div>
              </div>
            </div>
            {[
              ["Counter Range", "$14.20 — $14.65 / tonne"],
              ["Signal Rating", "STRONG — seller motivated"],
              ["Market Context", "2 competing RFQs on same seller inventory"],
              ["Urgency", "Move within 48 hours — seller may accept competing bid"],
              ["Strategy", "Open at $14.25, willing to go to $14.40. Seller's floor estimated $13.95."],
            ].map(([k, v]) => (
              <div key={k as string} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderTop: `1px solid ${C.border}`, gap: 12 }}>
                <span style={{ color: C.muted, fontSize: 13 }}>{k}</span>
                <span style={{ color: C.text, fontSize: 13, fontWeight: 500, textAlign: "right" }}>{v}</span>
              </div>
            ))}
          </SectionCard>
          <NavRow step={step} total={TOTAL} onPrev={() => setStep(2)} onNext={() => setStep(4)} />
        </div>
      )}

      {step === 4 && (
        <div>
          <SectionCard title="Escrow & Settlement" icon={Lock}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
              {[
                ["Trade ID", "UAIU-2026-0041"],
                ["Buyer", "Meridian Shipping Group"],
                ["Seller", "Rimba Raya Conservation LLC"],
                ["Volume", "10,000 tonnes"],
                ["Gross Value", "$144,000"],
                ["Platform Fee (0.75%)", "$1,080"],
                ["Seller Receives", "$142,920"],
                ["Release", "T+1 post registry verification"],
              ].map(([k, v]) => (
                <div key={k as string}>
                  <div style={{ color: C.muted, fontSize: 11, marginBottom: 2 }}>{k}</div>
                  <div style={{ color: k === "Seller Receives" || k === "Gross Value" ? C.gold : C.text, fontSize: 13, fontWeight: 500 }}>{v}</div>
                </div>
              ))}
            </div>
            <div style={{ background: "#0a1a0f", border: `1px solid #14532d`, borderRadius: 6, padding: "12px 16px", display: "flex", alignItems: "center", gap: 10 }}>
              <Lock size={16} color={C.green} />
              <span style={{ color: C.green, fontWeight: 600, fontSize: 13 }}>FUNDS HELD IN STRIPE ESCROW — Pending Registry Transfer Verification</span>
            </div>
          </SectionCard>
          <SectionCard title="Multi-Sig Approval" icon={ShieldCheck}>
            {[
              ["Approver", "Sarah Chen, Chief Compliance Officer"],
              ["Organisation", "Meridian Shipping Group"],
              ["Status", "APPROVED"],
              ["Timestamp", `${new Date().toLocaleDateString()} at 09:14 AM`],
              ["Approval Token", "UAIU-MSIG-2026-0041-SC"],
              ["Notes", "Approved for EU ETS Q1 2026 compliance surrender"],
            ].map(([k, v]) => (
              <div key={k as string} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderTop: `1px solid ${C.border}`, gap: 12 }}>
                <span style={{ color: C.muted, fontSize: 13 }}>{k}</span>
                <span style={{ color: k === "Status" ? C.green : C.text, fontSize: 13, fontWeight: k === "Status" ? 700 : 500 }}>{v}</span>
              </div>
            ))}
          </SectionCard>
          <NavRow step={step} total={TOTAL} onPrev={() => setStep(3)} onNext={() => setStep(5)} />
        </div>
      )}

      {step === 5 && (
        <div>
          <SectionCard title="Audit Pack" icon={Download}>
            <p style={{ color: C.muted, fontSize: 14, marginBottom: 16 }}>
              A single institutional-grade PDF containing all compliance artifacts for Trade UAIU-2026-0041 — ready to hand to your auditor.
            </p>
            {[
              ["Trade ID & Timestamp", "UAIU-2026-0041 · cryptographically timestamped"],
              ["SHA-256 Receipt Hash", "8b1f6d67f3ca8d6c…d6b8a14c"],
              ["Registry Serial Range", selected.serial],
              ["Escrow Proof", "Stripe payment intent ID + hold confirmation"],
              ["Multi-Sig Approval", "Sarah Chen (CCO) — token UAIU-MSIG-2026-0041-SC"],
              ["DD Report Summary", "VERIFIED · CORSIA ELIGIBLE · Risk 92/100 · PROCEED"],
              ["AI Price Analysis", "Counter $14.40 · Acceptance 74% · STRONG signal"],
              ["Platform Fee Breakdown", "Gross $144,000 · Fee $1,080 (0.75%) · Net $142,920"],
            ].map(([k, v]) => (
              <div key={k as string} style={{ display: "flex", gap: 10, padding: "8px 0", borderTop: `1px solid ${C.border}` }}>
                <CheckCircle size={14} color={C.green} style={{ marginTop: 2, flexShrink: 0 }} />
                <div>
                  <span style={{ color: C.muted, fontSize: 12 }}>{k}: </span>
                  <span style={{ color: C.text, fontSize: 12 }}>{v}</span>
                </div>
              </div>
            ))}
            <Button onClick={downloadAuditPack} style={{ marginTop: 18, background: C.gold, color: "#111827", fontWeight: 700 }}>
              <Download size={14} style={{ marginRight: 8 }} />Download Audit Pack PDF
            </Button>
          </SectionCard>
          <div style={{ background: "#0a1a0f", border: `1px solid #14532d`, borderRadius: 8, padding: "18px 22px", textAlign: "center" }}>
            <CheckCircle size={28} color={C.green} style={{ margin: "0 auto 10px" }} />
            <div style={{ color: C.green, fontWeight: 700, fontSize: 16 }}>Trade Complete</div>
            <div style={{ color: C.muted, fontSize: 13, marginTop: 4 }}>Buyer verified. Escrow released. Registry transfer confirmed. Audit pack archived.</div>
          </div>
          <NavRow step={step} total={TOTAL} onPrev={() => setStep(4)} onNext={() => setStep(0)} nextLabel="Start Over" />
        </div>
      )}
    </div>
  );
}

function SellerFlow() {
  const [step, setStep] = useState(0);
  const [published, setPublished] = useState(false);
  const [selectedBid, setSelectedBid] = useState<number | null>(null);
  const TOTAL = 5;

  const downloadReceipt = async () => {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF();
    doc.setFontSize(15);
    doc.text("UAIU.LIVE/X — Settlement Receipt", 14, 18);
    doc.setFontSize(10);
    [
      "Trade ID: UAIU-2026-0041",
      "Seller: Rimba Raya Conservation LLC",
      "Buyer: Meridian Shipping Group",
      "Volume: 10,000 tonnes · VCS-2023-RR-001–010000",
      "Gross: $144,000 · Fee: $1,080 (0.75%) · Net: $142,920",
      "Settlement: Stripe Connect destination charge — T+1",
      "Status: SETTLED — funds released to seller Connect account",
      `Date: ${new Date().toLocaleDateString()}`,
    ].forEach((l, i) => doc.text(l, 14, 34 + i * 9));
    doc.save("UAIU-Settlement-Receipt-UAIU-2026-0041.pdf");
  };

  return (
    <div>
      <StepDots total={TOTAL} current={step} />

      {step === 0 && (
        <div>
          <SectionCard title="List Your Carbon Credits" icon={Leaf}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
              {[
                ["Project Name", "Rimba Raya Biodiversity Reserve"],
                ["Registry", "Verra VCS"],
                ["Vintage Year", "2023"],
                ["Serial Range", "VCS-2023-RR-001–050000"],
                ["Volume Available", "50,000 tonnes"],
                ["Ask Price", "$14.50 / tonne"],
                ["CORSIA Status", "Eligible — Phase 1"],
                ["Minimum Trade Size", "1,000 tonnes"],
              ].map(([k, v]) => (
                <div key={k as string}>
                  <div style={{ color: C.muted, fontSize: 11, marginBottom: 2 }}>{k}</div>
                  <div style={{ color: C.text, fontSize: 13, fontWeight: 500 }}>{v}</div>
                </div>
              ))}
            </div>
            <Button onClick={() => { setPublished(true); setStep(1); }} style={{ background: C.gold, color: "#111827", fontWeight: 700 }}>
              Publish Listing
            </Button>
          </SectionCard>
          <div style={{ textAlign: "right" }}>
            <Button style={{ background: C.gold, color: "#111827", fontWeight: 700 }} onClick={() => { setPublished(true); setStep(1); }}>
              Next Step <ArrowRight size={14} style={{ marginLeft: 6 }} />
            </Button>
          </div>
        </div>
      )}

      {step === 1 && (
        <div>
          <SectionCard title="Incoming Bids" icon={BarChart2}>
            <div style={{ color: C.muted, fontSize: 13, marginBottom: 14 }}>Your listing is live. 3 qualified buyers have submitted RFQs.</div>
            {incomingBids.map((b, i) => (
              <div key={i} style={{ border: `1px solid ${selectedBid === i ? C.gold : C.border}`, borderRadius: 6, padding: "14px 16px", marginBottom: 10, cursor: "pointer" }} onClick={() => setSelectedBid(i)}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                  <div>
                    <div style={{ fontWeight: 600, color: C.text }}>{b.buyer}</div>
                    <div style={{ color: C.muted, fontSize: 12 }}>{b.purpose}</div>
                    <div style={{ color: C.muted, fontSize: 12 }}>{b.volume.toLocaleString()} tonnes · Deadline: {b.deadline}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ color: b.bid >= 14.3 ? C.green : C.amber, fontSize: 20, fontWeight: 700 }}>${b.bid.toFixed(2)}</div>
                    <div style={{ color: C.muted, fontSize: 11 }}>Your ask: ${b.ask.toFixed(2)}</div>
                    <div style={{ color: C.muted, fontSize: 11 }}>Gap: ${(b.ask - b.bid).toFixed(2)}/t</div>
                  </div>
                </div>
              </div>
            ))}
            <Button onClick={() => setStep(2)} disabled={selectedBid === null} style={{ background: selectedBid !== null ? C.gold : C.border, color: selectedBid !== null ? "#111827" : C.muted, fontWeight: 700, marginTop: 8 }}>
              Review Selected Bid <ChevronRight size={14} />
            </Button>
          </SectionCard>
          <NavRow step={step} total={TOTAL} onPrev={() => setStep(0)} onNext={() => setStep(2)} nextDisabled={selectedBid === null} />
        </div>
      )}

      {step === 2 && (
        <div>
          <SectionCard title="AI Negotiator — Seller View" icon={TrendingUp}>
            {selectedBid !== null && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontWeight: 600, color: C.text }}>{incomingBids[selectedBid].buyer}</div>
                <div style={{ color: C.muted, fontSize: 13 }}>Bid: ${incomingBids[selectedBid].bid.toFixed(2)} · Your ask: $14.50</div>
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              <div style={{ background: "#0a1628", border: `1px solid ${C.border}`, borderRadius: 6, padding: 16, textAlign: "center" }}>
                <div style={{ color: C.muted, fontSize: 12 }}>Accept Threshold</div>
                <div style={{ color: C.gold, fontSize: 28, fontWeight: 700 }}>$14.40</div>
                <div style={{ color: C.muted, fontSize: 11 }}>AI recommended floor</div>
              </div>
              <div style={{ background: "#0a1628", border: `1px solid ${C.border}`, borderRadius: 6, padding: 16, textAlign: "center" }}>
                <div style={{ color: C.muted, fontSize: 12 }}>Competing Offers</div>
                <div style={{ color: C.green, fontSize: 28, fontWeight: 700 }}>2</div>
                <div style={{ color: C.muted, fontSize: 11 }}>active RFQs on your inventory</div>
              </div>
            </div>
            {[
              ["Strategy", "Counter at $14.40. Buyer has budget headroom to $14.65."],
              ["Urgency", "Buyer faces EU ETS deadline in 52 days — motivated to close."],
              ["Risk", "LOW — buyer KYB verified, Stripe Connect escrow confirmed."],
              ["Recommendation", "ACCEPT at $14.40 or counter. Do not go below $13.95."],
            ].map(([k, v]) => (
              <div key={k as string} style={{ display: "flex", gap: 12, padding: "8px 0", borderTop: `1px solid ${C.border}` }}>
                <span style={{ color: C.muted, fontSize: 13, minWidth: 110 }}>{k}</span>
                <span style={{ color: C.text, fontSize: 13 }}>{v}</span>
              </div>
            ))}
          </SectionCard>
          <NavRow step={step} total={TOTAL} onPrev={() => setStep(1)} onNext={() => setStep(3)} />
        </div>
      )}

      {step === 3 && (
        <div>
          <SectionCard title="Escrow & Settlement" icon={Lock}>
            <div style={{ background: "#0a1a0f", border: `1px solid #14532d`, borderRadius: 6, padding: "12px 16px", marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
              <Lock size={16} color={C.green} />
              <span style={{ color: C.green, fontWeight: 600, fontSize: 13 }}>BUYER FUNDS HELD IN STRIPE ESCROW</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              {[
                ["Trade ID", "UAIU-2026-0041"],
                ["Buyer", "Meridian Shipping Group"],
                ["Volume", "10,000 tonnes"],
                ["Agreed Price", "$14.40 / tonne"],
                ["Gross", "$144,000"],
                ["Platform Fee (0.75%)", "$1,080"],
                ["You Receive", "$142,920"],
                ["Release", "T+1 after registry transfer confirmed"],
              ].map(([k, v]) => (
                <div key={k as string}>
                  <div style={{ color: C.muted, fontSize: 11, marginBottom: 2 }}>{k}</div>
                  <div style={{ color: k === "You Receive" ? C.green : C.text, fontSize: 13, fontWeight: k === "You Receive" ? 700 : 500 }}>{v}</div>
                </div>
              ))}
            </div>
            <p style={{ color: C.muted, fontSize: 13, marginTop: 14 }}>
              Transfer the registry serial range VCS-2023-RR-001–010000 to the buyer's Verra registry account. Once UAIU confirms the transfer, escrow is released to your Stripe Connect account automatically.
            </p>
          </SectionCard>
          <NavRow step={step} total={TOTAL} onPrev={() => setStep(2)} onNext={() => setStep(4)} nextLabel="Confirm Transfer →" />
        </div>
      )}

      {step === 4 && (
        <div>
          <div style={{ background: "#0a1a0f", border: `1px solid #14532d`, borderRadius: 8, padding: "24px 22px", textAlign: "center", marginBottom: 16 }}>
            <CheckCircle size={32} color={C.green} style={{ margin: "0 auto 12px" }} />
            <div style={{ color: C.green, fontWeight: 700, fontSize: 18 }}>Settlement Complete</div>
            <div style={{ color: C.muted, fontSize: 14, marginTop: 6 }}>$142,920 released to your Stripe Connect account. Registry transfer confirmed. Buyer notified.</div>
          </div>
          <SectionCard title="Settlement Receipt" icon={FileText}>
            {[
              ["Trade ID", "UAIU-2026-0041"],
              ["Amount Released", "$142,920"],
              ["Destination", "Rimba Raya Conservation LLC — Stripe Connect"],
              ["Settlement Method", "Destination charge (T+1)"],
              ["Registry Transfer", "VCS-2023-RR-001–010000 — CONFIRMED"],
              ["Date", new Date().toLocaleDateString()],
            ].map(([k, v]) => (
              <div key={k as string} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderTop: `1px solid ${C.border}`, gap: 12 }}>
                <span style={{ color: C.muted, fontSize: 13 }}>{k}</span>
                <span style={{ color: k === "Amount Released" ? C.green : C.text, fontSize: 13, fontWeight: k === "Amount Released" ? 700 : 500 }}>{v}</span>
              </div>
            ))}
            <Button onClick={downloadReceipt} style={{ marginTop: 16, background: C.gold, color: "#111827", fontWeight: 700 }}>
              <Download size={14} style={{ marginRight: 8 }} />Download Settlement Receipt
            </Button>
          </SectionCard>
          <NavRow step={step} total={TOTAL} onPrev={() => setStep(3)} onNext={() => setStep(0)} nextLabel="Start Over" />
        </div>
      )}
    </div>
  );
}

function MarketPanel() {
  const [bids, setBids] = useState([14.4, 14.2, 14.0, 13.8, 13.5]);
  const [asks, setAsks] = useState([14.5, 14.7, 14.9, 15.0, 15.2]);
  const [euaPrice, setEuaPrice] = useState(64.82);

  useEffect(() => {
    const t = setInterval(() => {
      setBids((p) => p.map((v, i) => +(v + (i === 0 ? randomDelta() : randomDelta() / 2)).toFixed(2)).sort((a, b) => b - a));
      setAsks((p) => p.map((v, i) => +(v + (i === 0 ? randomDelta() : randomDelta() / 2)).toFixed(2)).sort((a, b) => a - b));
      setEuaPrice((p) => +(p + (Math.random() * 0.1 - 0.05)).toFixed(2));
    }, 8000);
    return () => clearInterval(t);
  }, []);

  const trades = useMemo(() => {
    const now = Date.now();
    return [
      { px: 14.48, qty: 1200, minsAgo: 7 }, { px: 14.52, qty: 2600, minsAgo: 14 },
      { px: 14.41, qty: 3100, minsAgo: 23 }, { px: 14.56, qty: 980, minsAgo: 39 },
      { px: 14.44, qty: 4500, minsAgo: 58 },
    ].map((t) => ({ ...t, ts: new Date(now - t.minsAgo * 60_000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }));
  }, []);

  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: "16px 18px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
        <span style={{ color: C.gold, fontFamily: "'Playfair Display', serif", fontSize: 15, fontWeight: 600 }}>EU ETS Spot</span>
        <span style={{ color: C.gold, fontSize: 22, fontWeight: 700 }}>€{euaPrice.toFixed(2)}</span>
      </div>
      <div style={{ marginBottom: 12 }}>
        <div style={{ color: C.muted, fontSize: 11, marginBottom: 6 }}>ORDER BOOK</div>
        {asks.slice().reverse().map((a, i) => (
          <div key={`a${i}`} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "2px 0", color: C.red }}>
            <span>Ask</span><span>${a.toFixed(2)}</span>
          </div>
        ))}
        <div style={{ borderTop: `1px solid ${C.border}`, margin: "4px 0" }} />
        {bids.map((b, i) => (
          <div key={`b${i}`} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "2px 0", color: C.green }}>
            <span>Bid</span><span>${b.toFixed(2)}</span>
          </div>
        ))}
      </div>
      <div style={{ color: C.muted, fontSize: 11, marginBottom: 6 }}>RECENT TRADES</div>
      {trades.map((t, i) => (
        <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, padding: "2px 0", color: C.muted }}>
          <span>{t.ts}</span>
          <span style={{ color: C.text }}>${t.px.toFixed(2)}</span>
          <span>{t.qty.toLocaleString()}t</span>
        </div>
      ))}
    </div>
  );
}

function CalendarPanel() {
  const events = [
    { label: "EU ETS Maritime Q1 Surrender", date: "April 30, 2026", days: 52, status: "urgent" as const },
    { label: "CORSIA Phase 1 Annual Report", date: "June 30, 2026", days: 113, status: "warn" as const },
    { label: "IMO CII Rating Submission", date: "December 31, 2026", days: 296, status: "ok" as const },
    { label: "FuelEU Maritime Compliance", date: "January 1, 2027", days: 297, status: "ok" as const },
  ];
  const borderColor: Record<string, string> = { urgent: C.red, warn: C.amber, ok: C.green, info: "#60a5fa" };

  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: "16px 18px" }}>
      <div style={{ color: C.gold, fontFamily: "'Playfair Display', serif", fontSize: 15, fontWeight: 600, marginBottom: 12 }}>
        Regulatory Calendar
      </div>
      {events.map((e) => (
        <div key={e.label} style={{ borderLeft: `3px solid ${borderColor[e.status]}`, paddingLeft: 10, marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: C.text, fontSize: 13 }}>{e.label}</span>
            <StatusBadge status={e.status} />
          </div>
          <div style={{ color: C.muted, fontSize: 11, marginTop: 2 }}>{e.date} · {e.days} days</div>
        </div>
      ))}
    </div>
  );
}

export default function DemoMode() {
  const [persona, setPersona] = useState<"buyer" | "seller">("buyer");

  return (
    <div style={{ background: C.bg, color: C.text, minHeight: "100vh", fontFamily: "'Inter', sans-serif" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Header */}
      <div style={{ background: "#0a0e1a", borderBottom: `1px solid ${C.border}`, padding: "14px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, color: C.gold, fontWeight: 700, letterSpacing: "0.04em" }}>
          UAIU.LIVE/X
        </div>
        <Link href="/x" style={{ color: C.muted, fontSize: 13, textDecoration: "none", display: "flex", alignItems: "center", gap: 6 }}>
          <ArrowLeft size={13} /> Back to Exchange
        </Link>
      </div>

      {/* Demo Banner */}
      <div style={{ background: "#78350f", borderBottom: `1px solid #92400e`, padding: "8px 24px", textAlign: "center", fontSize: 12, fontWeight: 700, color: C.amber, letterSpacing: "0.06em" }}>
        DEMO MODE — All data is simulated for demonstration purposes only
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 20px" }}>

        {/* Title */}
        <div style={{ marginBottom: 28, textAlign: "center" }}>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(24px, 4vw, 38px)", color: C.gold, margin: "0 0 8px" }}>
            Institutional Carbon Trading Desk
          </h1>
          <p style={{ color: C.muted, fontSize: 14, margin: 0 }}>
            A guided walkthrough of the full trade lifecycle — from listing discovery to audit pack download.
          </p>
        </div>

        {/* Persona Toggle */}
        <div style={{ display: "flex", justifyContent: "center", gap: 12, marginBottom: 28 }}>
          {(["buyer", "seller"] as const).map((p) => (
            <button key={p} onClick={() => setPersona(p)} style={{ padding: "12px 32px", borderRadius: 6, border: `2px solid ${persona === p ? C.gold : C.border}`, background: persona === p ? C.gold : "transparent", color: persona === p ? "#111827" : C.muted, fontWeight: 700, fontSize: 15, cursor: "pointer", textTransform: "capitalize", transition: "all 0.15s" }}>
              {p === "buyer" ? <><Building2 size={15} style={{ display: "inline", marginRight: 7, verticalAlign: "middle" }} />I'm a Buyer</> : <><Leaf size={15} style={{ display: "inline", marginRight: 7, verticalAlign: "middle" }} />I'm a Seller</>}
            </button>
          ))}
        </div>

        {/* Main layout */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 20, alignItems: "start" }}>
          <div>
            {persona === "buyer" ? <BuyerFlow /> : <SellerFlow />}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <MarketPanel />
            <CalendarPanel />
          </div>
        </div>

        {/* CTA Footer */}
        <div style={{ marginTop: 40, background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "28px 32px", textAlign: "center" }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, color: C.gold, marginBottom: 8 }}>
            Ready to trade?
          </div>
          <p style={{ color: C.muted, fontSize: 14, margin: "0 0 20px" }}>
            Open your institutional account in 2 minutes. No fees to join. 0.75% execution fee only.
          </p>
          <div style={{ display: "flex", justifyContent: "center", gap: 12, flexWrap: "wrap" }}>
            <Link href="/x">
              <button style={{ padding: "12px 28px", background: C.gold, color: "#111827", fontWeight: 700, fontSize: 14, borderRadius: 6, border: "none", cursor: "pointer" }}>
                Open Account
              </button>
            </Link>
            <a href="mailto:desk@uaiu.live" style={{ textDecoration: "none" }}>
              <button style={{ padding: "12px 28px", background: "transparent", color: C.muted, fontWeight: 600, fontSize: 14, borderRadius: 6, border: `1px solid ${C.border}`, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
                <Mail size={14} />Contact the Desk
              </button>
            </a>
          </div>
        </div>

      </div>
    </div>
  );
}
