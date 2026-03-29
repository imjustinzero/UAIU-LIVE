export default function EnterpriseIndustrialPage() {
  const weeks = [
    ["Week 1 — Assessment", "Upload Scope 1/2/3 inventory, CBAM exposure scan, supply chain gap analysis."],
    ["Week 2 — EPD Mapping", "Map top components to EPDs, assign ISO verifier, build carbon budget."],
    ["Week 3 — Credit Procurement", "Reserve UVS credits, launch ISO 14064-2 verification, create product passports."],
    ["Week 4 — Reporting Package", "Finalize Scope 1/2/3 + offsets, CBAM declarations, ISO statements, filings."],
  ];
  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 md:p-8">
      <h1 className="text-3xl font-bold">Ericsson/Honeywell Enterprise Industrial Onboarding</h1>
      <div className="mt-6 grid gap-4 md:grid-cols-2">{weeks.map(([t, d]) => <div key={t} className="rounded-xl border border-white/10 bg-slate-900 p-4"><h2 className="font-semibold">{t}</h2><p className="text-sm text-white/70 mt-2">{d}</p></div>)}</div>
    </div>
  );
}
