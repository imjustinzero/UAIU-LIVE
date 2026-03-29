import { useEffect, useState } from "react";

export default function VerifierProfilePage({ params }: { params: { id: string } }) {
  const [data, setData] = useState<any>(null);
  useEffect(() => { fetch(`/api/verifiers/${params.id}`).then((r) => r.json()).then(setData); }, [params.id]);
  return <div className="min-h-screen p-4 md:p-8 bg-slate-950 text-white space-y-3">
    <h1 className="text-3xl font-semibold">Verifier {params.id}</h1>
    <div>Reputation score: {data?.reputationScore} ({data?.grade})</div>
    <div>Average verification time: {data?.averageVerificationTime} days</div>
    <div>Credits verified: {data?.creditsVerifiedTonnes} tonnes</div>
    <pre className="text-xs bg-black/30 p-2 rounded">{JSON.stringify(data?.verificationHistory || [], null, 2)}</pre>
  </div>;
}
