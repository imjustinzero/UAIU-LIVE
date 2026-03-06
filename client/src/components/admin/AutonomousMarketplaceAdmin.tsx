import { useEffect, useState } from "react";

type Props = { adminKey: string };

export function AutonomousMarketplaceAdmin({ adminKey }: Props) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    if (!adminKey) return;
    setLoading(true);
    try {
      const res = await fetch("/api/admin/autonomous-marketplace/queue", {
        headers: { "X-Admin-Key": adminKey },
      });
      const json = await res.json();
      setData(json);
    } finally {
      setLoading(false);
    }
  }

  async function resolveException(id: string) {
    await fetch(`/api/admin/exceptions/${id}/resolve`, {
      method: "POST",
      headers: { "X-Admin-Key": adminKey },
    });
    load();
  }

  useEffect(() => {
    load();
  }, [adminKey]);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ margin: 0 }}>Autonomous Marketplace</h3>
        <button onClick={load} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <section>
        <h4>Review Queue</h4>
        <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(data?.reviewQueue || [], null, 2)}</pre>
      </section>

      <section>
        <h4>RFQ Matches</h4>
        <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(data?.rfqMatches || [], null, 2)}</pre>
      </section>

      <section>
        <h4>Payouts</h4>
        <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(data?.payouts || [], null, 2)}</pre>
      </section>

      <section>
        <h4>Exceptions</h4>
        {(data?.exceptions || []).map((ex: any) => (
          <div key={ex.id} style={{ border: "1px solid #333", padding: 12, marginBottom: 8 }}>
            <div><strong>{ex.code}</strong> — {ex.message}</div>
            <div style={{ fontSize: 12, opacity: 0.8 }}>{ex.entity_type} / {ex.entity_id}</div>
            <button onClick={() => resolveException(ex.id)}>Resolve</button>
          </div>
        ))}
      </section>
    </div>
  );
}
