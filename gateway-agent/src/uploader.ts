import { ackBatch, queueReading, takeBatch } from './buffer';

export async function uploadBatch(endpoint: string, apiKey: string, readings: any[]) {
  const res = await fetch(`${endpoint}/iot/readings/batch`, { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ readings }) });
  if (!res.ok) throw new Error(`upload failed (${res.status})`);
  return res.json();
}

export async function syncBuffered(endpoint: string, apiKey: string) {
  const batch = takeBatch(100);
  if (!batch.length) return { sent: 0 };
  try {
    await uploadBatch(endpoint, apiKey, batch.map((b) => b.payload));
    ackBatch(batch.map((b) => b.id));
    return { sent: batch.length };
  } catch {
    return { sent: 0 };
  }
}

export function bufferOnFailure(reading: any) {
  queueReading(reading);
}
