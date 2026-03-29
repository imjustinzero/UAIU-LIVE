import type { Express } from "express";
import { asc, desc, eq, gte, lte } from "drizzle-orm";
import { createHash } from "crypto";
import { db } from "./db";
import {
  anomalyEvents,
  auditChainEntries,
  digitalTwinSnapshots,
  exchangeTrades,
  intelligenceEvents,
  iotDevices,
  iotReadings,
  iotTrustScores,
  mrvReports,
  satelliteReadings,
} from "@shared/schema";
import { getHashAlgorithm } from "./hash-agility";

function trendFor(values: number[], tolerance = 0.02): "increasing" | "stable" | "declining" {
  if (values.length < 2) return "stable";
  const first = values[0];
  const last = values[values.length - 1];
  if (first === 0) return "stable";
  const delta = (last - first) / Math.abs(first);
  if (delta > tolerance) return "increasing";
  if (delta < -tolerance) return "declining";
  return "stable";
}

async function addAuditEntry(transactionData: Record<string, any>) {
  const lastBlock = await db.query.auditChainEntries.findFirst({ orderBy: (t, { desc }) => [desc(t.blockNumber)] });
  const blockNumber = (lastBlock?.blockNumber ?? 0) + 1;
  const prevHash = lastBlock?.hash ?? "0000000000000000";
  const algorithm = getHashAlgorithm();
  const timestamp = new Date();
  const hash = createHash(algorithm)
    .update(JSON.stringify({ blockNumber, timestamp: timestamp.toISOString(), algorithm, transactionData, prevHash }))
    .digest("hex");
  const [created] = await db.insert(auditChainEntries).values({ blockNumber, timestamp, algorithm, transactionData, prevHash, hash }).returning();
  return created;
}

async function fetchOpenMeteo(lat: number, lng: number) {
  const baseUrl = process.env.OPEN_METEO_BASE_URL || "https://api.open-meteo.com/v1";
  const url = `${baseUrl}/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,precipitation,wind_speed_10m,relative_humidity_2m,surface_pressure&daily=precipitation_sum,et0_fao_evapotranspiration&timezone=UTC`;
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`open-meteo ${r.status}`);
    return await r.json();
  } catch {
    return null;
  }
}

function estimateFireRisk(temp: number, wind: number, humidity: number, precip: number): "low" | "medium" | "high" | "critical" {
  const score = temp * 0.5 + wind * 1.2 + (100 - humidity) * 0.5 - precip * 2;
  if (score >= 85) return "critical";
  if (score >= 65) return "high";
  if (score >= 40) return "medium";
  return "low";
}

export async function computeDigitalTwin(projectId: string) {
  const [devices, readings, sats, trust, mrv, anomalies, trades] = await Promise.all([
    db.select().from(iotDevices).where(eq(iotDevices.projectId, projectId)),
    db.select().from(iotReadings).where(eq(iotReadings.projectId, projectId)).orderBy(asc(iotReadings.receivedAt)).limit(1000),
    db.select().from(satelliteReadings).where(eq(satelliteReadings.projectId, projectId)).orderBy(desc(satelliteReadings.timestamp)).limit(30),
    db.select().from(iotTrustScores).where(eq(iotTrustScores.projectId, projectId)).orderBy(desc(iotTrustScores.calculatedAt)).limit(1),
    db.select().from(mrvReports).where(eq(mrvReports.projectId, projectId)).orderBy(desc(mrvReports.createdAt)).limit(1),
    db.select().from(anomalyEvents).orderBy(desc(anomalyEvents.detectedAt)).limit(500),
    db.select().from(exchangeTrades).orderBy(desc(exchangeTrades.createdAt)).limit(1000),
  ]);

  const projectDevices = devices;
  const latestByType = new Map<string, number>();
  const latestTimestamp = readings[readings.length - 1]?.receivedAt || new Date();
  for (let i = readings.length - 1; i >= 0; i--) {
    const r = readings[i];
    if (!latestByType.has(r.readingType)) latestByType.set(r.readingType, Number(r.value || 0));
  }

  const co2Values = readings.filter((r) => r.readingType.includes("co2")).map((r) => Number(r.value || 0));
  const ndviCurrent = Number((sats[0]?.payload as any)?.ndvi ?? 0.72);
  const ndviBaseline = Number((sats[sats.length - 1]?.payload as any)?.ndvi ?? 0.68);

  const boundary = {
    type: "Polygon",
    coordinates: [[[-62.3, 16.7], [-62.2, 16.7], [-62.2, 16.8], [-62.3, 16.8], [-62.3, 16.7]]],
  };
  const centroid = { lat: 16.75, lng: -62.25 };
  const weather = await fetchOpenMeteo(centroid.lat, centroid.lng);
  const currentWeather = weather?.current || {};
  const precipitation = Number(currentWeather.precipitation || 0);
  const temperature = Number(currentWeather.temperature_2m || latestByType.get("temperature_c") || 29);
  const humidity = Number(currentWeather.relative_humidity_2m || latestByType.get("humidity_pct") || 60);
  const wind = Number(currentWeather.wind_speed_10m || 4.3);
  const pressure = Number(currentWeather.surface_pressure || 1008);

  const generatedMonth = Number(mrv[0]?.creditsCalculated || 0);
  const generatedLifetime = trades.reduce((a, t) => a + Number(t.volumeTonnes || 0), 0);
  const generatedYear = generatedLifetime * 0.45;
  const currentRatePerDay = Math.max(0, (co2Values.at(-1) || 0) * 24 / 1000);

  const unresolvedAnomalies = anomalies.filter((a) => !a.resolved && projectDevices.some((d) => d.id === a.deviceId)).length;
  const dataSourcesActive = [
    projectDevices.length ? "iot" : null,
    sats.length ? "sentinel" : null,
    weather ? "open-meteo" : null,
    trades.length ? "market" : null,
    mrv.length ? "mrv" : null,
  ].filter(Boolean);
  const confidenceScore = Number(Math.min(100, (dataSourcesActive.length / 5) * 100).toFixed(2));

  const state = {
    projectId,
    timestamp: new Date().toISOString(),
    confidence: confidenceScore,
    physical: {
      boundaryPolygon: boundary,
      areaHectares: 1284,
      elevationProfile: [142, 155, 161, 149, 138],
      centroid,
    },
    atmosphere: {
      co2SequestrationRateKgPerHour: Number((co2Values.at(-1) || 0).toFixed(2)),
      co2SequestrationRateTrend: trendFor(co2Values),
      methaneFlowM3PerHour: Number((latestByType.get("methane_m3h") || 0).toFixed(2)),
      temperatureCelsius: temperature,
      humidityPercent: humidity,
      atmosphericPressureHpa: pressure,
      dataSource: projectDevices.length ? "iot" : "estimated",
    },
    vegetation: {
      ndviCurrent,
      ndviBaseline,
      ndviTrend: trendFor([ndviBaseline, ndviCurrent]) === "increasing" ? "improving" : trendFor([ndviBaseline, ndviCurrent]) === "declining" ? "declining" : "stable",
      forestCoverPercent: Number((62 + ndviCurrent * 20).toFixed(2)),
      biomassEstimateTonnes: Number((ndviCurrent * 8900).toFixed(2)),
      lastSatellitePass: sats[0]?.timestamp?.toISOString?.() || new Date().toISOString(),
      satelliteSource: sats[0]?.source || "Sentinel Hub",
    },
    weather: {
      temperatureCelsius: temperature,
      precipitationMm: precipitation,
      windSpeedMs: wind,
      droughtIndex: Number((Math.max(0, 100 - humidity + wind * 2)).toFixed(2)),
      fireRiskLevel: estimateFireRisk(temperature, wind, humidity, precipitation),
      source: "open-meteo",
    },
    devices: {
      total: projectDevices.length,
      online: projectDevices.filter((d) => d.status === "active").length,
      offline: projectDevices.filter((d) => d.status === "offline").length,
      tampered: projectDevices.filter((d) => d.status === "tampered").length,
      averageSignalStrength: Number((3.9).toFixed(2)),
      lastReadingAt: latestTimestamp.toISOString(),
    },
    credits: {
      generatedThisMonth: Number(generatedMonth.toFixed(2)),
      generatedThisYear: Number(generatedYear.toFixed(2)),
      generatedLifetime: Number(generatedLifetime.toFixed(2)),
      currentRatePerDay: Number(currentRatePerDay.toFixed(2)),
      projectedThisMonth: Number((generatedMonth + currentRatePerDay * 7).toFixed(2)),
      projectedNextMonth: Number((currentRatePerDay * 30).toFixed(2)),
      projectedNext90Days: Number((currentRatePerDay * 90).toFixed(2)),
      projectionConfidence: Number(Math.min(97, confidenceScore - 5).toFixed(2)),
    },
    compliance: {
      uvsStatus: "active",
      uvsGrade: trust[0]?.grade || "AA",
      uvsProbabilityNext90Days: Number(Math.min(99, 70 + Number(trust[0]?.trustScore || 0) * 0.3).toFixed(2)),
      iotTrustScore: Number(trust[0]?.trustScore || 0),
      mrvDataQuality: Number(mrv[0]?.dataQualityScore || 0),
      lastVerifierVisit: mrv[0]?.verifiedAt?.toISOString?.() || mrv[0]?.createdAt?.toISOString?.() || new Date().toISOString(),
      nextMrvDue: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      openAnomalies: unresolvedAnomalies,
      openInvestigations: Math.round(unresolvedAnomalies * 0.3),
    },
    market: {
      currentListingPrice: Number(trades[0]?.pricePerTonne || 22),
      ucpiComparison: 1.08,
      qualityScore: Number(Math.min(100, 50 + (trust[0]?.trustScore || 0) * 0.5).toFixed(2)),
      qualityGrade: (trust[0]?.grade || "AA"),
      buyerDemandSignal: "high",
    },
    alerts: {
      active: unresolvedAnomalies > 0 ? [{ id: "anomaly-open", type: "anomaly_spike", severity: "medium" }] : [],
      resolved24h: anomalies.filter((a) => a.resolved).slice(0, 10),
    },
  };

  const audit = await addAuditEntry({ type: "digital_twin_snapshot", projectId, confidenceScore });
  const [snapshot] = await db.insert(digitalTwinSnapshots).values({
    projectId,
    state,
    dataSourcesActive,
    confidenceScore,
    auditBlockId: audit.id,
  }).returning();

  if (confidenceScore < 60) {
    await db.insert(intelligenceEvents).values({
      projectId,
      eventType: "twin_confidence_low",
      severity: "high",
      title: "Digital Twin confidence below threshold",
      body: `Confidence score dropped to ${confidenceScore}. Missing data sources detected.`,
      dataSnapshot: state,
      actionRequired: true,
      suggestedAction: "Investigate missing IoT/satellite/weather feeds.",
      sentTo: ["supplier", "verifier"],
      auditBlockId: audit.id,
    });
  }

  return { snapshot, state, confidenceScore };
}

export async function recomputeAllProjectTwins() {
  const projects = await db.select({ projectId: iotDevices.projectId }).from(iotDevices);
  const uniqueProjectIds = Array.from(new Set(projects.map((p) => p.projectId).filter(Boolean)));
  for (const projectId of uniqueProjectIds) {
    await computeDigitalTwin(projectId);
  }
  return uniqueProjectIds.length;
}

export function registerDigitalTwinRoutes(app: Express) {
  app.post("/api/twin/:projectId/compute", async (req, res) => {
    try {
      const projectId = String(req.params.projectId);
      const result = await computeDigitalTwin(projectId);
      res.json(result.state);
    } catch (e: any) {
      res.status(500).json({ error: e.message || "Failed to compute twin" });
    }
  });

  app.get("/api/twin/:projectId/current", async (req, res) => {
    const projectId = String(req.params.projectId);
    let [latest] = await db.select().from(digitalTwinSnapshots).where(eq(digitalTwinSnapshots.projectId, projectId)).orderBy(desc(digitalTwinSnapshots.timestamp)).limit(1);
    if (!latest || Date.now() - new Date(latest.timestamp).getTime() > 15 * 60 * 1000) {
      await computeDigitalTwin(projectId);
      [latest] = await db.select().from(digitalTwinSnapshots).where(eq(digitalTwinSnapshots.projectId, projectId)).orderBy(desc(digitalTwinSnapshots.timestamp)).limit(1);
    }
    if (!latest) return res.status(404).json({ error: "Twin not available" });
    const ageSeconds = Math.round((Date.now() - new Date(latest.timestamp).getTime()) / 1000);
    res.json({ state: latest.state, ageSeconds, computedAt: latest.timestamp });
  });

  app.get("/api/twin/:projectId/history", async (req, res) => {
    const projectId = String(req.params.projectId);
    const from = req.query.from ? new Date(String(req.query.from)) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const to = req.query.to ? new Date(String(req.query.to)) : new Date();
    const rows = await db.select().from(digitalTwinSnapshots)
      .where(eq(digitalTwinSnapshots.projectId, projectId))
      .orderBy(asc(digitalTwinSnapshots.timestamp));
    const filtered = rows.filter((r) => new Date(r.timestamp) >= from && new Date(r.timestamp) <= to);
    res.json(filtered);
  });

  app.get("/api/intelligence/events", async (req, res) => {
    const projectId = String(req.query.projectId || "");
    const severity = String(req.query.severity || "");
    const eventType = String(req.query.eventType || "");
    const rows = await db.select().from(intelligenceEvents).orderBy(desc(intelligenceEvents.createdAt)).limit(500);
    const filtered = rows.filter((r) => (!projectId || r.projectId === projectId) && (!severity || r.severity === severity) && (!eventType || r.eventType === eventType));
    res.json(filtered);
  });

  app.get("/api/portfolio/twin", async (_req, res) => {
    const snapshots = await db.select().from(digitalTwinSnapshots).orderBy(desc(digitalTwinSnapshots.timestamp)).limit(500);
    const latestByProject = new Map<string, any>();
    for (const s of snapshots) if (!latestByProject.has(s.projectId)) latestByProject.set(s.projectId, s);
    const states = Array.from(latestByProject.values()).map((s: any) => s.state || {});
    const totalRate = states.reduce((a, s: any) => a + Number(s?.atmosphere?.co2SequestrationRateKgPerHour || 0), 0);
    const totalCreditsRate = states.reduce((a, s: any) => a + Number(s?.credits?.currentRatePerDay || 0), 0);
    const averageUvsProb = states.length ? states.reduce((a, s: any) => a + Number(s?.compliance?.uvsProbabilityNext90Days || 0), 0) / states.length : 0;
    const weatherExposure = states.filter((s: any) => ["high", "critical"].includes(s?.weather?.fireRiskLevel)).length;
    res.json({
      totalActiveProjects: states.length,
      aggregateCo2RateKgPerHour: Number(totalRate.toFixed(2)),
      aggregateCreditRatePerDay: Number(totalCreditsRate.toFixed(2)),
      portfolioRiskScore: Number(Math.max(0, 100 - (100 - averageUvsProb) * 0.7 - weatherExposure * 2).toFixed(2)),
      uvsCoveragePct: Number(averageUvsProb.toFixed(2)),
      weatherRiskExposureProjects: weatherExposure,
      projects: states,
    });
  });
}
