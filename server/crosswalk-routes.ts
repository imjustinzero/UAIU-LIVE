import type { Express } from "express";
import { and, eq, sql } from "drizzle-orm";
import { db } from "./db";
import { standardsCrosswalk } from "@shared/schema";
import { requireAdminHeader } from "./exchange-auth";

export function registerCrosswalkRoutes(app: Express): void {
  app.get("/api/crosswalk/standards", async (req, res) => {
    const { sourceStandard, targetStandard, alignmentType } = req.query as Record<string, string | undefined>;
    const conditions: any[] = [];
    if (sourceStandard) conditions.push(eq(standardsCrosswalk.sourceStandard, sourceStandard));
    if (targetStandard) conditions.push(eq(standardsCrosswalk.targetStandard, targetStandard));
    if (alignmentType) conditions.push(eq(standardsCrosswalk.alignmentType, alignmentType));

    const rows = conditions.length
      ? await db.select().from(standardsCrosswalk).where(and(...conditions))
      : await db.select().from(standardsCrosswalk);
    res.json(rows);
  });

  app.get("/api/crosswalk/platform-coverage", async (_req, res) => {
    const rows = await db.execute(sql`
      SELECT source_standard,
             COUNT(*)::int AS total_clauses,
             COUNT(*) FILTER (WHERE COALESCE(uaiu_feature_reference,'') <> '')::int AS covered_clauses,
             ROUND((COUNT(*) FILTER (WHERE COALESCE(uaiu_feature_reference,'') <> '')::numeric / NULLIF(COUNT(*),0)) * 100, 2) AS coverage_percent,
             COUNT(*) FILTER (WHERE alignment_type IN ('gap','conflict'))::int AS gap_count
      FROM standards_crosswalk
      GROUP BY source_standard
      ORDER BY source_standard
    `);
    res.json((rows as any).rows || []);
  });

  app.post("/api/crosswalk/entries", requireAdminHeader, async (req, res) => {
    const body = req.body || {};
    const [row] = await db.insert(standardsCrosswalk).values({
      sourceStandard: String(body.sourceStandard || ""),
      sourceClause: String(body.sourceClause || ""),
      sourceRequirement: String(body.sourceRequirement || ""),
      targetStandard: String(body.targetStandard || ""),
      targetClause: String(body.targetClause || ""),
      targetRequirement: String(body.targetRequirement || ""),
      alignmentType: String(body.alignmentType || "partial"),
      alignmentNotes: body.alignmentNotes ? String(body.alignmentNotes) : null,
      uaiuImplementation: body.uaiuImplementation ? String(body.uaiuImplementation) : null,
      uaiuFeatureReference: body.uaiuFeatureReference ? String(body.uaiuFeatureReference) : null,
    }).returning();
    res.status(201).json(row);
  });
}
