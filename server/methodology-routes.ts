import type { Express, Request } from "express";
import { createHmac, createHash, randomUUID } from "crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import {
  auditChainEntries,
  exchangeCreditListings,
  exchangeTrades,
  isoVerifiers,
  methodologyComments,
  methodologyDrafts,
  methodologyPeerReviews,
  methodologyVotes,
  methodologyWorkingGroups,
  mqiSnapshots,
  professionalProfiles,
  uvsCertifications,
} from "@shared/schema";
import { db } from "./db";
import { getHashAlgorithm } from "./hash-agility";

type MqiComponentBreakdown = {
  peerCitationScore: number;
  standardsAlignment: number;
  realWorldUsage: number;
  outcomeTracking: number;
  verifierReputation: number;
  academicReferences: number;
};

function clamp(val: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Number.isFinite(val) ? val : 0));
}

function mqiGrade(score: number): string {
  if (score >= 95) return "AAA";
  if (score >= 90) return "AA";
  if (score >= 82) return "A";
  if (score >= 74) return "BBB";
  if (score >= 66) return "BB";
  if (score >= 55) return "B";
  return "C";
}

function calculateTrend(current: number, previous?: number): "improving" | "stable" | "declining" {
  if (typeof previous !== "number") return "stable";
  const delta = current - previous;
  if (delta > 1.5) return "improving";
  if (delta < -1.5) return "declining";
  return "stable";
}

function signMqiPayload(payload: unknown): string {
  const key = process.env.MQI_SIGNING_KEY || process.env.AUDIT_CHAIN_SIGNING_KEY || "uaiu_mqi_dev_key";
  return createHmac("sha256", key).update(JSON.stringify(payload)).digest("hex");
}

async function addAuditEntry(transactionData: Record<string, any>) {
  const lastBlock = await db.query.auditChainEntries.findFirst({ orderBy: (t, { desc }) => [desc(t.blockNumber)] });
  const blockNumber = (lastBlock?.blockNumber ?? 0) + 1;
  const prevHash = lastBlock?.hash ?? "0000000000000000";
  const algorithm = getHashAlgorithm();
  const timestamp = new Date();
  const entryToHash = { blockNumber, timestamp: timestamp.toISOString(), algorithm, transactionData, prevHash };
  const hash = createHash(algorithm).update(JSON.stringify(entryToHash)).digest("hex");
  const [created] = await db.insert(auditChainEntries).values({ blockNumber, timestamp, algorithm, transactionData, prevHash, hash }).returning();
  return created;
}

async function methodologyCodeFromId(methodologyId: string): Promise<string> {
  const result = await db.execute(sql`SELECT ${methodologyId}::text as id`);
  const id = (result as any).rows?.[0]?.id || methodologyId;
  return `MTH-${String(id).slice(0, 8).toUpperCase()}`;
}

async function computeMqi(methodologyId: string, methodologyCode: string): Promise<{ score: number; grade: string; components: MqiComponentBreakdown }> {
  const peerCitationsRaw = await db.execute(sql`
    SELECT COUNT(*)::int AS count
    FROM methodology_comments c
    JOIN methodology_drafts d ON d.id = c.draft_id
    WHERE d.methodology_id = ${methodologyId}
      AND c.commenter_type IN ('verified_partner','working_group')
  `);
  const peerCitationCount = Number((peerCitationsRaw as any).rows?.[0]?.count ?? 0);
  const peerCitationScore = clamp(peerCitationCount * 12.5);

  const usageRaw = await db.execute(sql`
    SELECT
      COUNT(*)::int AS listing_count,
      COUNT(DISTINCT COALESCE(project_origin,''))::int AS geographies,
      COUNT(DISTINCT COALESCE(registry_name,''))::int AS registries,
      COALESCE(SUM(CASE WHEN created_at >= NOW() - INTERVAL '180 days' THEN 1 ELSE 0 END),0)::int AS recent
    FROM exchange_credit_listings
    WHERE status IN ('active','pending')
      AND (standard ILIKE '%' || ${methodologyCode} || '%' OR credit_type ILIKE '%' || ${methodologyCode} || '%')
  `);
  const usage = (usageRaw as any).rows?.[0] || {};
  const realWorldUsage = clamp(
    Number(usage.listing_count || 0) * 10 +
    Number(usage.geographies || 0) * 15 +
    Number(usage.registries || 0) * 15 +
    Number(usage.recent || 0) * 8,
  );

  const standardsAlignment = clamp(72 + Math.min(20, peerCitationCount * 1.6));

  const outcomeRaw = await db.execute(sql`
    SELECT
      COALESCE(AVG(CASE WHEN status = 'certified' THEN 100 ELSE 55 END), 62)::numeric AS cert_health,
      COALESCE(AVG(COALESCE(iot_trust_score, 80)), 80)::numeric AS iot_avg,
      COALESCE(AVG(CASE WHEN COALESCE(open_investigations,0) = 0 THEN 100 ELSE 45 END), 85)::numeric AS integrity
    FROM uvs_certifications
  `);
  const outcome = (outcomeRaw as any).rows?.[0] || {};
  const outcomeTracking = clamp((Number(outcome.cert_health || 0) * 0.45) + (Number(outcome.iot_avg || 0) * 0.35) + (Number(outcome.integrity || 0) * 0.2));

  const verifierRaw = await db.execute(sql`
    SELECT COALESCE(AVG(COALESCE(reputation_score,75)),75)::numeric AS avg_rep
    FROM iso_verifiers
    WHERE status = 'active'
  `);
  const verifierReputation = clamp(Number((verifierRaw as any).rows?.[0]?.avg_rep ?? 75));

  const academicRaw = await db.execute(sql`
    SELECT COALESCE(COUNT(*),0)::int AS refs
    FROM professional_profiles
    WHERE jsonb_array_length(COALESCE(publications_linked, '[]'::jsonb)) > 0
  `);
  const academicReferences = clamp(Number((academicRaw as any).rows?.[0]?.refs ?? 0) * 10);

  const components: MqiComponentBreakdown = {
    peerCitationScore,
    standardsAlignment,
    realWorldUsage,
    outcomeTracking,
    verifierReputation,
    academicReferences,
  };

  const score = clamp(
    peerCitationScore * 0.25 +
    standardsAlignment * 0.2 +
    realWorldUsage * 0.2 +
    outcomeTracking * 0.2 +
    verifierReputation * 0.1 +
    academicReferences * 0.05,
  );

  return { score: Number(score.toFixed(2)), grade: mqiGrade(score), components };
}

function requestRole(req: Request): string {
  return String(req.headers["x-user-role"] || "public").toLowerCase();
}

export async function calculateAndStoreMqi(methodologyId: string) {
  const methodologyCode = await methodologyCodeFromId(methodologyId);
  const { score, grade, components } = await computeMqi(methodologyId, methodologyCode);
  const prev = await db.query.mqiSnapshots.findFirst({ where: eq(mqiSnapshots.methodologyId, methodologyId), orderBy: (t, { desc }) => [desc(t.calculatedAt)] });
  const trend = calculateTrend(score, prev?.score != null ? Number(prev.score) : undefined);
  const calculatedAt = new Date();
  const signaturePayload = { methodologyId, methodologyCode, score, grade, components, trend, calculatedAt: calculatedAt.toISOString() };
  const indexSignature = signMqiPayload(signaturePayload);
  const audit = await addAuditEntry({ type: "mqi_snapshot", ...signaturePayload, indexSignature });

  const [snapshot] = await db.insert(mqiSnapshots).values({
    id: randomUUID(),
    methodologyId,
    methodologyCode,
    score: String(score),
    grade,
    components,
    trend,
    calculatedAt,
    indexSignature,
    auditBlockId: audit.blockNumber,
  }).returning();

  return snapshot;
}

export function registerMethodologyRoutes(app: Express): void {
  app.post("/api/mqi/calculate/:methodologyId", async (req, res) => {
    try {
      const snapshot = await calculateAndStoreMqi(req.params.methodologyId);
      return res.json(snapshot);
    } catch (error: any) {
      return res.status(500).json({ error: error?.message || "Failed to calculate MQI" });
    }
  });

  app.get("/api/mqi/:methodologyCode/current", async (req, res) => {
    const methodologyCode = String(req.params.methodologyCode || "").toUpperCase();
    const snapshot = await db.query.mqiSnapshots.findFirst({ where: eq(mqiSnapshots.methodologyCode, methodologyCode), orderBy: (t, { desc }) => [desc(t.calculatedAt)] });
    if (!snapshot) return res.status(404).json({ error: "MQI snapshot not found" });
    return res.json(snapshot);
  });

  app.get("/api/mqi/:methodologyCode/history", async (req, res) => {
    const methodologyCode = String(req.params.methodologyCode || "").toUpperCase();
    const history = await db.query.mqiSnapshots.findMany({ where: eq(mqiSnapshots.methodologyCode, methodologyCode), orderBy: (t, { desc }) => [desc(t.calculatedAt)] });
    return res.json(history);
  });

  app.get("/api/mqi/leaderboard", async (req, res) => {
    const { standard, creditType, geography } = req.query as Record<string, string | undefined>;
    const all = await db.query.mqiSnapshots.findMany({ orderBy: (t, { desc }) => [desc(t.calculatedAt)] });
    const latestByCode = new Map<string, any>();
    for (const row of all) if (!latestByCode.has(row.methodologyCode)) latestByCode.set(row.methodologyCode, row);
    let rows = Array.from(latestByCode.values()).sort((a, b) => Number(b.score) - Number(a.score));
    if (standard) rows = rows.filter((r) => r.methodologyCode.toLowerCase().includes(standard.toLowerCase()));
    if (creditType) rows = rows.filter((r) => r.methodologyCode.toLowerCase().includes(creditType.toLowerCase()));
    if (geography) rows = rows.filter((r) => JSON.stringify(r.components).toLowerCase().includes(geography.toLowerCase()));
    return res.json(rows);
  });

  app.post("/api/working-groups/create", async (req, res) => {
    try {
      const payload = req.body || {};
      const [row] = await db.insert(methodologyWorkingGroups).values({
        id: randomUUID(),
        name: String(payload.name || "Unnamed Working Group"),
        description: String(payload.description || ""),
        leadOrganization: String(payload.leadOrganization || "Unknown"),
        leadContactId: payload.leadContactId ? String(payload.leadContactId) : null,
        memberIds: Array.isArray(payload.memberIds) ? payload.memberIds : [],
        status: String(payload.status || "forming"),
        targetStandard: String(payload.targetStandard || ""),
        createdAt: new Date(),
      }).returning();
      return res.json(row);
    } catch (error: any) {
      return res.status(500).json({ error: error?.message || "Failed to create working group" });
    }
  });

  app.get("/api/working-groups", async (_req, res) => {
    const groups = await db.query.methodologyWorkingGroups.findMany({ orderBy: (t, { desc }) => [desc(t.createdAt)] });
    const withCounts = await Promise.all(groups.map(async (g) => {
      const [draft] = await db.select().from(methodologyDrafts).where(eq(methodologyDrafts.workingGroupId, g.id)).orderBy(desc(methodologyDrafts.publishedAt)).limit(1);
      return {
        ...g,
        memberCount: Array.isArray(g.memberIds) ? g.memberIds.length : 0,
        currentDraftStage: draft?.draftNumber || "—",
      };
    }));
    res.json(withCounts);
  });

  app.get("/api/working-groups/:id", async (req, res) => {
    const id = String(req.params.id || "");
    const group = await db.query.methodologyWorkingGroups.findFirst({ where: eq(methodologyWorkingGroups.id, id) });
    if (!group) return res.status(404).json({ error: "Working group not found" });
    const drafts = await db.query.methodologyDrafts.findMany({ where: eq(methodologyDrafts.workingGroupId, id), orderBy: (t, { desc }) => [desc(t.publishedAt)] });
    const latestDraft = drafts[0] || null;
    const voteResults = latestDraft ? await db.select({ vote: methodologyVotes.vote, count: sql<number>`count(*)::int` }).from(methodologyVotes).where(eq(methodologyVotes.draftId, latestDraft.id)).groupBy(methodologyVotes.vote) : [];
    return res.json({ ...group, drafts, currentDraft: latestDraft, voteResults });
  });

  app.post("/api/working-groups/:id/draft", async (req, res) => {
    const workingGroupId = String(req.params.id || "");
    const payload = req.body || {};
    const previous = await db.query.methodologyDrafts.findFirst({ where: eq(methodologyDrafts.workingGroupId, workingGroupId), orderBy: (t, { desc }) => [desc(t.publishedAt)] });
    const content = String(payload.content || "");
    const contentHash = createHash("sha256").update(content).digest("hex");
    const audit = await addAuditEntry({ type: "methodology_draft", workingGroupId, draftNumber: payload.draftNumber, contentHash });
    const [row] = await db.insert(methodologyDrafts).values({
      id: randomUUID(),
      workingGroupId,
      methodologyId: payload.methodologyId ? String(payload.methodologyId) : null,
      draftNumber: String(payload.draftNumber || `WD-${Date.now()}`),
      title: String(payload.title || "Untitled Draft"),
      content,
      contentHash,
      status: String(payload.status || "working_draft"),
      publishedAt: new Date(),
      commentDeadline: payload.commentDeadline ? new Date(payload.commentDeadline) : null,
      auditBlockId: audit.blockNumber,
    }).returning();
    const diffSummary = previous ? { previousDraftNumber: previous.draftNumber, changedChars: Math.abs((previous.content || "").length - content.length) } : null;
    res.json({ ...row, diffSummary });
  });

  app.get("/api/working-groups/:id/draft/:draftNumber", async (req, res) => {
    const { id, draftNumber } = req.params;
    const draft = await db.query.methodologyDrafts.findFirst({ where: and(eq(methodologyDrafts.workingGroupId, id), eq(methodologyDrafts.draftNumber, draftNumber)) });
    if (!draft) return res.status(404).json({ error: "Draft not found" });
    const comments = await db.query.methodologyComments.findMany({ where: eq(methodologyComments.draftId, draft.id), orderBy: (t, { desc }) => [desc(t.createdAt)] });
    const commentsByParagraph = comments.reduce<Record<string, number>>((acc, c) => {
      const key = c.paragraph || "general";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    res.json({ draft, commentsByParagraph });
  });

  app.post("/api/methodology-comments", async (req, res) => {
    const role = requestRole(req);
    const payload = req.body || {};
    if (role === "public" && (!payload.publicName || !payload.publicEmail)) {
      return res.status(400).json({ error: "Public comments require name and email" });
    }
    const audit = await addAuditEntry({ type: "methodology_comment", draftId: payload.draftId, paragraph: payload.paragraph, commentType: payload.commentType });
    const [row] = await db.insert(methodologyComments).values({
      id: randomUUID(),
      draftId: String(payload.draftId),
      commenterId: payload.commenterId ? String(payload.commenterId) : null,
      commenterType: String(payload.commenterType || (role === "public" ? "public" : "verified_partner")),
      paragraph: String(payload.paragraph || "general"),
      commentType: String(payload.commentType || "general"),
      comment: String(payload.comment || ""),
      proposedChange: payload.proposedChange ? String(payload.proposedChange) : null,
      status: "open",
      createdAt: new Date(),
      auditBlockId: audit.blockNumber,
    }).returning();
    res.json(row);
  });

  app.get("/api/methodology-comments/:draftId", async (req, res) => {
    const { type, status, section, sort = "newest" } = req.query as Record<string, string>;
    let rows = await db.query.methodologyComments.findMany({ where: eq(methodologyComments.draftId, req.params.draftId), orderBy: (t, { desc }) => [desc(t.createdAt)] });
    if (type) rows = rows.filter((r) => r.commentType === type);
    if (status) rows = rows.filter((r) => r.status === status);
    if (section) rows = rows.filter((r) => (r.paragraph || "").includes(section));
    if (sort === "most_supported") rows = rows.sort((a, b) => (b.comment?.length || 0) - (a.comment?.length || 0));
    res.json(rows);
  });

  app.post("/api/methodology-votes", async (req, res) => {
    const role = requestRole(req);
    if (!["verified_partner", "iso_verifier"].includes(role)) {
      return res.status(403).json({ error: "Only verified partners and ISO verifiers can vote" });
    }
    const payload = req.body || {};
    const audit = await addAuditEntry({ type: "methodology_vote", draftId: payload.draftId, vote: payload.vote, voterOrg: payload.voterOrg });
    const [row] = await db.insert(methodologyVotes).values({
      id: randomUUID(),
      draftId: String(payload.draftId),
      voterId: String(payload.voterId || randomUUID()),
      voterOrg: payload.voterOrg ? String(payload.voterOrg) : null,
      vote: String(payload.vote || "abstain"),
      comments: payload.comments ? String(payload.comments) : null,
      votedAt: new Date(),
      auditBlockId: audit.blockNumber,
    }).returning();
    res.json(row);
  });

  app.get("/api/methodology-votes/:draftId/results", async (req, res) => {
    const draftId = String(req.params.draftId);
    const votes = await db.query.methodologyVotes.findMany({ where: eq(methodologyVotes.draftId, draftId), orderBy: (t, { desc }) => [desc(t.votedAt)] });
    const tally = votes.reduce<Record<string, number>>((acc, v) => {
      acc[v.vote] = (acc[v.vote] || 0) + 1;
      return acc;
    }, {});
    const threshold = Number(process.env.METHODOLOGY_VOTE_APPROVAL_THRESHOLD || 0.66);
    const total = votes.length;
    const approvePct = total > 0 ? (tally.approve || 0) / total : 0;
    res.json({ draftId, totalVotes: total, tally, threshold, passed: approvePct >= threshold, votes });
  });

  app.post("/api/peer-review/request/:methodologyId", async (req, res) => {
    const methodologyId = String(req.params.methodologyId);
    const profilePool = await db.query.professionalProfiles.findMany({ orderBy: (t, { desc }) => [desc(t.reputationScore)] });
    const selected = profilePool
      .filter((p) => Number(p.reputationScore || 0) >= 75 && Number(p.mqlContributions || 0) <= 2)
      .slice(0, 3);

    const created = await Promise.all(selected.map(async (p) => {
      const [review] = await db.insert(methodologyPeerReviews).values({
        id: randomUUID(),
        methodologyId,
        reviewerId: p.userId,
        reviewerCredentials: p.credentials || {},
        assignedAt: new Date(),
      }).returning();
      return review;
    }));

    res.json({ methodologyId, reviewerCount: created.length, reviews: created, reviewPeriodDays: 21 });
  });

  app.post("/api/peer-review/:reviewId/submit", async (req, res) => {
    const reviewId = String(req.params.reviewId);
    const payload = req.body || {};
    const reviewHash = createHash("sha256").update(JSON.stringify(payload)).digest("hex");
    const audit = await addAuditEntry({ type: "methodology_peer_review", reviewId, reviewHash });

    const [updated] = await db.update(methodologyPeerReviews).set({
      completedAt: new Date(),
      recommendation: String(payload.recommendation || "major_revisions"),
      summary: String(payload.summary || ""),
      technicalComments: String(payload.technicalComments || ""),
      strengthsNoted: payload.strengthsNoted ? String(payload.strengthsNoted) : null,
      weaknessesNoted: payload.weaknessesNoted ? String(payload.weaknessesNoted) : null,
      requiredRevisions: payload.requiredRevisions ? String(payload.requiredRevisions) : null,
      reviewHash,
      auditBlockId: audit.blockNumber,
    }).where(eq(methodologyPeerReviews.id, reviewId)).returning();

    res.json(updated || { error: "Review not found" });
  });

  app.get("/api/peer-review/:methodologyId", async (req, res) => {
    const methodologyId = String(req.params.methodologyId);
    const reviews = await db.query.methodologyPeerReviews.findMany({ where: eq(methodologyPeerReviews.methodologyId, methodologyId), orderBy: (t, { desc }) => [desc(t.completedAt)] });
    const completed = reviews.filter((r) => !!r.completedAt);
    if (completed.length === 0) return res.json({ methodologyId, status: "in_progress", reviews: [] });
    res.json({ methodologyId, status: "completed", reviews: completed });
  });

  app.get("/api/intelligence/feed", async (req, res) => {
    const interests = String(req.query.interests || "").toLowerCase().split(",").filter(Boolean);
    const mqiChanges = await db.query.mqiSnapshots.findMany({ orderBy: (t, { desc }) => [desc(t.calculatedAt)], limit: 12 });
    const groups = await db.query.methodologyWorkingGroups.findMany({ orderBy: (t, { desc }) => [desc(t.createdAt)], limit: 8 });
    const reviews = await db.query.methodologyPeerReviews.findMany({ orderBy: (t, { desc }) => [desc(t.completedAt)], limit: 8 });

    const items = [
      ...mqiChanges.map((m) => ({ type: "methodology_watch", title: `MQI update: ${m.methodologyCode} now ${m.grade} (${m.score})`, publishedAt: m.calculatedAt, payload: m })),
      ...groups.map((g) => ({ type: "standards", title: `${g.name} moved to ${g.status}`, publishedAt: g.createdAt, payload: g })),
      ...reviews.filter((r) => !!r.completedAt).map((r) => ({ type: "peer_review", title: `Peer review ${r.recommendation || 'submitted'} for methodology`, publishedAt: r.completedAt, payload: r })),
    ].sort((a, b) => +new Date(String(b.publishedAt)) - +new Date(String(a.publishedAt)));

    const filtered = interests.length === 0 ? items : items.filter((i) => interests.some((k) => `${i.type} ${i.title}`.toLowerCase().includes(k)));
    const dailyBriefing = filtered.slice(0, 5);

    res.json({
      generatedAt: new Date().toISOString(),
      dailyBriefing,
      feed: filtered,
      aiBriefing: "Over the last 24 hours, methodology governance activity accelerated across MQI, standards working groups, and peer reviews. Key updates include newly recalculated methodology quality snapshots, movement in draft consultation status, and additional completed peer-review recommendations that may influence market confidence. Professionals should track high-grade methodology momentum and ballot outcomes because these are increasingly linked to pricing and procurement preference.",
    });
  });

  app.get("/api/professionals/:id", async (req, res) => {
    const profile = await db.query.professionalProfiles.findFirst({ where: eq(professionalProfiles.id, req.params.id) });
    if (!profile) return res.status(404).json({ error: "Professional profile not found" });
    res.json(profile);
  });
}

export function startMethodologyCron(): void {
  const every24hMs = 24 * 60 * 60 * 1000;
  const run = async () => {
    try {
      const rows = await db.execute(sql`SELECT DISTINCT methodology_id FROM methodology_peer_reviews WHERE methodology_id IS NOT NULL`);
      const ids = ((rows as any).rows || []).map((r: any) => String(r.methodology_id));
      for (const id of ids) {
        await calculateAndStoreMqi(id);
      }
      console.log(`[MQI Cron] recalculated ${ids.length} methodologies`);
    } catch (error: any) {
      console.error("[MQI Cron] failed:", error?.message || error);
    }
  };

  setTimeout(run, 60_000);
  setInterval(run, every24hMs);
}
