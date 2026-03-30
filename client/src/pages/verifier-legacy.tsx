import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";

export default function VerifierLegacyPage() {
  const { data } = useQuery({
    queryKey: ["verifier-legacy"],
    queryFn: async () => {
      const res = await fetch("/api/verifier/legacy");
      if (!res.ok) throw new Error("Failed to load legacy dashboard");
      return res.json();
    },
  });

  const totals = data?.totals;

  return (
    <div className="min-h-screen bg-[#060810] p-6 text-[#f2ead8]">
      <div className="mx-auto max-w-6xl space-y-6">
        <h1 className="text-2xl font-semibold">Verification Legacy Dashboard</h1>

        <div className="grid gap-3 md:grid-cols-4">
          <Impact title="Total tonnes verified" value={totals?.tonnesVerified || 0} />
          <Impact title="Cars off road (equivalent)" value={totals?.carsOffRoadEquivalent || 0} />
          <Impact title="Flights avoided" value={totals?.flightsAvoidedEquivalent || 0} />
          <Impact title="Acres protected" value={totals?.acresProtectedEquivalent || 0} />
          <Impact title="Projects verified" value={totals?.projectsVerified || 0} />
          <Impact title="Countries worked in" value={totals?.countriesWorked || 0} />
          <Impact title="Institutional buyers impacted" value={totals?.buyersImpacted || 0} />
          <Impact title="Value verified (EUR)" value={totals?.creditsValueEur || 0} />
        </div>

        <section className="rounded-xl border border-[#d4a84333] bg-[#0f1626] p-4">
          <h2 className="mb-2 text-sm font-semibold">Verification timeline</h2>
          <div className="space-y-2 text-sm">
            {(data?.timeline || []).map((entry: any) => (
              <div key={entry.id} className="rounded border border-[#d4a84322] p-2">
                <p className="font-medium">{entry.projectName}</p>
                <p className="text-xs text-[#c7c0ae]">Outcome: {entry.outcome} · Completed: {entry.dateCompleted ? new Date(entry.dateCompleted).toLocaleDateString() : "Pending"}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-[#d4a84333] bg-[#0f1626] p-4 text-sm">
          <h2 className="mb-2 font-semibold">Share your impact</h2>
          <p className="text-[#c7c0ae]">Generate a share card for LinkedIn or export PNG for your profile.</p>
          <Button className="mt-3">Generate Share Card</Button>
        </section>
      </div>
    </div>
  );
}

function Impact({ title, value }: { title: string; value: string | number }) {
  return (
    <article className="rounded border border-[#d4a84322] bg-[#0f1626] p-3">
      <p className="text-xs text-[#c7c0ae]">{title}</p>
      <p className="text-lg font-semibold">{Number(value).toLocaleString()}</p>
    </article>
  );
}
