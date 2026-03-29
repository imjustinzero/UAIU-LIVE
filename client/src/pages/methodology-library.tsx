import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation, useRoute } from "wouter";

function MethodologyDetail() {
  const [, params] = useRoute("/x/methodologies/:code/:version");
  const [citationBusy, setCitationBusy] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ["methodology", params?.code, params?.version],
    queryFn: async () => {
      const r = await fetch(`/api/methodologies/${params?.code}/${params?.version}`);
      if (!r.ok) throw new Error("Failed to load methodology");
      return r.json();
    },
    enabled: Boolean(params?.code && params?.version),
  });
  const { data: history } = useQuery({
    queryKey: ["methodology-history", params?.code],
    queryFn: async () => (await fetch(`/api/methodologies/${params?.code}`)).json(),
    enabled: Boolean(params?.code),
  });
  const { data: citations } = useQuery({
    queryKey: ["methodology-citations", data?.id],
    queryFn: async () => (await fetch(`/api/methodologies/${data?.id}/citations`)).json(),
    enabled: Boolean(data?.id),
  });

  if (isLoading) return <div className="p-8 text-white">Loading methodology…</div>;
  if (!data) return <div className="p-8 text-white">Methodology not found.</div>;

  const cite = async () => {
    setCitationBusy(true);
    await fetch(`/api/methodologies/${data.id}/cite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ creditId: crypto.randomUUID(), creditsVerified: 100 }),
    });
    setCitationBusy(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6 md:p-10">
      <Link href="/x/methodologies" className="text-emerald-300">← Back to library</Link>
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6 mt-4">
        <article className="rounded-xl border border-white/10 bg-slate-900 p-6">
          <h1 className="text-3xl font-semibold">{data.methodologyCode} v{data.version}</h1>
          <p className="text-white/80 mt-2">{data.title}</p>
          <p className="text-xs mt-2 text-white/60">Published: {new Date(data.publishedAt).toLocaleDateString()}</p>
          <div className="mt-6 prose prose-invert max-w-none whitespace-pre-wrap">{data.methodology}</div>
        </article>
        <aside className="space-y-4">
          <section className="rounded-xl border border-white/10 bg-slate-900 p-4">
            <h3 className="font-semibold">Document hash</h3>
            <p className="text-xs text-emerald-300 break-all mt-2">{data.documentHash}</p>
            <p className="text-xs text-white/60 mt-2">Audit block #{data.auditBlockId}</p>
          </section>
          <section className="rounded-xl border border-white/10 bg-slate-900 p-4">
            <h3 className="font-semibold">Version history</h3>
            <div className="mt-2 space-y-2 text-sm">
              {(history?.versionHistory || []).map((v: any) => (
                <div key={v.id} className="border border-white/10 rounded p-2">
                  <p>{v.version} · {v.status}</p>
                  <p className="text-xs text-white/70">{v.changeLog || "Initial publication"}</p>
                </div>
              ))}
            </div>
          </section>
          <section className="rounded-xl border border-white/10 bg-slate-900 p-4">
            <h3 className="font-semibold">Citations</h3>
            <p className="text-2xl mt-1">{data.citationCount}</p>
            <button onClick={cite} disabled={citationBusy} className="mt-3 rounded bg-emerald-500 px-3 py-2 text-sm text-slate-950 font-medium">Cite this methodology</button>
            <div className="mt-3 text-xs text-white/70 space-y-1">
              {(citations || []).slice(0, 5).map((c: any) => <p key={c.id}>{c.creditId} · {c.tonnes} tCO2e</p>)}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function MethodologyLibrary() {
  const [location] = useLocation();
  const isDetail = useMemo(() => location.startsWith("/x/methodologies/") && location.split("/").length >= 5, [location]);
  const { data, isLoading } = useQuery({
    queryKey: ["methodologies"],
    queryFn: async () => {
      const r = await fetch("/api/methodologies");
      if (!r.ok) throw new Error("Failed to load methodologies");
      return r.json();
    },
    enabled: !isDetail,
  });

  if (isDetail) return <MethodologyDetail />;

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6 md:p-10">
      <header className="max-w-3xl mb-8">
        <h1 className="text-4xl font-semibold">UAIU Methodology Library</h1>
        <p className="text-white/75 mt-3">Published verification methodologies from UAIU Verified Partners — versioned, cryptographically attributed, and permanently referenced in the audit chain.</p>
      </header>

      {isLoading ? <p>Loading…</p> : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {(data || []).map((m: any) => (
            <article key={m.id} className="rounded-xl border border-white/10 bg-slate-900 p-4 flex flex-col">
              <div className="flex items-center justify-between">
                <p className="font-semibold">{m.methodologyCode}</p>
                <span className="text-xs bg-emerald-900/60 text-emerald-300 px-2 py-1 rounded">v{m.version}</span>
              </div>
              <h3 className="mt-2 text-lg">{m.title}</h3>
              <p className="text-sm text-white/70 mt-2 line-clamp-3">{m.scope || m.description}</p>
              <div className="mt-3 flex flex-wrap gap-2">{(m.applicableStandards || []).map((s: string) => <span key={s} className="text-xs rounded bg-white/10 px-2 py-1">{s}</span>)}</div>
              <div className="mt-4 text-xs text-white/70">Downloads {m.downloadCount} · Citations {m.citationCount}</div>
              <div className="mt-4 flex gap-2">
                <Link href={`/x/methodologies/${m.methodologyCode}/${m.version}`} className="rounded bg-emerald-500 text-slate-950 px-3 py-2 text-sm font-medium">View</Link>
                <a href={`/api/methodologies/${m.methodologyCode}/${m.version}`} className="rounded border border-white/20 px-3 py-2 text-sm">Download</a>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

export default MethodologyLibrary;
