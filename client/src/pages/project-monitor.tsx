import { useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";

type MonitorResponse = {
  metrics: {
    totalActiveProjects: number;
    totalActiveDevices: number;
    totalReadingsIngested: number;
    totalCO2eMonitored: number;
    platformDataQualityScore: number;
  };
  projects: any[];
};

export default function ProjectMonitorPage() {
  const [data, setData] = useState<MonitorResponse | null>(null);
  const [selectedProject, setSelectedProject] = useState<any>(null);

  const load = async () => {
    const res = await fetch("/api/projects/monitor");
    if (res.ok) {
      const json = await res.json();
      setData(json);
      if (!selectedProject && json.projects?.length) setSelectedProject(json.projects[0]);
    }
  };

  useEffect(() => {
    load();
    const s = io("/api/iot/live", { transports: ["websocket", "polling"], query: { projectId: "all" } });
    s.on("reading", load);
    s.on("anomaly", load);
    return () => { s.disconnect(); };
  }, []);

  const projects = data?.projects || [];
  const mapPins = useMemo(
    () =>
      projects.map((p) => {
        const hasOffline = p.devices.some((d: any) => ["offline", "tampered"].includes(d.status));
        const hasAnomaly = (p.anomalyCounts.critical || 0) + (p.anomalyCounts.high || 0) + (p.anomalyCounts.medium || 0) > 0;
        return { ...p, color: hasOffline ? "#ef4444" : hasAnomaly ? "#f59e0b" : "#22c55e" };
      }),
    [projects],
  );

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 md:p-8 space-y-6">
      <h1 className="text-3xl font-bold">Live IoT Project Monitoring</h1>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        <Metric label="Active Projects" value={data?.metrics.totalActiveProjects ?? 0} />
        <Metric label="Active Devices" value={data?.metrics.totalActiveDevices ?? 0} />
        <Metric label="Readings Ingested" value={data?.metrics.totalReadingsIngested ?? 0} />
        <Metric label="CO2e Monitored (t)" value={(data?.metrics.totalCO2eMonitored ?? 0).toFixed(2)} />
        <Metric label="Platform Data Quality" value={`${(data?.metrics.platformDataQualityScore ?? 0).toFixed(2)}%`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="rounded border border-white/20 bg-slate-900 p-4 lg:col-span-1">
          <h2 className="font-semibold mb-3">Project Map (pin color health)</h2>
          <div className="space-y-2 max-h-[500px] overflow-auto">
            {mapPins.map((p) => (
              <button key={p.projectId} onClick={() => setSelectedProject(p)} className="w-full text-left rounded border border-white/10 p-2 hover:border-emerald-400">
                <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full" style={{ backgroundColor: p.color }} />{p.projectId}</div>
                <div className="text-xs text-white/70">Devices: {p.devices.length} | Anomalies: {Object.values(p.anomalyCounts).reduce((a: number, b: any) => a + Number(b), 0)}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded border border-white/20 bg-slate-900 p-4 lg:col-span-2">
          {!selectedProject && <p>Select a project pin to inspect details.</p>}
          {selectedProject && (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-semibold">Project {selectedProject.projectId}</h2>
                <p className="text-white/70 text-sm">MRV: {selectedProject.mrv?.status || "n/a"} • Quality: {selectedProject.mrv?.dataQualityScore?.toFixed?.(2) ?? "n/a"}%</p>
              </div>

              <div>
                <h3 className="font-medium">Devices</h3>
                <div className="grid md:grid-cols-2 gap-2 mt-2">
                  {selectedProject.devices.map((d: any) => (
                    <div key={d.id} className="rounded border border-white/10 p-2 text-sm">
                      <div className="font-medium">{d.deviceId} <span className="text-xs text-white/60">({d.deviceType})</span></div>
                      <div>Status: <span className="uppercase">{d.status}</span></div>
                      <div>Last Seen: {d.lastSeenAt ? new Date(d.lastSeenAt).toLocaleString() : "never"}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="font-medium">Latest readings</h3>
                <pre className="text-xs overflow-auto bg-black/30 p-2 rounded">{JSON.stringify(selectedProject.latestReadings, null, 2)}</pre>
              </div>

              <div className="grid md:grid-cols-3 gap-3 text-sm">
                <div className="rounded border border-white/10 p-2">Credits generated: {Number(selectedProject.creditsGenerated || 0).toFixed(2)}</div>
                <div className="rounded border border-white/10 p-2">Unresolved anomalies: {Object.values(selectedProject.anomalyCounts).reduce((a: number, b: any) => a + Number(b), 0)}</div>
                <div className="rounded border border-white/10 p-2">Audit blocks (from latest MRV): {selectedProject.mrv?.auditBlockIds?.length || 0}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded border border-white/20 bg-slate-900 p-3">
      <div className="text-xs text-white/70">{label}</div>
      <div className="text-xl font-semibold">{value}</div>
    </div>
  );
}
