import { useEffect, useState } from "react";

export default function ZStop() {
  const [status, setStatus] = useState<any>(null);

  useEffect(() => {
    fetch("/api/status/public")
      .then(r => r.json())
      .then(setStatus)
      .catch(() => setStatus({ status: "warning", message: "Status temporarily unavailable." }));
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: "#060810", color: "#f2ead8", display: "grid", placeItems: "center", padding: 24 }}>
      <div style={{ maxWidth: 720, width: "100%", border: "1px solid rgba(212,168,67,0.35)", padding: 32, background: "#0d1220" }}>
        <div style={{ color: "#d4a843", fontSize: 12, letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 12 }}>
          UAIU.LIVE/X
        </div>
        <h1 style={{ marginTop: 0 }}>Platform Status</h1>
        <p>{status?.message || "Loading current status..."}</p>
        <div style={{ marginTop: 16, fontFamily: "monospace" }}>
          status: {status?.status || "loading"}<br />
          tradingEnabled: {String(status?.tradingEnabled ?? "loading")}<br />
          updatedAt: {status?.updatedAt || "loading"}
        </div>
      </div>
    </div>
  );
}
