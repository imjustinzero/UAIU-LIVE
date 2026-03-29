import { useEffect, useState } from "react";
import { useRoute } from "wouter";

export default function ProfessionalProfilePage() {
  const [, params] = useRoute<{ id: string }>("/x/professionals/:id");
  const [profile, setProfile] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!params?.id) return;
    fetch(`/api/professionals/${params.id}`)
      .then(async (r) => {
        if (!r.ok) throw new Error("Profile not found");
        return r.json();
      })
      .then(setProfile)
      .catch((e) => setError(e.message));
  }, [params?.id]);

  if (error) return <div className="p-8 text-red-400">{error}</div>;
  if (!profile) return <div className="p-8 text-[#f2ead8]">Loading professional profile...</div>;

  return (
    <div className="min-h-screen bg-[#060810] px-6 py-10 text-[#f2ead8] md:px-10">
      <div className="mx-auto max-w-5xl space-y-6 rounded-xl border border-[#d4a84322] bg-[#0f1626] p-6">
        <header>
          <h1 className="text-4xl font-semibold">{profile.displayName}</h1>
          <p className="mt-1 text-sm text-[#c7c0ae]">{profile.title || "Professional"} · {profile.organization || "Independent"}</p>
        </header>
        <section className="grid gap-5 md:grid-cols-2">
          <article>
            <h2 className="mb-2 text-lg font-medium">Credentials & Specializations</h2>
            <pre className="whitespace-pre-wrap rounded bg-[#0a1322] p-3 text-xs text-[#d8d2c2]">{JSON.stringify({ credentials: profile.credentials, specializations: profile.specializations }, null, 2)}</pre>
          </article>
          <article>
            <h2 className="mb-2 text-lg font-medium">Verification Track Record</h2>
            <ul className="space-y-1 text-sm text-[#d8d2c2]">
              <li>Verifications completed: {profile.verificationsCompleted || 0}</li>
              <li>Tonnes verified: {profile.tonnesVerified || 0}</li>
              <li>Reputation score: {profile.reputationScore || 0}</li>
              <li>Peer reviews completed: {profile.mqlContributions || 0}</li>
              <li>ORCID: {profile.orcidId || "Not linked"}</li>
            </ul>
          </article>
        </section>
      </div>
    </div>
  );
}
