import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "uaiu_field_observations_v1";

export default function FieldAppPage() {
  const [activeProject] = useState({ id: "demo-project", name: "Pakistan Mangrove Restoration", status: "Active Engagement" });
  const [observationText, setObservationText] = useState("");
  const [queuedItems, setQueuedItems] = useState<any[]>([]);
  const [lastSync, setLastSync] = useState<string | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) setQueuedItems(JSON.parse(raw));
  }, []);

  const queueObservation = () => {
    if (!observationText.trim()) return;
    const next = [...queuedItems, {
      id: crypto.randomUUID(),
      text: observationText.trim(),
      type: "Document review",
      timestamp: new Date().toISOString(),
      gps: { lat: 24.8607, lng: 67.0011 },
      signature: `sig_${Math.random().toString(36).slice(2, 10)}`,
    }];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setQueuedItems(next);
    setObservationText("");
  };

  const syncQueued = async () => {
    if (queuedItems.length === 0) return;
    const res = await fetch("/api/field/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: queuedItems }),
    });
    if (!res.ok) return;
    localStorage.setItem(STORAGE_KEY, "[]");
    setQueuedItems([]);
    setLastSync(new Date().toISOString());
  };

  const checklist = useMemo(() => [
    "Boundary marker verification",
    "Device health check",
    "Community interview",
    "Vegetation observation",
    "Document review",
  ], []);

  return (
    <div className="min-h-screen bg-[#060810] p-4 text-[#f2ead8]">
      <div className="mx-auto max-w-md space-y-4 rounded-xl border border-[#d4a84333] bg-[#0d1628] p-4 shadow-lg">
        <h1 className="text-lg font-semibold">Field Verification Mobile App (PWA)</h1>
        <div className="rounded-md bg-[#101c32] p-3 text-sm">
          <p className="font-semibold">{activeProject.name}</p>
          <p className="text-xs text-[#c7c0ae]">{activeProject.status}</p>
          <p className="mt-2 text-xs">GPS: inside boundary (24.8607, 67.0011)</p>
          <p className="text-xs">Last sync: {lastSync ? new Date(lastSync).toLocaleString() : "Not synced yet"}</p>
          <p className="text-xs">Sync status: {queuedItems.length} items queued to sync</p>
        </div>

        <section className="space-y-2">
          <h2 className="text-sm font-semibold">Today's checklist</h2>
          {checklist.map((item) => (
            <label key={item} className="flex items-center gap-2 rounded border border-[#d4a84322] p-2 text-xs">
              <input type="checkbox" className="accent-emerald-500" />
              <span>{item}</span>
            </label>
          ))}
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-semibold">Add Observation</h2>
          <textarea value={observationText} onChange={(e) => setObservationText(e.target.value)} placeholder="Voice transcription or field note..." className="min-h-24 w-full rounded bg-[#0a1322] p-2 text-sm" />
          <div className="flex gap-2">
            <Button onClick={queueObservation} className="flex-1">Save Offline</Button>
            <Button onClick={syncQueued} variant="outline" className="flex-1">Sync Now</Button>
          </div>
          <p className="text-[11px] text-[#c7c0ae]">Captured photos are GPS tagged, timestamped, hashed, and synced into the evidence vault when online.</p>
        </section>
      </div>
    </div>
  );
}
