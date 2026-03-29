import { useEffect, useState } from "react";
import { Link } from "wouter";

export default function VerifierDirectoryPage() {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => { fetch('/api/verifiers').then((r) => r.json()).then(setRows); }, []);
  return <div className="min-h-screen p-4 md:p-8 bg-slate-950 text-white">
    <h1 className="text-3xl font-semibold mb-4">Verifier Directory</h1>
    <div className="space-y-2">{rows.map((v) => <Link key={v.id} href={`/x/verifiers/${v.verifierId}`} className="block rounded border border-white/20 p-3 bg-slate-900">{v.verifierId} • Score {Number(v.reputationScore).toFixed(1)} • Grade {v.grade}</Link>)}</div>
  </div>;
}
