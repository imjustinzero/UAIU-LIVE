import { useEffect, useState } from "react";
import PublicPageShell from "@/components/PublicPageShell";

export default function ChallengePage() {
  const [rows, setRows] = useState<any[]>([]);
  const [form, setForm] = useState({ submittedBy: "", submitterEmail: "", claimChallenged: "", challengeDescription: "", evidenceRequested: "" });
  const [challengeNumber, setChallengeNumber] = useState<string>("");

  const load = () => fetch("/api/challenges").then((r) => r.json()).then((d) => setRows(Array.isArray(d) ? d : [])).catch(() => setRows([]));
  useEffect(() => { load(); }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = await fetch("/api/challenges/submit", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(form) });
    const data = await r.json();
    setChallengeNumber(data.challengeNumber || "");
    load();
  };

  return (
    <PublicPageShell title="Challenge Any Claim" description="Submit formal security challenges with public evidence." path="/x/challenge">
      <div className="space-y-6">
        <h1 className="text-3xl font-semibold text-[#facc15]">Challenge Any Claim</h1>
        <p className="text-sm text-[#cbd5e1]">If you believe any security or compliance claim on this platform is false, submit a formal challenge. We will respond publicly with verifiable evidence. The challenge and our response are both hashed into the audit chain.</p>

        <form onSubmit={submit} className="grid gap-3 rounded border border-[#334155] bg-[#0f172a] p-4">
          {Object.entries(form).map(([k, v]) => (
            <textarea key={k} value={v} onChange={(e) => setForm((prev) => ({ ...prev, [k]: e.target.value }))} placeholder={k} className="rounded bg-[#020617] p-2 text-sm" rows={2} />
          ))}
          <button className="rounded bg-[#facc15] px-3 py-2 text-black">Submit challenge</button>
          {challengeNumber ? <p className="text-sm text-emerald-400">Challenge submitted: {challengeNumber}</p> : null}
        </form>

        <section>
          <h2 className="text-xl font-semibold">Challenge registry</h2>
          <div className="mt-3 grid gap-3">
            {rows.map((row) => (
              <article key={row.id} className="rounded border border-[#334155] bg-[#0f172a] p-3 text-sm">
                <div className="font-semibold">{row.challengeNumber} · {row.status}</div>
                <p className="mt-1 text-[#cbd5e1]">{row.claimChallenged}</p>
                {row.platformResponse ? <p className="mt-1 text-[#94a3b8]">Response: {row.platformResponse}</p> : null}
              </article>
            ))}
          </div>
        </section>
      </div>
    </PublicPageShell>
  );
}
