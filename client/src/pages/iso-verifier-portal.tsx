export default function IsoVerifierPortalPage() {
  const standards = ["ISO 14064-1", "ISO 14064-2", "ISO 14064-3", "ISO 14065", "ISO 14066", "ISO 14025", "ISO 14040/44"];
  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 md:p-8">
      <h1 className="text-3xl font-bold">ISO Verifier & Validator Portal</h1>
      <p className="text-white/70 mt-2">Dedicated workspace for ISO-accredited verification bodies.</p>
      <section className="mt-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-white/10 p-4 bg-slate-900"><h2 className="font-semibold">Engagement Dashboard</h2><p className="text-sm text-white/70 mt-2">Active engagements, pending statements, and deadlines.</p></div>
        <div className="rounded-xl border border-white/10 p-4 bg-slate-900"><h2 className="font-semibold">Data Room</h2><p className="text-sm text-white/70 mt-2">GHG inventory, LCA/EPD files, IoT summaries, audit chain references.</p></div>
        <div className="rounded-xl border border-white/10 p-4 bg-slate-900"><h2 className="font-semibold">Statement Generator</h2><p className="text-sm text-white/70 mt-2">ISO-compliant statements with digital signature and on-chain hash.</p></div>
      </section>
      <section className="mt-6 rounded-xl border border-white/10 p-4 bg-slate-900">
        <h2 className="font-semibold">Supported Standards</h2>
        <div className="flex flex-wrap gap-2 mt-2">{standards.map((s) => <span key={s} className="text-xs px-2 py-1 rounded bg-white/10">{s}</span>)}</div>
      </section>
    </div>
  );
}
