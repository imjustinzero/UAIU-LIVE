import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

function getToken() {
  return localStorage.getItem("x-exchange-token") || sessionStorage.getItem("x-exchange-token") || "";
}

export default function PartnerDashboardPage() {
  const partnerId = useMemo(() => localStorage.getItem("x-partner-id") || "", []);
  const { data } = useQuery({
    queryKey: ["partner-dashboard", partnerId],
    queryFn: async () => {
      const r = await fetch(`/api/partners/${partnerId}/dashboard`, { headers: { "X-Exchange-Token": getToken() } });
      if (!r.ok) throw new Error("Failed to load dashboard");
      return r.json();
    },
    enabled: !!partnerId,
  });

  if (!partnerId) return <main className="p-8">No partner session found.</main>;
  if (!data) return <main className="p-8">Loading dashboard…</main>;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10">
      <div className="max-w-6xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold">Partner Revenue Dashboard</h1>
        <section className="grid md:grid-cols-4 gap-4">
          <div className="p-4 border border-slate-700 rounded">New referrals: {data.pipeline?.pending ?? 0}</div>
          <div className="p-4 border border-slate-700 rounded">Active: {data.pipeline?.active ?? 0}</div>
          <div className="p-4 border border-slate-700 rounded">Completed: {data.pipeline?.completed ?? 0}</div>
          <div className="p-4 border border-slate-700 rounded">Declined: {data.pipeline?.declined ?? 0}</div>
        </section>
        <section className="p-4 border border-slate-700 rounded">
          <h2 className="font-semibold">Revenue Tracking</h2>
          <p className="text-slate-300">Total earned from UAIU referrals: €{Number(data.revenue?.totalEarned || 0).toLocaleString()}</p>
        </section>
      </div>
    </main>
  );
}
