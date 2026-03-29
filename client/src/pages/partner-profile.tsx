import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";

export default function PartnerProfilePage() {
  const { partnerId } = useParams<{ partnerId: string }>();
  const { data, isLoading } = useQuery({
    queryKey: ["partner-profile", partnerId],
    queryFn: async () => {
      const r = await fetch(`/api/partners/${partnerId}/profile`);
      if (!r.ok) throw new Error("Failed to load profile");
      return r.json();
    },
    enabled: !!partnerId,
  });

  if (isLoading) return <main className="p-8 text-slate-200">Loading partner profile…</main>;
  if (!data) return <main className="p-8 text-slate-200">Partner profile unavailable.</main>;

  const credentials = data.credentials || {};
  const specializations = data.specializations || {};

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10">
      <div className="max-w-5xl mx-auto space-y-8">
        <header className="rounded-xl border border-slate-700 bg-slate-900 p-6">
          <div className="text-xs uppercase text-amber-300">{data.partnerBadgeLevel}</div>
          <h1 className="text-3xl font-bold mt-1">{data.firmName}</h1>
          <p className="text-slate-300 mt-2">{data.methodologyDescription || "Independent human verification services for carbon credit assurance."}</p>
          <button className="mt-4 bg-amber-500 text-slate-950 px-4 py-2 rounded">Engage This Partner</button>
        </header>

        <section className="grid md:grid-cols-2 gap-4">
          <article className="rounded-xl border border-slate-700 bg-slate-900 p-4">
            <h2 className="font-semibold mb-2">Credentials</h2>
            <pre className="text-xs text-slate-300 whitespace-pre-wrap">{JSON.stringify(credentials, null, 2)}</pre>
          </article>
          <article className="rounded-xl border border-slate-700 bg-slate-900 p-4">
            <h2 className="font-semibold mb-2">Specializations</h2>
            <pre className="text-xs text-slate-300 whitespace-pre-wrap">{JSON.stringify(specializations, null, 2)}</pre>
          </article>
        </section>

        <section className="rounded-xl border border-slate-700 bg-slate-900 p-4">
          <h2 className="font-semibold mb-3">Platform Stats</h2>
          <div className="grid md:grid-cols-4 gap-3 text-sm">
            <div>Referrals: {data.stats?.totalReferrals ?? 0}</div>
            <div>Completed: {data.stats?.completedEngagements ?? 0}</div>
            <div>Conversion: {data.stats?.conversionRate ?? 0}%</div>
            <div>Value: €{Number(data.stats?.totalEngagementValue || 0).toLocaleString()}</div>
          </div>
        </section>
      </div>
    </main>
  );
}
