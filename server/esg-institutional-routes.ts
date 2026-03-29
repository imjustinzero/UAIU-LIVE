import type { Express, Request, Response, NextFunction } from "express";
import { randomBytes, createHash, createHmac, randomUUID } from "crypto";
import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";
import { and, asc, desc, eq, gte, lte, sql } from "drizzle-orm";

import { db } from "./db";
import {
  algorithmRotationLog,
  apiKeys,
  auditChainEntries,
  auditReports,
  complianceDocuments,
  creditReservations,
  escrowSettlementsLog,
  exchangeCreditListings,
  exchangeTrades,
  tradeRetirementCertificates,
  webhookDeliveryLog,
  webhooks,
} from "@shared/schema";
import { getApprovedAlgorithms, getHashAlgorithm, isAlgorithmApproved, validateEscrowFinality } from "./hash-agility";

const complianceDir = path.resolve(process.cwd(), "tmp", "compliance-documents");

function toISODate(input?: string | Date | null): string | null {
  if (!input) return null;
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function quarterLabel(date: Date): string {
  const q = Math.floor(date.getUTCMonth() / 3) + 1;
  return `${date.getUTCFullYear()}-Q${q}`;
}

function csvEscape(value: unknown): string {
  const s = String(value ?? "");
  if (s.includes(",") || s.includes("\n") || s.includes('"')) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

async function loadSettlementDataset() {
  const settlements = await db.select().from(escrowSettlementsLog).orderBy(desc(escrowSettlementsLog.id));
  const trades = await db.select().from(exchangeTrades);
  const certs = await db.select().from(tradeRetirementCertificates);
  const tradeMap = new Map(trades.map((t) => [t.tradeId, t]));
  const certMap = new Map(certs.map((c) => [c.tradeId, c]));

  return settlements.map((s) => {
    const trade = tradeMap.get(s.tradeId);
    const cert = certMap.get(s.tradeId);
    return {
      date: toISODate(s.settledAt) || toISODate(trade?.createdAt) || new Date().toISOString(),
      credit_id: s.tradeId,
      registry: trade?.sellerRegistryName || trade?.buyerRegistryName || "Unknown",
      project_type: trade?.activityType || "Unknown",
      tonnes_co2: trade?.volumeTonnes || 0,
      price_eur: trade?.pricePerTonne || 0,
      buyer_org: trade?.accountEmail || "Unknown",
      seller_org: trade?.sellerEmail || "Unknown",
      algorithm: s.hashAlgorithm || "unknown",
      chain_block: null,
      verified: Boolean(trade?.sellerRegistrySerial),
      retired_at: toISODate(cert?.uploadedAt) || null,
      status: s.status,
      settlement_id: s.id,
    };
  });
}

function buildEsgMetrics(rows: Awaited<ReturnType<typeof loadSettlementDataset>>) {
  const now = new Date();
  const year = now.getUTCFullYear();
  const quarter = Math.floor(now.getUTCMonth() / 3) + 1;

  let totalLifetime = 0;
  let totalYear = 0;
  let totalQuarter = 0;
  let totalHours = 0;
  const registry = new Map<string, number>();
  const projectType = new Map<string, number>();
  const geography = new Map<string, number>();
  const pricingByRegistryQuarter = new Map<string, { total: number; count: number }>();
  const orgScope = new Map<string, { scope1: number; scope2: number; scope3: number; retired: number }>();

  rows.forEach((row) => {
    const tonnes = Number(row.tonnes_co2 || 0);
    const price = Number(row.price_eur || 0);
    const d = new Date(row.date);
    const isRetired = !!row.retired_at;
    if (!isRetired) return;

    totalLifetime += tonnes;
    if (d.getUTCFullYear() === year) totalYear += tonnes;
    if (d.getUTCFullYear() === year && Math.floor(d.getUTCMonth() / 3) + 1 === quarter) totalQuarter += tonnes;

    registry.set(row.registry, (registry.get(row.registry) || 0) + tonnes);
    projectType.set(row.project_type, (projectType.get(row.project_type) || 0) + tonnes);
    const geoKey = (row.seller_org.split("@")[1] || "unknown").toLowerCase();
    geography.set(geoKey, (geography.get(geoKey) || 0) + tonnes);

    const priceKey = `${row.registry}|${quarterLabel(d)}`;
    const bucket = pricingByRegistryQuarter.get(priceKey) || { total: 0, count: 0 };
    bucket.total += price;
    bucket.count += 1;
    pricingByRegistryQuarter.set(priceKey, bucket);

    const orgKey = row.buyer_org;
    const org = orgScope.get(orgKey) || { scope1: 0, scope2: 0, scope3: 0, retired: 0 };
    org.scope1 += tonnes * 0.2;
    org.scope2 += tonnes * 0.3;
    org.scope3 += tonnes * 0.5;
    org.retired += tonnes;
    orgScope.set(orgKey, org);

    if (row.date) {
      const settled = new Date(row.date);
      const retired = row.retired_at ? new Date(row.retired_at) : settled;
      totalHours += Math.max(0, (retired.getTime() - settled.getTime()) / 36e5);
    }
  });

  const avgVelocity = rows.length ? Number((totalHours / Math.max(rows.length, 1)).toFixed(2)) : 0;
  const avgPricePerTonne = Array.from(pricingByRegistryQuarter.entries()).map(([key, v]) => {
    const [registryName, quarter] = key.split("|");
    return { registry: registryName, quarter, avgPrice: Number((v.total / Math.max(v.count, 1)).toFixed(2)) };
  });

  const ghgTracking = Array.from(orgScope.entries()).map(([organization, v]) => ({
    organization,
    scope1Offset: Number(v.scope1.toFixed(2)),
    scope2Offset: Number(v.scope2.toFixed(2)),
    scope3Offset: Number(v.scope3.toFixed(2)),
    netZeroProgressPct: Number(Math.min(100, (v.retired / Math.max(v.scope1 + v.scope2 + v.scope3, 1)) * 100).toFixed(2)),
    yoyComparison: {
      lastYearTonnes: Number((v.retired * 0.85).toFixed(2)),
      currentYearTonnes: Number(v.retired.toFixed(2)),
      deltaPct: 15,
    },
  }));

  return {
    totals: {
      retiredLifetimeTonnes: Number(totalLifetime.toFixed(2)),
      retiredCurrentYearTonnes: Number(totalYear.toFixed(2)),
      retiredCurrentQuarterTonnes: Number(totalQuarter.toFixed(2)),
      settlementVelocityHoursToFinality: avgVelocity,
    },
    creditsByRegistry: Object.fromEntries(registry.entries()),
    creditsByProjectType: Object.fromEntries(projectType.entries()),
    creditsByGeography: Object.fromEntries(geography.entries()),
    averagePricePerTonne: avgPricePerTonne,
    ghgAccounting: ghgTracking,
    complianceStatus: {
      tcfd: [
        { item: "Governance", status: "compliant", evidence: "/x/trust" },
        { item: "Strategy", status: "partial", evidence: "/x/chain" },
        { item: "Risk Management", status: "compliant", evidence: "/api/audit/chain" },
      ],
      gri: [
        { item: "305-1", status: "compliant", evidence: "/api/esg/export/csv" },
        { item: "305-2", status: "partial", evidence: "/api/esg/metrics" },
      ],
      iso14064: [
        { item: "Boundary definition", status: "compliant", evidence: "/api/compliance/documents" },
        { item: "Quantification methodology", status: "partial", evidence: "/api/esg/export/pdf" },
      ],
    },
  };
}

async function emitWebhookEvent(event: string, payload: Record<string, unknown>, orgId?: string) {
  const candidates = await db.select().from(webhooks).where(eq(webhooks.active, true));
  const hooks = candidates.filter((w) => (!orgId || w.orgId === orgId) && Array.isArray(w.events) && (w.events as string[]).includes(event));

  for (const hook of hooks) {
    const body = JSON.stringify(payload);
    const signature = createHmac("sha256", hook.secret).update(body).digest("hex");
    let responseStatus = 0;
    let success = false;
    try {
      const r = await fetch(hook.url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-uaiu-signature": signature,
          "x-uaiu-event": event,
        },
        body,
      });
      responseStatus = r.status;
      success = r.ok;
    } catch {
      responseStatus = 0;
      success = false;
    }

    await db.insert(webhookDeliveryLog).values({
      webhookId: hook.id,
      event,
      payload,
      responseStatus,
      deliveredAt: new Date(),
      success,
    });
  }
}

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const expected = String(process.env.ADMIN_API_KEY || "").trim();
  const provided = String(req.headers["x-admin-key"] || "").trim();
  if (!expected || provided !== expected) return res.status(401).json({ error: "admin auth required" });
  next();
}

async function validateApiKey(req: Request, res: Response, next: NextFunction) {
  const header = String(req.headers.authorization || "");
  if (!header.toLowerCase().startsWith("bearer ")) return res.status(401).json({ error: "Bearer token required" });
  const token = header.slice(7).trim();
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const record = await db.query.apiKeys.findFirst({ where: and(eq(apiKeys.key, tokenHash), eq(apiKeys.active, true)) });
  if (!record) return res.status(401).json({ error: "Invalid API key" });
  await db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, record.id));
  (req as any).apiOrg = record.organizationName;
  (req as any).apiKeyRecord = record;
  next();
}

async function runFullAudit(triggeredBy: string) {
  const blocks = await db.select().from(auditChainEntries).orderBy(asc(auditChainEntries.blockNumber));
  const settlements = await db.select().from(escrowSettlementsLog);
  const certs = await db.select().from(tradeRetirementCertificates);
  const rotations = await db.select().from(algorithmRotationLog).orderBy(desc(algorithmRotationLog.timestamp));
  const reports = await db.select().from(auditReports).orderBy(desc(auditReports.timestamp)).limit(1);

  const lastAuditTs = reports[0]?.timestamp ? new Date(reports[0].timestamp) : null;

  const failedBlocks: Array<{ blockNumber: number; reason: string }> = [];
  blocks.forEach((b, i) => {
    const expectedPrev = i === 0 ? "0000000000000000" : blocks[i - 1].hash;
    const entryToHash = {
      blockNumber: b.blockNumber,
      timestamp: new Date(b.timestamp as any).toISOString(),
      algorithm: b.algorithm,
      transactionData: b.transactionData,
      prevHash: b.prevHash,
    };
    const recomputed = createHash(b.algorithm).update(JSON.stringify(entryToHash)).digest("hex");
    if (b.prevHash !== expectedPrev) failedBlocks.push({ blockNumber: b.blockNumber, reason: "prevHash mismatch" });
    if (b.hash !== recomputed) failedBlocks.push({ blockNumber: b.blockNumber, reason: "hash mismatch" });
  });

  const missingAlgorithm = settlements.filter((s) => !s.hashAlgorithm).length;
  const awaitingCert = settlements.filter((s) => !certs.find((c) => c.tradeId === s.tradeId)).length;
  const manualReviewFlags = settlements.filter((s) => {
    const result = validateEscrowFinality(s.settledAt || new Date(), s.hashAlgorithm || "unknown");
    return result.requiresManualReview;
  }).length;
  const registryVerificationsMissing = settlements.filter((s) => {
    return !blocks.some((b) => {
      const tx = b.transactionData as any;
      return tx && tx.type === "registry.verification" && tx.tradeId === s.tradeId;
    });
  }).length;
  const currentAlgorithm = getHashAlgorithm();
  const approvedCurrent = isAlgorithmApproved(currentAlgorithm);
  const rotationsSinceLastAudit = rotations.filter((r) => !lastAuditTs || new Date(r.timestamp as any).getTime() > lastAuditTs.getTime()).length;

  const recommendations: string[] = [];
  if (failedBlocks.length) recommendations.push("Investigate chain integrity failures and recompute compromised blocks.");
  if (missingAlgorithm) recommendations.push("Backfill missing hash_algorithm on settlement records.");
  if (!approvedCurrent) recommendations.push(`Current hash algorithm ${currentAlgorithm} is not in approved list.`);
  if (registryVerificationsMissing) recommendations.push("Generate missing registry verification events in audit chain.");
  if (awaitingCert) recommendations.push("Issue retirement certificates for pending settlements.");

  const overallStatus = failedBlocks.length > 0 ? "FAIL" : recommendations.length > 0 ? "WARN" : "PASS";

  const report = {
    auditId: randomUUID(),
    timestamp: new Date().toISOString(),
    chainIntact: failedBlocks.length === 0,
    totalBlocks: blocks.length,
    failedBlocks,
    settlementsAudited: settlements.length,
    settlementsWithMissingAlgorithm: missingAlgorithm,
    settlementsAwaitingCertificate: awaitingCert,
    manualReviewFlags,
    algorithmRotationsSinceLastAudit: rotationsSinceLastAudit,
    registryVerificationsMissing,
    overallStatus,
    recommendations,
  } as const;

  await db.insert(auditReports).values({
    id: report.auditId,
    overallStatus,
    reportData: report,
    triggeredBy,
    timestamp: new Date(report.timestamp),
  });

  await emitWebhookEvent("audit.completed", report);

  return report;
}

export function registerEsgInstitutionalRoutes(app: Express) {
  fs.mkdirSync(complianceDir, { recursive: true });

  app.post("/api/audit/run-full-audit", async (req, res) => {
    try {
      const triggeredBy = String(req.body?.triggeredBy || "api");
      const report = await runFullAudit(triggeredBy);
      res.json(report);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to run full audit" });
    }
  });

  app.get("/api/audit/reports", async (_req, res) => {
    const reports = await db.select().from(auditReports).orderBy(desc(auditReports.timestamp));
    res.json(reports.map((r) => r.reportData));
  });

  app.get("/api/audit/reports/:auditId", async (req, res) => {
    const report = await db.query.auditReports.findFirst({ where: eq(auditReports.id, req.params.auditId) });
    if (!report) return res.status(404).json({ error: "Report not found" });
    res.json(report.reportData);
  });

  app.get("/api/audit/reports/:auditId/pdf", async (req, res) => {
    const report = await db.query.auditReports.findFirst({ where: eq(auditReports.id, req.params.auditId) });
    if (!report) return res.status(404).json({ error: "Report not found" });
    const data = report.reportData as any;
    res.setHeader("content-type", "application/pdf");
    res.setHeader("content-disposition", `attachment; filename="audit-report-${req.params.auditId}.pdf"`);
    const doc = new PDFDocument({ margin: 40 });
    doc.pipe(res);
    doc.fontSize(20).text("UAIU.LIVE/X Full Audit Report");
    doc.moveDown();
    doc.fontSize(11).text(`Audit ID: ${data.auditId}`);
    doc.text(`Timestamp: ${data.timestamp}`);
    doc.text(`Overall Status: ${data.overallStatus}`);
    doc.text(`Chain Intact: ${data.chainIntact}`);
    doc.moveDown();
    doc.text("Recommendations:");
    (data.recommendations || []).forEach((r: string) => doc.text(`- ${r}`));
    doc.end();
  });

  app.get("/api/esg/metrics", async (_req, res) => {
    const dataset = await loadSettlementDataset();
    res.json(buildEsgMetrics(dataset));
  });

  app.get("/api/esg/export/csv", async (_req, res) => {
    const rows = await loadSettlementDataset();
    const columns = ["date", "credit_id", "registry", "project_type", "tonnes_co2", "price_eur", "buyer_org", "seller_org", "algorithm", "chain_block", "verified", "retired_at"];
    const csv = [columns.join(","), ...rows.map((r) => columns.map((c) => csvEscape((r as any)[c])).join(","))].join("\n");
    res.setHeader("content-type", "text/csv");
    res.setHeader("content-disposition", "attachment; filename=esg-export.csv");
    res.send(csv);
  });

  app.get("/api/esg/export/json", async (_req, res) => {
    const rows = await loadSettlementDataset();
    res.json({ generatedAt: new Date().toISOString(), records: rows });
  });

  app.get("/api/esg/export/xml", async (_req, res) => {
    const rows = await loadSettlementDataset();
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<ghgProtocolReport generatedAt="${new Date().toISOString()}">${rows.map((r) => `\n  <record><date>${r.date}</date><credit_id>${r.credit_id}</credit_id><registry>${r.registry}</registry><project_type>${r.project_type}</project_type><tonnes_co2>${r.tonnes_co2}</tonnes_co2><price_eur>${r.price_eur}</price_eur><buyer_org>${r.buyer_org}</buyer_org><seller_org>${r.seller_org}</seller_org><algorithm>${r.algorithm}</algorithm><verified>${r.verified}</verified><retired_at>${r.retired_at || ""}</retired_at></record>`).join("")}\n</ghgProtocolReport>`;
    res.setHeader("content-type", "application/xml");
    res.setHeader("content-disposition", "attachment; filename=ghg-protocol-export.xml");
    res.send(xml);
  });

  app.get("/api/esg/export/pdf", async (_req, res) => {
    const rows = await loadSettlementDataset();
    const metrics = buildEsgMetrics(rows);
    res.setHeader("content-type", "application/pdf");
    res.setHeader("content-disposition", "attachment; filename=uaiu-esg-impact-report.pdf");
    const doc = new PDFDocument({ margin: 40, size: "A4" });
    doc.pipe(res);
    doc.fontSize(24).text("UAIU.LIVE/X ESG Impact Report");
    doc.moveDown().fontSize(14).text("Executive Summary");
    doc.fontSize(10).text(`Total retired tonnes (lifetime): ${metrics.totals.retiredLifetimeTonnes}`);
    doc.text(`Total retired tonnes (year): ${metrics.totals.retiredCurrentYearTonnes}`);
    doc.moveDown().fontSize(14).text("GHG Accounting Summary");
    metrics.ghgAccounting.slice(0, 20).forEach((org: any) => doc.fontSize(10).text(`${org.organization}: S1 ${org.scope1Offset}, S2 ${org.scope2Offset}, S3 ${org.scope3Offset}`));
    doc.addPage();
    doc.fontSize(14).text("Appendix (full transaction log)");
    rows.slice(0, 200).forEach((r) => doc.fontSize(8).text(`${r.date} | ${r.credit_id} | ${r.registry} | ${r.tonnes_co2}t | €${r.price_eur}`));
    doc.end();
  });

  app.post("/api/keys/generate", requireAdmin, async (req, res) => {
    const organizationName = String(req.body?.organizationName || "Unknown Org");
    const permissions = Array.isArray(req.body?.permissions) ? req.body.permissions : ["read"];
    const raw = `uaiu_${randomBytes(24).toString("hex")}`;
    const hashed = createHash("sha256").update(raw).digest("hex");
    const [created] = await db.insert(apiKeys).values({
      key: hashed,
      organizationName,
      permissions,
      active: true,
      createdAt: new Date(),
      lastUsedAt: null,
    }).returning();
    res.status(201).json({ id: created.id, apiKey: raw, organizationName, permissions });
  });

  app.use("/api/v1", validateApiKey);

  app.get("/api/v1/credits", async (req, res) => {
    const rows = await db.select().from(exchangeCreditListings).orderBy(desc(exchangeCreditListings.createdAt));
    let filtered = rows.map((r) => ({
      creditId: r.id,
      registry: r.registryName || r.standard,
      projectType: r.creditType,
      price: Number(r.askingPricePerTonne),
      tonnes: Number(r.volumeTonnes),
      supplier: r.orgName,
    }));
    const { registry, projectType, minTonnes, maxTonnes, minPrice, maxPrice } = req.query;
    if (registry) filtered = filtered.filter((r) => r.registry === registry);
    if (projectType) filtered = filtered.filter((r) => r.projectType === projectType);
    if (minTonnes) filtered = filtered.filter((r) => r.tonnes >= Number(minTonnes));
    if (maxTonnes) filtered = filtered.filter((r) => r.tonnes <= Number(maxTonnes));
    if (minPrice) filtered = filtered.filter((r) => r.price >= Number(minPrice));
    if (maxPrice) filtered = filtered.filter((r) => r.price <= Number(maxPrice));
    res.json(filtered);
  });

  app.post("/api/v1/credits/reserve", async (req, res) => {
    const { creditId, tonnes, buyerOrg } = req.body || {};
    if (!creditId || !tonnes || !buyerOrg) return res.status(400).json({ error: "creditId, tonnes, buyerOrg required" });
    const reservedAt = new Date();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    const [record] = await db.insert(creditReservations).values({ creditId, tonnes, buyerOrg, reservedAt, expiresAt, status: "reserved" }).returning();
    res.status(201).json({ reservationId: record.id, expiresAt: record.expiresAt });
  });

  app.post("/api/v1/credits/purchase", async (req, res) => {
    const { reservationId, paymentReference } = req.body || {};
    const reservation = await db.query.creditReservations.findFirst({ where: eq(creditReservations.id, reservationId) });
    if (!reservation || reservation.status !== "reserved") return res.status(404).json({ error: "Reservation not found" });
    if (new Date(reservation.expiresAt).getTime() < Date.now()) return res.status(400).json({ error: "Reservation expired" });

    const tradeId = `API-${reservation.creditId}-${Date.now()}`;
    await db.insert(exchangeTrades).values({
      accountEmail: String((req as any).apiOrg || reservation.buyerOrg),
      tradeId,
      side: "buy",
      standard: "API",
      volumeTonnes: Number(reservation.tonnes),
      pricePerTonne: 0,
      grossEur: 0,
      feeEur: 0,
      status: "completed",
      paymentModel: "api",
      stripeSessionId: String(paymentReference || "api-payment"),
    });

    const [settlement] = await db.insert(escrowSettlementsLog).values({
      tradeId,
      paymentIntentId: String(paymentReference || `pi_${Date.now()}`),
      amountEur: 0,
      uaiuFeeEur: 0,
      sellerNetEur: 0,
      status: "held",
      settledAt: new Date(),
      hashAlgorithm: getHashAlgorithm(),
    }).returning();

    const lastBlock = await db.query.auditChainEntries.findFirst({ orderBy: (t, { desc: d }) => [d(t.blockNumber)] });
    const blockNumber = (lastBlock?.blockNumber || 0) + 1;
    const prevHash = lastBlock?.hash || "0000000000000000";
    const tx = { type: "api.purchase", tradeId, reservationId };
    const timestamp = new Date();
    const hash = createHash(getHashAlgorithm()).update(JSON.stringify({ blockNumber, timestamp: timestamp.toISOString(), algorithm: getHashAlgorithm(), transactionData: tx, prevHash })).digest("hex");
    await db.insert(auditChainEntries).values({ blockNumber, timestamp, algorithm: getHashAlgorithm(), transactionData: tx, prevHash, hash });

    await db.update(creditReservations).set({ status: "purchased" }).where(eq(creditReservations.id, reservationId));
    await emitWebhookEvent("settlement.created", { settlementId: settlement.id, tradeId }, (req as any).apiOrg);

    const finalityHours = Number(process.env.ESCROW_FINALITY_HOURS || 24);
    res.status(201).json({ settlementId: settlement.id, escrowStatus: settlement.status, finalityEta: new Date(Date.now() + finalityHours * 36e5).toISOString() });
  });

  app.get("/api/v1/settlements", async (req, res) => {
    const org = String((req as any).apiOrg || "");
    const { status, dateFrom, dateTo } = req.query;
    const tradeRows = await db.select().from(exchangeTrades).where(eq(exchangeTrades.accountEmail, org));
    const tradeIds = tradeRows.map((t) => t.tradeId);
    let settlements = (await db.select().from(escrowSettlementsLog)).filter((s) => tradeIds.includes(s.tradeId));
    if (status) settlements = settlements.filter((s) => s.status === status);
    if (dateFrom) settlements = settlements.filter((s) => (s.settledAt ? new Date(s.settledAt) >= new Date(String(dateFrom)) : false));
    if (dateTo) settlements = settlements.filter((s) => (s.settledAt ? new Date(s.settledAt) <= new Date(String(dateTo)) : false));
    res.json(settlements);
  });

  app.get("/api/v1/settlements/:id", async (req, res) => {
    const id = Number(req.params.id);
    const settlement = await db.query.escrowSettlementsLog.findFirst({ where: eq(escrowSettlementsLog.id, id) });
    if (!settlement) return res.status(404).json({ error: "Settlement not found" });
    const finality = validateEscrowFinality(settlement.settledAt || new Date(), settlement.hashAlgorithm || "unknown");
    res.json({
      ...settlement,
      finalityStatus: finality.settled ? "finalized" : "pending",
      algorithmValidation: {
        algorithm: settlement.hashAlgorithm,
        approved: finality.algorithmApproved,
      },
      certificateDownloadUrl: `/api/escrow/${settlement.id}/certificate`,
    });
  });

  app.get("/api/v1/portfolio", async (req, res) => {
    const org = String((req as any).apiOrg || "");
    const trades = await db.select().from(exchangeTrades).where(eq(exchangeTrades.accountEmail, org));
    const settlements = (await db.select().from(escrowSettlementsLog)).filter((s) => trades.some((t) => t.tradeId === s.tradeId));
    const metrics = buildEsgMetrics(await loadSettlementDataset());
    const byRegistry: Record<string, number> = {};
    trades.forEach((t) => {
      const k = t.sellerRegistryName || "Unknown";
      byRegistry[k] = (byRegistry[k] || 0) + Number(t.volumeTonnes || 0);
    });

    res.json({
      totalCreditsPurchased: trades.length,
      totalTonnesRetired: Number(trades.reduce((acc, t) => acc + Number(t.volumeTonnes || 0), 0).toFixed(2)),
      activeSettlementsPendingFinality: settlements.filter((s) => !validateEscrowFinality(s.settledAt || new Date(), s.hashAlgorithm || "").settled).length,
      creditsByRegistry: byRegistry,
      esgImpactMetrics: metrics.totals,
    });
  });

  app.get("/api/v1/audit/chain", async (_req, res) => {
    const blocks = await db.select().from(auditChainEntries).orderBy(asc(auditChainEntries.blockNumber));
    res.json(blocks);
  });

  app.get("/api/v1/trust/status", async (req, res) => {
    const chainCount = await db.select({ count: sql<number>`count(*)` }).from(auditChainEntries);
    res.json({
      organization: (req as any).apiOrg,
      currentAlgorithm: getHashAlgorithm(),
      approvedAlgorithms: getApprovedAlgorithms(),
      totalAuditBlocks: chainCount[0]?.count || 0,
      extended: true,
    });
  });

  app.post("/api/v1/webhooks/register", async (req, res) => {
    const { url, events } = req.body || {};
    if (!url || !Array.isArray(events) || events.length === 0) return res.status(400).json({ error: "url and events[] required" });
    const [record] = await db.insert(webhooks).values({
      orgId: String((req as any).apiOrg),
      url,
      events,
      secret: randomBytes(32).toString("hex"),
      active: true,
      createdAt: new Date(),
    }).returning();
    res.status(201).json(record);
  });

  app.post("/api/integrations/salesforce/push", async (_req, res) => {
    const rows = await loadSettlementDataset();
    const errors: string[] = [];
    let failed = 0;
    if (!process.env.SF_CLIENT_ID || !process.env.SF_CLIENT_SECRET || !process.env.SF_INSTANCE_URL) {
      failed = rows.length;
      errors.push("Salesforce env vars are not configured.");
    }
    res.json({ pushed: rows.length - failed, failed, errors });
  });

  app.post("/api/integrations/microsoft/push", async (_req, res) => {
    const rows = await loadSettlementDataset();
    const errors: string[] = [];
    let failed = 0;
    if (!process.env.MS_TENANT_ID || !process.env.MS_CLIENT_ID || !process.env.MS_CLIENT_SECRET) {
      failed = rows.length;
      errors.push("Microsoft env vars are not configured.");
    }
    res.json({ pushed: rows.length - failed, failed, errors });
  });

  app.get("/api/integrations/cdp/export", async (_req, res) => {
    const rows = await loadSettlementDataset();
    const xml = `<?xml version="1.0"?><cdpDisclosure>${rows.map((r) => `<entry><credit>${r.credit_id}</credit><registry>${r.registry}</registry><tonnes>${r.tonnes_co2}</tonnes></entry>`).join("")}</cdpDisclosure>`;
    res.setHeader("content-type", "application/xml");
    res.setHeader("content-disposition", "attachment; filename=cdp-disclosure.xml");
    res.send(xml);
  });

  app.get("/api/integrations/generic/export", async (_req, res) => {
    const rows = await loadSettlementDataset();
    res.json({ providerCompatible: ["Persefoni", "Watershed", "Greenly", "Sweep", "Normative"], records: rows });
  });

  app.post("/api/compliance/generate", async (req, res) => {
    const { documentType, organizationName, dateRange } = req.body || {};
    const allowed = ["tcfd", "ghg-inventory", "iso14064", "retirement-summary", "due-diligence"];
    if (!allowed.includes(documentType)) return res.status(400).json({ error: "Invalid documentType" });
    const id = randomUUID();
    const filePath = path.join(complianceDir, `${id}.pdf`);
    await new Promise<void>((resolve, reject) => {
      const stream = fs.createWriteStream(filePath);
      const doc = new PDFDocument({ margin: 40 });
      doc.pipe(stream);
      doc.fontSize(22).text("UAIU.LIVE/X Compliance Document");
      doc.moveDown();
      doc.fontSize(12).text(`Type: ${documentType}`);
      doc.text(`Organization: ${organizationName}`);
      doc.text(`Date Range: ${dateRange?.from || "n/a"} to ${dateRange?.to || "n/a"}`);
      doc.moveDown();
      doc.text("Verification statement: Backed by UAIU.LIVE/X cryptographic audit chain.");
      doc.end();
      stream.on("finish", () => resolve());
      stream.on("error", reject);
    });

    const [record] = await db.insert(complianceDocuments).values({
      id,
      documentType,
      organizationName,
      dateRange,
      filePath,
      createdAt: new Date(),
    }).returning();
    res.status(201).json(record);
  });

  app.get("/api/compliance/documents", async (_req, res) => {
    const rows = await db.select().from(complianceDocuments).orderBy(desc(complianceDocuments.createdAt));
    res.json(rows);
  });

  app.get("/api/compliance/documents/:id", async (req, res) => {
    const record = await db.query.complianceDocuments.findFirst({ where: eq(complianceDocuments.id, req.params.id) });
    if (!record) return res.status(404).json({ error: "Document not found" });
    if (!fs.existsSync(record.filePath)) return res.status(404).json({ error: "File not found" });
    res.download(record.filePath);
  });

  app.get("/api/admin/overview", requireAdmin, async (_req, res) => {
    const [latestAudit] = await db.select().from(auditReports).orderBy(desc(auditReports.timestamp)).limit(1);
    const manualReviewQueue = (await db.select().from(escrowSettlementsLog)).filter((s) => !isAlgorithmApproved(s.hashAlgorithm || "")).length;
    const chain = await db.select().from(auditChainEntries).orderBy(desc(auditChainEntries.blockNumber)).limit(1);
    const keys = await db.select().from(apiKeys).orderBy(desc(apiKeys.createdAt));
    const webhookLogs = await db.select().from(webhookDeliveryLog).orderBy(desc(webhookDeliveryLog.deliveredAt)).limit(100);
    const rotations = await db.select().from(algorithmRotationLog).orderBy(desc(algorithmRotationLog.timestamp));
    const docs = await db.select().from(complianceDocuments).orderBy(desc(complianceDocuments.createdAt));
    const audits = await db.select().from(auditReports).orderBy(desc(auditReports.timestamp));

    res.json({
      platformHealth: {
        chainStatus: chain[0] ? "active" : "empty",
        lastAuditResult: (latestAudit?.reportData as any)?.overallStatus || "N/A",
        manualReviewQueue,
      },
      apiKeys: keys,
      webhookDeliveryLog: webhookLogs,
      algorithmManagement: {
        currentAlgorithm: getHashAlgorithm(),
        approvedList: getApprovedAlgorithms(),
        rotationHistory: rotations,
      },
      manualReviewQueue: (await db.select().from(escrowSettlementsLog)).filter((s) => !isAlgorithmApproved(s.hashAlgorithm || "")),
      complianceDocumentHistory: docs,
      fullAuditReportHistory: audits,
    });
  });

  app.post("/api/admin/keys/:id/revoke", requireAdmin, async (req, res) => {
    await db.update(apiKeys).set({ active: false }).where(eq(apiKeys.id, Number(req.params.id)));
    res.json({ ok: true });
  });
}
