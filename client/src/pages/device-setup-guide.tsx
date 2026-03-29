import { useMemo } from "react";
import { useRoute } from "wouter";

export default function DeviceSetupGuidePage() {
  const [, params] = useRoute("/x/developers/devices/:deviceSlug/setup");
  const slug = params?.deviceSlug || "generic-device";
  const codeExample = useMemo(() => `curl -X POST https://uaiu.live/x/api/iot/readings \\
  -H "Authorization: Bearer <deviceId:apiSecret>" \\
  -H "Content-Type: application/json" \\
  -d '{"readingType":"temperature_c","value":22.8,"unit":"°C","timestamp":"${new Date().toISOString()}"}'`, []);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 text-white">
      <h1 className="text-3xl font-bold">Setup Guide: {slug}</h1>
      <ol className="mt-6 list-decimal space-y-2 pl-6 text-white/90">
        <li>Register the device in UAIU and store credentials.</li>
        <li>Choose connection mode (MQTT, webhook adapter, or REST batch upload).</li>
        <li>Configure payload mapping to UAIU standard readings.</li>
        <li>Enable signatures and offline buffer.</li>
        <li>Run a test reading and confirm in project monitor.</li>
      </ol>

      <h2 className="mt-8 text-xl font-semibold">Code snippet</h2>
      <pre className="mt-2 overflow-auto rounded bg-black/40 p-3 text-xs">{codeExample}</pre>

      <h2 className="mt-8 text-xl font-semibold">Troubleshooting</h2>
      <ul className="mt-2 list-disc space-y-1 pl-6 text-white/90">
        <li>401 responses: verify device token and clock drift.</li>
        <li>Invalid signature: ensure exact payload bytes are signed.</li>
        <li>No data: validate adapter endpoint and payload schema.</li>
      </ul>

      <h2 className="mt-8 text-xl font-semibold">Video walkthrough</h2>
      <div className="mt-2 aspect-video w-full rounded border border-white/20 bg-black/40 p-4 text-white/70">YouTube embed placeholder</div>

      <h2 className="mt-8 text-xl font-semibold">Community notes</h2>
      <p className="mt-2 text-white/80">Community notes section placeholder for deployment tips by region and firmware versions.</p>
    </div>
  );
}
