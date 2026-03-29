import { useEffect, useState } from "react";

export default function IntelligenceFeedPage() {
  const [events, setEvents] = useState<any[]>([]);
  const [severity, setSeverity] = useState("");

  const load = async (nextSeverity = severity) => {
    const qs = new URLSearchParams();
    if (nextSeverity) qs.set('severity', nextSeverity);
    const res = await fetch(`/api/intelligence/events?${qs.toString()}`);
    setEvents(await res.json());
  };

  useEffect(() => { load(); }, []);

  return <div className="min-h-screen bg-slate-950 text-white p-4 md:p-8 space-y-3">
    <h1 className="text-3xl font-semibold">Twin Alerts & Intelligence Feed</h1>
    <div className="flex gap-2 text-sm">{["", "low", "medium", "high", "critical"].map((s) => <button key={s || 'all'} onClick={() => { setSeverity(s); load(s); }} className="rounded border border-white/30 px-2 py-1">{s || 'all'}</button>)}</div>
    <div className="space-y-2">{events.map((e) => <article key={e.id} className="rounded border border-white/20 bg-slate-900 p-3"><div className="text-xs text-white/60">{new Date(e.createdAt).toLocaleString()} • {e.projectId} • {e.severity}</div><h2 className="font-medium">{e.title}</h2><p className="text-sm text-white/80">{e.body}</p></article>)}</div>
  </div>;
}
