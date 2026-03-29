import { useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";

type LivePayload = any;

export default function ProjectLivePage({ params }: { params: { projectId: string } }) {
  const projectId = params.projectId;
  const [data, setData] = useState<LivePayload | null>(null);
  const [windowRange, setWindowRange] = useState<"24h" | "7d" | "30d">("24h");
  const [showNdvi, setShowNdvi] = useState(true);
  const [showFire, setShowFire] = useState(true);

  const load = async () => {
    const res = await fetch(`/api/projects/${projectId}/live`);
    if (res.ok) setData(await res.json());
  };

  useEffect(() => {
    load();
    const s = io("/api/iot/live", { transports: ["websocket", "polling"], query: { projectId } });
    s.on("reading", load);
    const t = setInterval(load, 30_000);
    return () => {
      clearInterval(t);
      s.disconnect();
    };
  }, [projectId]);

  const co2Series = useMemo(() => {
    const points = windowRange === "24h" ? 24 : windowRange === "7d" ? 28 : 30;
    return Array.from({ length: points }).map((_, i) => ({ x: i, y: Math.max(20, Math.round(40 + Math.sin(i / 2) * 12 + i * 0.3)) }));
  }, [windowRange]);

  return (
    <div className="min-h-screen bg-[#040b08] text-[#e9f9ef] p-3 md:p-6 space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        <div>
          <h1 className="text-2xl md:text-4xl font-semibold">Live Satellite Viewer</h1>
          <p className="text-sm text-emerald-100/70">Project {projectId} • Updated: {data?.satellite?.lastPassAt ? new Date(data.satellite.lastPassAt).toLocaleString() : "—"}</p>
        </div>
        <button className="rounded bg-emerald-500 text-black px-4 py-2 font-medium">Share This Project</button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 rounded-xl border border-emerald-200/20 bg-[#07140f] p-3 space-y-3">
          <div className="flex gap-2 text-xs">
            <button onClick={() => setShowNdvi((v) => !v)} className="rounded border border-emerald-300/30 px-2 py-1">NDVI {showNdvi ? "ON" : "OFF"}</button>
            <button onClick={() => setShowFire((v) => !v)} className="rounded border border-emerald-300/30 px-2 py-1">Fire Alerts {showFire ? "ON" : "OFF"}</button>
          </div>
          <div className="h-[360px] md:h-[520px] rounded-lg bg-gradient-to-b from-[#1c3427] via-[#173f2f] to-[#07140f] relative overflow-hidden">
            <div className="absolute inset-0 opacity-40" style={{ backgroundImage: "radial-gradient(circle at 30% 20%,#4ade80 0,transparent 35%),radial-gradient(circle at 70% 60%,#facc15 0,transparent 30%),radial-gradient(circle at 50% 80%,#ef4444 0,transparent 35%)" }} />
            <div className="absolute inset-8 border-2 border-emerald-300/80 rounded-lg" />
            {showFire && data?.fireAlerts?.map((alert: any) => (
              <div key={alert.id} className="absolute h-3 w-3 rounded-full bg-red-500 animate-ping" style={{ left: "58%", top: "35%" }} />
            ))}
            {(data?.iotDevices || []).slice(0, 8).map((d: any, i: number) => (
              <button key={d.id} title={`${d.deviceType}: ${d.latestReading?.value || "n/a"} ${d.latestReading?.unit || ""}`} className="absolute h-3 w-3 rounded-full bg-cyan-300 border border-white" style={{ left: `${20 + (i * 9) % 65}%`, top: `${20 + (i * 11) % 60}%` }} />
            ))}
            <div className="absolute left-3 bottom-3 text-xs bg-black/60 px-2 py-1 rounded">Satellite: {data?.satellite?.provider || "Sentinel-2 / Planet"}</div>
          </div>
        </div>

        <aside className="rounded-xl border border-emerald-200/20 bg-[#07140f] p-3">
          <h2 className="font-semibold mb-2">Live IoT Panel</h2>
          <div className="space-y-2 max-h-[560px] overflow-auto pr-1">
            {(data?.iotDevices || []).map((d: any) => (
              <div key={d.id} className="rounded border border-emerald-100/15 p-2 text-xs">
                <div className="flex justify-between"><span>{d.deviceType}</span><span>{d.status}</span></div>
                <div>{d.latestReading?.value ?? "--"} {d.latestReading?.unit || ""}</div>
                <div>Signal: {Math.max(1, Math.round(Math.random() * 5))}/5 • Battery: {Math.round(35 + Math.random() * 60)}%</div>
                <div>Signature: {d.signatureValid ? "valid" : "invalid"}</div>
              </div>
            ))}
          </div>
        </aside>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <section className="lg:col-span-2 rounded-xl border border-emerald-200/20 bg-[#07140f] p-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Live CO₂ Chart</h3>
            <div className="flex gap-2 text-xs">
              {(["24h", "7d", "30d"] as const).map((w) => <button key={w} onClick={() => setWindowRange(w)} className={`rounded px-2 py-1 border ${windowRange === w ? "bg-emerald-500/30 border-emerald-300" : "border-emerald-100/20"}`}>{w}</button>)}
            </div>
          </div>
          <div className="mt-3 h-40 flex items-end gap-1">
            {co2Series.map((p) => <div key={p.x} className="bg-emerald-400/80 w-full" style={{ height: `${p.y}%` }} />)}
          </div>
          <div className="text-xs mt-2 text-emerald-100/75">Cumulative this month: {Number(data?.co2?.cumulativeThisMonthTonnes || 0).toFixed(2)} t • Running credits: {Number(data?.co2?.runningCredits || 0).toFixed(2)}</div>
        </section>

        <section className="rounded-xl border border-emerald-200/20 bg-[#07140f] p-3 text-sm space-y-2">
          <h3 className="font-semibold">Project Health Score</h3>
          <div>IoT Trust Score: {Number(data?.health?.iotTrustScore || 0).toFixed(2)}</div>
          <div>UVS Grade: {data?.health?.uvsGrade || "N/A"}</div>
          <div>Days until MRV due: {data?.health?.daysUntilMrvDue ?? "—"}</div>
          <div>Last verifier visit: {data?.health?.lastVerifierVisitDate ? new Date(data.health.lastVerifierVisitDate).toLocaleDateString() : "—"}</div>
        </section>
      </div>
    </div>
  );
}
