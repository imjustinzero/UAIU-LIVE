const frameworks = ["SEC Climate Disclosure", "EU CSRD", "CDP", "TCFD", "CORSIA", "SB 253 / SB 261", "UK TCFD", "GRI"];

export default function ComplianceMonitorPage() {
  return (
    <div className="min-h-screen bg-[#060a13] text-white p-4 md:p-8 space-y-4">
      <h1 className="text-3xl font-semibold">Real-Time Compliance Monitor</h1>
      <section className="rounded border border-white/20 p-4 bg-slate-900">
        <h2 className="font-medium mb-3">Compliance Calendar</h2>
        <div className="grid md:grid-cols-2 gap-2 text-sm">
          {[90, 30, 7, 0].map((d) => <div key={d} className="rounded border border-white/10 p-2">{d === 0 ? "TODAY" : `${d} days before`} — Start preparing your filing</div>)}
        </div>
      </section>
      <section className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">{frameworks.map((f) => <div key={f} className="rounded border border-white/20 p-3 bg-slate-900 text-sm">
        <div className="font-medium">{f}</div><div>Status: compliant</div><div>Data completeness: 92%</div><button className="mt-2 rounded border border-emerald-300/40 px-2 py-1">Generate filing</button>
      </div>)}</section>
    </div>
  );
}
