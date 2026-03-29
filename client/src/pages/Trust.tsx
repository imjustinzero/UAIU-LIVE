import { useEffect, useState } from "react";

type TrustPayload = {
  chainIntact: boolean;
  currentAlgorithm: string;
  approvedAlgorithms: string[];
  lastSettlementAt: string | null;
  totalSettlements: number;
  totalCreditsRetired: number;
  lastAuditBlock: { blockNumber: number; timestamp: string; algorithm: string } | null;
  lastUpdated: string;
};

export default function Trust() {
  const [status, setStatus] = useState<TrustPayload | null>(null);
  const [history, setHistory] = useState<any[]>([]);

  const load = async () => {
    const [s, h] = await Promise.all([
      fetch("/api/trust/status").then((r) => r.json()),
      fetch("/api/audit/algorithm-history").then((r) => r.json()),
    ]);
    setStatus(s);
    setHistory(h || []);
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0f1e] px-4 py-6 text-white sm:px-8">
      <div className="mx-auto max-w-6xl">
        <h1 className="mb-4 text-3xl font-bold">Trust & Transparency</h1>

        {status && (
          <>
            <div className="mb-4 rounded border p-3" style={{ borderColor: status.chainIntact ? "#00ff88" : "#ef4444", backgroundColor: status.chainIntact ? "rgba(0,255,136,0.1)" : "rgba(239,68,68,0.15)" }}>
              Chain Integrity: <strong>{status.chainIntact ? "INTACT" : "COMPROMISED"}</strong>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded border border-white/10 bg-[#11182d] p-4">
                <p className="text-sm text-white/70">Current Active Algorithm</p>
                <p className="text-lg font-bold text-[#00ff88]">{status.currentAlgorithm}</p>
                <div className="mt-3 space-y-1 text-sm">
                  {status.approvedAlgorithms.map((alg) => (
                    <div key={alg} className="flex items-center justify-between">
                      <span>{alg}</span>
                      <span className="text-xs" style={{ color: alg === status.currentAlgorithm ? "#00ff88" : "#f59e0b" }}>
                        {alg === status.currentAlgorithm ? "Active" : "Deprecated"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded border border-white/10 bg-[#11182d] p-4 text-sm">
                <p>Last settlement: {status.lastSettlementAt ? new Date(status.lastSettlementAt).toLocaleString() : "N/A"}</p>
                <p>Total settlements: {status.totalSettlements}</p>
                <p>Total credits retired: {status.totalCreditsRetired}</p>
                <p>Last audit block: {status.lastAuditBlock ? `#${status.lastAuditBlock.blockNumber} @ ${new Date(status.lastAuditBlock.timestamp).toLocaleString()}` : "N/A"}</p>
                <p className="mt-2 text-xs text-white/60">Last updated: {new Date(status.lastUpdated).toLocaleString()}</p>
              </div>
            </div>
          </>
        )}

        <div className="mt-6 rounded border border-white/10 bg-[#11182d] p-4">
          <h2 className="mb-3 text-xl font-semibold">Algorithm Rotation History</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-white/70">
                <tr>
                  <th className="py-2">Timestamp</th>
                  <th className="py-2">Previous</th>
                  <th className="py-2">New</th>
                  <th className="py-2">Triggered By</th>
                </tr>
              </thead>
              <tbody>
                {history.map((row) => (
                  <tr key={row.id} className="border-t border-white/10">
                    <td className="py-2">{new Date(row.timestamp).toLocaleString()}</td>
                    <td className="py-2">{row.previousAlgorithm}</td>
                    <td className="py-2 text-[#00ff88]">{row.newAlgorithm}</td>
                    <td className="py-2">{row.triggeredBy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
