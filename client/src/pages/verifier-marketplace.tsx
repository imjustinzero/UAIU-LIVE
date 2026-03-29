export default function VerifierMarketplacePage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-white p-4 md:p-8">
      <h1 className="text-3xl font-bold">Human Verifier Marketplace</h1>
      <p className="text-white/70 mt-2">Find ISO-accredited verifiers by standards, geography, timeline, and specialization.</p>
      <div className="mt-6 rounded-xl border border-white/10 p-4 bg-zinc-900 text-sm">
        Public discovery API: <code>GET /api/verifiers/search?standard=14064-3&projectType=industrial&country=DE&language=en</code>
      </div>
    </div>
  );
}
