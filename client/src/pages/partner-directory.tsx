import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";

export default function PartnerDirectoryPage() {
  const [partnerType, setPartnerType] = useState("");
  const [country, setCountry] = useState("");
  const [specialization, setSpecialization] = useState("");
  const [standard, setStandard] = useState("");

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (partnerType) params.set("partnerType", partnerType);
    if (country) params.set("country", country);
    if (specialization) params.set("specialization", specialization);
    if (standard) params.set("standard", standard);
    return params.toString();
  }, [partnerType, country, specialization, standard]);

  const { data } = useQuery({
    queryKey: ["partner-directory", query],
    queryFn: async () => {
      const r = await fetch(`/api/partners/directory${query ? `?${query}` : ""}`);
      if (!r.ok) throw new Error("Failed to load partner directory");
      return r.json();
    },
  });

  const partners = data?.partners || [];
  const featured = partners.filter((p: any) => p.partnerBadgeLevel === "featured").slice(0, 3);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="space-y-2">
          <h1 className="text-4xl font-bold">UAIU Verified Partners</h1>
          <p className="text-slate-300">Independent human verification for institutional-grade carbon confidence.</p>
        </header>

        <section className="rounded-xl border border-slate-700 p-4 grid md:grid-cols-4 gap-3">
          <input className="bg-slate-900 border border-slate-700 rounded px-3 py-2" placeholder="Partner type" value={partnerType} onChange={(e) => setPartnerType(e.target.value)} />
          <input className="bg-slate-900 border border-slate-700 rounded px-3 py-2" placeholder="Country" value={country} onChange={(e) => setCountry(e.target.value)} />
          <input className="bg-slate-900 border border-slate-700 rounded px-3 py-2" placeholder="Specialization" value={specialization} onChange={(e) => setSpecialization(e.target.value)} />
          <input className="bg-slate-900 border border-slate-700 rounded px-3 py-2" placeholder="Standard" value={standard} onChange={(e) => setStandard(e.target.value)} />
        </section>

        {!!featured.length && (
          <section>
            <h2 className="text-2xl font-semibold mb-4">Featured Partners</h2>
            <div className="grid md:grid-cols-3 gap-4">
              {featured.map((p: any) => (
                <article key={p.id} className="rounded-xl border border-amber-500/40 bg-slate-900 p-4">
                  <div className="text-xs uppercase text-amber-300">Featured</div>
                  <h3 className="font-semibold mt-1">{p.firmName}</h3>
                  <p className="text-sm text-slate-300">{p.country || "Global"}</p>
                  <Link href={`/x/partners/${p.id}`} className="text-amber-300 text-sm">View profile →</Link>
                </article>
              ))}
            </div>
          </section>
        )}

        <section>
          <h2 className="text-2xl font-semibold mb-4">Partner Network</h2>
          <div className="grid md:grid-cols-3 gap-4">
            {partners.map((p: any) => (
              <article key={p.id} className="rounded-xl border border-slate-700 bg-slate-900 p-4 space-y-1">
                <h3 className="font-semibold">{p.firmName}</h3>
                <p className="text-sm text-slate-300">{p.partnerType} · {p.country || "Global"}</p>
                <p className="text-xs text-slate-400">Engagements: {p.totalEngagementsCompleted}</p>
                <Link href={`/x/partners/${p.id}`} className="text-sky-300 text-sm">Profile →</Link>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
