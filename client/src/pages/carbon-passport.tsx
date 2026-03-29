import { useEffect, useState } from "react";

export default function CarbonPassportPage({ params }: { params: { retirementId: string } }) {
  const [data, setData] = useState<any>(null);
  useEffect(() => { fetch(`/api/passport/${params.retirementId}`).then((r) => r.json()).then(setData); }, [params.retirementId]);
  return <div className="min-h-screen bg-[#0a2f1f] text-[#f9e7b0] p-4 md:p-10">
    <div className="max-w-5xl mx-auto rounded-2xl border border-yellow-600/50 bg-gradient-to-b from-[#123724] to-[#0a2016] p-4 md:p-8 grid md:grid-cols-2 gap-4">
      <section className="border border-yellow-600/40 rounded-xl p-4 space-y-2"><h1 className="text-2xl font-semibold">UAIU Carbon Passport</h1><div>{data?.organizationName}</div><div>This organization has retired {data?.tonnes} tonnes of CO₂</div><div>UVS: {data?.uvsCertificateNumber}</div><div className="h-24 w-24 bg-[#f9e7b0] text-black grid place-content-center">QR</div></section>
      <section className="border border-yellow-600/40 rounded-xl p-4 space-y-2"><div className="h-40 rounded bg-black/30" /><div>{data?.projectName} • {data?.location}</div><div>{data?.registry} • Verified by {data?.verifierName}</div><div className="text-emerald-300">● active and verified</div><button className="rounded bg-yellow-500 text-black px-3 py-1">Share on LinkedIn</button></section>
    </div>
  </div>;
}
