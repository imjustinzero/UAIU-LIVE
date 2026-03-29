import { useEffect, useMemo, useState } from "react";
import { useRoute } from "wouter";
import { CheckCircle2, AlertTriangle, XCircle, Share2 } from "lucide-react";

type Certificate = any;

const palette = {
  bg: "#0a0f1e",
  surface: "#111827",
  border: "#1f2937",
  accent: "#00ff88",
  warning: "#f59e0b",
  error: "#ef4444",
};

export default function VerifyPage() {
  const [, params] = useRoute("/x/verify/:certificateNumber");
  const [certificate, setCertificate] = useState<Certificate | null>(null);
  const [loading, setLoading] = useState(true);
  const [hashInput, setHashInput] = useState("");
  const [hashResult, setHashResult] = useState<"match" | "mismatch" | null>(null);

  useEffect(() => {
    const id = params?.certificateNumber;
    if (!id) return;
    fetch(`/api/uvs/certificates/${id}`).then((r) => r.json()).then(setCertificate).finally(() => setLoading(false));
  }, [params?.certificateNumber]);

  const statusMeta = useMemo(() => {
    const status = certificate?.status;
    if (status === "certified") return { text: "VERIFIED", color: palette.accent, icon: <CheckCircle2 size={18} /> };
    if (status === "suspended") return { text: "SUSPENDED", color: palette.warning, icon: <AlertTriangle size={18} /> };
    return { text: "REVOKED", color: palette.error, icon: <XCircle size={18} /> };
  }, [certificate]);

  const remainingPercent = useMemo(() => {
    if (!certificate) return 0;
    const total = new Date(certificate.expiresAt).getTime() - new Date(certificate.certifiedAt).getTime();
    const used = Date.now() - new Date(certificate.certifiedAt).getTime();
    return Math.max(0, Math.min(100, 100 - (used / total) * 100));
  }, [certificate]);

  if (loading) return <div className="min-h-screen animate-pulse p-6" style={{ background: palette.bg }} />;
  if (!certificate?.certificateNumber) return <div className="min-h-screen p-6 text-white" style={{ background: palette.bg }}>Certificate not found.</div>;

  return (
    <div className="min-h-screen text-white" style={{ background: palette.bg }}>
      <div className="mx-auto max-w-[1280px] space-y-4 px-3 py-4 md:px-6 lg:px-10">
        <section className="rounded-xl border p-4" style={{ borderColor: palette.border, background: palette.surface }}>
          <p className="text-xs text-white/70">Certificate Number</p>
          <h1 className="text-[clamp(22px,4vw,40px)] font-bold">{certificate.certificateNumber}</h1>
          <div className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold" style={{ background: `${statusMeta.color}1f`, color: statusMeta.color }}>
            <span className="animate-pulse">{statusMeta.icon}</span> {statusMeta.text}
          </div>
          <p className="mt-3 text-sm">{certificate.projectName} • {certificate.registry}</p>
          <p className="text-sm text-white/70">{certificate.tonnes?.toLocaleString()} tonnes certified</p>
          <div className="mt-3">
            <div className="h-2 overflow-hidden rounded bg-white/10"><div className="h-full" style={{ width: `${remainingPercent}%`, background: palette.accent }} /></div>
            <p className="mt-1 text-xs text-white/70">{new Date(certificate.certifiedAt).toLocaleDateString()} → {new Date(certificate.expiresAt).toLocaleDateString()}</p>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            ["Quality Score", certificate.qualityScore],
            ["IoT Trust", certificate.iotTrustScore],
            ["MRV Quality", certificate.mrvDataQuality],
            ["Verifier Rating", 94],
          ].map(([label, val]: any) => {
            const v = Number(val);
            const c = v >= 80 ? palette.accent : v >= 60 ? palette.warning : palette.error;
            return (
              <div key={label} className="rounded-xl border p-3" style={{ borderColor: palette.border, background: palette.surface }}>
                <p className="text-xs text-white/70">{label}</p>
                <p className="text-xl font-bold" style={{ color: c }}>{v}/100</p>
                <div className="mt-2 h-1 rounded bg-white/10"><div className="h-full rounded" style={{ width: `${v}%`, background: c }} /></div>
              </div>
            );
          })}
        </section>

        <details className="rounded-xl border p-4" open style={{ borderColor: palette.border, background: palette.surface }}>
          <summary className="cursor-pointer text-lg font-semibold">13 Criteria Checklist</summary>
          <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
            {certificate.criteria?.map((item: any) => <div key={item.key} className="flex items-center gap-2 text-sm">{item.passed ? "✓" : "✗"} {item.label}</div>)}
          </div>
        </details>

        <section className="rounded-xl border p-4" style={{ borderColor: palette.border, background: palette.surface }}>
          <h2 className="text-xl font-semibold">Certificate Hash Verifier</h2>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input value={hashInput} onChange={(e) => setHashInput(e.target.value)} placeholder="Paste certificate hash to verify" className="min-h-11 flex-1 rounded border bg-transparent px-3 text-sm" style={{ borderColor: palette.border }} />
            <button className="min-h-11 rounded px-4 text-black" style={{ background: palette.accent }} onClick={() => setHashResult(hashInput.trim() === certificate.certificateHash ? "match" : "mismatch")}>Verify Hash</button>
          </div>
          {hashResult && <p className="mt-2 text-sm" style={{ color: hashResult === "match" ? palette.accent : palette.error }}>{hashResult === "match" ? "HASH MATCH ✓ This certificate has not been altered since issuance." : "HASH MISMATCH ✗"}</p>}
        </section>

        <section className="rounded-xl border p-4" style={{ borderColor: palette.border, background: palette.surface }}>
          <h2 className="text-xl font-semibold">Share</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            <button className="min-h-11 rounded border px-3" style={{ borderColor: palette.border }} onClick={() => navigator.clipboard.writeText(window.location.href)}>Copy URL</button>
            <button className="min-h-11 rounded border px-3" style={{ borderColor: palette.border }} onClick={() => navigator.share?.({ title: "UVS Verification", url: window.location.href })}><Share2 className="mr-1 inline" size={16} />Share</button>
          </div>
        </section>
      </div>
    </div>
  );
}
