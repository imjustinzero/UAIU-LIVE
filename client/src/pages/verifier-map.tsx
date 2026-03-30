import { useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const STATUS_META: Record<string, { label: string; color: string }> = {
  needs_verifier: { label: "Needs Verifier", color: "bg-blue-500" },
  active: { label: "Verification Active", color: "bg-amber-500" },
  complete: { label: "Verified ✓", color: "bg-emerald-500" },
  unverified: { label: "Unverified", color: "bg-slate-500" },
};

export default function VerifierMapPage() {
  const { status } = useAuth();
  const [selectedProject, setSelectedProject] = useState<any | null>(null);
  const [filters, setFilters] = useState({ creditType: "all", status: "all", country: "all" });

  const { data, isLoading } = useQuery({
    queryKey: ["verifier-map-projects"],
    queryFn: async () => {
      const res = await fetch("/api/verifier/map/projects");
      if (!res.ok) throw new Error("Failed to load verifier map");
      return res.json();
    },
    refetchInterval: 5 * 60 * 1000,
  });

  const projects = useMemo(() => {
    const rows = data?.projects || [];
    return rows.filter((project: any) => {
      if (filters.creditType !== "all" && project.creditType !== filters.creditType) return false;
      if (filters.status !== "all" && project.status !== filters.status) return false;
      if (filters.country !== "all" && project.projectOrigin !== filters.country) return false;
      return true;
    });
  }, [data?.projects, filters]);

  const countries = Array.from(new Set((data?.projects || []).map((project: any) => project.projectOrigin).filter(Boolean)));

  const requestEngagement = async () => {
    if (!selectedProject) return;
    const response = await fetch("/api/verifier/map/request-engagement", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: selectedProject.id }),
    });
    if (response.ok) {
      const body = await response.json();
      setSelectedProject((prev: any) => prev ? { ...prev, requestStatus: body.status } : prev);
    }
  };

  return (
    <div className="min-h-screen bg-[#060810] text-[#f2ead8]">
      <div className="border-b border-[#d4a84333] bg-[#0b1222]/95 px-4 py-3">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-3 text-xs md:grid-cols-5">
          <Stat title="Projects needing verification" value={data?.stats?.needsVerifier || 0} />
          <Stat title="Verifications in progress" value={data?.stats?.inProgress || 0} />
          <Stat title="Verifications completed" value={data?.stats?.completed || 0} />
          <Stat title="Countries covered" value={data?.stats?.countriesCovered || 0} />
          <Stat title="Total tonnes verified" value={Math.round(data?.stats?.totalTonnesVerified || 0).toLocaleString()} />
        </div>
      </div>

      <div className="mx-auto flex max-w-7xl gap-4 p-4">
        <aside className="w-72 space-y-3 rounded-xl border border-[#d4a84333] bg-[#0f1626] p-3">
          <h2 className="text-sm font-semibold">Filters</h2>
          <select className="w-full rounded bg-[#111c30] p-2 text-sm" value={filters.creditType} onChange={(e) => setFilters((prev) => ({ ...prev, creditType: e.target.value }))}>
            <option value="all">All credit types</option>
            {Array.from(new Set((data?.projects || []).map((project: any) => project.creditType))).map((type) => <option key={String(type)} value={String(type)}>{String(type)}</option>)}
          </select>
          <select className="w-full rounded bg-[#111c30] p-2 text-sm" value={filters.status} onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}>
            <option value="all">All statuses</option>
            <option value="needs_verifier">Needs verifier</option>
            <option value="active">Verification active</option>
            <option value="complete">Verified complete</option>
            <option value="unverified">Unverified</option>
          </select>
          <select className="w-full rounded bg-[#111c30] p-2 text-sm" value={filters.country} onChange={(e) => setFilters((prev) => ({ ...prev, country: e.target.value }))}>
            <option value="all">All countries</option>
            {countries.map((country) => <option key={String(country)} value={String(country)}>{String(country)}</option>)}
          </select>
          <p className="text-xs text-[#c7c0ae]">Mapbox GL renders when a token is configured. Fallback project grid remains available for low-bandwidth environments.</p>
        </aside>

        <section className="relative flex-1 overflow-hidden rounded-xl border border-[#d4a84333] bg-gradient-to-br from-[#071021] to-[#0f1e35] p-4">
          <div className="mb-3 flex items-center justify-between">
            <h1 className="text-xl font-semibold">Live Field Verification Map</h1>
            <Badge className="bg-[#1d2f52] text-[#f2ead8]">{projects.length} visible pins</Badge>
          </div>

          {isLoading ? <p className="text-sm text-[#c7c0ae]">Loading live projects...</p> : null}

          <div className="grid max-h-[72vh] grid-cols-1 gap-3 overflow-y-auto pr-2 md:grid-cols-2">
            {projects.map((project: any) => (
              <button key={project.id} type="button" onClick={() => setSelectedProject(project)} className="rounded-lg border border-[#d4a84322] bg-[#0a1322] p-3 text-left transition hover:border-[#d4a84366]">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">{project.orgName}</p>
                  <span className={`h-2.5 w-2.5 rounded-full ${STATUS_META[project.status]?.color || "bg-slate-500"} animate-pulse`} />
                </div>
                <p className="mt-1 text-xs text-[#c7c0ae]">{project.creditType} · {project.vintageYear || "N/A"} · {project.projectOrigin}</p>
                <p className="mt-1 text-xs text-[#d8d2c2]">{STATUS_META[project.status]?.label || "Unknown"} · {Number(project.volumeTonnes || 0).toLocaleString()} tCO2e</p>
              </button>
            ))}
          </div>
        </section>
      </div>

      {selectedProject ? (
        <aside className="fixed right-0 top-0 z-30 h-full w-full max-w-md overflow-y-auto border-l border-[#d4a84333] bg-[#0c1526] p-4 shadow-2xl">
          <div className="mb-3 flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold">{selectedProject.orgName}</h2>
              <p className="text-xs text-[#c7c0ae]">{selectedProject.registryName || "Registry pending"} · {selectedProject.projectOrigin}</p>
            </div>
            <button onClick={() => setSelectedProject(null)} className="text-xs text-[#c7c0ae]">Close</button>
          </div>
          <div className="space-y-2 text-sm">
            <p><strong>Status:</strong> {STATUS_META[selectedProject.status]?.label}</p>
            <p><strong>Credit type:</strong> {selectedProject.creditType}</p>
            <p><strong>Vintage:</strong> {selectedProject.vintageYear || "N/A"}</p>
            <p><strong>Tonnes available:</strong> {Number(selectedProject.volumeTonnes || 0).toLocaleString()}</p>
            <p><strong>Verification tier:</strong> Tier {selectedProject.verificationTier || 4}</p>
          </div>
          {status === "authenticated" ? (
            <Button className="mt-4 w-full" onClick={requestEngagement}>Request This Engagement</Button>
          ) : (
            <p className="mt-4 text-xs text-[#c7c0ae]">Sign in as a verifier to request this engagement.</p>
          )}
          {selectedProject.requestStatus ? <p className="mt-2 text-xs text-emerald-300">Request status: {selectedProject.requestStatus}</p> : null}
        </aside>
      ) : null}
    </div>
  );
}

function Stat({ title, value }: { title: string; value: string | number }) {
  return (
    <div className="rounded-md border border-[#d4a84322] bg-[#0a1322] p-2">
      <p className="text-[11px] text-[#c7c0ae]">{title}</p>
      <p className="text-sm font-semibold">{value}</p>
    </div>
  );
}
