import { useQuery } from "@tanstack/react-query";

export default function PartnerMethodologyImpact() {
  const partnerId = "00000000-0000-0000-0000-000000000001";
  const { data, isLoading } = useQuery({
    queryKey: ["partner-methodology-impact", partnerId],
    queryFn: async () => (await fetch(`/api/partner/methodology-impact?partnerId=${partnerId}`)).json(),
  });

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6 md:p-10">
      <h1 className="text-3xl font-semibold">Methodology Impact Dashboard</h1>
      {isLoading ? <p className="mt-4">Loading…</p> : (
        <div className="grid md:grid-cols-3 gap-4 mt-6">
          <div className="rounded-xl border border-white/10 bg-slate-900 p-4"><p className="text-sm text-white/70">Total credits verified</p><p className="text-2xl mt-1">{data?.totalCreditsVerified ?? 0}</p></div>
          <div className="rounded-xl border border-white/10 bg-slate-900 p-4"><p className="text-sm text-white/70">Total tonnes CO2e</p><p className="text-2xl mt-1">{Math.round(data?.totalTonnes ?? 0).toLocaleString()}</p></div>
          <div className="rounded-xl border border-white/10 bg-slate-900 p-4"><p className="text-sm text-white/70">Countries</p><p className="text-2xl mt-1">{(data?.countries || []).length}</p></div>
        </div>
      )}
    </div>
  );
}
