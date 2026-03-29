import type { Express } from "express";
import { createHash } from "crypto";
import { desc, eq } from "drizzle-orm";
import { db } from "./db";
import { auditChainEntries, securityChallenges } from "@shared/schema";
import { getHashAlgorithm } from "./hash-agility";
import { requireAdminHeader } from "./exchange-auth";

function hashPayload(payload: Record<string, unknown>, algorithm: string): string {
  return createHash(algorithm).update(JSON.stringify(payload)).digest("hex");
}

async function addAuditEntry(transactionData: Record<string, any>) {
  const lastBlock = await db.query.auditChainEntries.findFirst({ orderBy: (t, { desc }) => [desc(t.blockNumber)] });
  const blockNumber = (lastBlock?.blockNumber ?? 0) + 1;
  const prevHash = lastBlock?.hash ?? "0000000000000000";
  const algorithm = getHashAlgorithm();
  const timestamp = new Date();
  const payload = { blockNumber, timestamp: timestamp.toISOString(), algorithm, transactionData, prevHash };
  const hash = hashPayload(payload, algorithm);
  const [row] = await db.insert(auditChainEntries).values({ blockNumber, timestamp, algorithm, transactionData, prevHash, hash }).returning();
  return row;
}

async function nextChallengeNumber(): Promise<string> {
  const year = new Date().getUTCFullYear();
  const prefix = `UAIU-CHAL-${year}-`;
  const rows = await db.select({ challengeNumber: securityChallenges.challengeNumber }).from(securityChallenges);
  const seq = rows
    .map((r) => r.challengeNumber)
    .filter((n) => n.startsWith(prefix))
    .map((n) => Number(n.split("-").pop() || 0))
    .reduce((max, cur) => Math.max(max, cur), 0) + 1;
  return `${prefix}${String(seq).padStart(4, "0")}`;
}

export function registerChallengesRoutes(app: Express): void {
  app.post("/api/challenges/submit", async (req, res) => {
    try {
      const body = req.body || {};
      const challengeNumber = await nextChallengeNumber();
      const [row] = await db.insert(securityChallenges).values({
        challengeNumber,
        submittedBy: String(body.submittedBy || "Anonymous"),
        submitterEmail: String(body.submitterEmail || ""),
        claimChallenged: String(body.claimChallenged || ""),
        challengeDescription: String(body.challengeDescription || ""),
        evidenceRequested: String(body.evidenceRequested || ""),
        status: "open",
        public: body.public !== false,
      }).returning();

      const audit = await addAuditEntry({
        type: "security_challenge_submitted",
        challengeId: row.id,
        challengeNumber,
        submittedBy: row.submittedBy,
      });

      await db.update(securityChallenges).set({ auditBlockId: audit.blockNumber }).where(eq(securityChallenges.id, row.id));

      return res.status(201).json({ challengeNumber });
    } catch (error: any) {
      return res.status(500).json({ error: error?.message || "Failed to submit challenge" });
    }
  });

  app.post("/api/challenges/:id/respond", requireAdminHeader, async (req, res) => {
    try {
      const id = String(req.params.id || "");
      const body = req.body || {};
      const [updated] = await db.update(securityChallenges).set({
        platformResponse: String(body.platformResponse || ""),
        evidenceLinks: body.evidenceLinks || [],
        status: String(body.status || "evidence_provided"),
        resolvedAt: body.status === "resolved" ? new Date() : null,
        resolverNotes: body.resolverNotes ? String(body.resolverNotes) : null,
      }).where(eq(securityChallenges.id, id)).returning();
      if (!updated) return res.status(404).json({ error: "Challenge not found" });

      const audit = await addAuditEntry({
        type: "security_challenge_response",
        challengeId: id,
        challengeNumber: updated.challengeNumber,
        status: updated.status,
      });

      const [finalRow] = await db.update(securityChallenges).set({ auditBlockId: audit.blockNumber }).where(eq(securityChallenges.id, id)).returning();
      return res.json(finalRow);
    } catch (error: any) {
      return res.status(500).json({ error: error?.message || "Failed to respond to challenge" });
    }
  });

  app.get("/api/challenges", async (_req, res) => {
    const rows = await db.select().from(securityChallenges).where(eq(securityChallenges.public, true)).orderBy(desc(securityChallenges.createdAt));
    return res.json(rows);
  });

  app.get("/api/challenges/:id", async (req, res) => {
    const id = String(req.params.id || "");
    const row = await db.query.securityChallenges.findFirst({ where: eq(securityChallenges.id, id) });
    if (!row || !row.public) return res.status(404).json({ error: "Challenge not found" });
    return res.json(row);
  });
}
