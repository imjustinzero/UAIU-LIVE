import { useEffect, useState } from "react";
import PublicPageShell from "@/components/PublicPageShell";

type FormalProperty = {
  propertyId: string;
  title: string;
  category: string;
  formalStatement: string;
  informalExplanation: string;
  testImplementation: string;
  lastVerificationResult: string | null;
  lastVerifiedAt: string | null;
  standardsAlignment: any;
};

export default function FormalPropertiesPage() {
  const [rows, setRows] = useState<FormalProperty[]>([]);

  useEffect(() => {
    fetch("/api/properties")
      .then((r) => r.json())
      .then((d) => setRows(Array.isArray(d) ? d : []))
      .catch(() => setRows([]));
  }, []);

  return (
    <PublicPageShell
      title="UAIU.LIVE/X Formal Security Properties"
      description="These are tested invariants, not claims."
      path="/x/properties"
    >
      <div className="space-y-6">
        <header>
          <h1 className="text-3xl font-semibold text-[#facc15]">UAIU.LIVE/X Formal Security Properties</h1>
          <p className="mt-2 text-sm text-[#cbd5e1]">These are not assertions. They are tested invariants verified automatically every 6 hours. Every test is public. Run them yourself.</p>
        </header>

        <div className="grid gap-4">
          {rows.map((p) => (
            <article key={p.propertyId} className="rounded-xl border border-[#334155] bg-[#0f172a] p-5">
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-lg font-semibold">{p.propertyId} — {p.title}</h2>
                <span className={p.lastVerificationResult === "pass" ? "text-emerald-400" : "text-red-400"}>
                  {p.lastVerificationResult === "pass" ? "PASS ✓" : "FAIL ✗"}
                </span>
              </div>
              <p className="mt-2 text-sm text-[#cbd5e1]">{p.informalExplanation}</p>
              <details className="mt-3">
                <summary className="cursor-pointer text-sm text-[#facc15]">Formal statement</summary>
                <p className="mt-2 text-xs text-[#cbd5e1]">{p.formalStatement}</p>
              </details>
              <div className="mt-3 text-xs text-[#94a3b8]">Last tested: {p.lastVerifiedAt ? new Date(p.lastVerifiedAt).toISOString() : "Never"}</div>
              <div className="mt-1 text-xs text-[#94a3b8]">Standards aligned: {JSON.stringify(p.standardsAlignment)}</div>
              <a className="mt-3 inline-block text-xs text-[#facc15] underline" href={`/api/properties/${p.propertyId}`}>View test code link</a>
            </article>
          ))}
        </div>
      </div>
    </PublicPageShell>
  );
}
