import type { Express } from "express";
import { and, desc, eq, sql } from "drizzle-orm";
import { createHash, randomUUID } from "crypto";
import {
  auditChainEntries,
  creditRegistry,
  partnerMethodologies,
  methodologyCitations,
  verificationStatements,
} from "@shared/schema";
import { db } from "./db";
import { getHashAlgorithm } from "./hash-agility";

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

function computeAlignment(methodology: string, standardReference: string) {
  const normalizedMethod = methodology.toLowerCase();
  const sections = [
    "scope",
    "definitions",
    "verification steps",
    "evidence requirements",
    "materiality thresholds",
    "reporting format",
    "limitations",
  ];
  const fullyAligned = sections.filter((s) => normalizedMethod.includes(s));
  const partiallyAligned = sections.filter((s) => !fullyAligned.includes(s) && normalizedMethod.includes(s.split(" ")[0]));
  const gaps = sections.filter((s) => !fullyAligned.includes(s) && !partiallyAligned.includes(s));
  const baseScore = Math.round((fullyAligned.length / sections.length) * 100);

  return {
    standardReference,
    alignmentScore: Math.min(100, Math.max(0, baseScore + Math.min(15, standardReference.length % 10))),
    fullyAligned,
    partiallyAligned,
    gaps,
    recommendations: gaps.map((g) => `Add explicit ${g} mapping against ${standardReference}.`),
  };
}

export function registerMethodologyRoutes(app: Express): void {
  app.post("/api/methodologies", async (req, res) => {
    try {
      const {
        partnerId,
        methodologyCode,
        version,
        title,
        description,
        scope,
        applicableStandards = [],
        applicableCreditTypes = [],
        applicableGeographies = [],
        methodology,
        changeLog,
        status = "published",
      } = req.body || {};

      if (!partnerId || !methodologyCode || !version || !title || !methodology) {
        return res.status(400).json({ error: "partnerId, methodologyCode, version, title, methodology are required" });
      }

      const documentHash = createHash("sha256").update(String(methodology)).digest("hex");
      const evidenceVaultId = randomUUID();
      const publishedAt = new Date();

      const audit = await addAuditEntry({
        type: "methodology_published",
        partnerId,
        methodologyCode,
        version,
        documentHash,
      });

      const [created] = await db.insert(partnerMethodologies).values({
        partnerId,
        methodologyCode,
        version,
        title,
        description: description || null,
        scope: scope || null,
        applicableStandards,
        applicableCreditTypes,
        applicableGeographies,
        methodology,
        changeLog: changeLog || null,
        publishedAt,
        status,
        documentHash,
        evidenceVaultId,
        auditBlockId: audit.blockNumber,
      }).returning();

      return res.status(201).json({
        ...created,
        publicUrl: `/x/methodologies/${created.methodologyCode}/${created.version}`,
      });
    } catch (error: any) {
      return res.status(500).json({ error: error.message || "Failed to publish methodology" });
    }
  });

  app.get("/api/methodologies/:id/citations", async (req, res) => {
    try {
      const id = String(req.params.id || "");
      const rows = await db
        .select({
          id: methodologyCitations.id,
          creditId: methodologyCitations.creditId,
          project: creditRegistry.projectType,
          tonnes: methodologyCitations.creditsVerified,
          date: methodologyCitations.createdAt,
          buyerOrganization: methodologyCitations.buyerOrganization,
        })
        .from(methodologyCitations)
        .leftJoin(creditRegistry, eq(creditRegistry.id, methodologyCitations.creditId))
        .where(eq(methodologyCitations.methodologyId, id))
        .orderBy(desc(methodologyCitations.createdAt));
      return res.json(rows);
    } catch (error: any) {
      return res.status(500).json({ error: error.message || "Failed to fetch citations" });
    }
  });

  app.post("/api/methodologies/:id/cite", async (req, res) => {
    try {
      const id = String(req.params.id || "");
      const { creditId, creditsVerified, project, tonnes, buyerOrganization } = req.body || {};
      if (!creditId) return res.status(400).json({ error: "creditId is required" });

      const [methodology] = await db.select().from(partnerMethodologies).where(eq(partnerMethodologies.id, id));
      if (!methodology) return res.status(404).json({ error: "Methodology not found" });

      const [citation] = await db.insert(methodologyCitations).values({
        methodologyId: id,
        creditId,
        projectName: project || null,
        creditsVerified: Number(creditsVerified ?? tonnes ?? 0),
        buyerOrganization: buyerOrganization || null,
      }).returning();

      await db.update(partnerMethodologies)
        .set({ citationCount: sql`${partnerMethodologies.citationCount} + 1` })
        .where(eq(partnerMethodologies.id, id));

      await addAuditEntry({
        type: "methodology_cited",
        methodologyId: id,
        methodologyCode: methodology.methodologyCode,
        methodologyVersion: methodology.version,
        methodologyHash: methodology.documentHash,
        creditId,
      });

      await db.update(verificationStatements).set({
        methodologyCode: methodology.methodologyCode,
        methodologyVersion: methodology.version,
        methodologyHash: methodology.documentHash,
      }).where(eq(verificationStatements.id, String(creditId)));

      return res.status(201).json(citation);
    } catch (error: any) {
      return res.status(500).json({ error: error.message || "Failed to create citation" });
    }
  });

  app.get("/api/methodologies/:code/:version", async (req, res) => {
    try {
      const code = String(req.params.code || "");
      const version = String(req.params.version || "");
      const [item] = await db.select().from(partnerMethodologies)
        .where(and(eq(partnerMethodologies.methodologyCode, code), eq(partnerMethodologies.version, version), eq(partnerMethodologies.status, "published")));
      if (!item) return res.status(404).json({ error: "Methodology not found" });

      await db.update(partnerMethodologies)
        .set({ downloadCount: sql`${partnerMethodologies.downloadCount} + 1` })
        .where(eq(partnerMethodologies.id, item.id));

      return res.json({ ...item, publicUrl: `/x/methodologies/${item.methodologyCode}/${item.version}` });
    } catch (error: any) {
      return res.status(500).json({ error: error.message || "Failed to fetch methodology" });
    }
  });

  app.get("/api/methodologies/:code", async (req, res) => {
    try {
      const code = String(req.params.code || "");
      const history = await db.select().from(partnerMethodologies)
        .where(and(eq(partnerMethodologies.methodologyCode, code), eq(partnerMethodologies.status, "published")))
        .orderBy(desc(partnerMethodologies.publishedAt));
      if (!history.length) return res.status(404).json({ error: "Methodology not found" });

      return res.json({ latest: history[0], versionHistory: history });
    } catch (error: any) {
      return res.status(500).json({ error: error.message || "Failed to fetch methodology history" });
    }
  });

  app.get("/api/methodologies", async (req, res) => {
    try {
      const standard = String(req.query.standard || "").toLowerCase();
      const creditType = String(req.query.creditType || "").toLowerCase();
      const geography = String(req.query.geography || "").toLowerCase();
      const sort = String(req.query.sort || "newest");

      const rows = await db.select().from(partnerMethodologies).where(eq(partnerMethodologies.status, "published"));
      let filtered = rows.filter((row) => {
        const standards = ((row.applicableStandards || []) as string[]).map((x) => String(x).toLowerCase());
        const types = ((row.applicableCreditTypes || []) as string[]).map((x) => String(x).toLowerCase());
        const geos = ((row.applicableGeographies || []) as string[]).map((x) => String(x).toLowerCase());
        return (!standard || standards.some((x) => x.includes(standard)))
          && (!creditType || types.some((x) => x.includes(creditType)))
          && (!geography || geos.some((x) => x.includes(geography)));
      });

      if (sort === "citation") filtered = filtered.sort((a, b) => (b.citationCount || 0) - (a.citationCount || 0));
      if (sort === "partner_reputation") filtered = filtered.sort((a, b) => (b.citationCount || 0) - (a.citationCount || 0));
      if (sort === "newest") filtered = filtered.sort((a, b) => +new Date(b.publishedAt || 0) - +new Date(a.publishedAt || 0));

      return res.json(filtered);
    } catch (error: any) {
      return res.status(500).json({ error: error.message || "Failed to fetch methodologies" });
    }
  });

  app.post("/api/methodologies/alignment-check", async (req, res) => {
    try {
      const { methodologyId, standardReference } = req.body || {};
      if (!methodologyId || !standardReference) {
        return res.status(400).json({ error: "methodologyId and standardReference are required" });
      }

      const [methodology] = await db.select().from(partnerMethodologies).where(eq(partnerMethodologies.id, methodologyId));
      if (!methodology) return res.status(404).json({ error: "Methodology not found" });

      const result = computeAlignment(String(methodology.methodology || ""), String(standardReference));
      return res.json({ methodologyId, ...result });
    } catch (error: any) {
      return res.status(500).json({ error: error.message || "Failed to run alignment check" });
    }
  });

  app.get("/api/partner/methodology-impact", async (req, res) => {
    try {
      const partnerId = String(req.query.partnerId || req.headers["x-partner-id"] || "");
      if (!partnerId) return res.status(400).json({ error: "partnerId is required" });

      const methods = await db.select().from(partnerMethodologies).where(eq(partnerMethodologies.partnerId, partnerId));
      const methodIds = methods.map((m) => m.id);
      const allCitations = await db.select().from(methodologyCitations);
      const citations = allCitations.filter((c) => methodIds.includes(c.methodologyId));

      const totalCreditsVerified = citations.length;
      const totalTonnes = citations.reduce((sum, c) => sum + Number(c.creditsVerified || 0), 0);
      const countries = Array.from(new Set(methods.flatMap((m) => (m.applicableGeographies as string[] || []))));
      const standards = Array.from(new Set(methods.flatMap((m) => (m.applicableStandards as string[] || []))));
      const downloads = methods.reduce((sum, m) => sum + Number(m.downloadCount || 0), 0);
      const views = downloads;
      const citationsCount = methods.reduce((sum, m) => sum + Number(m.citationCount || 0), 0);

      return res.json({
        partnerId,
        totalCreditsVerified,
        totalTonnes,
        countries,
        registriesCovered: standards,
        standardsAlignedTo: standards,
        timeSpan: {
          firstUse: citations[0]?.createdAt || null,
          latest: citations[citations.length - 1]?.createdAt || null,
        },
        methodologyReach: {
          downloads,
          views,
          citations: citationsCount,
          trend: citationsCount > 20 ? "growing" : citationsCount > 5 ? "stable" : "declining",
        },
        citationTrail: citations,
      });
    } catch (error: any) {
      return res.status(500).json({ error: error.message || "Failed to fetch methodology impact" });
    }
  });
}
