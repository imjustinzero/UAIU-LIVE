import { useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";

export default function DigitalTwinPage({ params }: { params: { projectId: string } }) {
  const projectId = params.projectId;
  const [twin, setTwin] = useState<any>(null);
  const [predictions, setPredictions] = useState<any[]>([]);
  const [layer, setLayer] = useState("satellite");

  const load = async () => {
    const [t, p] = await Promise.all([
      fetch(`/api/twin/${projectId}/current`).then((r) => r.json()),
      fetch(`/api/predictions/${projectId}/current`).then((r) => r.json()),
    ]);
    setTwin(t);
    setPredictions(Array.isArray(p) ? p : []);
  };

  useEffect(() => {
    load();
    const s = io("/api/iot/live", { transports: ["websocket", "polling"], query: { projectId } });
    s.on("reading", load);
    return () => {
      s.disconnect();
    };
  }, [projectId]);

  const credit90 = useMemo(() => predictions.find((p) => p.predictionType === "credit_volume" && p.horizon === "90d"), [predictions]);

  return <div className="min-h-screen bg-[#030712] text-white">
    <header className="sticky top-0 z-20 bg-black/85 border-b border-emerald-300/25 p-3 flex items-center justify-between">
      <div><div className="font-semibold">Project {projectId}</div><div className="text-xs text-emerald-200/80">UVS {twin?.state?.compliance?.uvsGrade || "--"}</div></div>
      <div className="text-xs flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"/>LIVE</div>
    </header>

    <div className="grid grid-cols-1 lg:grid-cols-[60%_40%]">
      <section className="lg:h-[calc(100vh-56px)] p-3 border-r border-white/10">
        <div className="h-[280px] md:h-[420px] lg:h-full rounded-xl bg-gradient-to-br from-[#123b2a] to-[#0a1523] relative overflow-hidden">
          <div className="absolute inset-7 border-2 border-emerald-400/80 rounded-xl"/>
          {Array.from({length:30}).map((_,i)=><div key={i} className="absolute h-1.5 w-1.5 rounded-full bg-emerald-300/80 animate-pulse" style={{left:`${10+(i*9)%80}%`,top:`${15+(i*7)%70}%`}} />)}
          <div className="absolute bottom-3 left-3 right-3 flex gap-2 text-xs">{["satellite","ndvi","fire","sensors","weather"].map((l)=><button key={l} onClick={()=>setLayer(l)} className={`px-2 py-1 rounded border ${layer===l?"bg-emerald-500/30 border-emerald-300":"border-white/30"}`}>{l}</button>)}</div>
        </div>
      </section>

      <section className="p-3 space-y-3 overflow-auto lg:h-[calc(100vh-56px)]">
        <Panel title="Live Readings"><Metric label="CO₂ rate" value={`${Number(twin?.state?.atmosphere?.co2SequestrationRateKgPerHour || 0).toFixed(2)} kg/h`} /><Metric label="Temp" value={`${twin?.state?.atmosphere?.temperatureCelsius || 0}°C`} /><Metric label="Humidity" value={`${twin?.state?.atmosphere?.humidityPercent || 0}%`} /></Panel>
        <Panel title="Credit Generation"><Metric label="Today" value={`${Number(twin?.state?.credits?.currentRatePerDay || 0).toFixed(2)} t`} /><Metric label="This month" value={`${Number(twin?.state?.credits?.generatedThisMonth || 0).toFixed(2)} t`} /><Metric label="Lifetime" value={`${Number(twin?.state?.credits?.generatedLifetime || 0).toFixed(2)} t`} /></Panel>
        <Panel title="Vegetation Health"><Metric label="NDVI" value={String(twin?.state?.vegetation?.ndviCurrent || "--")} /><Metric label="Trend" value={twin?.state?.vegetation?.ndviTrend || "--"} /><Metric label="Forest Cover" value={`${twin?.state?.vegetation?.forestCoverPercent || 0}%`} /></Panel>
        <Panel title="Weather"><Metric label="Wind" value={`${twin?.state?.weather?.windSpeedMs || 0} m/s`} /><Metric label="Precipitation" value={`${twin?.state?.weather?.precipitationMm || 0} mm`} /><Metric label="Fire risk" value={twin?.state?.weather?.fireRiskLevel || "--"} /></Panel>
        <Panel title="Predictions (90d)"><Metric label="Predicted credits" value={`${Number(credit90?.predictedValue || 0).toFixed(2)} t`} /><Metric label="Low/High" value={`${Number(credit90?.confidenceInterval?.low || 0).toFixed(1)} / ${Number(credit90?.confidenceInterval?.high || 0).toFixed(1)}`} /><Metric label="Confidence" value={`${credit90?.confidenceInterval?.confidence || 0}%`} /></Panel>
        <Panel title="Device Status"><Metric label="Online" value={`${twin?.state?.devices?.online || 0}/${twin?.state?.devices?.total || 0}`} /><Metric label="Offline" value={String(twin?.state?.devices?.offline || 0)} /><Metric label="Tampered" value={String(twin?.state?.devices?.tampered || 0)} /></Panel>
        <Panel title="Compliance"><Metric label="UVS" value={`${twin?.state?.compliance?.uvsStatus || "--"} (${twin?.state?.compliance?.uvsGrade || "--"})`} /><Metric label="IoT Trust" value={String(twin?.state?.compliance?.iotTrustScore || 0)} /><Metric label="Open anomalies" value={String(twin?.state?.compliance?.openAnomalies || 0)} /></Panel>
        <Panel title="AI Insights"><p className="text-sm text-white/85">{credit90?.confidenceInterval?.explanation || "Twin telemetry is stable. UVS retention probability remains strong with moderate weather-driven variability."}</p><button className="mt-2 rounded bg-emerald-500 text-black px-3 py-1 text-sm">Generate Verifier Briefing</button></Panel>
      </section>
    </div>
  </div>;
}

function Panel({ title, children }: { title: string; children: any }) {
  return <div className="rounded-xl border border-white/15 bg-slate-900/60 p-3"><h3 className="font-medium mb-2">{title}</h3>{children}</div>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="text-sm flex justify-between py-0.5"><span className="text-white/70">{label}</span><span>{value}</span></div>;
}
