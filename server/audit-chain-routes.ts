import type { Express } from "express";
import { createHash } from "node:crypto";
import { asc, eq } from "drizzle-orm";

import { db } from "./db";
import { auditChainEntries, escrowSettlementsLog } from "@shared/schema";
import { getHashAlgorithm, validateEscrowFinality } from "./hash-agility";

function hashEntry(entry: Record<string, unknown>, algorithm: string): string {
  return createHash(algorithm).update(JSON.stringify(entry)).digest("hex");
}

export function registerAuditChainRoutes(app: Express): void {
  app.post("/api/audit/entry", async (req, res) => {
    try {
      const transactionData = req.body?.transactionData;
      if (!transactionData || typeof transactionData !== "object" || Array.isArray(transactionData)) {
        return res.status(400).json({ error: "transactionData object is required" });
      }

      const lastBlock = await db.query.auditChainEntries.findFirst({
        orderBy: (t, { desc }) => [desc(t.blockNumber)],
      });

      const blockNumber = (lastBlock?.blockNumber ?? 0) + 1;
      const prevHash = lastBlock?.hash ?? "0000000000000000";
      const algorithm = getHashAlgorithm();
      const timestamp = new Date();
      const entryToHash = {
        blockNumber,
        timestamp: timestamp.toISOString(),
        algorithm,
        transactionData,
        prevHash,
      };
      const hash = hashEntry(entryToHash, algorithm);

      const [created] = await db.insert(auditChainEntries).values({
        blockNumber,
        timestamp,
        algorithm,
        transactionData,
        prevHash,
        hash,
      }).returning();

      return res.status(201).json(created);
    } catch (error: any) {
      return res.status(500).json({ error: error.message || "Failed to create audit chain entry" });
    }
  });

  app.get("/api/audit/chain", async (_req, res) => {
    try {
      const blocks = await db.select().from(auditChainEntries).orderBy(asc(auditChainEntries.blockNumber));
      let chainIntact = true;

      const verifiedBlocks = blocks.map((block, index) => {
        const expectedPrevHash = index === 0 ? "0000000000000000" : blocks[index - 1].hash;
        const entryToHash = {
          blockNumber: block.blockNumber,
          timestamp: block.timestamp?.toISOString?.() || new Date(block.timestamp as any).toISOString(),
          algorithm: block.algorithm,
          transactionData: block.transactionData,
          prevHash: block.prevHash,
        };
        const recomputedHash = hashEntry(entryToHash, block.algorithm);
        const verified = block.prevHash === expectedPrevHash && block.hash === recomputedHash;
        if (!verified) chainIntact = false;
        return { ...block, verified };
      });

      return res.json({ chainIntact, blocks: verifiedBlocks });
    } catch (error: any) {
      return res.status(500).json({ error: error.message || "Failed to fetch audit chain" });
    }
  });

  app.post("/api/escrow/settle", async (req, res) => {
    try {
      const { tradeId, paymentIntentId, amountEur, uaiuFeeEur, sellerNetEur } = req.body || {};
      if (!tradeId || !paymentIntentId || [amountEur, uaiuFeeEur, sellerNetEur].some((v) => typeof v !== "number")) {
        return res.status(400).json({
          error: "tradeId, paymentIntentId, amountEur, uaiuFeeEur, sellerNetEur are required",
        });
      }

      const [created] = await db.insert(escrowSettlementsLog).values({
        tradeId,
        paymentIntentId,
        amountEur,
        uaiuFeeEur,
        sellerNetEur,
        status: "held",
        settledAt: new Date(),
        hashAlgorithm: getHashAlgorithm(),
      }).returning();

      return res.status(201).json(created);
    } catch (error: any) {
      return res.status(500).json({ error: error.message || "Failed to create escrow settlement" });
    }
  });

  app.get("/api/escrow/:id/status", async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ error: "id must be a positive integer" });
      }

      const record = await db.query.escrowSettlementsLog.findFirst({
        where: eq(escrowSettlementsLog.id, id),
      });

      if (!record) {
        return res.status(404).json({ error: "Settlement record not found" });
      }

      const finality = validateEscrowFinality(
        record.settledAt ?? new Date(),
        record.hashAlgorithm || "sha256",
      );

      return res.json({
        id: record.id,
        tradeId: record.tradeId,
        status: record.status,
        settled: finality.settled,
        hoursElapsed: finality.hoursElapsed,
        requiredHours: finality.requiredHours,
        algorithmAtSettlement: finality.algorithmAtSettlement,
        algorithmApproved: finality.algorithmApproved,
        requiresManualReview: finality.requiresManualReview,
        approvedAlgorithms: finality.approvedAlgorithms,
      });
    } catch (error: any) {
      return res.status(500).json({ error: error.message || "Failed to fetch escrow settlement status" });
    }
  });
}
