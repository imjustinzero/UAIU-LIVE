import { useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, CheckCircle2, Copy, Cpu, Download, FileText, Satellite, XCircle } from "lucide-react";

type ChainBlock = { id: number; blockNumber: number; timestamp: string; algorithm: string; transactionData: Record<string, any>; prevHash: string; hash: string; verified: boolean };
type ChainResponse = { chainIntact: boolean; blocks: ChainBlock[] };

const theme = { bg: "#0a0f1e", accent: "#00ff88", text: "#ffffff" };

function shortHash(hash: string): string { return !hash ? "N/A" : `${hash.slice(0, 12)}...${hash.slice(-8)}`; }

function txIcon(type: string) {
  if (type === "iot_reading") return <Activity size={14} />;
  if (type === "mrv_report") return <FileText size={14} />;
  if (type === "anomaly_detected") return <AlertTriangle size={14} />;
  if (["device_registered", "device_calibrated", "device_decommissioned", "firmware_updated"].includes(type)) return <Cpu size={14} />;
  if (type === "satellite_reading") return <Satellite size={14} />;
  return <FileText size={14} />;
}

export default function ChainExplorer() {
  const [activeTab, setActiveTab] = useState<"chain" | "audit">("chain");
  const [data, setData] = useState<ChainResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [auditReport, setAuditReport] = useState<any>(null);
  const [auditRunning, setAuditRunning] = useState(false);

  const fetchChain = async () => {
    try {
      const response = await fetch("/api/audit/chain");
      if (!response.ok) throw new Error("Unable to load chain");
      setData(await response.json());
      setError(null);
    } catch (err: any) { setError(err.message || "Failed to load chain"); }
    finally { setLoading(false); }
  };

  const runAudit = async () => {
    setAuditRunning(true);
    const res = await fetch("/api/audit/run-full-audit", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ triggeredBy: "admin" }) });
    const report = await res.json();
    setAuditReport(report);
    const poll = setInterval(async () => {
      const r = await fetch(`/api/audit/reports/${report.auditId}`);
      if (r.ok) {
        setAuditReport(await r.json());
        setAuditRunning(false);
        clearInterval(poll);
      }
    }, 2000);
    setTimeout(() => { clearInterval(poll); setAuditRunning(false); }, 12000);
  };

  useEffect(() => { fetchChain(); const id = setInterval(fetchChain, 30000); return () => clearInterval(id); }, []);
  const blocks = useMemo(() => data?.blocks || [], [data]);
  const copyToClipboard = async (value: string) => { try { await navigator.clipboard.writeText(value); } catch {} };

  return (
    <div className="min-h-screen px-4 py-6 sm:px-6 lg:px-10" style={{ backgroundColor: theme.bg, color: theme.text }}>
      <div className="mx-auto max-w-6xl">
        <div className="mb-4 flex gap-3">
          <button onClick={() => setActiveTab("chain")} className={`px-4 py-2 rounded border ${activeTab === "chain" ? "border-emerald-400" : "border-white/20"}`}>Chain</button>
          <button onClick={() => setActiveTab("audit")} className={`px-4 py-2 rounded border ${activeTab === "audit" ? "border-emerald-400" : "border-white/20"}`}>Audit</button>
        </div>

        {activeTab === "chain" && <>
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3"><h1 className="text-2xl font-bold sm:text-3xl">UAIU.LIVE/X Chain Explorer</h1><button onClick={() => window.open("/api/audit/export/pdf", "_blank")} className="inline-flex items-center gap-2 rounded-md border border-[#00ff88] px-4 py-2 text-sm font-medium transition hover:bg-[#00ff88] hover:text-black"><Download size={16} /> Export PDF</button></div>
          {data && <div className="mb-6 rounded-lg border p-4 text-sm sm:text-base" style={{ borderColor: data.chainIntact ? theme.accent : "#ff4d4f", backgroundColor: data.chainIntact ? "rgba(0,255,136,0.08)" : "rgba(255,77,79,0.12)" }}>Chain Integrity: <strong>{String(data.chainIntact)}</strong></div>}
          {loading && <p>Loading chain data...</p>}
          {error && <p className="text-red-400">{error}</p>}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">{blocks.map((block) => {
            const txSummary = JSON.stringify(block.transactionData || {}).slice(0, 120);
            const txType = (block.transactionData as any)?.type || "unknown";
            return <div key={block.id} className="rounded-lg border border-white/20 bg-[#11182d] p-4 shadow-lg"><div className="mb-2 flex items-center justify-between gap-2"><p className="text-sm font-semibold">Block #{block.blockNumber}</p><span className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold" style={{ color: block.verified ? "#00ff88" : "#ff4d4f", backgroundColor: block.verified ? "rgba(0,255,136,0.12)" : "rgba(255,77,79,0.16)" }}>{block.verified ? <CheckCircle2 size={14} /> : <XCircle size={14} />}{block.verified ? "Verified" : "Failed"}</span></div><div className="space-y-1 text-xs sm:text-sm text-white/90"><p><span className="text-white/60">Timestamp:</span> {new Date(block.timestamp).toLocaleString()}</p><p><span className="text-white/60">Algorithm:</span> {block.algorithm}</p><p className="inline-flex items-center gap-2"><span className="text-white/60">Transaction Type:</span> {txIcon(txType)} {txType}</p><p><span className="text-white/60">Data Summary:</span> {txSummary}</p></div><div className="mt-3 space-y-2 text-xs sm:text-sm"><div className="flex items-center justify-between gap-2"><p className="truncate"><span className="text-white/60">Hash:</span> {shortHash(block.hash)}</p><button onClick={() => copyToClipboard(block.hash)} className="rounded border border-white/20 p-1 hover:border-[#00ff88]"><Copy size={14} /></button></div><div className="flex items-center justify-between gap-2"><p className="truncate"><span className="text-white/60">PrevHash:</span> {shortHash(block.prevHash)}</p><button onClick={() => copyToClipboard(block.prevHash)} className="rounded border border-white/20 p-1 hover:border-[#00ff88]"><Copy size={14} /></button></div></div></div>;
          })}</div>
        </>}

        {activeTab === "audit" && <div className="space-y-4">
          <div className="flex items-center justify-between"><h2 className="text-2xl font-semibold">Full Platform Self-Audit</h2><button onClick={runAudit} disabled={auditRunning} className="px-4 py-2 border border-emerald-400 rounded">{auditRunning ? "Running..." : "Run Audit"}</button></div>
          {auditRunning && <div className="text-sm text-amber-300">Audit in progress... polling every 2 seconds.</div>}
          {auditReport && <div className="rounded border border-white/20 bg-[#11182d] p-4 space-y-2">
            <div className={`text-lg font-semibold ${auditReport.overallStatus === "PASS" ? "text-emerald-400" : auditReport.overallStatus === "WARN" ? "text-yellow-400" : "text-red-400"}`}>Status: {auditReport.overallStatus}</div>
            <pre className="text-xs overflow-auto">{JSON.stringify(auditReport, null, 2)}</pre>
            <a href={`/api/audit/reports/${auditReport.auditId}/pdf`} className="inline-flex items-center gap-2 rounded-md border border-[#00ff88] px-4 py-2 text-sm font-medium"><Download size={16} /> Download Report as PDF</a>
          </div>}
        </div>}
      </div>
    </div>
  );
}
