import { useEffect, useState } from "react";

export default function ClaimCertificatePage({ params }: { params: { certificateNumber: string } }) {
  const [data, setData] = useState<any>(null);
  useEffect(() => { fetch(`/api/claims/${params.certificateNumber}`).then((r) => r.json()).then(setData); }, [params.certificateNumber]);
  return <div className="min-h-screen bg-slate-950 text-white p-4 md:p-8"><h1 className="text-3xl font-semibold">Verified Claim Certificate</h1><pre className="mt-3 rounded bg-black/30 p-3 text-xs">{JSON.stringify(data, null, 2)}</pre></div>;
}
