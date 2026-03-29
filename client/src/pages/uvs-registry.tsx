import { useEffect, useMemo, useState } from "react";

export default function UvsRegistryPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [query, setQuery] = useState("");

  useEffect(() => { fetch("/api/uvs/certificates").then((r) => r.json()).then(setRows); }, []);

  const filtered = useMemo(() => rows.filter((r) => (r.certificateNumber + r.projectName + r.country).toLowerCase().includes(query.toLowerCase())), [rows, query]);

  return (
    <div className="min-h-screen bg-[#0a0f1e] px-3 py-4 text-white sm:px-6 lg:px-10">
      <div className="mx-auto max-w-7xl space-y-4">
        <h1 className="text-[clamp(22px,4vw,40px)] font-bold">UVS Public Registry</h1>
        <input className="min-h-11 w-full rounded border border-[#1f2937] bg-[#111827] px-3" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by certificate, project, country" />
        <div className="grid grid-cols-1 gap-3 md:hidden">
          {filtered.map((r) => <a href={`/x/verify/${r.certificateNumber}`} key={r.id} className="rounded-xl border border-[#1f2937] bg-[#111827] p-3"><p className="font-semibold">{r.certificateNumber}</p><p className="text-sm">{r.projectName}</p><p className="text-xs text-white/70">{r.country} • {r.tonnes?.toLocaleString()}t</p></a>)}
        </div>
        <div className="hidden overflow-x-auto rounded-xl border border-[#1f2937] md:block">
          <table className="w-full text-left text-sm"><thead className="bg-[#111827]"><tr><th className="p-3">Certificate</th><th>Project</th><th>Status</th><th>Grade</th><th>Tonnes</th></tr></thead><tbody>{filtered.map((r) => <tr key={r.id} className="border-t border-[#1f2937]"><td className="p-3"><a className="text-[#00ff88]" href={`/x/verify/${r.certificateNumber}`}>{r.certificateNumber}</a></td><td>{r.projectName}</td><td>{r.status}</td><td>{r.qualityGrade}</td><td>{r.tonnes?.toLocaleString()}</td></tr>)}</tbody></table>
        </div>
      </div>
    </div>
  );
}
