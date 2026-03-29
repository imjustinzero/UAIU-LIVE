import { useEffect, useMemo, useState } from "react";
import { useRoute } from "wouter";

export default function ProductPassportPage() {
  const [, params] = useRoute("/x/product/:certificateNumber");
  const certificateNumber = params?.certificateNumber || "";
  const [passport, setPassport] = useState<any>(null);

  useEffect(() => {
    if (!certificateNumber) return;
    fetch(`/api/pcp/${encodeURIComponent(certificateNumber)}`).then((r) => r.json()).then(setPassport).catch(() => setPassport(null));
  }, [certificateNumber]);

  const state = useMemo(() => {
    const total = Number(passport?.totalBatchCarbon || 0);
    const retired = Array.isArray(passport?.retirementIds) ? passport.retirementIds.length : 0;
    if (!total) return { label: "NO OFFSET", color: "text-red-400" };
    if (retired >= total) return { label: "FULLY OFFSET", color: "text-emerald-400" };
    if (retired > 0) return { label: "PARTIAL OFFSET", color: "text-amber-400" };
    return { label: "NO OFFSET", color: "text-red-400" };
  }, [passport]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-4 md:p-8">
      <div className="max-w-3xl mx-auto rounded-2xl border border-zinc-700 bg-zinc-900 p-5">
        <h1 className="text-3xl font-bold">{passport?.productName || "Product Carbon Passport"}</h1>
        <p className="text-sm text-zinc-400">Certificate: {certificateNumber}</p>
        <div className="mt-5 grid gap-3 md:grid-cols-2 text-sm">
          <div className="rounded border border-zinc-700 p-3">Embedded Carbon / Unit: <b>{passport?.embeddedCarbonPerUnit || "-"} kg CO₂e</b></div>
          <div className="rounded border border-zinc-700 p-3">Batch Carbon: <b>{passport?.totalBatchCarbon || "-"} tCO₂e</b></div>
        </div>
        <p className={`mt-4 font-semibold ${state.color}`}>{state.label}</p>
        <div className="mt-4 h-3 rounded bg-zinc-800 overflow-hidden">
          <div className="h-full bg-emerald-500" style={{ width: `${Math.min(100, (Array.isArray(passport?.retirementIds) ? passport.retirementIds.length * 10 : 0))}%` }} />
        </div>
        <div className="mt-4 flex gap-2">
          <a href={`/api/pcp/${encodeURIComponent(certificateNumber)}/pdf`} className="px-3 py-2 rounded bg-emerald-500 text-black font-semibold">Download PDF</a>
          <button className="px-3 py-2 rounded border border-zinc-600" onClick={() => navigator.share?.({ title: passport?.productName || "Product Carbon Passport", url: window.location.href })}>Share</button>
        </div>
      </div>
    </div>
  );
}
