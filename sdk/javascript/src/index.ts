export type Reading = { deviceId: string; timestamp: string; readingType: string; value: number; unit: string; signature?: string };

export class UAIUClient {
  constructor(private cfg: { endpoint: string; apiKey: string; privateKey?: string }) {}

  async registerDevice(payload: Record<string, unknown>) {
    return this.req('/iot/devices/register', payload);
  }

  async submitReading(reading: Reading) {
    return this.req('/iot/readings', this.sign(reading));
  }

  async batchSubmit(readings: Reading[]) {
    return this.req('/iot/readings/batch', { readings: readings.map((r) => this.sign(r)) });
  }

  private sign<T extends Reading>(reading: T): T {
    if (!this.cfg.privateKey) return reading;
    return { ...reading, signature: `signed:${Buffer.from(reading.deviceId).toString('base64')}` };
  }

  private async req(path: string, body: unknown, attempt = 0): Promise<any> {
    const res = await fetch(`${this.cfg.endpoint}${path}`, { method: 'POST', headers: { Authorization: `Bearer ${this.cfg.apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!res.ok && attempt < 3) {
      await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
      return this.req(path, body, attempt + 1);
    }
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'UAIU SDK request failed');
    return data;
  }
}
