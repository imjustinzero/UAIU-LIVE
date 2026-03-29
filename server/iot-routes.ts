import type { Express } from "express";
import { Router } from "express";
import { createHash, createHmac, randomBytes } from "crypto";
import mqtt from "mqtt";
import PDFDocument from "pdfkit";
import { and, asc, desc, eq, gte, lte, sql } from "drizzle-orm";
import {
  anomalyEvents,
  auditChainEntries,
  exchangeCreditListings,
  firmwareVersions,
  iotDevices,
  iotReadings,
  iotRawPayloads,
  iotTrustScores,
  mrvReports,
  satelliteReadings,
  deviceCertifications,
} from "@shared/schema";
import { db } from "./db";
import { getHashAlgorithm } from "./hash-agility";

let ioNamespace: { emit: (event: string, payload: any) => void } | null = null;
export function setIotLiveNamespace(ns: any) { ioNamespace = ns; }

function hashEntry(entry: Record<string, unknown>, algorithm: string): string {
  return createHash(algorithm).update(JSON.stringify(entry)).digest("hex");
}

async function addAuditEntry(transactionData: Record<string, any>) {
  const lastBlock = await db.query.auditChainEntries.findFirst({ orderBy: (t, { desc }) => [desc(t.blockNumber)] });
  const blockNumber = (lastBlock?.blockNumber ?? 0) + 1;
  const prevHash = lastBlock?.hash ?? "0000000000000000";
  const algorithm = getHashAlgorithm();
  const timestamp = new Date();
  const entryToHash = { blockNumber, timestamp: timestamp.toISOString(), algorithm, transactionData, prevHash };
  const hash = hashEntry(entryToHash, algorithm);
  const [created] = await db.insert(auditChainEntries).values({ blockNumber, timestamp, algorithm, transactionData, prevHash, hash }).returning();
  return created;
}

function asDate(value: string | undefined, fallback?: Date) {
  if (!value) return fallback;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? fallback : d;
}

function gradeFor(score: number) {
  if (score >= 95) return "A+";
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

function computeMethodologyCredits(methodology: string, totals: { co2: number; methane: number; energy: number }) {
  if (methodology === "VERRA_VM0015") return totals.co2 * 1.05;
  if (methodology === "GOLD_STANDARD_TPDDTEC") return totals.methane * 0.0019 + totals.energy * 0.0005;
  return totals.co2 + totals.methane * 0.0015 + totals.energy * 0.0004;
}

function verifyReadingSignature(publicKey: string, payload: any, signature?: string | null) {
  if (!signature || !publicKey) return false;
  const expected = createHmac("sha256", publicKey).update(JSON.stringify(payload)).digest("hex");
  return expected === signature;
}



type StandardReading = {
  deviceId: string;
  timestamp: string;
  readingType: string;
  value: number;
  unit: string;
  signature?: string;
  rawPayload?: unknown;
};

const MQTT_TOPIC_PREFIX = "uaiu";
let mqttStarted = false;
let mqttConnected = false;
let mqttStatusReason = "MQTT bridge not initialized";
let mqttReconnectAttempts = 0;
let mqttReconnectTimer: NodeJS.Timeout | null = null;

export function getMqttHealthStatus() {
  return {
    connected: mqttConnected,
    reason: mqttConnected ? undefined : mqttStatusReason,
  };
}

function normalizeReading(input: any): StandardReading | null {
  if (!input || !input.deviceId || !input.readingType) return null;
  const value = Number(input.value);
  if (!Number.isFinite(value)) return null;
  const timestamp = asDate(String(input.timestamp || ""), new Date())!;
  return {
    deviceId: String(input.deviceId),
    timestamp: timestamp.toISOString(),
    readingType: String(input.readingType),
    value,
    unit: String(input.unit || ""),
    signature: input.signature ? String(input.signature) : undefined,
    rawPayload: input.rawPayload ?? input,
  };
}

async function ingestStandardReading(readingInput: StandardReading, source: string) {
  const [device] = await db.select().from(iotDevices).where(eq(iotDevices.deviceId, readingInput.deviceId));
  if (!device) return { error: "invalid_payload", reason: `Unknown deviceId ${readingInput.deviceId}` };

  const signaturePayload = {
    deviceId: readingInput.deviceId,
    timestamp: readingInput.timestamp,
    readingType: readingInput.readingType,
    value: readingInput.value,
    unit: readingInput.unit,
  };
  const signatureValid = readingInput.signature
    ? verifyReadingSignature(device.publicKey, signaturePayload, readingInput.signature)
    : true;

  const [reading] = await db.insert(iotReadings).values({
    deviceId: device.id,
    projectId: device.projectId,
    timestamp: asDate(readingInput.timestamp, new Date())!,
    receivedAt: new Date(),
    readingType: readingInput.readingType,
    value: readingInput.value,
    unit: readingInput.unit,
    rawPayload: readingInput.rawPayload || readingInput,
    deviceSignature: readingInput.signature || null,
    signatureValid,
    anomalyFlag: !signatureValid,
    anomalyReason: !signatureValid ? "signature_invalid" : null,
  } as any).returning();

  const audit = await addAuditEntry({
    type: "iot_reading",
    source,
    deviceId: device.id,
    projectId: device.projectId,
    readingType: reading.readingType,
    value: reading.value,
    unit: reading.unit,
    signatureValid,
  });
  await db.update(iotReadings).set({ auditBlockId: audit.id }).where(eq(iotReadings.id, reading.id));
  await detectAnomalies({ device, reading, signatureValid });
  await db.update(iotDevices).set({ lastSeenAt: new Date(), status: "active" }).where(eq(iotDevices.id, device.id));

  return { readingId: reading.id, auditBlockId: audit.id, projectId: device.projectId };
}

async function logRawPayload(source: string, rawPayload: any, deviceId?: string) {
  const [row] = await db.insert(iotRawPayloads).values({
    source,
    deviceId: deviceId || null,
    rawPayload: rawPayload || {},
    processed: false,
    readingIds: [],
  } as any).returning();
  return row;
}

async function markPayloadProcessed(payloadId: string, readingIds: string[]) {
  await db.update(iotRawPayloads).set({ processed: true, readingIds }).where(eq(iotRawPayloads.id, payloadId));
}

function decodeLorawanPayload(payloadB64: string) {
  const raw = Buffer.from(payloadB64, "base64");
  if (raw.length >= 4) {
    const temp = raw.readInt16BE(0) / 10;
    const humidity = raw.readUInt16BE(2) / 10;
    return [
      { readingType: "temperature_c", value: temp, unit: "°C" },
      { readingType: "humidity_pct", value: humidity, unit: "%" },
    ];
  }
  return [];
}

function ensureMqttBridge() {
  if (mqttStarted) return;
  mqttStarted = true;
  const brokerUrl = process.env.MQTT_BROKER_URL;
  if (!brokerUrl) {
    mqttConnected = false;
    mqttStatusReason = "MQTT_BROKER_URL not set";
    console.warn("[MQTT] MQTT_BROKER_URL not set; MQTT bridge disabled.");
    return;
  }

  const connectClient = () => mqtt.connect(brokerUrl, {
    username: process.env.MQTT_USERNAME || undefined,
    password: process.env.MQTT_PASSWORD || undefined,
    port: Number(process.env.MQTT_PORT || 1883),
    reconnectPeriod: 0,
  });
  let client = connectClient();

  const queueReconnect = () => {
    mqttReconnectAttempts += 1;
    const backoffMs = Math.min(30_000, Math.max(1_000, 2 ** mqttReconnectAttempts * 1_000));
    mqttStatusReason = `Reconnect scheduled in ${backoffMs}ms`;
    if (mqttReconnectTimer) clearTimeout(mqttReconnectTimer);
    mqttReconnectTimer = setTimeout(() => {
      client.removeAllListeners();
      client.end(true);
      client = connectClient();
      attachHandlers();
    }, backoffMs);
  };

  const attachHandlers = () => {
    client.on("connect", () => {
      mqttConnected = true;
      mqttStatusReason = "Connected";
      mqttReconnectAttempts = 0;
      console.info(`MQTT connected to ${brokerUrl}`);
      client.subscribe(`${MQTT_TOPIC_PREFIX}/devices/+/readings`);
      client.subscribe(`${MQTT_TOPIC_PREFIX}/devices/+/status`);
    });

    client.on("close", () => {
      mqttConnected = false;
      mqttStatusReason = "Connection closed";
      queueReconnect();
    });

    client.on("error", (err) => {
      mqttConnected = false;
      mqttStatusReason = err?.message || "MQTT connection error";
      console.error("MQTT connection error:", err);
      queueReconnect();
    });

    client.on("message", async (topic, payloadBuffer) => {
      try {
        const payload = JSON.parse(payloadBuffer.toString("utf8"));
        const topicParts = topic.split("/");
        const deviceId = topicParts[2];
        if (!deviceId) return;
        const raw = await logRawPayload("mqtt", payload, deviceId);

        if (topic.endsWith("/status")) {
          const [device] = await db.select().from(iotDevices).where(eq(iotDevices.deviceId, deviceId));
          if (device) await db.update(iotDevices).set({ status: String(payload.status || "active"), lastSeenAt: new Date() }).where(eq(iotDevices.id, device.id));
          await markPayloadProcessed(raw.id, []);
          client.publish(`${MQTT_TOPIC_PREFIX}/devices/${deviceId}/ack`, JSON.stringify({ ok: true, type: "status", at: new Date().toISOString() }));
          return;
        }

        const reading = normalizeReading({ ...payload, deviceId });
        if (!reading) {
          client.publish(`${MQTT_TOPIC_PREFIX}/devices/${deviceId}/ack`, JSON.stringify({ ok: false, error: "invalid_payload" }));
          return;
        }
        const result: any = await ingestStandardReading(reading, "mqtt");
        if (result.error) {
          client.publish(`${MQTT_TOPIC_PREFIX}/devices/${deviceId}/ack`, JSON.stringify({ ok: false, error: result.reason }));
          return;
        }
        await markPayloadProcessed(raw.id, [result.readingId]);
        client.publish(`${MQTT_TOPIC_PREFIX}/devices/${deviceId}/ack`, JSON.stringify({ ok: true, readingId: result.readingId, auditBlockId: result.auditBlockId }));
        client.publish(`${MQTT_TOPIC_PREFIX}/projects/${result.projectId}/summary`, JSON.stringify({ deviceId, readingType: reading.readingType, value: reading.value, at: reading.timestamp }));
      } catch (e) {
        // keep MQTT loop resilient
      }
    });
  };

  attachHandlers();
}
async function createAnomaly(deviceId: string, readingId: string | null, anomalyType: string, severity: string, description: string) {
  const [event] = await db.insert(anomalyEvents).values({ deviceId, readingId, anomalyType, severity, description }).returning();
  await addAuditEntry({ type: "anomaly_detected", deviceId, anomalyType, severity, description });
  ioNamespace?.emit("anomaly", event);
  return event;
}

async function detectAnomalies(params: { device: any; reading: any; signatureValid: boolean; isReplay?: boolean }) {
  const found: any[] = [];
  const { device, reading, signatureValid, isReplay } = params;
  if (!signatureValid) {
    found.push(await createAnomaly(device.id, reading.id, "signature_invalid", "high", "Device signature failed verification"));
  }

  const value = Number(reading.value);
  const min = Number((device.calibrationData as any)?.min ?? Number.NEGATIVE_INFINITY);
  const max = Number((device.calibrationData as any)?.max ?? Number.POSITIVE_INFINITY);
  if (Number.isFinite(min) && Number.isFinite(max) && (value < min || value > max)) {
    found.push(await createAnomaly(device.id, reading.id, "value_out_of_range", "medium", `Reading ${value} outside calibration range ${min}-${max}`));
  }

  if ((reading.readingType === "co2_sequestration_kg" && value < 0) || (reading.readingType === "temperature_c" && value > 100)) {
    found.push(await createAnomaly(device.id, reading.id, "impossible_value", "critical", `Impossible ${reading.readingType} value ${value}`));
  }

  const recent = await db.select().from(iotReadings)
    .where(and(eq(iotReadings.deviceId, device.id), eq(iotReadings.readingType, reading.readingType), gte(iotReadings.receivedAt, new Date(Date.now() - 24 * 60 * 60 * 1000))))
    .orderBy(desc(iotReadings.receivedAt))
    .limit(1000);

  if (recent.length > 10) {
    const avg = recent.reduce((a, r) => a + Number(r.value), 0) / recent.length;
    const variance = recent.reduce((a, r) => a + Math.pow(Number(r.value) - avg, 2), 0) / recent.length;
    const std = Math.sqrt(variance);
    if (std > 0 && Math.abs(value - avg) > std * 3) {
      found.push(await createAnomaly(device.id, reading.id, "sudden_spike", "medium", `Reading deviates by >3σ from 24h rolling average`));
    }
  }

  const recent7 = recent.slice(0, 6);
  if (recent7.length >= 6 && recent7.every((r) => Number(r.value) === Number(recent7[0].value)) && Number(recent7[0].value) === value) {
    found.push(await createAnomaly(device.id, reading.id, "flatline", "high", "6+ consecutive identical readings"));
  }

  const driftMs = Math.abs(new Date(reading.timestamp).getTime() - new Date(reading.receivedAt).getTime());
  if (driftMs > 5 * 60 * 1000) {
    found.push(await createAnomaly(device.id, reading.id, "timestamp_drift", "low", "Device timestamp drift exceeds 5 minutes"));
  }

  const lastSeen = device.lastSeenAt ? new Date(device.lastSeenAt).getTime() : null;
  const thresholdMins = Number(process.env.IOT_OFFLINE_THRESHOLD_MINUTES || 30);
  if (lastSeen && Date.now() - lastSeen > thresholdMins * 60 * 1000 * 3) {
    found.push(await createAnomaly(device.id, reading.id, "offline_gap", "high", "Gap in telemetry exceeds expected interval * 3"));
  }

  if (isReplay) {
    found.push(await createAnomaly(device.id, reading.id, "batch_replay", "critical", "Batch contains duplicate timestamp for device"));
  }

  return found;
}

async function computeTrustScore(projectId: string) {
  const devices = await db.select().from(iotDevices).where(eq(iotDevices.projectId, projectId));
  const readings = await db.select().from(iotReadings).where(eq(iotReadings.projectId, projectId));
  const anomalies = await db.select().from(anomalyEvents).leftJoin(iotReadings, eq(anomalyEvents.readingId, iotReadings.id)).where(eq(iotReadings.projectId, projectId));
  const sats = await db.select().from(satelliteReadings).where(eq(satelliteReadings.projectId, projectId));
  const validSig = readings.length ? readings.filter((r) => r.signatureValid).length / readings.length : 0;
  const coverage = readings.length ? Math.min(1, readings.length / (devices.length * 24 * 30 || 1)) : 0;
  const anomalyRate = readings.length ? Math.max(0, 1 - anomalies.length / readings.length) : 1;
  const deviceHealth = devices.length ? devices.filter((d) => d.status === "active").length / devices.length : 0;
  const satelliteValidation = sats.length ? 0.8 : 0.6;
  const trustScore = (validSig * 30 + coverage * 25 + anomalyRate * 20 + deviceHealth * 15 + satelliteValidation * 10);
  const components = { signatureValidity: validSig * 100, dataCoverage: coverage * 100, anomalyRate: anomalyRate * 100, deviceHealth: deviceHealth * 100, satelliteValidation: satelliteValidation * 100 };
  const grade = gradeFor(trustScore);
  const recommendation = trustScore >= 90 ? "Strong telemetry trust posture." : "Improve signature validity, coverage, and device uptime.";

  const [saved] = await db.insert(iotTrustScores).values({ projectId, trustScore, grade, components, calculatedAt: new Date() }).returning();
  return { ...saved, recommendation };
}

export function registerIotRoutes(app: Express): void {
  ensureMqttBridge();
  const router = Router();

  router.post("/devices/register", async (req, res) => {
    try {
      const { deviceId, deviceType, projectId, publicKey, location, firmwareVersion } = req.body || {};
      if (!deviceId || !deviceType || !projectId || !publicKey) return res.status(400).json({ error: "Missing required fields" });
      const apiSecret = randomBytes(24).toString("hex");
      const apiSecretHash = createHash("sha256").update(apiSecret).digest("hex");
      const [device] = await db.insert(iotDevices).values({ deviceId, deviceType, projectId, publicKey, location: location || {}, firmwareVersion: firmwareVersion || null, status: "offline", apiSecretHash }).returning();
      await addAuditEntry({ type: "device_registered", deviceId: device.id, deviceType, projectId });
      return res.status(201).json({ deviceUuid: device.id, apiSecret });
    } catch (e: any) {
      return res.status(500).json({ error: e.message || "Failed to register device" });
    }
  });

  router.get("/devices", async (_req, res) => {
    const devices = await db.select().from(iotDevices).orderBy(desc(iotDevices.registeredAt));
    res.json(devices);
  });

  router.get("/devices/:id", async (req, res) => {
    const id = String(req.params.id);
    const [device] = await db.select().from(iotDevices).where(eq(iotDevices.id, id));
    if (!device) return res.status(404).json({ error: "Device not found" });
    const readings = await db.select().from(iotReadings).where(eq(iotReadings.deviceId, id)).orderBy(desc(iotReadings.receivedAt)).limit(500);
    res.json({ ...device, readings });
  });

  router.post("/devices/:id/calibrate", async (req, res) => {
    const id = String(req.params.id);
    const calibrationData = req.body?.calibrationData || {};
    const [updated] = await db.update(iotDevices).set({ calibrationData }).where(eq(iotDevices.id, id)).returning();
    if (!updated) return res.status(404).json({ error: "Device not found" });
    await addAuditEntry({ type: "device_calibrated", deviceId: id, deviceType: updated.deviceType, projectId: updated.projectId });
    res.json(updated);
  });

  router.delete("/devices/:id/decommission", async (req, res) => {
    const id = String(req.params.id);
    const [updated] = await db.update(iotDevices).set({ status: "decommissioned" }).where(eq(iotDevices.id, id)).returning();
    if (!updated) return res.status(404).json({ error: "Device not found" });
    await addAuditEntry({ type: "device_decommissioned", deviceId: id, deviceType: updated.deviceType, projectId: updated.projectId });
    res.json({ success: true, device: updated });
  });

  async function authDevice(req: any) {
    const auth = String(req.headers.authorization || "");
    if (!auth.startsWith("Bearer ")) return { error: "Missing bearer token" } as any;
    const token = auth.slice(7);
    const [deviceIdentifier, apiSecret] = token.split(":");
    if (!deviceIdentifier || !apiSecret) return { error: "Malformed token" } as any;
    const [device] = await db.select().from(iotDevices).where(eq(iotDevices.deviceId, deviceIdentifier));
    if (!device || !device.apiSecretHash) return { error: "Unknown device" } as any;
    const hash = createHash("sha256").update(apiSecret).digest("hex");
    if (hash !== device.apiSecretHash) return { error: "Invalid credentials" } as any;
    return { device };
  }

  router.post("/readings", async (req, res) => {
    const auth = await authDevice(req);
    if (auth.error) return res.status(401).json({ error: auth.error });
    const device = auth.device;
    const payload = req.body || {};
    const signatureValid = verifyReadingSignature(device.publicKey, payload.rawPayload ?? payload, payload.deviceSignature);
    const timestamp = asDate(payload.timestamp, new Date())!;
    const readingData = {
      deviceId: device.id,
      projectId: device.projectId,
      timestamp,
      readingType: payload.readingType,
      value: Number(payload.value),
      unit: payload.unit || "",
      rawPayload: payload.rawPayload || payload,
      deviceSignature: payload.deviceSignature || null,
      signatureValid,
      anomalyFlag: !signatureValid,
      anomalyReason: !signatureValid ? "signature_invalid" : null,
      receivedAt: new Date(),
    };
    const [reading] = await db.insert(iotReadings).values(readingData as any).returning();
    const audit = await addAuditEntry({ type: "iot_reading", deviceId: device.id, deviceType: device.deviceType, projectId: device.projectId, readingType: reading.readingType, value: reading.value, unit: reading.unit, deviceSignature: reading.deviceSignature, signatureValid, anomalyFlag: reading.anomalyFlag });
    await db.update(iotReadings).set({ auditBlockId: audit.id }).where(eq(iotReadings.id, reading.id));
    const anomalies = await detectAnomalies({ device, reading: { ...reading, receivedAt: new Date(), timestamp }, signatureValid });
    await db.update(iotDevices).set({ lastSeenAt: new Date(), status: device.status === "decommissioned" ? "decommissioned" : "active" }).where(eq(iotDevices.id, device.id));
    ioNamespace?.emit("reading", { ...reading, auditBlockId: audit.id, anomalyFlag: anomalies.length > 0 });
    return res.status(201).json({ readingId: reading.id, auditBlockId: audit.id, signatureValid, anomalyFlag: anomalies.length > 0 });
  });

  router.post("/readings/batch", async (req, res) => {
    const auth = await authDevice(req);
    if (auth.error) return res.status(401).json({ error: auth.error });
    const device = auth.device;
    const readings = Array.isArray(req.body?.readings) ? req.body.readings : [];
    const maxBatch = Number(process.env.IOT_READING_MAX_BATCH || 1000);
    if (readings.length > maxBatch) return res.status(400).json({ error: `Batch exceeds ${maxBatch}` });
    let accepted = 0;
    let rejected = 0;
    const auditBlocks: number[] = [];
    for (const r of readings) {
      try {
        const existing = await db.select({ id: iotReadings.id }).from(iotReadings).where(and(eq(iotReadings.deviceId, device.id), eq(iotReadings.timestamp, asDate(r.timestamp, new Date())!))).limit(1);
        const isReplay = existing.length > 0;
        const signatureValid = verifyReadingSignature(device.publicKey, r.rawPayload ?? r, r.deviceSignature);
        const [reading] = await db.insert(iotReadings).values({
          deviceId: device.id,
          projectId: device.projectId,
          timestamp: asDate(r.timestamp, new Date())!,
          readingType: r.readingType,
          value: Number(r.value),
          unit: r.unit || "",
          rawPayload: r.rawPayload || r,
          deviceSignature: r.deviceSignature || null,
          signatureValid,
          anomalyFlag: !signatureValid || isReplay,
          anomalyReason: !signatureValid ? "signature_invalid" : isReplay ? "batch_replay" : null,
        } as any).returning();
        const audit = await addAuditEntry({ type: "iot_reading", deviceId: device.id, deviceType: device.deviceType, projectId: device.projectId, readingType: reading.readingType, value: reading.value, unit: reading.unit, deviceSignature: reading.deviceSignature, signatureValid, anomalyFlag: reading.anomalyFlag });
        auditBlocks.push(audit.id);
        await db.update(iotReadings).set({ auditBlockId: audit.id }).where(eq(iotReadings.id, reading.id));
        await detectAnomalies({ device, reading, signatureValid, isReplay });
        accepted += 1;
      } catch {
        rejected += 1;
      }
    }
    await db.update(iotDevices).set({ lastSeenAt: new Date(), status: "active" }).where(eq(iotDevices.id, device.id));
    res.json({ accepted, rejected, auditBlocks });
  });

  router.get("/readings/:deviceId", async (req, res) => {
    const [device] = await db.select().from(iotDevices).where(eq(iotDevices.deviceId, String(req.params.deviceId)));
    if (!device) return res.status(404).json({ error: "Device not found" });
    const limit = Math.min(1000, Number(req.query.limit || 100));
    const from = asDate(String(req.query.from || ""));
    const to = asDate(String(req.query.to || ""));
    let where = and(eq(iotReadings.deviceId, device.id));
    if (req.query.readingType) where = and(where, eq(iotReadings.readingType, String(req.query.readingType))) as any;
    if (from) where = and(where, gte(iotReadings.timestamp, from)) as any;
    if (to) where = and(where, lte(iotReadings.timestamp, to)) as any;
    const rows = await db.select().from(iotReadings).where(where as any).orderBy(desc(iotReadings.timestamp)).limit(limit);
    res.json({ deviceId: device.id, readings: rows });
  });

  router.get("/readings/:deviceId/latest", async (req, res) => {
    const [device] = await db.select().from(iotDevices).where(eq(iotDevices.deviceId, String(req.params.deviceId)));
    if (!device) return res.status(404).json({ error: "Device not found" });
    const rows = await db.select().from(iotReadings).where(eq(iotReadings.deviceId, device.id)).orderBy(desc(iotReadings.timestamp)).limit(500);
    const latest: Record<string, any> = {};
    for (const r of rows) if (!latest[r.readingType]) latest[r.readingType] = r;
    res.json(latest);
  });

  app.post("/api/mrv/generate", async (req, res) => {
    const { projectId, from, to, methodology } = req.body || {};
    if (!projectId || !from || !to || !methodology) return res.status(400).json({ error: "projectId, from, to, methodology required" });
    const fromDate = asDate(from)!;
    const toDate = asDate(to)!;
    const readings = await db.select().from(iotReadings).where(and(eq(iotReadings.projectId, projectId), gte(iotReadings.timestamp, fromDate), lte(iotReadings.timestamp, toDate)));
    const valid = readings.filter((r) => r.signatureValid);
    const totals = {
      co2: readings.filter((r) => r.readingType === "co2_sequestration_kg").reduce((a, r) => a + Number(r.value), 0) / 1000,
      methane: readings.filter((r) => r.readingType === "methane_flow_m3").reduce((a, r) => a + Number(r.value), 0),
      energy: readings.filter((r) => r.readingType === "energy_kwh").reduce((a, r) => a + Number(r.value), 0),
    };
    const periodHours = Math.max(1, (toDate.getTime() - fromDate.getTime()) / 3600000);
    const coverageHours = new Set(readings.map((r) => `${new Date(r.timestamp).toISOString().slice(0, 13)}`)).size;
    const dataQualityScore = (readings.length ? valid.length / readings.length : 0) * (coverageHours / periodHours) * 100;
    const anomaliesDetected = readings.filter((r) => r.anomalyFlag).length;
    const creditsCalculated = computeMethodologyCredits(methodology, totals);
    const auditBlocks = readings.map((r) => r.auditBlockId).filter(Boolean) as number[];
    const [report] = await db.insert(mrvReports).values({
      projectId,
      reportingPeriod: { from, to },
      readingsCount: readings.length,
      totalCO2Sequestered: totals.co2,
      totalMethaneFlowed: totals.methane,
      totalEnergyGenerated: totals.energy,
      creditsCalculated,
      calculationMethodology: methodology,
      dataQualityScore,
      anomaliesDetected,
      auditBlockIds: auditBlocks,
      status: "submitted",
    } as any).returning();
    const audit = await addAuditEntry({ type: "mrv_report", projectId, reportId: report.id, periodFrom: from, periodTo: to, creditsCalculated, methodology, dataQualityScore, readingCount: readings.length, anomalyCount: anomaliesDetected });
    res.json({ ...report, auditBlockId: audit.id });
  });

  app.get("/api/mrv/reports/:projectId", async (req, res) => {
    const rows = await db.select().from(mrvReports).where(eq(mrvReports.projectId, String(req.params.projectId))).orderBy(desc(mrvReports.createdAt));
    res.json(rows);
  });

  app.get("/api/mrv/reports/:reportId/verify", async (req, res) => {
    const reportId = String(req.params.reportId);
    const [report] = await db.select().from(mrvReports).where(eq(mrvReports.id, reportId));
    if (!report) return res.status(404).json({ error: "Report not found" });
    const verifier = String(req.headers["x-admin-user"] || "verifier");
    const [updated] = await db.update(mrvReports).set({ status: "verified", verifiedBy: verifier, verifiedAt: new Date(), creditsIssued: report.creditsCalculated }).where(eq(mrvReports.id, reportId)).returning();
    await db.insert(exchangeCreditListings).values({
      orgName: "MRV Issuance",
      contactName: verifier,
      email: "mrv@uaiu.live",
      standard: String(report.calculationMethodology),
      creditType: "mrv_issued",
      volumeTonnes: String(report.creditsCalculated),
      askingPricePerTonne: "0",
      projectOrigin: report.projectId,
      status: "approved",
    } as any);
    await addAuditEntry({ type: "credits_issued", reportId, projectId: report.projectId, creditsIssued: report.creditsCalculated });
    res.json(updated);
  });

  app.get("/api/mrv/reports/:reportId/pdf", async (req, res) => {
    const [report] = await db.select().from(mrvReports).where(eq(mrvReports.id, String(req.params.reportId)));
    if (!report) return res.status(404).json({ error: "Report not found" });
    const readings = await db.select().from(iotReadings).where(eq(iotReadings.projectId, report.projectId));
    const filename = `mrv-report-${report.id}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=\"${filename}\"`);
    const doc = new PDFDocument({ margin: 36 });
    doc.pipe(res);
    doc.fontSize(18).text("UAIU.LIVE/X Automated MRV Report");
    doc.moveDown(0.5).fontSize(11);
    doc.text(`Project: ${report.projectId}`);
    doc.text(`Period: ${JSON.stringify(report.reportingPeriod)}`);
    doc.text(`Methodology: ${report.calculationMethodology}`);
    doc.text(`Credits Calculated: ${report.creditsCalculated.toFixed(4)} tCO2e`);
    doc.text(`Data Quality Score: ${report.dataQualityScore.toFixed(2)}`);
    doc.text(`Anomalies: ${report.anomaliesDetected}`);
    doc.moveDown();
    doc.text("Reading summary by type:");
    const byType = readings.reduce((acc: Record<string, number>, r) => { acc[r.readingType] = (acc[r.readingType] || 0) + 1; return acc; }, {});
    Object.entries(byType).forEach(([k, v]) => doc.text(`- ${k}: ${v}`));
    const blocks = (report.auditBlockIds as any[]) || [];
    doc.moveDown().text(`Audit chain reference: first=${blocks[0] || "n/a"} last=${blocks[blocks.length - 1] || "n/a"}`);
    doc.moveDown().text("Verifier signature block: ______________________");
    doc.text("Verification statement: IoT-derived MRV evidence has been assessed for issuance readiness.");
    doc.end();
  });

  app.get("/api/anomalies", async (req, res) => {
    const limit = Math.min(1000, Number(req.query.limit || 200));
    const filters: any[] = [];
    if (req.query.deviceId) filters.push(eq(anomalyEvents.deviceId, String(req.query.deviceId)));
    if (typeof req.query.resolved !== "undefined") filters.push(eq(anomalyEvents.resolved, String(req.query.resolved) === "true"));
    if (req.query.severity) filters.push(eq(anomalyEvents.severity, String(req.query.severity)));
    const where = filters.length ? and(...filters) : undefined;
    const rows = await db.select().from(anomalyEvents).where(where as any).orderBy(desc(anomalyEvents.detectedAt)).limit(limit);
    res.json(rows);
  });

  app.post("/api/anomalies/:id/resolve", async (req, res) => {
    const [updated] = await db.update(anomalyEvents).set({ resolved: true, resolvedAt: new Date(), resolvedBy: String(req.headers["x-admin-user"] || "admin"), resolution: String(req.body?.resolution || "resolved") }).where(eq(anomalyEvents.id, String(req.params.id))).returning();
    if (!updated) return res.status(404).json({ error: "Anomaly not found" });
    await addAuditEntry({ type: "anomaly_resolved", anomalyId: updated.id, resolvedBy: updated.resolvedBy, resolution: updated.resolution });
    res.json(updated);
  });

  app.get("/api/anomalies/summary", async (_req, res) => {
    const rows = await db.select().from(anomalyEvents);
    const bySeverity = rows.reduce((acc: Record<string, number>, r) => { acc[r.severity] = (acc[r.severity] || 0) + 1; return acc; }, {});
    const byType = rows.reduce((acc: Record<string, number>, r) => { acc[r.anomalyType] = (acc[r.anomalyType] || 0) + 1; return acc; }, {});
    res.json({ bySeverity, byType, unresolved: rows.filter((r) => !r.resolved).length });
  });

  app.get("/api/projects/monitor", async (_req, res) => {
    const devices = await db.select().from(iotDevices);
    const readings = await db.select().from(iotReadings).orderBy(desc(iotReadings.timestamp));
    const anomalies = await db.select().from(anomalyEvents).where(eq(anomalyEvents.resolved, false));
    const reports = await db.select().from(mrvReports).orderBy(desc(mrvReports.createdAt));
    const byProject: Record<string, any> = {};
    for (const d of devices) {
      if (!byProject[d.projectId]) byProject[d.projectId] = { projectId: d.projectId, devices: [], latestReadings: {}, anomalyCounts: { low: 0, medium: 0, high: 0, critical: 0 }, creditsGenerated: 0, mrv: null };
      byProject[d.projectId].devices.push(d);
    }
    for (const r of readings) {
      if (!byProject[r.projectId]) continue;
      const k = `${r.deviceId}:${r.readingType}`;
      if (!byProject[r.projectId].latestReadings[k]) byProject[r.projectId].latestReadings[k] = r;
    }
    for (const a of anomalies) {
      const [dev] = devices.filter((d) => d.id === a.deviceId);
      if (dev && byProject[dev.projectId]) byProject[dev.projectId].anomalyCounts[a.severity] = (byProject[dev.projectId].anomalyCounts[a.severity] || 0) + 1;
    }
    for (const r of reports) {
      if (byProject[r.projectId]) {
        byProject[r.projectId].creditsGenerated += Number(r.creditsIssued || 0);
        if (!byProject[r.projectId].mrv) byProject[r.projectId].mrv = r;
      }
    }
    const all = Object.values(byProject);
    const metrics = {
      totalActiveProjects: all.length,
      totalActiveDevices: devices.filter((d) => d.status === "active").length,
      totalReadingsIngested: readings.length,
      totalCO2eMonitored: reports.reduce((a, r) => a + Number(r.creditsCalculated), 0),
      platformDataQualityScore: reports.length ? reports.reduce((a, r) => a + Number(r.dataQualityScore), 0) / reports.length : 0,
    };
    res.json({ metrics, projects: all });
  });

  app.get("/api/iot/firmware/latest", async (_req, res) => {
    const [latest] = await db.select().from(firmwareVersions).orderBy(desc(firmwareVersions.releasedAt)).limit(1);
    if (!latest) return res.status(404).json({ error: "No firmware versions configured" });
    res.json(latest);
  });

  app.post("/api/iot/firmware/report", async (req, res) => {
    const { deviceId, firmwareVersion } = req.body || {};
    const [device] = await db.select().from(iotDevices).where(eq(iotDevices.deviceId, String(deviceId)));
    if (!device) return res.status(404).json({ error: "Device not found" });
    await db.update(iotDevices).set({ firmwareVersion: String(firmwareVersion) }).where(eq(iotDevices.id, device.id));
    const mandatory = process.env.FIRMWARE_MANDATORY_VERSION || "1.0.0";
    if (String(firmwareVersion) < mandatory) {
      await createAnomaly(device.id, null, "firmware_outdated", "high", `Firmware ${firmwareVersion} is below mandatory ${mandatory}`);
    }
    await addAuditEntry({ type: "firmware_updated", deviceId: device.id, deviceType: device.deviceType, projectId: device.projectId });
    res.json({ success: true });
  });

  app.get("/api/iot/security/report", async (_req, res) => {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const invalidSignatures = await db.select().from(iotReadings).where(and(eq(iotReadings.signatureValid, false), gte(iotReadings.receivedAt, since)));
    const replayAttempts = await db.select().from(anomalyEvents).where(eq(anomalyEvents.anomalyType, "batch_replay"));
    const drift = await db.select().from(anomalyEvents).where(eq(anomalyEvents.anomalyType, "timestamp_drift"));
    const devices = await db.select().from(iotDevices);
    const outdatedFirmware = devices.filter((d) => (d.firmwareVersion || "0.0.0") < (process.env.FIRMWARE_MANDATORY_VERSION || "1.0.0"));
    const offline = devices.filter((d) => !d.lastSeenAt || Date.now() - new Date(d.lastSeenAt).getTime() > 24 * 60 * 60 * 1000);
    res.json({ invalidSignaturesLast24h: invalidSignatures, outdatedFirmware, timestampDriftEvents: drift, replayAttackAttempts: replayAttempts, offlineOver24h: offline });
  });

  app.post("/api/iot/satellite/ingest", async (req, res) => {
    const { source, projectId, timestamp, dataType, payload } = req.body || {};
    if (!source || !projectId || !timestamp || !dataType) return res.status(400).json({ error: "Missing required fields" });
    const [reading] = await db.insert(satelliteReadings).values({ source, projectId, timestamp: asDate(timestamp, new Date())!, dataType, payload: payload || {} } as any).returning();
    const audit = await addAuditEntry({ type: "satellite_reading", source, projectId, dataType, payload: payload || {} });
    await db.update(satelliteReadings).set({ auditBlockId: audit.id }).where(eq(satelliteReadings.id, reading.id));
    if (dataType === "land_use_change" || dataType === "fire_alert") {
      const projDevices = await db.select().from(iotDevices).where(eq(iotDevices.projectId, projectId));
      for (const d of projDevices) {
        await createAnomaly(d.id, null, "possible_deforestation_event", "critical", `Satellite ${dataType} signal detected`);
      }
    }
    res.status(201).json({ ...reading, auditBlockId: audit.id });
  });

  app.get("/api/iot/satellite/:projectId", async (req, res) => {
    const rows = await db.select().from(satelliteReadings).where(eq(satelliteReadings.projectId, String(req.params.projectId))).orderBy(asc(satelliteReadings.timestamp));
    res.json(rows);
  });

  app.get("/api/iot/trust-score/:projectId", async (req, res) => {
    const trust = await computeTrustScore(String(req.params.projectId));
    res.json({
      projectId: trust.projectId,
      trustScore: Number(trust.trustScore),
      grade: trust.grade,
      components: trust.components,
      recommendation: (trust as any).recommendation,
      calculatedAt: trust.calculatedAt,
    });
  });



  router.get("/mqtt/connection-info", async (req, res) => {
    const auth = await authDevice(req);
    if (auth.error) return res.status(401).json({ error: auth.error });
    const device = auth.device;
    return res.json({
      brokerUrl: process.env.MQTT_BROKER_URL || "",
      port: Number(process.env.MQTT_PORT || 1883),
      tlsPort: Number(process.env.MQTT_TLS_PORT || 8883),
      topicPrefix: MQTT_TOPIC_PREFIX,
      username: process.env.MQTT_USERNAME || device.deviceId,
      password: "device-managed",
      topics: {
        readings: `${MQTT_TOPIC_PREFIX}/devices/${device.deviceId}/readings`,
        status: `${MQTT_TOPIC_PREFIX}/devices/${device.deviceId}/status`,
        commands: `${MQTT_TOPIC_PREFIX}/devices/${device.deviceId}/commands`,
        ack: `${MQTT_TOPIC_PREFIX}/devices/${device.deviceId}/ack`,
      },
    });
  });

  async function handleAdapterIngest(source: string, payload: any, parser: (payload: any) => StandardReading[]) {
    const raw = await logRawPayload(source, payload, payload?.deviceId || payload?.serial || payload?.devEUI || payload?.device);
    const parsed = parser(payload);
    if (!parsed.length) return { error: "invalid_payload", reason: `No ${source} readings parsed` };
    const readingIds: string[] = [];
    const auditBlockIds: number[] = [];
    for (const reading of parsed) {
      const result: any = await ingestStandardReading(reading, source);
      if (result.error) return result;
      readingIds.push(result.readingId);
      auditBlockIds.push(result.auditBlockId);
    }
    await markPayloadProcessed(raw.id, readingIds);
    return { accepted: readingIds.length, readingIds, auditBlockIds };
  }

  function parseCampbell(payload: any): StandardReading[] {
    if (Array.isArray(payload?.readings)) return payload.readings.map((r: any) => normalizeReading(r)).filter(Boolean) as StandardReading[];
    if (typeof payload?.toa5 === "string") {
      const lines = payload.toa5.split("\\n").map((l: string) => l.trim()).filter(Boolean);
      const dataLine = lines[lines.length - 1]?.split(",") || [];
      const deviceId = String(payload.deviceId || dataLine[0] || "");
      const timestamp = String(payload.timestamp || dataLine[1] || new Date().toISOString());
      return [normalizeReading({ deviceId, timestamp, readingType: "temperature_c", value: Number(dataLine[2] || 0), unit: "°C", rawPayload: payload })!].filter(Boolean);
    }
    return [];
  }

  function parseHobolink(payload: any): StandardReading[] {
    const serial = String(payload?.logger_sn || payload?.serial || payload?.deviceId || "");
    const ts = String(payload?.timestamp || new Date().toISOString());
    const sensors = Array.isArray(payload?.measurements) ? payload.measurements : [];
    return sensors.map((m: any) => normalizeReading({ deviceId: serial, timestamp: ts, readingType: String(m.type || "sensor"), value: Number(m.value), unit: String(m.unit || ""), rawPayload: payload })).filter(Boolean) as StandardReading[];
  }

  function parseParticle(payload: any): StandardReading[] {
    const data = payload?.data ? JSON.parse(Buffer.from(String(payload.data), "base64").toString("utf8")) : payload?.eventData || {};
    const mapped = normalizeReading({
      deviceId: payload?.coreid || payload?.deviceId,
      timestamp: payload?.published_at || new Date().toISOString(),
      readingType: data.readingType || payload?.event || "particle_event",
      value: Number(data.value ?? payload?.value ?? 0),
      unit: data.unit || "",
      rawPayload: payload,
    });
    return mapped ? [mapped] : [];
  }

  function parseLorawan(payload: any): StandardReading[] {
    const deviceId = String(payload?.deviceInfo?.devEui || payload?.end_device_ids?.device_id || payload?.devEUI || "");
    const b64 = String(payload?.data || payload?.frm_payload || payload?.uplink_message?.frm_payload || "");
    const ts = String(payload?.time || payload?.received_at || new Date().toISOString());
    return decodeLorawanPayload(b64).map((d) => normalizeReading({ deviceId, timestamp: ts, readingType: d.readingType, value: d.value, unit: d.unit, rawPayload: payload })).filter(Boolean) as StandardReading[];
  }

  function parseSensecap(payload: any): StandardReading[] {
    const deviceId = String(payload?.deviceEui || payload?.deviceId || "");
    const ts = String(payload?.timestamp || new Date().toISOString());
    const records = Array.isArray(payload?.measurements) ? payload.measurements : [];
    return records.map((r: any) => normalizeReading({ deviceId, timestamp: ts, readingType: String(r.type || r.name || "sensecap_measurement"), value: Number(r.value), unit: String(r.unit || ""), rawPayload: payload })).filter(Boolean) as StandardReading[];
  }

  function parseBlues(payload: any): StandardReading[] {
    const body = payload?.body || payload || {};
    const mapped = normalizeReading({
      deviceId: body.device || body.deviceId || payload?.device,
      timestamp: body.when ? new Date(Number(body.when) * 1000).toISOString() : new Date().toISOString(),
      readingType: body.readingType || body.type || "blues_event",
      value: Number(body.value || 0),
      unit: body.unit || "",
      rawPayload: payload,
    });
    return mapped ? [mapped] : [];
  }

  router.post("/ingest/campbell", async (req, res) => {
    const result: any = await handleAdapterIngest("campbell", req.body || {}, parseCampbell);
    if (result.error) return res.status(400).json(result);
    return res.status(201).json(result);
  });

  router.post("/ingest/hobolink", async (req, res) => {
    const result: any = await handleAdapterIngest("hobolink", req.body || {}, parseHobolink);
    if (result.error) return res.status(400).json(result);
    return res.status(201).json(result);
  });

  router.post("/ingest/particle", async (req, res) => {
    const sharedSecret = process.env.PARTICLE_WEBHOOK_SECRET || "";
    const headerSig = String(req.headers["x-particle-signature"] || "");
    if (sharedSecret) {
      const expected = createHmac("sha256", sharedSecret).update(JSON.stringify(req.body || {})).digest("hex");
      if (expected !== headerSig) return res.status(401).json({ error: "invalid_signature", reason: "Particle signature check failed" });
    }
    const result: any = await handleAdapterIngest("particle", req.body || {}, parseParticle);
    if (result.error) return res.status(400).json(result);
    return res.status(201).json(result);
  });

  router.post("/ingest/lorawan", async (req, res) => {
    const result: any = await handleAdapterIngest("lorawan", req.body || {}, parseLorawan);
    if (result.error) return res.status(400).json(result);
    return res.status(201).json(result);
  });

  router.post("/ingest/sensecap", async (req, res) => {
    const result: any = await handleAdapterIngest("sensecap", req.body || {}, parseSensecap);
    if (result.error) return res.status(400).json(result);
    return res.status(201).json(result);
  });

  router.post("/ingest/blues", async (req, res) => {
    const result: any = await handleAdapterIngest("blues", req.body || {}, parseBlues);
    if (result.error) return res.status(400).json(result);
    return res.status(201).json(result);
  });

  app.post("/api/devices/certification/apply", async (req, res) => {
    const payload = req.body || {};
    if (!payload.manufacturer || !payload.deviceModel) return res.status(400).json({ error: "manufacturer and deviceModel required" });
    const initial = {
      connectionAuthentication: "pending",
      readingSubmissionAccuracy: "pending",
      signatureVerification: "pending",
      offlineBufferingAndSync: "pending",
      timestampAccuracy: "pending",
      batchUploadPerformance: "pending",
      errorRecovery: "pending",
    };
    const [created] = await db.insert(deviceCertifications).values({
      manufacturer: String(payload.manufacturer),
      deviceModel: String(payload.deviceModel),
      firmwareVersion: payload.firmwareVersion ? String(payload.firmwareVersion) : null,
      testResults: initial,
      certificationLevel: "compatible",
      badgeUrl: null,
    } as any).returning();
    return res.status(201).json(created);
  });

  app.get("/api/devices/certification/status/:id", async (req, res) => {
    const [row] = await db.select().from(deviceCertifications).where(eq(deviceCertifications.id, String(req.params.id)));
    if (!row) return res.status(404).json({ error: "Not found" });
    return res.json(row);
  });

  app.get("/api/devices/certifications", async (_req, res) => {
    const rows = await db.select().from(deviceCertifications).orderBy(desc(deviceCertifications.createdAt));
    return res.json(rows);
  });

    app.use("/api/iot", router);
}
