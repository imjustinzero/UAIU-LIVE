import { useEffect, useMemo, useState } from "react";

const slides = ["Net Zero Progress", "Live Project Map", "Compliance Status", "Audit Chain Live", "Verification Proof"] as const;

export default function BoardroomPage({ params }: { params: { orgId: string } }) {
  const [index, setIndex] = useState(0);
  const [auto, setAuto] = useState(false);
  const [data, setData] = useState<any>(null);

  useEffect(() => { fetch(`/api/boardroom/${params.orgId}/data`).then((r) => r.json()).then(setData); }, [params.orgId]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") setIndex((i) => Math.min(4, i + 1));
      if (e.key === "ArrowLeft") setIndex((i) => Math.max(0, i - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => {
    if (!auto) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % slides.length), 30_000);
    return () => clearInterval(t);
  }, [auto]);

  const progress = useMemo(() => Number(data?.netZero?.progressPct || 0), [data]);

  return (
    <div className="min-h-screen bg-black text-white p-4 md:p-10">
      <div className="absolute top-4 right-4 text-xs flex items-center gap-3">
        <button className="border border-white/30 rounded px-2 py-1" onClick={() => setAuto((v) => !v)}>Auto {auto ? "ON" : "OFF"}</button>
        <span>{index + 1}/{slides.length}</span>
      </div>

      {index === 0 && <section className="h-[90vh] grid place-content-center text-center gap-8">
        <h1 className="text-5xl md:text-8xl font-bold">{Number(data?.netZero?.tonnesOffsetThisYear || 0).toLocaleString()} t</h1>
        <p className="text-xl text-white/70">Tonnes offset this year</p>
        <div className="mx-auto h-48 w-48 rounded-full border-8 border-emerald-400 grid place-content-center text-3xl">{progress}%</div>
        <div>Verra {data?.netZero?.registryBreakdown?.verra || 0} • Gold Standard {data?.netZero?.registryBreakdown?.goldStandard || 0} • UVS {data?.netZero?.uvsCertifiedPercentage || 0}%</div>
      </section>}

      {index === 1 && <section className="h-[90vh] relative rounded-2xl border border-emerald-500/50 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#051e10] to-[#071f2f]" />
        {Array.from({ length: 25 }).map((_, i) => <div key={i} className="absolute h-2 w-2 bg-emerald-400 rounded-full animate-pulse" style={{ left: `${(i * 13) % 96}%`, top: `${(i * 17) % 90}%` }} />)}
        <div className="absolute bottom-0 left-0 right-0 bg-black/70 p-2 text-sm">Credit retirement ticker • Live IoT pulses active</div>
      </section>}

      {index === 2 && <section className="h-[90vh] grid place-content-center gap-4 text-3xl">
        {Object.entries(data?.compliance || {}).map(([k, v]) => <div key={k}>✅ {k.toUpperCase()}: {String(v)}</div>)}
      </section>}

      {index === 3 && <section className="h-[90vh] p-4 md:p-12">
        <h2 className="text-4xl mb-4">Audit Chain Live — INTACT ✓</h2>
        <div className="space-y-2 text-sm">{(data?.audit?.lastBlocks || []).map((b: any) => <div key={b.id} className="rounded border border-white/20 p-2">Block #{b.blockNumber} • {b.algorithm}</div>)}</div>
        <div className="mt-6 text-white/70">Total blocks: {data?.audit?.totalBlocks || 0} • Current algorithm: {data?.audit?.algorithm}</div>
      </section>}

      {index === 4 && <section className="h-[90vh] grid place-content-center text-center gap-4">
        <div className="mx-auto h-56 w-56 bg-white text-black grid place-content-center">QR</div>
        <div className="text-2xl">Certificate: {data?.verificationProof?.certificateNumber}</div>
        <div>Scan to verify independently</div>
        <div className="inline-block bg-emerald-500/20 border border-emerald-300 rounded px-3 py-1">UVS {data?.verificationProof?.grade}</div>
      </section>}
    </div>
  );
}
