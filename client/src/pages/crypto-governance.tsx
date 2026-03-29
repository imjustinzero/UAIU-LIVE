import { useEffect, useMemo, useState } from "react";

type CbomRow = {
  id: string;
  componentName: string;
  algorithmInUse: string;
  pqcVulnerable: boolean;
  nistDeprecationYear: number | null;
  bsiDeprecationYear: number | null;
  ncscDeprecationYear: number | null;
  migrationStatus: string;
  migrationTarget: string;
};

export default function CryptoGovernancePage() {
  const [cbom, setCbom] = useState<CbomRow[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [matrix, setMatrix] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      const [a, b, c] = await Promise.all([
        fetch("/api/crypto/cbom").then((r) => r.json()),
        fetch("/api/crypto/cbom/summary").then((r) => r.json()),
        fetch("/api/crypto/compliance-matrix").then((r) => r.json()),
      ]);
      setCbom(a || []);
      setSummary(b || null);
      setMatrix(c || []);
    };
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, []);

  const trend = useMemo(() => {
    if (!summary) return "stable";
    if (summary.overallPostureScore >= 75) return "improving";
    if (summary.overallPostureScore >= 50) return "stable";
    return "declining";
  }, [summary]);

  const colorFor = (status: string) => (status === "complete" ? "#10b981" : status === "in_progress" ? "#f59e0b" : "#ef4444");

  return (
    <div className="min-h-screen bg-[#0a0f1e] px-4 py-6 text-white sm:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header>
          <h1 className="text-3xl font-bold">UAIU.LIVE/X Cryptographic Governance</h1>
          <p className="mt-2 text-white/70">Real-time cryptographic posture across NIST IR 8547, BSI TR-02102, and NCSC guidance</p>
        </header>

        <section className="rounded border border-white/10 bg-[#11182d] p-4">
          <h2 className="mb-3 text-xl font-semibold">Jurisdiction Timeline</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5 text-sm">
            {["2026 (now)", "2030 deprecation", "2031 NCSC", "2032 BSI hybrid", "2035 disallow"].map((m) => (
              <div key={m} className="rounded border border-white/15 p-2 text-center">{m}</div>
            ))}
          </div>
          <div className="mt-3 space-y-1 text-xs">
            {cbom.map((row) => (
              <div key={row.id} className="flex items-center gap-2">
                <span style={{ background: colorFor(row.migrationStatus) }} className="inline-block h-2 w-2 rounded-full" />
                <span>{row.componentName} — {row.migrationStatus}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded border border-white/10 bg-[#11182d] p-4">
          <h2 className="mb-3 text-xl font-semibold">CBOM Table</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-white/70"><tr><th>Component</th><th>Algorithm</th><th>PQC</th><th>NIST</th><th>BSI</th><th>NCSC</th><th>Status</th><th>Target</th></tr></thead>
              <tbody>
                {cbom.map((row) => (
                  <tr key={row.id} className="border-t border-white/10">
                    <td className="py-2">{row.componentName}</td>
                    <td>{row.algorithmInUse}</td>
                    <td>{row.pqcVulnerable ? "YES" : "NO"}</td>
                    <td>{row.nistDeprecationYear ?? "—"}</td>
                    <td>{row.bsiDeprecationYear ?? "—"}</td>
                    <td>{row.ncscDeprecationYear ?? "—"}</td>
                    <td><span className="rounded px-2 py-1 text-xs" style={{ background: colorFor(row.migrationStatus) }}>{row.migrationStatus}</span></td>
                    <td>{row.migrationTarget}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded border border-white/10 bg-[#11182d] p-4">
          <h2 className="mb-3 text-xl font-semibold">Compliance Matrix</h2>
          <div className="space-y-2 text-sm">
            {matrix.map((row, idx) => (
              <div key={idx} className="rounded border border-white/10 p-2">
                <div className="font-medium">{row.component}</div>
                <div>NIST: {row.nist?.status === "compliant" ? "✓" : row.nist?.status === "critical" ? "✗" : "⚠"}</div>
                <div>BSI: {row.bsi?.status === "compliant" ? "✓" : row.bsi?.status === "critical" ? "✗" : "⚠"}</div>
                <div>NCSC: {row.ncsc?.status === "compliant" ? "✓" : row.ncsc?.status === "critical" ? "✗" : "⚠"}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded border border-white/10 bg-[#11182d] p-4 text-sm">
          <h2 className="mb-2 text-xl font-semibold">Posture Score</h2>
          <p>Overall PQC readiness score: <strong>{summary?.overallPostureScore ?? 0}</strong></p>
          <p>NIST compliant components: {summary?.jurisdictions?.nist?.compliantComponents ?? 0}</p>
          <p>BSI compliant components: {summary?.jurisdictions?.bsi?.compliantComponents ?? 0}</p>
          <p>NCSC compliant components: {summary?.jurisdictions?.ncsc?.compliantComponents ?? 0}</p>
          <p>Trend: {trend}</p>
        </section>
      </div>
    </div>
  );
}
