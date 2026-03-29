import { useEffect, useMemo, useState } from "react";

type Listing = {
  id: string;
  standard: string;
  status: string;
  registrySerial: string | null;
  registryName: string | null;
  createdAt: string;
};

type Settlement = {
  id: number;
  tradeId: string;
  settledAt: string | null;
  hashAlgorithm: string | null;
  status: string;
};

type DashboardRecord = {
  listing: Listing;
  trade: { tradeId: string; status: string } | null;
  settlement: Settlement | null;
};

const styles = {
  bg: "#0a0f1e",
  card: "#11182d",
  accent: "#00ff88",
};

export default function SupplierDashboard() {
  const [records, setRecords] = useState<DashboardRecord[]>([]);
  const [verifications, setVerifications] = useState<Record<string, { verified: boolean }>>({});
  const [statusBySettlement, setStatusBySettlement] = useState<Record<number, any>>({});

  const emailParam = useMemo(() => new URLSearchParams(window.location.search).get("email") || "", []);

  useEffect(() => {
    const fetchData = async () => {
      const res = await fetch(`/api/supplier/dashboard${emailParam ? `?email=${encodeURIComponent(emailParam)}` : ""}`);
      const data = await res.json();
      const incoming = data.records || [];
      setRecords(incoming);

      const verifyPairs = await Promise.all(incoming.map(async (r: DashboardRecord) => {
        const creditId = r.listing.registrySerial || r.trade?.tradeId || r.listing.id;
        const vr = await fetch(`/api/registry/verify/${encodeURIComponent(creditId)}`);
        const vj = await vr.json();
        return [r.listing.id, vj] as const;
      }));
      setVerifications(Object.fromEntries(verifyPairs));

      const settlementPairs = await Promise.all(incoming.map(async (r: DashboardRecord) => {
        if (!r.settlement?.id) return null;
        const sr = await fetch(`/api/escrow/${r.settlement.id}/status`);
        if (!sr.ok) return [r.settlement.id, null] as const;
        const sj = await sr.json();
        return [r.settlement.id, sj] as const;
      }));
      setStatusBySettlement(Object.fromEntries(settlementPairs.filter(Boolean) as any));
    };

    fetchData();
  }, [emailParam]);

  const downloadCert = (settlementId: number) => {
    fetch(`/api/escrow/${settlementId}/certificate`, { method: "POST" })
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed");
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `retirement-certificate-${settlementId}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      })
      .catch(() => undefined);
  };

  return (
    <div className="min-h-screen px-4 py-6 sm:px-8" style={{ backgroundColor: styles.bg, color: "white" }}>
      <div className="mx-auto max-w-6xl">
        <h1 className="mb-6 text-3xl font-bold">Supplier Dashboard</h1>

        <div className="space-y-4">
          {records.map((record) => {
            const settlementStatus = record.settlement?.id ? statusBySettlement[record.settlement.id] : null;
            const algorithmLabel = settlementStatus?.requiresManualReview
              ? { text: "manual review", color: "#ef4444" }
              : settlementStatus?.algorithmApproved
                ? { text: "approved", color: styles.accent }
                : { text: "deprecated", color: "#f59e0b" };

            return (
              <div key={record.listing.id} className="rounded-lg border border-white/15 p-4" style={{ backgroundColor: styles.card }}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold">Credit Listing {record.listing.id.slice(0, 8)}...</p>
                    <p className="text-sm text-white/70">Status: {record.trade?.status || record.listing.status || "active"}</p>
                    <p className="text-sm text-white/70">Registry: {record.listing.registryName || "Unknown"}</p>
                  </div>
                  <span className="rounded-full px-2 py-1 text-xs font-bold" style={{ backgroundColor: "rgba(0,255,136,0.12)", color: styles.accent }}>
                    {verifications[record.listing.id]?.verified ? "Verified ✓" : "Pending"}
                  </span>
                </div>

                {settlementStatus && (
                  <div className="mt-4 space-y-2">
                    <p className="text-sm">T+1 Countdown: {settlementStatus.hoursRemaining}h remaining</p>
                    <div className="h-2 w-full rounded bg-white/10">
                      <div className="h-2 rounded" style={{ width: `${settlementStatus.percentComplete}%`, backgroundColor: styles.accent }} />
                    </div>
                    <p className="text-xs text-white/70">Finality ETA: {new Date(settlementStatus.finalityEta).toLocaleString()}</p>
                    <p className="text-xs" style={{ color: algorithmLabel.color }}>
                      Algorithm status: {algorithmLabel.text} ({settlementStatus.algorithmAtSettlement})
                    </p>
                  </div>
                )}

                {record.settlement?.status?.includes("settled") && record.settlement.id && (
                  <button
                    onClick={() => downloadCert(record.settlement!.id)}
                    className="mt-4 rounded border border-[#00ff88] px-3 py-2 text-sm hover:bg-[#00ff88] hover:text-black"
                  >
                    Download Retirement Certificate
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
