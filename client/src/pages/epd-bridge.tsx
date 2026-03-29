import { useState } from "react";

export default function EpdBridgePage() {
  const [category, setCategory] = useState("steel");
  const [volume, setVolume] = useState(10);
  const [result, setResult] = useState<any>(null);

  const runEstimate = async () => {
    const res = await fetch(`/api/epd/calculator?productCategory=${encodeURIComponent(category)}&volume=${volume}&functionalUnit=per-unit`);
    setResult(await res.json());
  };

  return (
    <div className="min-h-screen bg-[#081018] text-white p-4 md:p-8">
      <h1 className="text-3xl font-bold">EPD / LCA Data Bridge</h1>
      <p className="text-white/70 mt-2">Register EPDs, link retirement proofs, and issue product-level offset certificates.</p>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-slate-900 p-4">
          <h2 className="font-semibold">Carbon Calculator</h2>
          <div className="space-y-2 mt-3 text-sm">
            <input className="w-full bg-slate-800 rounded p-2" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="product category" />
            <input className="w-full bg-slate-800 rounded p-2" type="number" value={volume} onChange={(e) => setVolume(Number(e.target.value))} />
            <button onClick={runEstimate} className="px-3 py-2 rounded bg-emerald-500 text-black font-semibold">Estimate</button>
            {result && <pre className="text-xs bg-black/40 p-2 rounded overflow-auto">{JSON.stringify(result, null, 2)}</pre>}
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-slate-900 p-4 text-sm text-white/80">
          <h2 className="font-semibold text-white">Workflow</h2>
          <ol className="list-decimal ml-5 mt-2 space-y-1">
            <li>Upload/register EPD using <code>POST /api/epd/records</code>.</li>
            <li>Link retirement IDs using <code>POST /api/epd/records/:id/link-retirements</code>.</li>
            <li>Download certificate via <code>GET /api/epd/records/:id/certificate</code>.</li>
            <li>Create product passport with linked EPD and retirement proofs.</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
