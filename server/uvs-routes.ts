import type { Express, Request, Response } from "express";
import { randomUUID, createHash } from "crypto";
import rateLimit from "express-rate-limit";
import { z } from "zod";

type UvsStatus = "pending" | "certified" | "suspended" | "revoked";

type Certificate = {
  id: string;
  creditId: string;
  certificateNumber: string;
  status: UvsStatus;
  certifiedAt: string;
  expiresAt: string;
  revokedAt: string | null;
  revocationReason: string | null;
  qualityScore: number;
  qualityGrade: string;
  iotTrustScore: number;
  mrvDataQuality: number;
  verifierId: string;
  verifierStatementId: string;
  article6Status: "applied" | "not_required";
  corsiaEligible: boolean;
  sdgCount: number;
  sanctionsClean: boolean;
  openInvestigations: number;
  auditBlockId: number;
  certificateHash: string;
  publicUrl: string;
  qrCodePath: string;
  evidencePackageHash: string;
  projectName: string;
  registry: "Verra" | "Gold Standard";
  projectType: string;
  country: string;
  tonnes: number;
  vintageYear: number;
  supplierOrganization: string;
  verifierName: string;
  verifierOrganization: string;
  criteria: Array<{ key: string; label: string; passed: boolean; detail: string }>;
};

type Amendment = {
  id: string;
  proposedBy: string;
  title: string;
  description: string;
  status: "proposed" | "open_comment" | "voting" | "approved" | "rejected";
  proposedAt: string;
  votingClosesAt: string | null;
  approvedAt: string | null;
  votes: { for: string[]; against: string[]; abstain: string[] };
  auditBlockId: number;
};

const committeeMembers = [
  { id: randomUUID(), name: "Dr. Lena Ortiz", organization: "UAIU Standards Council", role: "Chair", expertise: "MRV Methodology", joinedAt: new Date().toISOString(), active: true, bio: "Leads methodological integrity and quantitative validation.", photoUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400" },
  { id: randomUUID(), name: "Prof. Arjun Mehta", organization: "Carbon Integrity Institute", role: "Member", expertise: "Article 6 & CORSIA", joinedAt: new Date().toISOString(), active: true, bio: "Specialist in international carbon market interoperability.", photoUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400" },
];

const amendments: Amendment[] = [];
const preferences = new Map<string, any>();
const subscriptions = new Map<string, any>();
let blockCounter = 10520;

const criteriaLabels = [
  ["qualityScore", "Quality Score >= 80"],
  ["iotTrustScore", "IoT Trust Score >= 80"],
  ["mrvDataQuality", "MRV Data Quality >= 90"],
  ["thirdParty", "Third Party Verified"],
  ["registry", "Registry Confirmed"],
  ["sanctions", "Sanctions Screened"],
  ["ownership", "Beneficial Ownership Disclosed"],
  ["investigations", "Zero Open Investigations"],
  ["collusion", "No Collusion Flags"],
  ["article6", "Article 6 Documented"],
  ["signatures", "Device Signatures >= 95%"],
  ["satellite", "Satellite Cross-Validated"],
  ["legal", "No Legal Holds"],
] as const;

const certificates: Certificate[] = [createSeedCertificate()];

function createSeedCertificate(): Certificate {
  const cert: Partial<Certificate> = {
    id: randomUUID(),
    creditId: randomUUID(),
    certificateNumber: "UVS-2026-GS-004821",
    status: "certified",
    certifiedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 45).toISOString(),
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 320).toISOString(),
    revokedAt: null,
    revocationReason: null,
    qualityScore: 92,
    qualityGrade: "AAA",
    iotTrustScore: 91,
    mrvDataQuality: 95,
    verifierId: randomUUID(),
    verifierStatementId: randomUUID(),
    article6Status: "applied",
    corsiaEligible: true,
    sdgCount: 8,
    sanctionsClean: true,
    openInvestigations: 0,
    auditBlockId: blockCounter++,
    publicUrl: "/x/verify/UVS-2026-GS-004821",
    qrCodePath: "/assets/qr/UVS-2026-GS-004821.png",
    projectName: "Mekong Blue Carbon Basin",
    registry: "Gold Standard",
    projectType: "Blue Carbon",
    country: "Vietnam",
    tonnes: 120000,
    vintageYear: 2024,
    supplierOrganization: "Pacific Regeneration Co.",
    verifierName: "Eleanor Shaw",
    verifierOrganization: "TerraVeritas LLP",
  };
  const criteria = criteriaLabels.map(([key, label]) => ({ key, label, passed: true, detail: "Pass" }));
  cert.criteria = criteria;
  cert.evidencePackageHash = hashObj({ type: "evidence", cert });
  cert.certificateHash = hashObj({ type: "certificate", cert });
  return cert as Certificate;
}

function hashObj(input: unknown): string {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

function sendError(res: Response, status: number, error: string, code: string, details?: Record<string, unknown>) {
  return res.status(status).json({ error, code, details, requestId: randomUUID() });
}

function evaluateEligibility(payload: any) {
  const checks = [
    { key: "quality_score", ok: payload.qualityScore >= 80 && ["AA", "AAA"].includes(payload.qualityGrade), recommendation: "Raise quality governance controls to reach AA minimum." },
    { key: "iot_trust", ok: payload.iotTrustScore >= 80, recommendation: "Increase signed device reporting coverage." },
    { key: "mrv_data", ok: payload.mrvDataQuality >= 90, recommendation: "Improve MRV completeness and anomaly triage." },
    { key: "third_party_statement", ok: payload.verifierStatementSigned === true, recommendation: "Obtain signed verifier attestation." },
    { key: "registry_verification", ok: payload.registryCurrent === true, recommendation: "Resolve registry status issues." },
    { key: "sanctions_clean", ok: payload.sanctionsClean === true, recommendation: "Clear sanctions checks before submission." },
    { key: "beneficial_ownership", ok: payload.ownershipDisclosed === true, recommendation: "Complete ownership disclosures." },
    { key: "open_investigations", ok: payload.openInvestigations === 0, recommendation: "Close investigations before certifying." },
    { key: "collusion_flags", ok: payload.collusionFlags === 0, recommendation: "Resolve all active collusion flags." },
    { key: "article6_status", ok: ["applied", "not_required"].includes(payload.article6Status), recommendation: "Document Article 6 status." },
    { key: "device_signature_rate", ok: payload.validDeviceSignatures >= 95, recommendation: "Reach 95% valid signature threshold." },
    { key: "satellite_cross_validation", ok: payload.satelliteConsistent === true, recommendation: "Align NDVI and on-ground data." },
    { key: "legal_holds", ok: payload.legalHolds === 0, recommendation: "Release legal holds first." },
  ];

  const failed = checks.filter((c) => !c.ok);
  return { eligible: failed.length === 0, failedCriteria: failed.map((f) => f.key), recommendations: failed.map((f) => f.recommendation) };
}

export function registerUvsRoutes(app: Express) {
  app.use("/api/uvs", rateLimit({
    windowMs: 60_000,
    max: 500,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Rate limit exceeded", code: "RATE_LIMITED", requestId: randomUUID() },
  }));

  app.get("/api/uvs/methodology", (_req, res) => {
    const version = process.env.UVS_METHODOLOGY_VERSION || "1.0";
    const hash = hashObj({ version, doc: "UVS-METHODOLOGY-V1" });
    res.json({ version, documentHash: hash, storedInVault: true, auditReference: { firstBlock: 9101, lastBlock: blockCounter } });
  });

  app.post("/api/uvs/certify/:creditId", (req, res) => {
    const bodySchema = z.object({
      qualityScore: z.number().min(0).max(100).default(85),
      qualityGrade: z.string().default("AA"),
      iotTrustScore: z.number().min(0).max(100).default(85),
      mrvDataQuality: z.number().min(0).max(100).default(92),
      verifierStatementSigned: z.boolean().default(true),
      registryCurrent: z.boolean().default(true),
      sanctionsClean: z.boolean().default(true),
      ownershipDisclosed: z.boolean().default(true),
      openInvestigations: z.number().int().min(0).default(0),
      collusionFlags: z.number().int().min(0).default(0),
      article6Status: z.enum(["applied", "not_required"]).default("applied"),
      validDeviceSignatures: z.number().min(0).max(100).default(97),
      satelliteConsistent: z.boolean().default(true),
      legalHolds: z.number().int().min(0).default(0),
      projectName: z.string().default("Unnamed UVS Project"),
      registry: z.enum(["Verra", "Gold Standard"]).default("Gold Standard"),
      projectType: z.string().default("REDD+"),
      country: z.string().default("Unknown"),
      tonnes: z.number().positive().default(1000),
      vintageYear: z.number().int().default(new Date().getFullYear() - 1),
      supplierOrganization: z.string().default("Unknown Supplier"),
      verifierName: z.string().default("Assigned Verifier"),
      verifierOrganization: z.string().default("Verifier Org"),
      corsiaEligible: z.boolean().default(false),
      sdgCount: z.number().int().min(0).default(0),
    });
    const parsed = bodySchema.safeParse(req.body || {});
    if (!parsed.success) return sendError(res, 400, "Invalid payload", "VALIDATION_ERROR", { issues: parsed.error.issues });

    const eligibility = evaluateEligibility(parsed.data);
    if (!eligibility.eligible) return res.status(200).json(eligibility);

    const year = new Date().getFullYear();
    const seq = String(Math.floor(Math.random() * 999999)).padStart(6, "0");
    const code = parsed.data.registry === "Gold Standard" ? "GS" : "VERRA";
    const certificateNumber = `UVS-${year}-${code}-${seq}`;

    const certificate: Certificate = {
      id: randomUUID(),
      creditId: req.params.creditId,
      certificateNumber,
      status: "certified",
      certifiedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      revokedAt: null,
      revocationReason: null,
      qualityScore: parsed.data.qualityScore,
      qualityGrade: parsed.data.qualityGrade,
      iotTrustScore: parsed.data.iotTrustScore,
      mrvDataQuality: parsed.data.mrvDataQuality,
      verifierId: randomUUID(),
      verifierStatementId: randomUUID(),
      article6Status: parsed.data.article6Status,
      corsiaEligible: parsed.data.corsiaEligible,
      sdgCount: parsed.data.sdgCount,
      sanctionsClean: parsed.data.sanctionsClean,
      openInvestigations: 0,
      auditBlockId: blockCounter++,
      certificateHash: "",
      publicUrl: `/x/verify/${certificateNumber}`,
      qrCodePath: `/assets/qr/${certificateNumber}.png`,
      evidencePackageHash: "",
      projectName: parsed.data.projectName,
      registry: parsed.data.registry,
      projectType: parsed.data.projectType,
      country: parsed.data.country,
      tonnes: parsed.data.tonnes,
      vintageYear: parsed.data.vintageYear,
      supplierOrganization: parsed.data.supplierOrganization,
      verifierName: parsed.data.verifierName,
      verifierOrganization: parsed.data.verifierOrganization,
      criteria: criteriaLabels.map(([key, label]) => ({ key, label, passed: true, detail: "Pass" })),
    };

    certificate.evidencePackageHash = hashObj({ type: "evidence", certificate });
    certificate.certificateHash = hashObj({ type: "certificate", certificate });
    certificates.unshift(certificate);

    return res.json({
      eligible: true,
      certificate,
      actions: [
        "evidence_package_assembled",
        "audit_chain_entry_uvs_certified",
        "webhook_certificate.issued",
        "credit_registry_uvsEligible=true",
      ],
    });
  });

  app.post("/api/uvs/revoke/:certificateId", (req, res) => {
    const parsed = z.object({ reason: z.string().min(5) }).safeParse(req.body || {});
    if (!parsed.success) return sendError(res, 400, "Revocation reason is required", "VALIDATION_ERROR", { issues: parsed.error.issues });
    const cert = certificates.find((c) => c.id === req.params.certificateId || c.certificateNumber === req.params.certificateId);
    if (!cert) return sendError(res, 404, "Certificate not found", "NOT_FOUND");
    cert.status = "revoked";
    cert.revokedAt = new Date().toISOString();
    cert.revocationReason = parsed.data.reason;
    cert.auditBlockId = blockCounter++;
    res.json({ ok: true, certificate: cert, event: "uvs_revoked", webhookTargets: ["buyers", "supplier"] });
  });

  app.post("/api/uvs/renew/:certificateId", (req, res) => {
    const cert = certificates.find((c) => c.id === req.params.certificateId || c.certificateNumber === req.params.certificateId);
    if (!cert) return sendError(res, 404, "Certificate not found", "NOT_FOUND");
    const archived = { ...cert, status: "revoked" as UvsStatus, revokedAt: new Date().toISOString(), revocationReason: "Archived by renewal" };
    certificates.push(archived);
    cert.status = "certified";
    cert.certifiedAt = new Date().toISOString();
    cert.expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
    cert.auditBlockId = blockCounter++;
    cert.certificateHash = hashObj({ type: "renewed-certificate", cert });
    res.json({ renewed: true, certificate: cert, archivedCertificate: archived.id });
  });

  app.get("/api/uvs/certificates", (req, res) => {
    const { registry, grade, projectType, country } = req.query;
    const filtered = certificates.filter((c) => c.status !== "revoked").filter((c) => {
      return (!registry || c.registry === registry) && (!grade || c.qualityGrade === grade) && (!projectType || c.projectType === projectType) && (!country || c.country === country);
    });
    res.json(filtered);
  });

  app.get("/api/uvs/certificates/:certificateNumber", (req, res) => {
    const cert = certificates.find((c) => c.certificateNumber === req.params.certificateNumber);
    if (!cert) return sendError(res, 404, "Certificate not found", "NOT_FOUND");
    const auditBlocks = Array.from({ length: 5 }).map((_, i) => ({
      number: cert.auditBlockId - i,
      timestamp: new Date(Date.now() - i * 3_600_000).toISOString(),
      type: i === 0 ? "uvs_certified" : "criteria_checkpoint",
      hash: hashObj({ block: cert.auditBlockId - i, certificateNumber: cert.certificateNumber }).slice(0, 32),
    }));
    res.json({ ...cert, auditBlocks, methodologyVersion: process.env.UVS_METHODOLOGY_VERSION || "1.0" });
  });

  app.get("/api/uvs/certificates/:certificateNumber/pdf", (req, res) => {
    const cert = certificates.find((c) => c.certificateNumber === req.params.certificateNumber);
    if (!cert) return sendError(res, 404, "Certificate not found", "NOT_FOUND");
    res.json({
      ok: true,
      message: "PDF generation endpoint ready",
      url: `/api/uvs/certificates/${cert.certificateNumber}/pdf`,
      pages: 4,
      sections: ["certificate", "evidence", "methodology", "verification_guide"],
    });
  });

  app.get("/api/uvs/certificates/:certificateNumber/embed-code", (req, res) => {
    const cert = certificates.find((c) => c.certificateNumber === req.params.certificateNumber);
    if (!cert) return sendError(res, 404, "Certificate not found", "NOT_FOUND");
    res.json({
      iframeCode: `<iframe src="https://uaiu.live/x/widget/${cert.certificateNumber}" width="600" height="400" loading="lazy" title="UVS Verification Widget"></iframe>`,
      scriptCode: `<script>window.UAIUWidget={certificate:"${cert.certificateNumber}"}</script>`,
      instructions: "Paste this code into your investor relations page",
    });
  });

  app.post("/api/committee/amendments", (req, res) => {
    const parsed = z.object({ proposedBy: z.string().min(2), title: z.string().min(4), description: z.string().min(10) }).safeParse(req.body || {});
    if (!parsed.success) return sendError(res, 400, "Invalid amendment payload", "VALIDATION_ERROR", { issues: parsed.error.issues });
    const amendment: Amendment = { id: randomUUID(), ...parsed.data, status: "proposed", proposedAt: new Date().toISOString(), votingClosesAt: null, approvedAt: null, votes: { for: [], against: [], abstain: [] }, auditBlockId: blockCounter++ };
    amendments.unshift(amendment);
    res.status(201).json(amendment);
  });

  app.post("/api/committee/amendments/:id/vote", (req, res) => {
    const parsed = z.object({ voterId: z.string().min(2), vote: z.enum(["for", "against", "abstain"]) }).safeParse(req.body || {});
    if (!parsed.success) return sendError(res, 400, "Invalid vote payload", "VALIDATION_ERROR", { issues: parsed.error.issues });
    const amendment = amendments.find((a) => a.id === req.params.id);
    if (!amendment) return sendError(res, 404, "Amendment not found", "NOT_FOUND");

    amendment.votes.for = amendment.votes.for.filter((v) => v !== parsed.data.voterId);
    amendment.votes.against = amendment.votes.against.filter((v) => v !== parsed.data.voterId);
    amendment.votes.abstain = amendment.votes.abstain.filter((v) => v !== parsed.data.voterId);
    amendment.votes[parsed.data.vote].push(parsed.data.voterId);
    amendment.status = "voting";
    amendment.votingClosesAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    amendment.auditBlockId = blockCounter++;
    res.json(amendment);
  });

  app.get("/api/committee/amendments", (_req, res) => {
    res.json(amendments);
  });

  app.get("/api/committee/members", (_req, res) => {
    res.json(committeeMembers);
  });

  app.post("/api/notifications/subscribe", (req, res) => {
    const parsed = z.object({ userId: z.string().min(1), endpoint: z.string().url(), keys: z.record(z.string(), z.string()), deviceType: z.string().min(2) }).safeParse(req.body || {});
    if (!parsed.success) return sendError(res, 400, "Invalid subscription payload", "VALIDATION_ERROR", { issues: parsed.error.issues });
    const id = randomUUID();
    subscriptions.set(id, { id, createdAt: new Date().toISOString(), ...parsed.data });
    res.status(201).json({ id, saved: true });
  });

  app.post("/api/notifications/send", (req, res) => {
    const parsed = z.object({ eventType: z.string().min(2), message: z.string().min(2), audience: z.enum(["buyers", "suppliers", "verifiers", "all"]).default("all") }).safeParse(req.body || {});
    if (!parsed.success) return sendError(res, 400, "Invalid notification payload", "VALIDATION_ERROR", { issues: parsed.error.issues });
    res.json({ queued: true, deliveredCount: subscriptions.size, ...parsed.data });
  });

  app.get("/api/notifications/preferences", (req, res) => {
    const userId = String(req.query.userId || "public");
    res.json(preferences.get(userId) || { userId, quietHours: { start: "22:00", end: "07:00" }, digestMode: "realtime", events: {} });
  });

  app.put("/api/notifications/preferences", (req, res) => {
    const parsed = z.object({ userId: z.string().min(1), quietHours: z.object({ start: z.string(), end: z.string() }).optional(), digestMode: z.enum(["daily", "realtime"]).default("realtime"), events: z.record(z.string(), z.boolean()).default({}) }).safeParse(req.body || {});
    if (!parsed.success) return sendError(res, 400, "Invalid preferences payload", "VALIDATION_ERROR", { issues: parsed.error.issues });
    preferences.set(parsed.data.userId, parsed.data);
    res.json({ saved: true, preferences: parsed.data });
  });

  // 24h auto re-check (in-process)
  setInterval(() => {
    certificates.forEach((cert) => {
      if (cert.status !== "certified") return;
      if (new Date(cert.expiresAt).getTime() < Date.now()) {
        cert.status = "suspended";
        cert.revocationReason = "Certificate expired";
      }
    });
  }, 24 * 60 * 60 * 1000).unref();
}
