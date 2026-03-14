import { useSEO } from "@/lib/seo";

const faq = [
  ["How quickly can fleets procure credits?", "Most trades can settle in T+1 with immediate receipt hashing."],
  ["Are trades auditable?", "Yes. Each trade includes a SHA-256 receipt and downloadable audit pack."],
  ["Does this support IMO reporting?", "Yes, records are formatted for audit and compliance evidence."],
  ["Which standards are supported?", "Verra, Gold Standard, EU ETS pathways, and related registry references."],
  ["Can we onboard multiple entities?", "Yes, desk workflows support multi-entity procurement."],
] as const;

export default function MaritimeCarbonOffsetting() {
  useSEO({
    title: "Maritime Carbon Offsetting — UAIU.LIVE/X",
    description: "How carbon offsetting works for fleet operators and maritime compliance teams.",
    path: "/maritime/carbon-offsetting",
  });

  return (
    <main style={{ minHeight: "100vh", background: "#060810", color: "#f2ead8", padding: "80px 20px" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <h1>Maritime Carbon Offsetting</h1>
        <p style={{ color: "rgba(242,234,216,0.75)" }}>Carbon offsetting for maritime operators means buying verified credits to address residual emissions while meeting mandatory reporting and compliance milestones.</p>

        <h2>How UAIU.LIVE/X Works for Fleet Operators</h2>
        <ul>
          <li>Procure verified inventory matched to regulatory requirements.</li>
          <li>Execute with escrow-backed workflows and settlement traceability.</li>
          <li>Download compliance-ready audit packs per completed trade.</li>
        </ul>

        <h2>FAQ</h2>
        <div style={{ display: "grid", gap: 12 }}>
          {faq.map(([q, a]) => (
            <div key={q} style={{ border: "1px solid rgba(212,168,67,0.22)", background: "#0d1220", padding: 14 }}>
              <strong>{q}</strong>
              <p style={{ marginBottom: 0, color: "rgba(242,234,216,0.75)" }}>{a}</p>
            </div>
          ))}
        </div>

        <a href="#request-demo" style={{ display: "inline-block", marginTop: 20, background: "#d4a843", color: "#060810", padding: "12px 16px", textDecoration: "none", fontWeight: 700 }}>Talk to a Specialist</a>
      </div>
    </main>
  );
}
