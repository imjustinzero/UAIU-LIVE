import { useState } from "react";

export default function EnterprisePage() {
  const [form, setForm] = useState<any>({ orgName: "", industry: "", frameworks: [] });
  const [submitted, setSubmitted] = useState<any>(null);

  const submit = async () => {
    const res = await fetch("/api/enterprise/apply", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(form) });
    setSubmitted(await res.json());
  };

  return <div className="min-h-screen bg-slate-950 text-white p-4 md:p-8 space-y-6">
    <h1 className="text-3xl md:text-5xl font-semibold">The carbon procurement infrastructure your compliance team has been waiting for</h1>
    <div className="grid md:grid-cols-3 gap-3">{[
      "For your ESG team: automated regulatory filing",
      "For your legal team: cryptographic proof, no greenwashing risk",
      "For your board: live verification in the boardroom",
    ].map((t) => <div key={t} className="rounded border border-white/20 p-4 bg-slate-900">{t}</div>)}</div>

    <section className="rounded border border-white/20 p-4 bg-slate-900 space-y-2">
      <h2 className="text-xl font-semibold">Enterprise onboarding</h2>
      <input className="w-full bg-slate-800 rounded p-2" placeholder="Company name" onChange={(e) => setForm({ ...form, orgName: e.target.value })} />
      <input className="w-full bg-slate-800 rounded p-2" placeholder="Industry" onChange={(e) => setForm({ ...form, industry: e.target.value })} />
      <input className="w-full bg-slate-800 rounded p-2" placeholder="Stock ticker" onChange={(e) => setForm({ ...form, ticker: e.target.value })} />
      <button onClick={submit} className="rounded bg-emerald-500 text-black px-4 py-2 font-medium">Request demo</button>
      {submitted && <div className="text-sm text-emerald-300">Application submitted: {submitted.id}</div>}
    </section>
  </div>;
}
