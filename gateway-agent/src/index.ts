import { loadConfig } from './config';
import { discoverDevices } from './discovery';
import { signReading } from './signer';
import { bufferOnFailure, syncBuffered, uploadBatch } from './uploader';
import { startUi } from './ui';

const config = loadConfig();
const state = { connected: false, rpm: 0, logs: [] as string[] };

function log(line: string) {
  state.logs.unshift(`${new Date().toISOString()} ${line}`);
  state.logs = state.logs.slice(0, 100);
}

async function collectReadings() {
  const devices = await discoverDevices();
  return devices.map((d, idx) => ({
    deviceId: config.UAIU_DEVICE_IDS[idx] || `gateway-device-${idx + 1}`,
    timestamp: new Date().toISOString(),
    readingType: `${d.type}_heartbeat`,
    value: 1,
    unit: 'count',
  })).map((r) => ({ ...r, signature: signReading(r) }));
}

async function loop() {
  const readings = await collectReadings();
  try {
    await uploadBatch(config.UAIU_ENDPOINT, config.UAIU_API_KEY, readings);
    await syncBuffered(config.UAIU_ENDPOINT, config.UAIU_API_KEY);
    state.connected = true;
    state.rpm = readings.length;
    log(`Uploaded ${readings.length} readings`);
  } catch {
    readings.forEach(bufferOnFailure);
    state.connected = false;
    log('Upload failed; readings buffered locally');
  }
}

startUi(() => state);
setInterval(loop, config.UPLOAD_INTERVAL_SECONDS * 1000);
loop();
