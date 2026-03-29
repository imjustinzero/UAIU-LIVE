import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Copy, Download, XCircle } from "lucide-react";

type ChainBlock = {
  id: number;
  blockNumber: number;
  timestamp: string;
  algorithm: string;
  transactionData: Record<string, any>;
  prevHash: string;
  hash: string;
  verified: boolean;
};

type ChainResponse = {
  chainIntact: boolean;
  blocks: ChainBlock[];
};

const theme = {
  bg: "#0a0f1e",
  accent: "#00ff88",
  text: "#ffffff",
};

function shortHash(hash: string): string {
  if (!hash) return "N/A";
  return `${hash.slice(0, 12)}...${hash.slice(-8)}`;
}

export default function ChainExplorer() {
  const [data, setData] = useState<ChainResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchChain = async () => {
    try {
      const response = await fetch("/api/audit/chain");
      if (!response.ok) throw new Error("Unable to load chain");
      const payload = await response.json();
      setData(payload);
      setError(null);
    } catch (err: any) {
      setError(err.message || "Failed to load chain");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChain();
    const id = setInterval(fetchChain, 30_000);
    return () => clearInterval(id);
  }, []);

  const blocks = useMemo(() => data?.blocks || [], [data]);

  const copyToClipboard = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // no-op
    }
  };

  const exportPdf = () => {
    window.open("/api/audit/export/pdf", "_blank", "noopener,noreferrer");
  };

  return (
    <div className="min-h-screen px-4 py-6 sm:px-6 lg:px-10" style={{ backgroundColor: theme.bg, color: theme.text }}>
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold sm:text-3xl">UAIU.LIVE/X Chain Explorer</h1>
          <button
            onClick={exportPdf}
            className="inline-flex items-center gap-2 rounded-md border border-[#00ff88] px-4 py-2 text-sm font-medium transition hover:bg-[#00ff88] hover:text-black"
          >
            <Download size={16} /> Export PDF
          </button>
        </div>

        {data && (
          <div
            className="mb-6 rounded-lg border p-4 text-sm sm:text-base"
            style={{
              borderColor: data.chainIntact ? theme.accent : "#ff4d4f",
              backgroundColor: data.chainIntact ? "rgba(0,255,136,0.08)" : "rgba(255,77,79,0.12)",
            }}
          >
            Chain Integrity: <strong>{String(data.chainIntact)}</strong>
          </div>
        )}

        {loading && <p>Loading chain data...</p>}
        {error && <p className="text-red-400">{error}</p>}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {blocks.map((block) => {
            const txSummary = JSON.stringify(block.transactionData || {}).slice(0, 120);
            const txType = (block.transactionData as any)?.type || "unknown";
            return (
              <div key={block.id} className="rounded-lg border border-white/20 bg-[#11182d] p-4 shadow-lg">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold">Block #{block.blockNumber}</p>
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold"
                    style={{
                      color: block.verified ? "#00ff88" : "#ff4d4f",
                      backgroundColor: block.verified ? "rgba(0,255,136,0.12)" : "rgba(255,77,79,0.16)",
                    }}
                  >
                    {block.verified ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                    {block.verified ? "Verified" : "Failed"}
                  </span>
                </div>

                <div className="space-y-1 text-xs sm:text-sm text-white/90">
                  <p><span className="text-white/60">Timestamp:</span> {new Date(block.timestamp).toLocaleString()}</p>
                  <p><span className="text-white/60">Algorithm:</span> {block.algorithm}</p>
                  <p><span className="text-white/60">Transaction Type:</span> {txType}</p>
                  <p><span className="text-white/60">Data Summary:</span> {txSummary}</p>
                </div>

                <div className="mt-3 space-y-2 text-xs sm:text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate"><span className="text-white/60">Hash:</span> {shortHash(block.hash)}</p>
                    <button onClick={() => copyToClipboard(block.hash)} className="rounded border border-white/20 p-1 hover:border-[#00ff88]">
                      <Copy size={14} />
                    </button>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate"><span className="text-white/60">PrevHash:</span> {shortHash(block.prevHash)}</p>
                    <button onClick={() => copyToClipboard(block.prevHash)} className="rounded border border-white/20 p-1 hover:border-[#00ff88]">
                      <Copy size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
