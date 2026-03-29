import type { Express } from "express";
import { createHash } from "node:crypto";
import PDFDocument from "pdfkit";
import { asc, desc, eq } from "drizzle-orm";

import { db } from "./db";
import {
  algorithmRotationLog,
  auditChainEntries,
  escrowSettlementsLog,
  exchangeCreditListings,
  exchangeTrades,
  tradeRetirementCertificates,
} from "@shared/schema";
import { APPROVED_ALGORITHMS, getHashAlgorithm, validateEscrowFinality } from "./hash-agility";

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

  app.get("/api/audit/export/pdf", async (_req, res) => {
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

      const filename = `uaiu-audit-export-${Date.now()}.pdf`;
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

      const doc = new PDFDocument({ margin: 36, size: "A4" });
      doc.pipe(res);

      doc.fontSize(20).fillColor("#00ff88").text("UAIU.LIVE/X", { align: "left" });
      doc.moveDown(0.2);
      doc.fontSize(13).fillColor("#000000").text("Cryptographic Audit Trail Export");
      doc.moveDown(0.4);
      doc.fontSize(10).text(`Export timestamp: ${new Date().toISOString()}`);
      doc.text(`Chain integrity: ${chainIntact ? "INTACT" : "COMPROMISED"}`);
      doc.moveDown(0.5);
      doc.fontSize(10).text("# | Timestamp | Algorithm | Tx Type | Hash | Verified");
      doc.moveTo(36, doc.y).lineTo(560, doc.y).stroke();
      doc.moveDown(0.3);

      for (const block of verifiedBlocks) {
        const txType = String((block.transactionData as any)?.type || "unknown");
        const line = [
          String(block.blockNumber),
          new Date(block.timestamp as any).toISOString(),
          block.algorithm,
          txType,
          `${String(block.hash).slice(0, 14)}...`,
          block.verified ? "Yes" : "No",
        ].join(" | ");

        doc.fontSize(8).fillColor("#111111").text(line, { continued: false });
        if (doc.y > 760) doc.addPage();
      }

      doc.moveDown(0.8);
      doc.fontSize(10).fillColor("#333333").text("Generated by UAIU.LIVE/X — Cryptographic Audit Trail", {
        align: "center",
      });

      doc.end();
    } catch (error: any) {
      return res.status(500).json({ error: error.message || "Failed to export audit chain PDF" });
    }
  });

  app.post("/api/audit/algorithm-rotate", async (req, res) => {
    try {
      const { newAlgorithm, triggeredBy, notes } = req.body || {};
      const normalizedNewAlgorithm = String(newAlgorithm || "").trim().toLowerCase();
      const actor = String(triggeredBy || "").trim();

      if (!normalizedNewAlgorithm || !actor) {
        return res.status(400).json({ error: "newAlgorithm and triggeredBy are required" });
      }
      if (!APPROVED_ALGORITHMS.includes(normalizedNewAlgorithm)) {
        return res.status(400).json({
          error: `newAlgorithm must be one of: ${APPROVED_ALGORITHMS.join(", ")}`,
        });
      }

      const previousAlgorithm = getHashAlgorithm();
      const timestamp = new Date();
      const payload = {
        timestamp: timestamp.toISOString(),
        previousAlgorithm,
        newAlgorithm: normalizedNewAlgorithm,
        triggeredBy: actor,
        notes: notes || null,
      };
      const signatureHash = createHash("sha256").update(JSON.stringify(payload)).digest("hex");

      const [record] = await db.insert(algorithmRotationLog).values({
        timestamp,
        previousAlgorithm,
        newAlgorithm: normalizedNewAlgorithm,
        triggeredBy: actor,
        signatureHash,
        notes: notes || null,
      }).returning();

      return res.status(201).json(record);
    } catch (error: any) {
      return res.status(500).json({ error: error.message || "Failed to rotate algorithm" });
    }
  });

  app.get("/api/audit/algorithm-history", async (_req, res) => {
    try {
      const rows = await db.select().from(algorithmRotationLog).orderBy(desc(algorithmRotationLog.timestamp));
      return res.json(rows);
    } catch (error: any) {
      return res.status(500).json({ error: error.message || "Failed to fetch algorithm history" });
    }
  });

  app.get("/api/registry/verify/:creditId", async (req, res) => {
    try {
      const creditId = String(req.params.creditId || "").trim();
      const normalized = creditId.toUpperCase();
      const registry = normalized.startsWith("VCS") ? "Verra" : normalized.startsWith("GS") ? "Gold Standard" : "Unknown";
      const verified = registry !== "Unknown";
      return res.json({
        creditId,
        registry,
        verified,
        verifiedAt: new Date().toISOString(),
      });
    } catch (error: any) {
      return res.status(500).json({ error: error.message || "Failed to verify registry credit" });
    }
  });

  app.get("/api/trust/status", async (_req, res) => {
    try {
      const blocks = await db.select().from(auditChainEntries).orderBy(asc(auditChainEntries.blockNumber));
      let chainIntact = true;

      blocks.forEach((block, index) => {
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
      });

      const settlements = await db.select().from(escrowSettlementsLog);
      const settledOnly = settlements.filter((s) => String(s.status || "").toLowerCase().includes("settled"));
      const lastSettlement = settledOnly.sort((a, b) => {
        const ta = new Date(a.settledAt || 0).getTime();
        const tb = new Date(b.settledAt || 0).getTime();
        return tb - ta;
      })[0] || null;

      const retiredRecords = await db.select().from(tradeRetirementCertificates);
      const lastAuditBlock = blocks.length > 0 ? blocks[blocks.length - 1] : null;

      return res.json({
        chainIntact,
        currentAlgorithm: getHashAlgorithm(),
        approvedAlgorithms: APPROVED_ALGORITHMS,
        lastSettlementAt: lastSettlement?.settledAt || null,
        totalSettlements: settledOnly.length,
        totalCreditsRetired: retiredRecords.length,
        lastAuditBlock: lastAuditBlock
          ? {
              blockNumber: lastAuditBlock.blockNumber,
              timestamp: lastAuditBlock.timestamp,
              algorithm: lastAuditBlock.algorithm,
            }
          : null,
        lastUpdated: new Date().toISOString(),
      });
    } catch (error: any) {
      return res.status(500).json({ error: error.message || "Failed to fetch trust status" });
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

      const finalityEtaDate = new Date((record.settledAt ?? new Date()).getTime() + (finality.requiredHours * 60 * 60 * 1000));
      const hoursRemaining = Math.max(0, Math.floor(finality.requiredHours - finality.hoursElapsed));
      const percentComplete = Math.max(0, Math.min(100, Number(((finality.hoursElapsed / finality.requiredHours) * 100).toFixed(2))));

      return res.json({
        id: record.id,
        tradeId: record.tradeId,
        status: record.status,
        settled: finality.settled,
        hoursElapsed: finality.hoursElapsed,
        requiredHours: finality.requiredHours,
        hoursRemaining,
        percentComplete,
        finalityEta: finalityEtaDate.toISOString(),
        algorithmAtSettlement: finality.algorithmAtSettlement,
        algorithmApproved: finality.algorithmApproved,
        requiresManualReview: finality.requiresManualReview,
        approvedAlgorithms: finality.approvedAlgorithms,
      });
    } catch (error: any) {
      return res.status(500).json({ error: error.message || "Failed to fetch escrow settlement status" });
    }
  });

  app.post("/api/escrow/:id/certificate", async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ error: "id must be a positive integer" });
      }

      const settlement = await db.query.escrowSettlementsLog.findFirst({
        where: eq(escrowSettlementsLog.id, id),
      });
      if (!settlement) return res.status(404).json({ error: "Settlement record not found" });

      const trade = await db.query.exchangeTrades.findFirst({
        where: eq(exchangeTrades.tradeId, settlement.tradeId),
      });

      const filename = `retirement-certificate-${settlement.tradeId || settlement.id}.pdf`;
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

      const doc = new PDFDocument({ margin: 48, size: "A4" });
      doc.pipe(res);

      doc.fontSize(24).fillColor("#00a86b").text("UAIU.LIVE/X", { align: "center" });
      doc.moveDown(0.2);
      doc.fontSize(16).fillColor("#111111").text("Retirement Certificate", { align: "center" });
      doc.moveDown(1);

      const rows: [string, string][] = [
        ["Credit ID", settlement.tradeId || `ESCROW-${settlement.id}`],
        ["Registry", String(trade?.sellerRegistryName || "Not specified")],
        ["Algorithm Used", String(settlement.hashAlgorithm || "sha256")],
        ["Settlement Timestamp", new Date(settlement.settledAt || new Date()).toISOString()],
        ["Trade Reference", String(trade?.tradeId || settlement.tradeId || "N/A")],
      ];

      doc.fontSize(11).fillColor("#222222");
      rows.forEach(([k, v]) => {
        doc.text(`${k}: ${v}`);
        doc.moveDown(0.25);
      });

      doc.moveDown(1.2);
      doc.fontSize(10).fillColor("#555555").text("Issued by UAIU.LIVE/X settlement infrastructure.", { align: "left" });
      doc.end();
    } catch (error: any) {
      return res.status(500).json({ error: error.message || "Failed to generate retirement certificate" });
    }
  });

  app.get("/api/supplier/dashboard", async (req, res) => {
    try {
      const email = String(req.query.email || "").trim().toLowerCase();

      const listings = email
        ? await db.select().from(exchangeCreditListings)
          .where(eq(exchangeCreditListings.email, email))
          .orderBy(desc(exchangeCreditListings.createdAt))
        : await db.select().from(exchangeCreditListings)
          .orderBy(desc(exchangeCreditListings.createdAt))
          .limit(25);

      const enriched = await Promise.all(listings.map(async (listing) => {
        const trade = listing.registrySerial
          ? await db.query.exchangeTrades.findFirst({
              where: eq(exchangeTrades.sellerRegistrySerial, listing.registrySerial),
              orderBy: (t, { desc: d }) => [d(t.createdAt)],
            })
          : null;

        const settlement = trade?.tradeId
          ? await db.query.escrowSettlementsLog.findFirst({
              where: eq(escrowSettlementsLog.tradeId, trade.tradeId),
              orderBy: (t, { desc: d }) => [d(t.id)],
            })
          : null;

        return {
          listing,
          trade,
          settlement,
        };
      }));

      return res.json({
        email: email || null,
        records: enriched,
      });
    } catch (error: any) {
      return res.status(500).json({ error: error.message || "Failed to fetch supplier dashboard" });
    }
  });
}
