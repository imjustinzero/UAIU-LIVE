import { useSEO } from "@/lib/seo";

export default function Maritime() {
  useSEO({
    title: "Carbon Compliance for Maritime Operations",
    description: "Procure, verify, and report maritime carbon credits with IMO-ready workflows.",
    path: "/maritime",
  });

  return (
    <main style={{ minHeight: "100vh", background: "#060810", color: "#f2ead8", padding: "80px 20px" }}>
      <div style={{ maxWidth: 980, margin: "0 auto" }}>
        <h1 style={{ fontSize: "clamp(32px,6vw,56px)", marginBottom: 12 }}>Carbon Compliance for Maritime Operations</h1>
        <p style={{ color: "rgba(242,234,216,0.75)", maxWidth: 760 }}>Institutional-grade procurement, settlement, and audit readiness for cruise and shipping operators.</p>

        <section style={{ marginTop: 36 }}>
          <h2>3-Step Process</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
            {["Procure", "Verify", "Report"].map((step, idx) => (
              <div key={step} style={{ border: "1px solid rgba(212,168,67,0.22)", padding: 16, background: "#0d1220" }}>
                <div style={{ color: "#d4a843", fontSize: 12 }}>Step {idx + 1}</div>
                <div>{step}</div>
              </div>
            ))}
          </div>
        </section>

        <section style={{ marginTop: 28 }}>
          <h2>Compliance Urgency</h2>
          <p style={{ color: "rgba(242,234,216,0.75)" }}>IMO 2023 carbon intensity rules are tightening disclosure and performance expectations. UAIU.LIVE/X provides execution and evidence rails for compliance deadlines.</p>
        </section>

        <section style={{ marginTop: 28 }}>
          <h2>Compatible Registries</h2>
          <p>Verra · Gold Standard · EU ETS</p>
        </section>

        <a href="#request-demo" style={{ display: "inline-block", marginTop: 22, background: "#d4a843", color: "#060810", padding: "12px 18px", textDecoration: "none", fontWeight: 700 }}>Request a Demo</a>
      </div>
    </main>
  );
}
