import { useMemo, useState } from "react";
import { Link } from "wouter";

type DeviceEntry = {
  slug: string;
  name: string;
  manufacturer: string;
  type: string;
  connection: string;
  setupDifficulty: "Easy" | "Medium" | "Advanced";
  costRange: string;
  bestFor: string;
  gatewayAgent: boolean;
  nativeMqtt: boolean;
  offlineCapable: boolean;
};

const DEVICES: DeviceEntry[] = [
  { slug: "campbell-cr300", name: "Campbell Scientific CR300", manufacturer: "Campbell Scientific", type: "datalogger", connection: "Campbell / REST / Gateway", setupDifficulty: "Advanced", costRange: "$800-1500", bestFor: "Enterprise, remote forest sites", gatewayAgent: true, nativeMqtt: false, offlineCapable: true },
  { slug: "campbell-cr1000x", name: "Campbell Scientific CR1000X", manufacturer: "Campbell Scientific", type: "datalogger", connection: "Campbell / REST / Gateway", setupDifficulty: "Advanced", costRange: "$1500-3000", bestFor: "Large projects, multi-sensor arrays", gatewayAgent: true, nativeMqtt: false, offlineCapable: true },
  { slug: "hobo-mx2301", name: "Onset HOBO MX2301", manufacturer: "Onset", type: "sensor node", connection: "HOBOlink / USB / Gateway", setupDifficulty: "Easy", costRange: "$150-300", bestFor: "Starter field deployments", gatewayAgent: true, nativeMqtt: false, offlineCapable: true },
  { slug: "hobo-u30", name: "Onset HOBO U30", manufacturer: "Onset", type: "datalogger", connection: "HOBOlink / USB / Gateway", setupDifficulty: "Medium", costRange: "$400-800", bestFor: "Mid-size monitoring stations", gatewayAgent: true, nativeMqtt: false, offlineCapable: true },
  { slug: "particle-boron", name: "Particle Boron", manufacturer: "Particle", type: "cellular modem", connection: "Particle webhook / REST", setupDifficulty: "Medium", costRange: "$70-100", bestFor: "Biogas, distributed rural telemetry", gatewayAgent: false, nativeMqtt: false, offlineCapable: true },
  { slug: "particle-electron", name: "Particle Electron", manufacturer: "Particle", type: "cellular modem", connection: "Particle webhook / REST", setupDifficulty: "Medium", costRange: "$70-100", bestFor: "Cellular fallback sites", gatewayAgent: false, nativeMqtt: false, offlineCapable: true },
  { slug: "blues-notecard", name: "Blues Wireless Notecard", manufacturer: "Blues Wireless", type: "cellular modem", connection: "Blues / REST", setupDifficulty: "Easy", costRange: "$50-80", bestFor: "No-WiFi locations", gatewayAgent: false, nativeMqtt: false, offlineCapable: true },
  { slug: "dragino-lsn50v2", name: "Dragino LSN50v2", manufacturer: "Dragino", type: "sensor node", connection: "LoRaWAN", setupDifficulty: "Medium", costRange: "$40-60", bestFor: "Low-cost LoRaWAN deployments", gatewayAgent: true, nativeMqtt: false, offlineCapable: true },
  { slug: "sensecap-s2103", name: "Seeed SenseCAP S2103", manufacturer: "Seeed", type: "sensor node", connection: "LoRaWAN / SenseCAP", setupDifficulty: "Easy", costRange: "$80-120", bestFor: "Forest & REDD+ CO2", gatewayAgent: true, nativeMqtt: false, offlineCapable: true },
  { slug: "sensecap-s2104", name: "Seeed SenseCAP S2104", manufacturer: "Seeed", type: "sensor node", connection: "LoRaWAN / SenseCAP", setupDifficulty: "Easy", costRange: "$80-120", bestFor: "Soil moisture and restoration sites", gatewayAgent: true, nativeMqtt: false, offlineCapable: true },
  { slug: "vaisala-gmp343", name: "Vaisala GMP343", manufacturer: "Vaisala", type: "sensor node", connection: "Modbus / Gateway", setupDifficulty: "Advanced", costRange: "$1000-2000", bestFor: "High-precision CO2 research", gatewayAgent: true, nativeMqtt: false, offlineCapable: true },
  { slug: "raspberry-pi-4", name: "Raspberry Pi 4", manufacturer: "Raspberry Pi", type: "gateway", connection: "Gateway Agent", setupDifficulty: "Medium", costRange: "$60-80", bestFor: "Edge gateway and local buffering", gatewayAgent: true, nativeMqtt: true, offlineCapable: true },
  { slug: "generic-esp32", name: "Generic ESP32", manufacturer: "Generic", type: "sensor node", connection: "MQTT / REST", setupDifficulty: "Advanced", costRange: "$10-20", bestFor: "Custom OEM prototypes", gatewayAgent: true, nativeMqtt: true, offlineCapable: true },
  { slug: "generic-arduino-mkr", name: "Generic Arduino MKR", manufacturer: "Arduino", type: "sensor node", connection: "MQTT / REST", setupDifficulty: "Advanced", costRange: "$30-50", bestFor: "Custom low-power embedded builds", gatewayAgent: true, nativeMqtt: true, offlineCapable: true },
];

export default function DeviceCompatibilityPage() {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => DEVICES.filter((d) => `${d.name} ${d.manufacturer} ${d.connection} ${d.bestFor}`.toLowerCase().includes(query.toLowerCase())), [query]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 text-white">
      <h1 className="text-3xl font-bold">UAIU Device Compatibility Matrix</h1>
      <p className="mt-2 text-white/80">Searchable list of certified-compatible devices and setup guides.</p>
      <input className="mt-4 w-full rounded border border-white/20 bg-black/20 p-2" placeholder="Search by device, manufacturer, method, use case" value={query} onChange={(e) => setQuery(e.target.value)} />

      <div className="mt-8 overflow-auto rounded border border-white/20">
        <table className="w-full text-sm">
          <thead className="bg-white/10">
            <tr>
              <th className="p-2 text-left">Device</th><th className="p-2 text-left">Type</th><th className="p-2 text-left">Connection</th><th className="p-2 text-left">Difficulty</th><th className="p-2 text-left">Cost</th><th className="p-2 text-left">Capabilities</th><th className="p-2 text-left">Guide</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((device) => (
              <tr key={device.slug} className="border-t border-white/10">
                <td className="p-2"><div className="font-medium">{device.name}</div><div className="text-white/70">{device.manufacturer}</div></td>
                <td className="p-2">{device.type}</td>
                <td className="p-2">{device.connection}</td>
                <td className="p-2">{device.setupDifficulty}</td>
                <td className="p-2">{device.costRange}</td>
                <td className="p-2">GA: {device.gatewayAgent ? "Yes" : "No"} • MQTT: {device.nativeMqtt ? "Yes" : "No"} • Offline: {device.offlineCapable ? "Yes" : "No"}</td>
                <td className="p-2"><Link href={`/x/developers/devices/${device.slug}/setup`} className="underline">Setup guide</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="mt-10 text-2xl font-semibold">UAIU Recommended Kits</h2>
      <ul className="mt-4 list-disc space-y-2 pl-6 text-white/90">
        <li><strong>Forest & REDD+ Kit ($350):</strong> SenseCAP CO2 + SenseCAP soil moisture + Blues Notecard gateway.</li>
        <li><strong>Biogas Monitoring Kit ($280):</strong> Particle Boron + gas flow adapter + UAIU Gateway Agent.</li>
        <li><strong>Enterprise Site Kit ($2,500):</strong> Campbell Scientific CR300 + multi-sensor inputs + solar.</li>
      </ul>
    </div>
  );
}
