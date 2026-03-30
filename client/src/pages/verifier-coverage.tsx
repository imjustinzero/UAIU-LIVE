import { useQuery } from "@tanstack/react-query";

export default function VerifierCoveragePage() {
  const { data } = useQuery({
    queryKey: ["verifier-coverage-map"],
    queryFn: async () => {
      const res = await fetch("/api/verifier/coverage/map");
      if (!res.ok) throw new Error("Failed to load coverage");
      return res.json();
    },
  });

  return (
    <div className="min-h-screen bg-[#060810] p-6 text-[#f2ead8]">
      <div className="mx-auto max-w-6xl space-y-5">
        <h1 className="text-2xl font-semibold">Regional Verifier Coverage Map</h1>
        <p className="text-sm text-[#c7c0ae]">Heat intensity: green (3+), amber (1-2), red (demand gap), grey (no activity).</p>

        <div className="grid gap-3 md:grid-cols-3">
          {(data?.countries || []).map((country: any) => (
            <article key={country.country} className="rounded-lg border border-[#d4a84322] bg-[#0f1626] p-3 text-sm">
              <p className="font-semibold">{country.country}</p>
              <p>Coverage: <span className="uppercase">{country.coverageStatus}</span></p>
              <p>Verifiers: {country.verifierCount}</p>
              <p>Projects needing verification: {country.projectsNeedingVerification}</p>
              <p>Credits available: {Math.round(country.creditsAvailable || 0).toLocaleString()} tCO2e</p>
            </article>
          ))}
        </div>

        <section className="rounded-lg border border-[#d4a84322] bg-[#0f1626] p-4">
          <h2 className="mb-3 text-sm font-semibold">Demand vs Supply</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-[#c7c0ae]">
                  <th className="pb-2">Country</th>
                  <th className="pb-2">Need</th>
                  <th className="pb-2">Verifiers</th>
                  <th className="pb-2">Gap</th>
                </tr>
              </thead>
              <tbody>
                {(data?.demandVsSupply || []).map((row: any) => (
                  <tr key={row.country} className="border-t border-[#d4a84322]">
                    <td className="py-2">{row.country}</td>
                    <td>{row.projectsNeedingVerification}</td>
                    <td>{row.verifierCount}</td>
                    <td>{Math.max(0, row.projectsNeedingVerification - row.verifierCount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
