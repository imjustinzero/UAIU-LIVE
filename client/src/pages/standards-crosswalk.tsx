import { useEffect, useState } from "react";
import PublicPageShell from "@/components/PublicPageShell";

export default function StandardsCrosswalkPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [coverage, setCoverage] = useState<any[]>([]);

  useEffect(() => {
    fetch("/api/crosswalk/standards").then((r) => r.json()).then((d) => setRows(Array.isArray(d) ? d : []));
    fetch("/api/crosswalk/platform-coverage").then((r) => r.json()).then((d) => setCoverage(Array.isArray(d) ? d : []));
  }, []);

  return (
    <PublicPageShell title="Standards Crosswalk" description="Map standards to platform implementation." path="/x/standards-crosswalk">
      <div className="space-y-6">
        <h1 className="text-3xl font-semibold text-[#facc15]">Standards Crosswalk</h1>
        <p className="text-sm text-[#cbd5e1]">How ISO 14064, GHG Protocol, Verra VCS, Gold Standard, and the new ISO/GHG Joint Standard map to each other — and to UAIU.LIVE/X.</p>

        <section>
          <h2 className="text-xl font-semibold">Crosswalk entries</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead><tr><th>Source</th><th>Clause</th><th>Target</th><th>Alignment</th><th>UAIU Feature</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-[#334155]"><td>{r.sourceStandard}</td><td>{r.sourceClause}</td><td>{r.targetStandard} {r.targetClause}</td><td>{r.alignmentType}</td><td>{r.uaiuFeatureReference || "—"}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded border border-[#334155] bg-[#0f172a] p-4">
          <h2 className="text-xl font-semibold">Gap analysis view</h2>
          <ul className="mt-2 space-y-1 text-sm text-[#cbd5e1]">
            {coverage.map((c) => <li key={c.source_standard}>{c.source_standard}: {c.coverage_percent}% covered, gaps/conflicts: {c.gap_count}</li>)}
          </ul>
        </section>
      </div>
    </PublicPageShell>
  );
}
