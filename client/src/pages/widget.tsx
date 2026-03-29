import { useEffect, useState } from "react";
import { useRoute } from "wouter";

export default function UvsWidget() {
  const [, params] = useRoute("/x/widget/:certificateNumber");
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    const load = () => fetch(`/api/uvs/certificates/${params?.certificateNumber}`).then((r) => r.json()).then(setData);
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, [params?.certificateNumber]);

  const color = data?.status === "certified" ? "#00ff88" : "#ef4444";
  return (
    <div className="h-screen w-screen p-2 text-white" style={{ background: "#0a0f1e" }}>
      <div className="h-full rounded border p-3" style={{ borderColor: color, background: "#111827" }}>
        <p className="text-xs">UAIU VERIFIED STANDARD</p>
        <p className="font-semibold">{data?.certificateNumber || "Loading..."}</p>
        <p className="text-sm">Status: <span style={{ color }}>{data?.status?.toUpperCase?.() || "..."}</span></p>
        <p className="text-sm">Grade: {data?.qualityGrade || "-"}</p>
        <p className="text-xs text-white/70">{data?.projectName}</p>
      </div>
    </div>
  );
}
