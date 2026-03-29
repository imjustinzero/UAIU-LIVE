export default function GovContractsPage() {
  const vehicles = ["GSA Schedule", "SEWP V", "OASIS+", "GWACs"];
  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 md:p-8">
      <h1 className="text-3xl font-bold">GovCon Contract Vehicle Readiness</h1>
      <div className="mt-4 grid gap-3 md:grid-cols-2">{vehicles.map((v) => <div key={v} className="rounded-lg border border-white/10 p-4 bg-slate-900"><h2 className="font-semibold">{v}</h2><p className="text-sm text-white/70 mt-1">Capability statement, NAICS mapping, pricing and past performance pack.</p></div>)}</div>
    </div>
  );
}
