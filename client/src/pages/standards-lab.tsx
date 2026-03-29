import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";

type WorkingGroup = {
  id: string;
  name: string;
  description?: string | null;
  leadOrganization: string;
  targetStandard?: string | null;
  status: string;
  memberCount?: number;
  currentDraftStage?: string;
};

export default function StandardsLabPage() {
  const [groups, setGroups] = useState<WorkingGroup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/working-groups")
      .then((r) => r.json())
      .then((d) => setGroups(Array.isArray(d) ? d : []))
      .catch(() => setGroups([]))
      .finally(() => setLoading(false));
  }, []);

  const active = useMemo(() => groups.filter((g) => ["forming", "active", "consultation", "balloting"].includes(g.status)), [groups]);

  return (
    <div className="min-h-screen bg-[#060810] px-6 py-10 text-[#f2ead8] md:px-10">
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="space-y-3">
          <p className="text-xs uppercase tracking-[0.2em] text-[#d4a843]">Standards Development</p>
          <h1 className="text-4xl font-semibold md:text-5xl">UAIU Standards Lab</h1>
          <p className="max-w-3xl text-sm text-[#c7c0ae]">Open methodology development for the voluntary carbon market. Where the industry writes its future.</p>
        </header>

        <section className="grid gap-4 rounded-xl border border-[#d4a84333] bg-[#0f1626] p-6 md:grid-cols-2">
          <h2 className="text-xl font-medium md:col-span-2">How to Participate</h2>
          <ul className="space-y-2 text-sm text-[#d6d0bf]">
            <li>• Anyone can read drafts.</li>
            <li>• Verified partners can comment.</li>
            <li>• ISO verifiers can vote.</li>
            <li>• Working group leads control membership.</li>
          </ul>
          <div className="space-y-2 text-sm text-[#d6d0bf]">
            <p>Draft viewer includes table-of-contents anchors, paragraph-level comments, and diff from previous drafts.</p>
            <p>Vote dashboard shows live tally during balloting and full transparency after close.</p>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold">Active Working Groups</h2>
            <button className="rounded border border-[#d4a84366] px-4 py-2 text-xs uppercase tracking-[0.18em]">Create Group</button>
          </div>
          {loading ? <p className="text-sm text-[#c7c0ae]">Loading working groups...</p> : null}
          <div className="grid gap-4 md:grid-cols-2">
            {active.map((group) => (
              <article key={group.id} className="rounded-xl border border-[#d4a84322] bg-[#0f1626] p-5">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-lg font-semibold">{group.name}</h3>
                  <span className="rounded-full border border-[#22c55e55] px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-[#86efac]">{group.status}</span>
                </div>
                <p className="mb-3 text-sm text-[#cbc4b3]">{group.description || "No description provided."}</p>
                <dl className="space-y-1 text-xs text-[#a49a84]">
                  <div><dt className="inline">Lead Organization: </dt><dd className="inline">{group.leadOrganization}</dd></div>
                  <div><dt className="inline">Target Standard: </dt><dd className="inline">{group.targetStandard || "TBD"}</dd></div>
                  <div><dt className="inline">Members: </dt><dd className="inline">{group.memberCount ?? 0}</dd></div>
                  <div><dt className="inline">Current Stage: </dt><dd className="inline">{group.currentDraftStage || "—"}</dd></div>
                </dl>
                <div className="mt-4 flex flex-wrap gap-2 text-xs">
                  <Link href={`/x/standards-lab?group=${group.id}`} className="rounded border border-[#d4a84366] px-3 py-2">Comment</Link>
                  <button className="rounded border border-[#d4a84344] px-3 py-2">Join</button>
                  <button className="rounded border border-[#d4a84344] px-3 py-2">Follow</button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
