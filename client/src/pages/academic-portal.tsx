import PublicPageShell from "@/components/PublicPageShell";

export default function AcademicPortalPage() {
  const datasets = [
    ["/api/academic/v1/market/price-series", "Volume-weighted average price per credit type."],
    ["/api/academic/v1/verification/outcomes", "Verification outcomes by type/geography/standard."],
    ["/api/academic/v1/iot/data-quality", "Aggregated IoT quality and anomaly rates."],
    ["/api/academic/v1/methodology/citations", "Methodology usage and price correlation signals."],
    ["/api/academic/v1/fraud/patterns", "Anonymized anomaly/fraud pattern statistics."],
    ["/api/academic/v1/pqc/algorithm-usage", "Algorithm migration and deprecated usage trends."],
  ];

  return (
    <PublicPageShell title="UAIU.LIVE/X Academic Research Portal" description="Open data for carbon market research." path="/x/academic">
      <div className="space-y-6">
        <h1 className="text-3xl font-semibold text-[#facc15]">UAIU.LIVE/X Academic Research Portal</h1>
        <p className="text-sm text-[#cbd5e1]">Open data for carbon market research. Supporting the people writing the standards that govern the markets we build.</p>

        <section>
          <h2 className="text-xl font-semibold">Available datasets</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {datasets.map(([path, desc]) => (
              <li key={path} className="rounded border border-[#334155] bg-[#0f172a] p-3">
                <code>{path}</code>
                <p className="text-[#cbd5e1]">{desc}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded border border-[#334155] bg-[#0f172a] p-4 text-sm text-[#cbd5e1]">
          <p><strong>How to apply for access:</strong> submit institution, researcher identity, ORCID, and purpose to <code>POST /api/academic/v1/access-request</code>.</p>
          <p className="mt-2"><strong>Citation requirement:</strong> every response includes the <code>X-UAIU-Citation</code> header.</p>
          <p className="mt-2"><strong>Special access:</strong> ISO/GHG Protocol Joint Working Group receives elevated access tier automatically.</p>
        </section>
      </div>
    </PublicPageShell>
  );
}
