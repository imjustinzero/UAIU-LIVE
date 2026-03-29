import { useEffect, useMemo, useState } from "react";

const interestOptions = ["standards", "methodologies", "regulatory", "market", "cbam", "corsia"];

export default function IndustryIntelligencePage() {
  const [interests, setInterests] = useState<string[]>(["standards", "methodologies", "market"]);
  const [data, setData] = useState<any>(null);

  const query = useMemo(() => interests.join(","), [interests]);

  useEffect(() => {
    fetch(`/api/intelligence/feed?interests=${encodeURIComponent(query)}`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null));
  }, [query]);

  return (
    <div className="min-h-screen bg-[#050911] px-6 py-10 text-[#f2ead8] md:px-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <header>
          <p className="text-xs uppercase tracking-[0.2em] text-[#d4a843]">Daily Briefing</p>
          <h1 className="text-4xl font-semibold">Industry Intelligence Feed</h1>
          <p className="mt-2 max-w-3xl text-sm text-[#c8c0af]">Methodology watch, market signals, standards activity, and regulatory shifts in one curated feed.</p>
        </header>

        <section className="rounded-xl border border-[#d4a84322] bg-[#0f1626] p-4">
          <h2 className="mb-2 text-sm uppercase tracking-[0.15em] text-[#d4a843]">Personalization</h2>
          <div className="flex flex-wrap gap-2">
            {interestOptions.map((item) => (
              <button
                key={item}
                onClick={() => setInterests((prev) => prev.includes(item) ? prev.filter((v) => v !== item) : [...prev, item])}
                className={`rounded-full border px-3 py-1 text-xs uppercase tracking-[0.12em] ${interests.includes(item) ? "border-[#22c55e88] text-[#86efac]" : "border-[#d4a84333] text-[#c8c0af]"}`}
              >
                {item}
              </button>
            ))}
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <article className="rounded-xl border border-[#d4a84322] bg-[#0f1626] p-5 md:col-span-2">
            <h3 className="mb-3 text-xl font-semibold">Top 5 Daily Briefing</h3>
            <div className="space-y-3 text-sm text-[#d7d0bf]">
              {(data?.dailyBriefing || []).map((item: any, idx: number) => (
                <div key={`${item.title}-${idx}`} className="rounded border border-[#ffffff14] p-3">
                  <p className="text-xs uppercase tracking-[0.12em] text-[#a9a092]">{item.type}</p>
                  <p>{item.title}</p>
                </div>
              ))}
            </div>
          </article>
          <article className="rounded-xl border border-[#d4a84322] bg-[#0f1626] p-5">
            <h3 className="mb-3 text-xl font-semibold">AI Briefing</h3>
            <p className="text-sm leading-relaxed text-[#d7d0bf]">{data?.aiBriefing || "Generating your daily briefing..."}</p>
            <div className="mt-4 text-xs text-[#9f9686]">Email digest: daily / weekly (coming from user settings).</div>
          </article>
        </section>
      </div>
    </div>
  );
}
