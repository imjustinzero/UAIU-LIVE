import { useEffect, useMemo, useState } from "react";

const DEADLINES = [
  { quarter: "Q1", due: "April 30" },
  { quarter: "Q2", due: "July 31" },
  { quarter: "Q3", due: "October 31" },
  { quarter: "Q4", due: "January 31" },
];

export default function CbamPage() {
  const [factors, setFactors] = useState<Record<string, number>>({});
  const [tonnes, setTonnes] = useState(100);
  const [goods, setGoods] = useState("steel");

  useEffect(() => {
    fetch("/api/cbam/embedded-carbon/factors").then((r) => r.json()).then((d) => setFactors(d.factors || {})).catch(() => setFactors({}));
  }, []);

  const certificates = useMemo(() => Math.max(0, tonnes * (factors[goods] ?? 0)), [tonnes, factors, goods]);

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 md:p-8">
      <h1 className="text-3xl font-bold">CBAM Compliance Module</h1>
      <p className="text-white/70 mt-2">EU Carbon Border Adjustment Mechanism declaration management and submission packaging.</p>

      <section className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-white/10 p-4 bg-slate-900">
          <h2 className="font-semibold">Deadline Calendar</h2>
          <ul className="mt-2 space-y-1 text-sm text-white/80">
            {DEADLINES.map((d) => <li key={d.quarter}>{d.quarter} declaration due by {d.due}</li>)}
          </ul>
        </div>
        <div className="rounded-xl border border-white/10 p-4 bg-slate-900">
          <h2 className="font-semibold">Certificate Calculator</h2>
          <div className="mt-3 space-y-2 text-sm">
            <select value={goods} onChange={(e) => setGoods(e.target.value)} className="w-full bg-slate-800 p-2 rounded">
              {Object.keys(factors).map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
            <input type="number" className="w-full bg-slate-800 p-2 rounded" value={tonnes} onChange={(e) => setTonnes(Number(e.target.value))} />
            <p>Estimated certificates required: <span className="text-emerald-400 font-semibold">{certificates.toFixed(2)}</span></p>
          </div>
        </div>
      </section>

      <section className="mt-6 rounded-xl border border-white/10 p-4 bg-slate-900">
        <h2 className="font-semibold">Submission Package Generator</h2>
        <p className="text-sm text-white/70 mt-2">Use API endpoint <code>/api/cbam/declarations/:id/package</code> to generate downloadable ZIP with summary, calculation methodology, retirement proofs, UVS refs, audit chain and ISO 14064 alignment statement.</p>
      </section>
    </div>
  );
}
