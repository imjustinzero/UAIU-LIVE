import type { Express } from "express";
import { createHash, randomUUID } from "node:crypto";
import { and, desc, eq, gte } from "drizzle-orm";

import { db } from "./db";
import { requireAuth } from "./session-middleware";
import {
  auditChainEntries,
  exchangeCreditListings,
  notifications,
  partnerReferrals,
  professionalProfiles,
  verifiedPartners,
  verifierCredentials,
  verifierQualityScores,
} from "@shared/schema";

type EngagementStatus = "needs_verifier" | "active" | "complete" | "unverified";

async function writeAuditEntry(transactionData: Record<string, unknown>): Promise<number> {
  const lastBlock = await db.query.auditChainEntries.findFirst({ orderBy: (t, { desc }) => [desc(t.blockNumber)] });
  const blockNumber = (lastBlock?.blockNumber ?? 0) + 1;
  const prevHash = lastBlock?.hash ?? "0000000000000000";
  const timestamp = new Date();
  const algorithm = "sha256";
  const payload = { blockNumber, timestamp: timestamp.toISOString(), algorithm, transactionData, prevHash };
  const hash = createHash(algorithm).update(JSON.stringify(payload)).digest("hex");
  await db.insert(auditChainEntries).values({ blockNumber, timestamp, algorithm, transactionData, prevHash, hash });
  return blockNumber;
}

function deriveStatusFromTier(tier: number | null | undefined): EngagementStatus {
  if (!tier || tier >= 4) return "needs_verifier";
  if (tier === 3) return "active";
  if (tier <= 2) return "complete";
  return "unverified";
}

function scoreGrade(score: number): string {
  if (score >= 96) return "AAA";
  if (score >= 90) return "AA";
  if (score >= 84) return "A";
  if (score >= 78) return "BBB";
  if (score >= 70) return "BB";
  if (score >= 60) return "B";
  return "CCC";
}

function safeNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function calculateQualityScore(verifierId: string) {
  const profile = await db.query.professionalProfiles.findFirst({ where: eq(professionalProfiles.userId, verifierId) });
  const referrals = await db.query.partnerReferrals.findMany({ where: eq(partnerReferrals.partnerId, verifierId), orderBy: (t, { desc }) => [desc(t.referredAt)] });
  const validCredentials = await db.query.verifierCredentials.findMany({
    where: and(
      eq(verifierCredentials.verifierId, verifierId),
      eq(verifierCredentials.verifiedByPlatform, true),
      gte(verifierCredentials.expiresAt, new Date()),
    ),
  });

  const totalVerifications = Math.max(Number(profile?.verificationsCompleted || 0), referrals.length);
  const tonnesVerified = safeNumber(profile?.tonnesVerified, 0);

  const accuracyRate = Math.min(100, 70 + Math.min(30, totalVerifications * 0.8));
  const fieldCoverageRate = Math.min(100, 60 + Math.min(40, totalVerifications * 1.2));
  const documentationQuality = Math.min(100, 58 + Math.min(42, totalVerifications));
  const responseTime = Math.max(45, 92 - Math.min(35, totalVerifications * 0.8));
  const outcomeTracking = Math.min(100, 65 + Math.min(35, totalVerifications * 0.6));

  const credentialStrengthBase = validCredentials.reduce((acc, credential) => {
    switch (credential.credentialType) {
      case "iso_14065":
        return acc + 30;
      case "unfccc_reviewer":
      case "ipcc_reviewer":
      case "undp_technical":
        return acc + 25;
      case "iso_14064":
      case "verra_auditor":
      case "gs_auditor":
      case "cdm_auditor":
        return acc + 18;
      default:
        return acc + 10;
    }
  }, 10);
  const credentialStrength = Math.min(100, credentialStrengthBase);

  const score = Number((
    accuracyRate * 0.3 +
    fieldCoverageRate * 0.2 +
    documentationQuality * 0.2 +
    responseTime * 0.15 +
    outcomeTracking * 0.1 +
    credentialStrength * 0.05
  ).toFixed(2));

  const latest = await db.query.verifierQualityScores.findFirst({
    where: eq(verifierQualityScores.verifierId, verifierId),
    orderBy: (t, { desc }) => [desc(t.calculatedAt)],
  });

  const trend = !latest ? "new" : score > safeNumber(latest.score) ? "up" : score < safeNumber(latest.score) ? "down" : "flat";
  const disputeRate = Number(Math.max(0, 4 - totalVerifications * 0.03).toFixed(2));

  const [created] = await db.insert(verifierQualityScores).values({
    id: randomUUID(),
    verifierId,
    score: String(score),
    grade: scoreGrade(score),
    components: {
      accuracyRate,
      fieldCoverageRate,
      documentationQuality,
      responseTime,
      outcomeTracking,
      credentialStrength,
    },
    totalVerifications,
    tonnesVerified: String(tonnesVerified),
    disputeRate: String(disputeRate),
    calculatedAt: new Date(),
    trend,
  }).returning();

  const auditBlockId = await writeAuditEntry({ type: "verifier_quality_score", verifierId, score, calculatedAt: created.calculatedAt });
  await db.update(verifierQualityScores).set({ auditBlockId }).where(eq(verifierQualityScores.id, created.id));

  return { ...created, auditBlockId };
}

export function registerVerifierRoutes(app: Express): void {
  app.get("/api/verifier/map/projects", async (_req, res) => {
    const projects = await db.query.exchangeCreditListings.findMany({ orderBy: (t, { desc }) => [desc(t.createdAt)] });
    const rows = projects.map((project) => {
      const status = deriveStatusFromTier(project.verificationTier);
      const coordinates = {
        lat: safeNumber((project as any).latitude, 0),
        lng: safeNumber((project as any).longitude, 0),
      };
      return {
        ...project,
        status,
        label: status === "needs_verifier" ? "Needs Verifier" : status === "active" ? "Verification Active" : status === "complete" ? "Verified ✓" : "Unverified",
        coordinates,
      };
    });

    const grouped = {
      needs_verifier: rows.filter((p) => p.status === "needs_verifier"),
      active: rows.filter((p) => p.status === "active"),
      complete: rows.filter((p) => p.status === "complete"),
      unverified: rows.filter((p) => p.status === "unverified"),
    };

    const countries = new Set(rows.map((row) => String(row.projectOrigin || "Unknown")).filter(Boolean));
    const totalTonnesVerified = grouped.complete.reduce((sum, row) => sum + safeNumber(row.volumeTonnes), 0);

    res.json({
      grouped,
      projects: rows,
      stats: {
        needsVerifier: grouped.needs_verifier.length,
        inProgress: grouped.active.length,
        completed: grouped.complete.length,
        countriesCovered: countries.size,
        totalTonnesVerified,
      },
      refreshedAt: new Date().toISOString(),
      cacheTtlMs: 5 * 60 * 1000,
    });
  });

  app.post("/api/verifier/map/request-engagement", requireAuth, async (req, res) => {
    const { projectId, timelineRequested, budgetRange, standardsRequired, languagesNeeded, durationEstimateDays } = req.body || {};
    if (!projectId) return res.status(400).json({ error: "projectId is required" });

    const userId = String((req as any).session?.userId || "");
    if (!userId) return res.status(401).json({ error: "authentication required" });

    const project = await db.query.exchangeCreditListings.findFirst({ where: eq(exchangeCreditListings.id, String(projectId)) });
    if (!project) return res.status(404).json({ error: "project not found" });

    const [request] = await db.insert(partnerReferrals).values({
      partnerId: userId,
      creditId: project.id,
      referralType: "field_verification",
      status: "pending_review",
      engagementValue: budgetRange ? String(budgetRange) : null,
    }).returning();

    const message = `Verifier engagement requested for ${project.orgName} (${project.id}).`;
    await db.insert(notifications).values([
      { userId, type: "verifier_engagement_request_created", message, data: JSON.stringify({ requestId: request.id, projectId: project.id }) },
      { userId: project.email || userId, type: "verifier_engagement_requested", message, data: JSON.stringify({ requestId: request.id, timelineRequested, standardsRequired, languagesNeeded, durationEstimateDays }) },
      { userId: "admin", type: "verifier_engagement_admin_alert", message, data: JSON.stringify({ requestId: request.id, projectId: project.id }) },
    ]);

    res.json({ requestId: request.id, status: "pending_review" });
  });

  app.post("/api/field/sync", requireAuth, async (req, res) => {
    const batch = Array.isArray(req.body?.items) ? req.body.items : [];
    const auditBlockIds: number[] = [];
    let synced = 0;

    for (const item of batch) {
      try {
        const blockId = await writeAuditEntry({ type: "field_sync_item", verifierId: (req as any).session?.userId, item });
        auditBlockIds.push(blockId);
        synced += 1;
      } catch {
        // continue
      }
    }

    res.json({ synced, failed: Math.max(0, batch.length - synced), auditBlockIds });
  });

  app.get("/api/field/checklist/:projectId/:standard", requireAuth, async (req, res) => {
    const { projectId, standard } = req.params;
    const normalized = String(standard || "").toLowerCase();
    const baseChecklist = [
      "Verify project boundary markers and coordinate fidelity",
      "Capture geotagged photos at all mandatory waypoints",
      "Validate source documents against registered methodology",
      "Record interview evidence with local operators",
      "Log anomalies and remediation notes",
    ];
    const standardsExtras = normalized.includes("14064")
      ? ["Validate baseline assumptions", "Confirm monitoring plan consistency"]
      : normalized.includes("verra")
        ? ["Assess VCS safeguards implementation", "Cross-check registry serial integrity"]
        : ["Verify Gold Standard SDG impact evidence", "Validate stakeholder consultation logs"];

    const items = [...baseChecklist, ...standardsExtras].map((title, index) => ({
      id: `${projectId}-${index + 1}`,
      title,
      priority: index < 2 ? "high" : index < 5 ? "medium" : "normal",
      photoRequired: index < 3,
      status: "pending",
    }));

    res.json({ projectId, standard, items });
  });

  app.post("/api/field/boundary-event", requireAuth, async (req, res) => {
    const { projectId, eventType, coordinates, timestamp } = req.body || {};
    if (!projectId || !eventType) return res.status(400).json({ error: "projectId and eventType are required" });

    const auditBlockId = await writeAuditEntry({
      type: "field_boundary_event",
      verifierId: (req as any).session?.userId,
      projectId,
      eventType,
      coordinates,
      timestamp: timestamp || new Date().toISOString(),
    });

    res.status(201).json({ ok: true, auditBlockId });
  });

  app.get("/api/verifier/credentials", requireAuth, async (req, res) => {
    const verifierId = String((req as any).session?.userId);
    const rows = await db.query.verifierCredentials.findMany({ where: eq(verifierCredentials.verifierId, verifierId), orderBy: (t, { desc }) => [desc(t.issuedAt)] });
    res.json(rows);
  });

  app.post("/api/verifier/credentials", requireAuth, async (req, res) => {
    const verifierId = String((req as any).session?.userId);
    const body = req.body || {};
    const docHash = createHash("sha256").update(JSON.stringify(body.document || body.credentialNumber || randomUUID())).digest("hex");
    const credentialType = String(body.credentialType || "custom");
    const [created] = await db.insert(verifierCredentials).values({
      id: randomUUID(),
      verifierId,
      credentialType,
      issuingBody: String(body.issuingBody || "Unknown issuer"),
      credentialNumber: String(body.credentialNumber || "pending"),
      issuedAt: body.issuedAt ? new Date(body.issuedAt) : new Date(),
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      documentHash: docHash,
      evidenceVaultId: randomUUID(),
      verifiedByPlatform: false,
      publiclyVisible: body.publiclyVisible !== false,
    }).returning();

    if (["unfccc_reviewer", "ipcc_reviewer", "undp_technical"].includes(credentialType)) {
      await db.insert(notifications).values({
        userId: "admin",
        type: "high_trust_credential_added",
        message: `High-trust credential added for verifier ${verifierId}`,
        data: JSON.stringify({ verifierId, credentialId: created.id, credentialType }),
      });
    }

    res.status(201).json(created);
  });

  app.get("/api/verifier/quality-score/:verifierId", async (req, res) => {
    const verifierId = String(req.params.verifierId);
    const latest = await db.query.verifierQualityScores.findFirst({ where: eq(verifierQualityScores.verifierId, verifierId), orderBy: (t, { desc }) => [desc(t.calculatedAt)] });
    if (!latest) return res.status(404).json({ error: "No quality score found" });

    const prior90 = await db.query.verifierQualityScores.findFirst({
      where: and(eq(verifierQualityScores.verifierId, verifierId), gte(verifierQualityScores.calculatedAt, new Date(Date.now() - 90 * 24 * 60 * 60 * 1000))),
      orderBy: (t, { asc }) => [asc(t.calculatedAt)],
    });
    const delta90 = prior90 ? Number(safeNumber(latest.score) - safeNumber(prior90.score)).toFixed(2) : "0.00";
    res.json({ ...latest, trendVs90Days: Number(delta90) });
  });

  app.post("/api/verifier/quality-score/:verifierId", async (req, res) => {
    const verifierId = String(req.params.verifierId);
    const score = await calculateQualityScore(verifierId);
    res.json(score);
  });

  app.get("/api/verifier/coverage/map", async (_req, res) => {
    const projects = await db.query.exchangeCreditListings.findMany();
    const partners = await db.query.verifiedPartners.findMany({ where: eq(verifiedPartners.status, "approved") });

    const byCountry = new Map<string, { country: string; verifierCount: number; projectsNeedingVerification: number; creditsAvailable: number; avgTimelineDays: number }>();

    for (const project of projects) {
      const country = String(project.projectOrigin || "Unknown");
      const current = byCountry.get(country) || { country, verifierCount: 0, projectsNeedingVerification: 0, creditsAvailable: 0, avgTimelineDays: 0 };
      current.projectsNeedingVerification += deriveStatusFromTier(project.verificationTier) === "needs_verifier" ? 1 : 0;
      current.creditsAvailable += safeNumber(project.volumeTonnes);
      current.avgTimelineDays = 12;
      byCountry.set(country, current);
    }

    for (const partner of partners) {
      const country = String(partner.country || "Unknown");
      const current = byCountry.get(country) || { country, verifierCount: 0, projectsNeedingVerification: 0, creditsAvailable: 0, avgTimelineDays: 0 };
      current.verifierCount += 1;
      byCountry.set(country, current);
    }

    const rows = Array.from(byCountry.values()).map((row) => ({
      ...row,
      coverageStatus: row.verifierCount >= 3 ? "green" : row.verifierCount >= 1 ? "amber" : row.projectsNeedingVerification > 0 ? "red" : "grey",
    }));

    const demandVsSupply = rows
      .filter((row) => row.projectsNeedingVerification > 0 || row.verifierCount > 0)
      .sort((a, b) => b.projectsNeedingVerification - a.projectsNeedingVerification)
      .slice(0, 30);

    res.json({ countries: rows, demandVsSupply, refreshedAt: new Date().toISOString() });
  });

  app.get("/api/verifier/legacy", requireAuth, async (req, res) => {
    const verifierId = String((req as any).session?.userId);
    const profile = await db.query.professionalProfiles.findFirst({ where: eq(professionalProfiles.userId, verifierId) });
    const referrals = await db.query.partnerReferrals.findMany({ where: eq(partnerReferrals.partnerId, verifierId), orderBy: (t, { desc }) => [desc(t.referredAt)] });
    const tonnes = safeNumber(profile?.tonnesVerified);
    const projects = referrals.length;
    const countries = new Set((profile?.countriesWorkedIn as string[] | null) || []).size;

    res.json({
      totals: {
        tonnesVerified: tonnes,
        projectsVerified: projects,
        countriesWorked: countries,
        carsOffRoadEquivalent: Math.round(tonnes / 4.6),
        flightsAvoidedEquivalent: Math.round(tonnes / 0.25),
        acresProtectedEquivalent: Math.round(tonnes / 2.5),
        buyersImpacted: Math.max(1, Math.round(projects * 0.6)),
        creditsValueEur: Math.round(tonnes * 18),
      },
      timeline: referrals.map((r) => ({
        id: r.id,
        projectName: `Project ${String(r.creditId || "N/A").slice(0, 8)}`,
        country: "Undisclosed",
        tonnesVerified: Math.round(safeNumber(r.engagementValue, 0)),
        dateCompleted: r.engagementCompletedAt,
        outcome: r.status,
      })),
      methodology: {
        citations: Math.round(projects * 2.4),
        trainedVerifiers: Math.round(projects / 3),
      },
    });
  });
}

export function startVerifierScoreCron(): void {
  const run = async () => {
    try {
      const profiles = await db.query.professionalProfiles.findMany({ columns: { userId: true } });
      const uniqueVerifierIds = Array.from(new Set(profiles.map((profile) => profile.userId).filter(Boolean)));
      for (const verifierId of uniqueVerifierIds) {
        await calculateQualityScore(verifierId);
      }
      console.log(`[Verifier Score Cron] recalculated ${uniqueVerifierIds.length} verifier scores`);
    } catch (error: any) {
      console.error("[Verifier Score Cron] failed", error?.message || error);
    }
  };

  setTimeout(run, 70_000);
  setInterval(run, 24 * 60 * 60 * 1000);
}
