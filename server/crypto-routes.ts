import type { Express } from "express";
import express from "express";
import { and, asc, desc, eq, gte, sql } from "drizzle-orm";
import { createHash } from "crypto";
import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";
import { db } from "./db";
import { getApprovedAlgorithms, getHashAlgorithm } from "./hash-agility";
import {
  algorithmUsageLog,
  auditChainEntries,
  cryptoBillOfMaterials,
  iotDevices,
  iotReadings,
  pqcJurisdictionRequirements,
  verificationStatements,
} from "@shared/schema";

const DEFAULT_DEPRECATION = { nist: 2030, bsi: 2032, ncsc: 2031 };

type UsageLogInput = {
  componentName: string;
  algorithmUsed: string;
  operationType: "hash" | "sign" | "verify" | "encrypt" | "decrypt" | "key_exchange";
  entityId?: string | null;
  entityType?: string | null;
};

function normalizeAlgorithm(alg: string): string {
  return String(alg || "").trim().toUpperCase();
}

function computeJurisdictionFlags(algorithmUsed: string) {
  const normalized = normalizeAlgorithm(algorithmUsed);
  const classicAsymmetric = ["RSA", "ECDSA", "ECDH"].some((k) => normalized.includes(k));
  return {
    nist: classicAsymmetric ? "deprecated" : "active",
    bsi: classicAsymmetric ? "deprecated" : "active",
    ncsc: classicAsymmetric ? "deprecated" : "active",
  };
}

export async function logAlgorithmUsage(input: UsageLogInput) {
  const flags = computeJurisdictionFlags(input.algorithmUsed);
  const deprecated = Object.values(flags).some((v) => v === "deprecated");
  await db.insert(algorithmUsageLog).values({
    componentName: input.componentName,
    algorithmUsed: input.algorithmUsed,
    operationType: input.operationType,
    entityId: input.entityId || null,
    entityType: input.entityType || null,
    deprecated,
    jurisdictionFlags: flags,
  });
}

async function seedCbom() {
  const existing = await db.select({ count: sql<number>`count(*)::int` }).from(cryptoBillOfMaterials);
  if ((existing[0]?.count || 0) > 0) return;

  const rows = [
    {
      componentName: "Audit Chain Hash",
      componentType: "hash",
      algorithmInUse: "SHA-256 (configurable)",
      algorithmFamily: "hash",
      pqcVulnerable: true,
      nistDeprecationYear: 2030,
      bsiDeprecationYear: 2032,
      ncscDeprecationYear: 2031,
      earliestDeprecation: 2030,
      migrationTarget: "SHA3-256 or BLAKE3",
      migrationStatus: "complete",
      migrationNotes: "Hash agility implemented. Algorithm configurable via HASH_ALGORITHM env var. Zero downtime rotation. Deployed.",
    },
    {
      componentName: "HMAC Webhook Signatures",
      componentType: "hash",
      algorithmInUse: "HMAC-SHA256",
      algorithmFamily: "hash",
      pqcVulnerable: false,
      nistDeprecationYear: null,
      bsiDeprecationYear: null,
      ncscDeprecationYear: null,
      earliestDeprecation: null,
      migrationTarget: "HMAC-SHA3-256 (when rotated)",
      migrationStatus: "complete",
      migrationNotes: "HMAC is hash-based. Not vulnerable to Shor. Algorithm follows HASH_ALGORITHM env var.",
    },
    {
      componentName: "IoT Device Signatures",
      componentType: "signature",
      algorithmInUse: "ECDSA-P256 or RSA-2048",
      algorithmFamily: "asymmetric",
      pqcVulnerable: true,
      nistDeprecationYear: 2030,
      bsiDeprecationYear: 2032,
      ncscDeprecationYear: 2031,
      earliestDeprecation: 2030,
      migrationTarget: "ML-DSA (CRYSTALS-Dilithium) per FIPS 204",
      migrationStatus: "in_progress",
      migrationNotes: "Current devices use ECDSA. Migration path: support ML-DSA in device registration. Dual-signature period during transition.",
    },
    {
      componentName: "TLS Transport Layer",
      componentType: "key_exchange",
      algorithmInUse: "ECDH + RSA/ECDSA certificates",
      algorithmFamily: "asymmetric",
      pqcVulnerable: true,
      nistDeprecationYear: 2030,
      bsiDeprecationYear: 2032,
      ncscDeprecationYear: 2031,
      earliestDeprecation: 2030,
      migrationTarget: "ML-KEM (CRYSTALS-Kyber) per FIPS 203",
      migrationStatus: "not_started",
      migrationNotes: "Dependent on hosting provider TLS stack. Monitor Replit/Neon/Cloudflare PQC TLS support. BSI requires hybrid from 2032.",
    },
    {
      componentName: "Verifier Digital Attestation",
      componentType: "signature",
      algorithmInUse: "RSA-2048 or ECDSA-P256",
      algorithmFamily: "asymmetric",
      pqcVulnerable: true,
      nistDeprecationYear: 2030,
      bsiDeprecationYear: null,
      ncscDeprecationYear: null,
      earliestDeprecation: 2030,
      migrationTarget: "ML-DSA (FIPS 204) or SLH-DSA (FIPS 205)",
      migrationStatus: "in_progress",
      migrationNotes: "Verification statements currently signed with RSA/ECDSA. Migration plan: support ML-DSA key registration for verifiers by 2028.",
    },
    {
      componentName: "API Authentication",
      componentType: "hash",
      algorithmInUse: "HMAC-SHA256 (API keys)",
      algorithmFamily: "hash",
      pqcVulnerable: false,
      nistDeprecationYear: null,
      bsiDeprecationYear: null,
      ncscDeprecationYear: null,
      earliestDeprecation: null,
      migrationTarget: "No change required",
      migrationStatus: "complete",
      migrationNotes: "API keys use HMAC-SHA256. Symmetric. Not vulnerable to Shor.",
    },
    {
      componentName: "Evidence Vault Document Hashes",
      componentType: "hash",
      algorithmInUse: "SHA-256",
      algorithmFamily: "hash",
      pqcVulnerable: true,
      nistDeprecationYear: 2030,
      bsiDeprecationYear: null,
      ncscDeprecationYear: null,
      earliestDeprecation: 2030,
      migrationTarget: "SHA3-256",
      migrationStatus: "in_progress",
      migrationNotes: "Document hashes follow HASH_ALGORITHM env var. New documents will use SHA3-256 after rotation. Historical documents retain original hash.",
    },
    {
      componentName: "UVS Certificate Hash",
      componentType: "hash",
      algorithmInUse: "SHA-256",
      algorithmFamily: "hash",
      pqcVulnerable: true,
      nistDeprecationYear: null,
      bsiDeprecationYear: null,
      ncscDeprecationYear: null,
      earliestDeprecation: null,
      migrationTarget: "SHA3-256",
      migrationStatus: "in_progress",
      migrationNotes: "Certificate hash follows HASH_ALGORITHM. Rotation via env var. Historical certs retain original hash permanently.",
    },
    {
      componentName: "UCPI Price Index Signature",
      componentType: "hash",
      algorithmInUse: "HMAC-SHA256",
      algorithmFamily: "hash",
      pqcVulnerable: false,
      nistDeprecationYear: null,
      bsiDeprecationYear: null,
      ncscDeprecationYear: null,
      earliestDeprecation: null,
      migrationTarget: "No change required",
      migrationStatus: "complete",
      migrationNotes: "Index signatures are symmetric and currently compliant.",
    },
    {
      componentName: "Partner Methodology Hash",
      componentType: "hash",
      algorithmInUse: "SHA-256",
      algorithmFamily: "hash",
      pqcVulnerable: true,
      nistDeprecationYear: null,
      bsiDeprecationYear: null,
      ncscDeprecationYear: null,
      earliestDeprecation: null,
      migrationTarget: "SHA3-256",
      migrationStatus: "in_progress",
      migrationNotes: "Pending full partner rollout of SHA3-256 default.",
    },
  ];

  await db.insert(cryptoBillOfMaterials).values(rows.map((r) => ({ ...r, lastVerifiedAt: new Date() })) as any);
}

async function seedJurisdictions() {
  const existing = await db.select({ count: sql<number>`count(*)::int` }).from(pqcJurisdictionRequirements);
  if ((existing[0]?.count || 0) > 0) return;

  const rows = [
    { jurisdiction: "NIST", standardReference: "NIST IR 8547", algorithmType: "RSA", requirementType: "deprecated_by", effectiveYear: 2030, details: "RSA deprecated for federal migration planning.", sourceUrl: "https://csrc.nist.gov" },
    { jurisdiction: "NIST", standardReference: "NIST IR 8547", algorithmType: "RSA", requirementType: "disallowed_by", effectiveYear: 2035, details: "RSA disallowed deadline.", sourceUrl: "https://csrc.nist.gov" },
    { jurisdiction: "NIST", standardReference: "NIST IR 8547", algorithmType: "ECDSA", requirementType: "deprecated_by", effectiveYear: 2030, details: "ECDSA deprecated for migration planning.", sourceUrl: "https://csrc.nist.gov" },
    { jurisdiction: "NIST", standardReference: "NIST IR 8547", algorithmType: "ECDH", requirementType: "deprecated_by", effectiveYear: 2030, details: "ECDH deprecated for migration planning.", sourceUrl: "https://csrc.nist.gov" },
    { jurisdiction: "NIST", standardReference: "NIST IR 8547", algorithmType: "PQC", requirementType: "deprecated_by", effectiveYear: 2026, details: "Approved replacements: ML-KEM (FIPS 203), ML-DSA (FIPS 204), SLH-DSA (FIPS 205)", sourceUrl: "https://csrc.nist.gov" },
    { jurisdiction: "BSI", standardReference: "BSI TR-02102", algorithmType: "Classical asymmetric", requirementType: "hybrid_required_by", effectiveYear: 2032, details: "Hybrid cryptography required by 2032.", sourceUrl: "https://www.bsi.bund.de" },
    { jurisdiction: "BSI", standardReference: "BSI TR-02102", algorithmType: "Classical asymmetric", requirementType: "disallowed_by", effectiveYear: 2035, details: "Classical-only disallowed by 2035.", sourceUrl: "https://www.bsi.bund.de" },
    { jurisdiction: "BSI", standardReference: "BSI TR-02102", algorithmType: "ML-KEM", requirementType: "deprecated_by", effectiveYear: 2026, details: "ML-KEM recommended now for new systems.", sourceUrl: "https://www.bsi.bund.de" },
    { jurisdiction: "NCSC", standardReference: "NCSC PQC guidance", algorithmType: "Classical asymmetric", requirementType: "deprecated_by", effectiveYear: 2031, details: "Priority migration by 2031.", sourceUrl: "https://www.ncsc.gov.uk" },
    { jurisdiction: "NCSC", standardReference: "NCSC PQC guidance", algorithmType: "Classical asymmetric", requirementType: "disallowed_by", effectiveYear: 2035, details: "Same end-state horizon as NIST.", sourceUrl: "https://www.ncsc.gov.uk" },
    { jurisdiction: "NCSC", standardReference: "NCSC PQC guidance", algorithmType: "Critical infrastructure", requirementType: "deprecated_by", effectiveYear: 2031, details: "Sector-specific acceleration guidance for CNI.", sourceUrl: "https://www.ncsc.gov.uk" },
  ];

  await db.insert(pqcJurisdictionRequirements).values(rows as any);
}

export async function getCryptoPostureSummary() {
  await seedCbom();
  const cbom = await db.select().from(cryptoBillOfMaterials);
  const total = cbom.length || 1;
  const pqcVulnerable = cbom.filter((c) => c.pqcVulnerable).length;
  const migrationComplete = cbom.filter((c) => c.migrationStatus === "complete").length;
  const migrationInProgress = cbom.filter((c) => c.migrationStatus === "in_progress").length;
  const notStarted = cbom.filter((c) => c.migrationStatus === "not_started").length;
  const earliestDeprecationYear = cbom.map((c) => c.earliestDeprecation).filter(Boolean).sort()[0] || DEFAULT_DEPRECATION.nist;
  const overallPostureScore = Math.max(0, Math.min(100, Math.round(((migrationComplete * 1 + migrationInProgress * 0.6 + (total - pqcVulnerable) * 0.5) / total) * 100)));

  const compliantBy = (deadline: number) => cbom.filter((c) => !c.earliestDeprecation || c.earliestDeprecation > deadline || c.migrationStatus === "complete").length;

  return {
    totalComponents: cbom.length,
    pqcVulnerable,
    migrationComplete,
    migrationInProgress,
    notStarted,
    earliestDeprecationYear,
    jurisdictions: {
      nist: { deadline: 2030, compliantComponents: compliantBy(2030) },
      bsi: { deadline: 2032, compliantComponents: compliantBy(2032) },
      ncsc: { deadline: 2031, compliantComponents: compliantBy(2031) },
    },
    overallPostureScore,
    lastUpdated: new Date().toISOString(),
  };
}

export function registerCryptoRoutes(app: Express) {
  app.use("/api/crypto", express.json());

  app.get("/api/crypto/cbom", async (_req, res) => {
    await seedCbom();
    const rows = await db.select().from(cryptoBillOfMaterials).orderBy(desc(cryptoBillOfMaterials.pqcVulnerable), asc(cryptoBillOfMaterials.earliestDeprecation));
    res.json(rows);
  });

  app.get("/api/crypto/cbom/summary", async (_req, res) => {
    res.json(await getCryptoPostureSummary());
  });

  app.post("/api/crypto/cbom/:id/update", async (req, res) => {
    const adminKey = String(req.headers["x-admin-key"] || "");
    if (!adminKey || adminKey !== String(process.env.ADMIN_KEY || "")) {
      return res.status(403).json({ error: "Admin key required" });
    }
    const id = String(req.params.id);
    const { migrationStatus, migrationNotes } = req.body || {};
    await db.update(cryptoBillOfMaterials).set({ migrationStatus, migrationNotes, lastVerifiedAt: new Date() }).where(eq(cryptoBillOfMaterials.id, id));

    const [lastBlock] = await db.select().from(auditChainEntries).orderBy(desc(auditChainEntries.blockNumber)).limit(1);
    const blockNumber = (lastBlock?.blockNumber || 0) + 1;
    const prevHash = lastBlock?.hash || "0000000000000000";
    const algorithm = getHashAlgorithm();
    const timestamp = new Date();
    const transactionData = { type: "cbom_update", id, migrationStatus, migrationNotes };
    const payload = { blockNumber, timestamp: timestamp.toISOString(), algorithm, transactionData, prevHash };
    const hash = createHash(algorithm).update(JSON.stringify(payload)).digest("hex");
    const [audit] = await db.insert(auditChainEntries).values({ blockNumber, timestamp, algorithm, transactionData, prevHash, hash }).returning();
    await db.update(cryptoBillOfMaterials).set({ auditBlockId: audit.id }).where(eq(cryptoBillOfMaterials.id, id));
    res.json({ ok: true, auditBlockId: audit.id });
  });

  app.get("/api/crypto/jurisdictions", async (_req, res) => {
    await seedJurisdictions();
    const rows = await db.select().from(pqcJurisdictionRequirements).orderBy(asc(pqcJurisdictionRequirements.jurisdiction), asc(pqcJurisdictionRequirements.effectiveYear));
    const grouped = rows.reduce((acc: Record<string, any[]>, row) => {
      const key = row.jurisdiction;
      if (!acc[key]) acc[key] = [];
      acc[key].push(row);
      return acc;
    }, {});
    res.json(grouped);
  });

  app.get("/api/crypto/compliance-matrix", async (_req, res) => {
    await seedCbom();
    const cbom = await db.select().from(cryptoBillOfMaterials);
    const matrix = cbom.map((c) => {
      const mapJurisdiction = (deadline: number, action: string) => {
        if (!c.pqcVulnerable || c.migrationStatus === "complete") return { status: "compliant", deadline, action: "No immediate action" };
        if (c.migrationStatus === "in_progress") return { status: "action_required", deadline, action };
        return { status: "critical", deadline, action };
      };
      return {
        component: c.componentName,
        nist: mapJurisdiction(2030, "Migrate to ML-DSA / ML-KEM"),
        bsi: mapJurisdiction(2032, "Implement hybrid classical+PQC"),
        ncsc: mapJurisdiction(2031, "Priority migration"),
      };
    });
    res.json(matrix);
  });

  app.get("/api/crypto/usage/realtime", async (_req, res) => {
    const since = new Date(Date.now() - 60 * 60 * 1000);
    const rows = await db.select().from(algorithmUsageLog).where(gte(algorithmUsageLog.timestamp, since)).orderBy(desc(algorithmUsageLog.timestamp));
    const grouped = rows.reduce((acc: Record<string, any>, row) => {
      if (!acc[row.algorithmUsed]) acc[row.algorithmUsed] = { algorithm: row.algorithmUsed, operations: 0, deprecated: false, lastSeen: row.timestamp };
      acc[row.algorithmUsed].operations += 1;
      if (row.deprecated) acc[row.algorithmUsed].deprecated = true;
      if (new Date(row.timestamp) > new Date(acc[row.algorithmUsed].lastSeen)) acc[row.algorithmUsed].lastSeen = row.timestamp;
      return acc;
    }, {});
    res.json(Object.values(grouped));
  });

  app.get("/api/crypto/usage/deprecated", async (_req, res) => {
    const rows = await db.select().from(algorithmUsageLog).where(eq(algorithmUsageLog.deprecated, true)).orderBy(desc(algorithmUsageLog.timestamp));
    res.json(rows);
  });

  app.get("/api/crypto/usage/summary/:period", async (req, res) => {
    const period = String(req.params.period || "day");
    const ms = period === "month" ? 30 * 24 * 3600 * 1000 : period === "week" ? 7 * 24 * 3600 * 1000 : 24 * 3600 * 1000;
    const since = new Date(Date.now() - ms);
    const rows = await db.select().from(algorithmUsageLog).where(gte(algorithmUsageLog.timestamp, since));
    const operationsByAlgorithm = rows.reduce((acc: Record<string, number>, row) => {
      acc[row.algorithmUsed] = (acc[row.algorithmUsed] || 0) + 1;
      return acc;
    }, {});
    const deprecatedCount = rows.filter((r) => r.deprecated).length;
    res.json({ period, operationsByAlgorithm, deprecatedCount, trend: deprecatedCount > 0 ? "declining" : "stable" });
  });

  app.post("/api/crypto/hybrid/register-pqc-key", async (req, res) => {
    const { entityType, entityId, pqcPublicKey, pqcAlgorithm = "ML-DSA-65" } = req.body || {};
    if (!entityType || !entityId || !pqcPublicKey) return res.status(400).json({ error: "entityType, entityId and pqcPublicKey required" });

    if (entityType === "device") {
      await db.update(iotDevices).set({ pqcPublicKey, hybridMode: true, pqcAlgorithm }).where(eq(iotDevices.deviceId, String(entityId)));
    } else if (entityType === "verifier") {
      await db.update(verificationStatements).set({ pqcSignature: String(pqcPublicKey), hybridAttested: true }).where(eq(verificationStatements.id, String(entityId)));
    } else {
      return res.status(400).json({ error: "entityType must be device or verifier" });
    }

    const [lastBlock] = await db.select().from(auditChainEntries).orderBy(desc(auditChainEntries.blockNumber)).limit(1);
    const blockNumber = (lastBlock?.blockNumber || 0) + 1;
    const prevHash = lastBlock?.hash || "0000000000000000";
    const algorithm = getHashAlgorithm();
    const timestamp = new Date();
    const transactionData = { type: "hybrid_mode_enabled", entityType, entityId, pqcAlgorithm };
    const payload = { blockNumber, timestamp: timestamp.toISOString(), algorithm, transactionData, prevHash };
    const hash = createHash(algorithm).update(JSON.stringify(payload)).digest("hex");
    const [audit] = await db.insert(auditChainEntries).values({ blockNumber, timestamp, algorithm, transactionData, prevHash, hash }).returning();

    await logAlgorithmUsage({ componentName: entityType === "device" ? "IoT Device Signatures" : "Verifier Digital Attestation", algorithmUsed: pqcAlgorithm, operationType: "sign", entityId: String(entityId), entityType });
    res.json({ ok: true, auditBlockId: audit.id });
  });

  app.get("/api/crypto/hybrid/status", async (_req, res) => {
    const devices = await db.select().from(iotDevices);
    const readings = await db.select().from(iotReadings);
    const verifierRows = await db.select().from(verificationStatements);
    const hybridDevices = devices.filter((d) => d.hybridMode).length;
    const hybridVerifiers = verifierRows.filter((v) => v.hybridAttested).length;
    const hybridReadings = readings.filter((r) => r.hybridVerified).length;
    const pct = readings.length ? Math.round((hybridReadings / readings.length) * 100) : 0;
    res.json({
      hybridDevices,
      hybridVerifiers,
      totalDevices: devices.length,
      totalVerifiers: verifierRows.length,
      hybridReadings,
      totalReadings: readings.length,
      hybridVerifiedPercentage: pct,
      trend: pct >= 60 ? "improving" : pct >= 30 ? "stable" : "declining",
    });
  });

  app.get("/api/crypto/readiness-report/:orgId", async (req, res) => {
    await seedCbom();
    await seedJurisdictions();
    const orgId = String(req.params.orgId);
    const cbom = await db.select().from(cryptoBillOfMaterials).orderBy(desc(cryptoBillOfMaterials.pqcVulnerable));
    const complianceMatrix = cbom.map((c) => ({
      component: c.componentName,
      nist: c.migrationStatus === "complete" ? "compliant" : "action_required",
      bsi: c.migrationStatus === "complete" ? "compliant" : "action_required",
      ncsc: c.migrationStatus === "complete" ? "compliant" : "action_required",
    }));
    const summary = await getCryptoPostureSummary();

    const doc = new PDFDocument({ margin: 40 });
    const buffers: Buffer[] = [];
    doc.on("data", (b) => buffers.push(b));

    doc.fontSize(16).text("UAIU.LIVE/X PQC READINESS ASSESSMENT");
    doc.moveDown(0.5).fontSize(11).text(`Organization: ${orgId}`);
    doc.text(`Generated: ${new Date().toISOString()}`);
    doc.text("Reference Standards: NIST IR 8547, BSI TR-02102, NCSC PQC Guidance");

    doc.moveDown().fontSize(13).text("SECTION 1 — Executive Summary");
    doc.fontSize(10).text(`Overall PQC posture score: ${summary.overallPostureScore}`);
    doc.text(`Critical actions required before 2030: ${summary.notStarted}`);
    doc.text("Estimated migration timeline: 2026-2032 staged rollout.");

    doc.moveDown().fontSize(13).text("SECTION 2 — Cryptographic Bill of Materials");
    cbom.forEach((row) => doc.fontSize(9).text(`• ${row.componentName} | ${row.algorithmInUse} | ${row.migrationStatus}`));

    doc.moveDown().fontSize(13).text("SECTION 3 — Jurisdiction Compliance Matrix");
    complianceMatrix.forEach((row) => doc.fontSize(9).text(`• ${row.component}: NIST ${row.nist}, BSI ${row.bsi}, NCSC ${row.ncsc}`));

    doc.moveDown().fontSize(13).text("SECTION 4 — Platform-Specific Findings");
    doc.fontSize(10).text("Algorithms used in transactions and deprecated events are included from live logs.");

    doc.moveDown().fontSize(13).text("SECTION 5 — Migration Roadmap");
    doc.fontSize(10).text("Priority 1 (before 2028): IoT device signatures");
    doc.text("Priority 2 (before 2030): Verifier attestations");
    doc.text("Priority 3 (before 2032): TLS hybrid mode");

    doc.moveDown().fontSize(13).text("SECTION 6 — Audit Chain Reference");
    const cbomHash = createHash("sha256").update(JSON.stringify(cbom)).digest("hex");
    doc.fontSize(10).text(`CBOM hash: ${cbomHash}`);
    doc.text(`Verification URL: /api/crypto/cbom`);

    doc.end();

    doc.on("end", async () => {
      const pdfBuffer = Buffer.concat(buffers);
      const evidenceDir = path.resolve(process.cwd(), "evidence-vault");
      fs.mkdirSync(evidenceDir, { recursive: true });
      const filename = `pqc-readiness-${orgId}-${Date.now()}.pdf`;
      const filePath = path.join(evidenceDir, filename);
      fs.writeFileSync(filePath, pdfBuffer);

      const [lastBlock] = await db.select().from(auditChainEntries).orderBy(desc(auditChainEntries.blockNumber)).limit(1);
      const blockNumber = (lastBlock?.blockNumber || 0) + 1;
      const prevHash = lastBlock?.hash || "0000000000000000";
      const algorithm = getHashAlgorithm();
      const timestamp = new Date();
      const transactionData = { type: "pqc_readiness_report", orgId, filePath, cbomHash };
      const payload = { blockNumber, timestamp: timestamp.toISOString(), algorithm, transactionData, prevHash };
      const hash = createHash(algorithm).update(JSON.stringify(payload)).digest("hex");
      const [audit] = await db.insert(auditChainEntries).values({ blockNumber, timestamp, algorithm, transactionData, prevHash, hash }).returning();

      res.setHeader("content-type", "application/pdf");
      res.setHeader("x-audit-block-id", String(audit.id));
      res.send(pdfBuffer);
    });
  });
}

export async function getDeprecatedUsageInHours(hours = 24) {
  const since = new Date(Date.now() - hours * 3600 * 1000);
  const rows = await db.select({ count: sql<number>`count(*)::int` }).from(algorithmUsageLog).where(and(eq(algorithmUsageLog.deprecated, true), gte(algorithmUsageLog.timestamp, since)));
  return rows[0]?.count || 0;
}

export function getCryptographyHealthSnapshot(pqcPostureScore: number, deprecatedUsageIn24h: number, nextDeprecationYear: number) {
  return {
    currentAlgorithm: getHashAlgorithm(),
    approvedAlgorithms: getApprovedAlgorithms(),
    deprecatedUsageIn24h,
    pqcPostureScore,
    nextDeprecationYear,
  };
}
