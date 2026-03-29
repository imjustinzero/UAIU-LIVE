import { useEffect, useState } from "react";

export default function EsgDashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/esg/metrics")
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="min-h-screen bg-[#0a0f1e] text-white p-6">Loading ESG dashboard...</div>;

  return (
    <div className="min-h-screen bg-[#0a0f1e] text-white p-6 space-y-6">
      <h1 className="text-3xl font-bold">UAIU.LIVE/X ESG Reporting Dashboard</h1>

      <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Metric title="Retired (Lifetime tonnes)" value={data?.totals?.retiredLifetimeTonnes} />
        <Metric title="Retired (Current Year)" value={data?.totals?.retiredCurrentYearTonnes} />
        <Metric title="Retired (Current Quarter)" value={data?.totals?.retiredCurrentQuarterTonnes} />
        <Metric title="Settlement Velocity (hrs)" value={data?.totals?.settlementVelocityHoursToFinality} />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="Credits by Registry (Pie-ready)"><pre>{JSON.stringify(data?.creditsByRegistry || {}, null, 2)}</pre></Panel>
        <Panel title="Credits by Project Type (Bar-ready)"><pre>{JSON.stringify(data?.creditsByProjectType || {}, null, 2)}</pre></Panel>
        <Panel title="Credits by Geography"><pre>{JSON.stringify(data?.creditsByGeography || {}, null, 2)}</pre></Panel>
        <Panel title="Average Price per Tonne"><pre>{JSON.stringify(data?.averagePricePerTonne || [], null, 2)}</pre></Panel>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="GHG Accounting Panel"><pre>{JSON.stringify(data?.ghgAccounting || [], null, 2)}</pre></Panel>
        <Panel title="Compliance Status Panel"><pre>{JSON.stringify(data?.complianceStatus || {}, null, 2)}</pre></Panel>
      </section>

      <section className="flex flex-wrap gap-3">
        <a className="px-4 py-2 rounded border border-emerald-400" href="/api/esg/export/csv">Download CSV</a>
        <a className="px-4 py-2 rounded border border-emerald-400" href="/api/esg/export/json">Download JSON</a>
        <a className="px-4 py-2 rounded border border-emerald-400" href="/api/esg/export/xml">Download XML</a>
        <a className="px-4 py-2 rounded border border-emerald-400" href="/api/esg/export/pdf">Download PDF</a>
      </section>
    </div>
  );
}

function Metric({ title, value }: { title: string; value: string | number }) {
  return <div className="bg-[#11182d] border border-white/20 rounded p-4"><div className="text-xs opacity-70">{title}</div><div className="text-2xl font-semibold">{value ?? "0"}</div></div>;
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="bg-[#11182d] border border-white/20 rounded p-4"><h2 className="font-semibold mb-2">{title}</h2><div className="text-xs overflow-auto max-h-[360px]">{children}</div></div>;
}
