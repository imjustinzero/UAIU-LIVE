export default function SupplyChainMapPage() {
  return (
    <div className="min-h-screen bg-[#06101a] text-white p-4 md:p-8">
      <h1 className="text-3xl font-bold">Industrial Supply Chain Carbon Layer</h1>
      <p className="text-white/70 mt-2">Scope 3 visibility across components, suppliers, EPD verification, offset coverage, and CBAM exposure.</p>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-slate-900 p-4">
          <h2 className="font-semibold">Carbon Flow Map</h2>
          <p className="text-sm text-white/70 mt-2">Interactive Sankey placeholder for carbon flow across component categories.</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-slate-900 p-4">
          <h2 className="font-semibold">Data Quality Heat Map</h2>
          <p className="text-sm text-white/70 mt-2">Highlights verified vs unverified supplier emissions data.</p>
        </div>
      </div>
      <div className="mt-6 rounded-xl border border-white/10 bg-slate-900 p-4 text-sm">
        Use <code>POST /api/supplychain/carbon-map</code> for CSV-imported rows and <code>GET /api/supplychain/:orgId/scope3-hotspots</code> for AI hotspot insight.
      </div>
    </div>
  );
}
