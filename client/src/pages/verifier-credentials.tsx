import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";

export default function VerifierCredentialsPage() {
  const [form, setForm] = useState({ credentialType: "iso_14064", issuingBody: "", credentialNumber: "", expiresAt: "" });
  const { data, refetch } = useQuery({
    queryKey: ["verifier-credentials"],
    queryFn: async () => {
      const res = await fetch("/api/verifier/credentials");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const saveCredential = async () => {
    const res = await fetch("/api/verifier/credentials", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setForm({ credentialType: "iso_14064", issuingBody: "", credentialNumber: "", expiresAt: "" });
      refetch();
    }
  };

  const rows = useMemo(() => (Array.isArray(data) ? data : []), [data]);

  return (
    <div className="min-h-screen bg-[#060810] p-6 text-[#f2ead8]">
      <div className="mx-auto max-w-5xl space-y-6">
        <header>
          <h1 className="text-2xl font-semibold">Verifier Credential Wallet</h1>
          <p className="text-sm text-[#c7c0ae]">Upload credentials, track expiry, and share platform-verified proof.</p>
        </header>

        <section className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 rounded-xl border border-[#d4a84333] bg-[#0f1626] p-4">
            <h2 className="text-sm font-semibold">Add credential</h2>
            <select className="w-full rounded bg-[#101c32] p-2 text-sm" value={form.credentialType} onChange={(e) => setForm((prev) => ({ ...prev, credentialType: e.target.value }))}>
              {[
                "iso_14064", "iso_14065", "verra_auditor", "gs_auditor", "unfccc_reviewer", "ipcc_reviewer", "undp_technical", "cdm_auditor", "custom",
              ].map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
            <input className="w-full rounded bg-[#101c32] p-2 text-sm" placeholder="Issuing body" value={form.issuingBody} onChange={(e) => setForm((prev) => ({ ...prev, issuingBody: e.target.value }))} />
            <input className="w-full rounded bg-[#101c32] p-2 text-sm" placeholder="Credential number" value={form.credentialNumber} onChange={(e) => setForm((prev) => ({ ...prev, credentialNumber: e.target.value }))} />
            <input className="w-full rounded bg-[#101c32] p-2 text-sm" type="date" value={form.expiresAt} onChange={(e) => setForm((prev) => ({ ...prev, expiresAt: e.target.value }))} />
            <Button className="w-full" onClick={saveCredential}>Upload & Hash Credential</Button>
          </div>

          <div className="space-y-3">
            {rows.map((row: any) => {
              const expiresAt = new Date(row.expiresAt);
              const daysRemaining = Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
              const expired = daysRemaining < 0;
              return (
                <article key={row.id} className={`rounded-xl border p-4 ${expired ? "border-slate-700 bg-slate-900/60" : "border-[#d4a84333] bg-[#0f1626]"}`}>
                  <p className="text-xs uppercase text-[#c7c0ae]">{row.credentialType}</p>
                  <h3 className="text-sm font-semibold">{row.issuingBody}</h3>
                  <p className="text-xs">Valid until {expiresAt.toLocaleDateString()} ({daysRemaining} days)</p>
                  <p className="text-xs">{row.verifiedByPlatform ? "Platform Verified ✓" : "Pending admin verification"}</p>
                  <p className="mt-1 break-all text-[11px] text-[#c7c0ae]">Doc hash: {row.documentHash}</p>
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
