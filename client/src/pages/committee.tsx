import { useEffect, useState } from "react";

export default function CommitteePage() {
  const [members, setMembers] = useState<any[]>([]);
  const [amendments, setAmendments] = useState<any[]>([]);

  useEffect(() => {
    fetch("/api/committee/members").then((r) => r.json()).then(setMembers);
    fetch("/api/committee/amendments").then((r) => r.json()).then(setAmendments);
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0f1e] px-4 py-6 text-white sm:px-6 lg:px-10">
      <div className="mx-auto max-w-6xl space-y-4">
        <h1 className="text-[clamp(22px,4vw,40px)] font-bold">UVS Standards Committee</h1>
        <section className="rounded-xl border border-[#1f2937] bg-[#111827] p-4">
          <h2 className="text-xl font-semibold">Committee Members</h2>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            {members.map((m) => (
              <article key={m.id} className="rounded-lg border border-[#1f2937] p-3">
                <p className="font-semibold">{m.name}</p><p className="text-sm text-white/70">{m.organization} • {m.role}</p>
                <p className="text-sm">Expertise: {m.expertise}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="rounded-xl border border-[#1f2937] bg-[#111827] p-4">
          <h2 className="text-xl font-semibold">Methodology Amendments</h2>
          <div className="mt-3 space-y-2">
            {amendments.length === 0 && <p className="text-sm text-white/70">No amendments yet.</p>}
            {amendments.map((a) => <div key={a.id} className="rounded border border-[#1f2937] p-3 text-sm"><p className="font-medium">{a.title}</p><p className="text-white/70">Status: {a.status}</p></div>)}
          </div>
        </section>
      </div>
    </div>
  );
}
