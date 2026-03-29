import type { Express } from "express";
import { createHash, randomUUID } from "crypto";
import { sql } from "drizzle-orm";
import { db } from "./db";
import { academicAccessRequests } from "@shared/schema";

function citationHeader(): string {
  const today = new Date().toISOString().split("T")[0];
  return `UAIU Holdings Corp. UAIU.LIVE/X Carbon Market Data [platform launch-${today}]. Retrieved ${today}. uaiu.live/x/academic. DOI: pending`;
}

export function registerAcademicRoutes(app: Express): void {
  app.use("/api/academic/v1", (_req, res, next) => {
    res.setHeader("X-UAIU-Citation", citationHeader());
    next();
  });

  app.post("/api/academic/v1/access-request", async (req, res) => {
    try {
      const body = req.body || {};
      const rawApiKey = randomUUID().replace(/-/g, "");
      const apiKey = createHash("sha256").update(rawApiKey).digest("hex");
      const [row] = await db.insert(academicAccessRequests).values({
        institutionName: String(body.institutionName || ""),
        researcherName: String(body.researcherName || ""),
        researcherEmail: String(body.researcherEmail || ""),
        orcidId: body.orcidId ? String(body.orcidId) : null,
        researchPurpose: String(body.researchPurpose || ""),
        dataRequested: body.dataRequested || {},
        dataAccessLevel: String(body.dataAccessLevel || "aggregate_only"),
        citationFormat: citationHeader(),
        status: "submitted",
        apiKey,
      }).returning();
      res.status(201).json({ id: row.id, status: row.status });
    } catch (error: any) {
      res.status(500).json({ error: error?.message || "Failed to create request" });
    }
  });

  app.get("/api/academic/v1/market/price-series", async (_req, res) => {
    const rows = await db.execute(sql`
      SELECT date_trunc('day', created_at) AS timestamp,
             COALESCE(standard, 'unknown') AS credit_type,
             COALESCE(registry_name, 'unknown') AS registry,
             ROUND(SUM(price_per_tonne * volume_tonnes)::numeric / NULLIF(SUM(volume_tonnes),0), 4) AS avg_price,
             SUM(volume_tonnes)::numeric AS volume,
             COUNT(*)::int AS transaction_count
      FROM exchange_credit_listings
      GROUP BY 1,2,3
      ORDER BY 1 ASC
    `).catch(() => ({ rows: [] } as any));
    res.json((rows as any).rows || []);
  });

  app.get("/api/academic/v1/verification/outcomes", async (_req, res) => {
    const rows = await db.execute(sql`
      SELECT
        CASE WHEN verifier_id IS NULL OR verifier_id = '' THEN 'independent' ELSE 'registered_verifier' END AS verifier_type,
        COALESCE(cr.project_type, 'unknown') AS credit_type,
        COALESCE(cr.registry, 'unknown') AS geography,
        COALESCE(vs.methodology_code, 'unknown') AS standard_applied,
        status,
        COUNT(*)::int AS count
      FROM uvs_certifications uc
      LEFT JOIN credit_registry cr ON cr.id = uc.credit_id
      LEFT JOIN verification_statements vs ON vs.id = uc.verifier_statement_id
      GROUP BY 1,2,3,4,5
      ORDER BY count DESC
    `).catch(() => ({ rows: [] } as any));
    res.json((rows as any).rows || []);
  });

  app.get("/api/academic/v1/iot/data-quality", async (_req, res) => {
    const rows = await db.execute(sql`
      SELECT
        COALESCE(d.device_type, 'unknown') AS device_type,
        COALESCE((d.location->>'country'), 'unknown') AS geography,
        COALESCE(cr.project_type, 'unknown') AS credit_type,
        ROUND(AVG(CASE WHEN r.signature_valid THEN 1 ELSE 0 END)::numeric, 4) AS signature_validity_rate,
        ROUND(AVG(CASE WHEN r.anomaly_flag THEN 1 ELSE 0 END)::numeric, 4) AS anomaly_rate,
        COUNT(*)::int AS coverage_rate
      FROM iot_readings r
      LEFT JOIN iot_devices d ON d.id = r.device_id
      LEFT JOIN credit_registry cr ON cr.id = d.project_id
      GROUP BY 1,2,3
      ORDER BY coverage_rate DESC
    `).catch(() => ({ rows: [] } as any));
    res.json((rows as any).rows || []);
  });

  app.get("/api/academic/v1/methodology/citations", async (_req, res) => {
    const rows = await db.execute(sql`
      SELECT
        COALESCE(pm.methodology_code, 'unknown') AS methodology_code,
        COUNT(mc.id)::int AS citation_count,
        ROUND(AVG(COALESCE(ecl.price_per_tonne,0))::numeric, 4) AS avg_credit_price,
        COUNT(DISTINCT mc.credit_id)::int AS unique_credits
      FROM partner_methodologies pm
      LEFT JOIN methodology_citations mc ON mc.methodology_id = pm.id
      LEFT JOIN exchange_credit_listings ecl ON ecl.standard ILIKE '%' || pm.methodology_code || '%'
      GROUP BY 1
      ORDER BY citation_count DESC
    `).catch(() => ({ rows: [] } as any));
    res.json((rows as any).rows || []);
  });

  app.get("/api/academic/v1/fraud/patterns", async (_req, res) => {
    const rows = await db.execute(sql`
      SELECT anomaly_type,
             severity,
             COUNT(*)::int AS detected_count,
             ROUND(AVG(CASE WHEN resolved THEN 1 ELSE 0 END)::numeric, 4) AS resolution_rate
      FROM anomaly_events
      GROUP BY anomaly_type, severity
      ORDER BY detected_count DESC
    `).catch(() => ({ rows: [] } as any));
    res.json((rows as any).rows || []);
  });

  app.get("/api/academic/v1/pqc/algorithm-usage", async (_req, res) => {
    const rows = await db.execute(sql`
      SELECT date_trunc('day', timestamp) AS timestamp,
             algorithm,
             COUNT(*)::int AS usage_count,
             COUNT(*) FILTER (WHERE LOWER(algorithm) NOT IN ('sha256','sha3-256','blake2b512'))::int AS deprecated_events
      FROM audit_chain_entries
      GROUP BY 1,2
      ORDER BY 1 ASC
    `);
    res.json((rows as any).rows || []);
  });
}
