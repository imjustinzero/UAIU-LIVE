import { useEffect, useState } from 'react';

type Program = { program: string; registry: string; phase1: string; phase2: string; approvedAt: string; notes: string };

export default function CorsiaPage() {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [q, setQ] = useState('');
  useEffect(() => {
    document.title = 'CORSIA Eligible Carbon Credits Checker | UAIU.LIVE';
    fetch('/api/public/corsia-programs', { cache: 'no-store' }).then((r) => r.json()).then((p) => setPrograms(p.programs || [])).catch(() => setPrograms([]));
  }, []);
  const filtered = programs.filter((p) => `${p.program} ${p.registry}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-3xl font-bold">CORSIA Eligibility Checker</h1>
      <input className="mt-4 w-full rounded border border-border bg-background p-2" placeholder="Enter program name, standard, or registry" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="mt-6 grid gap-3">
        {filtered.map((p) => <div key={p.program} className="rounded border border-border p-3 text-sm"><div className="font-semibold">{p.program}</div><div>{p.registry} · Phase 1: {p.phase1} · Phase 2: {p.phase2}</div><div className="text-muted-foreground">Approved: {p.approvedAt} · {p.notes}</div></div>)}
      </div>
    </main>
  );
}
