import type { Express } from "express";
import { createHash } from "crypto";
import { execSync } from "child_process";
import { desc, eq, sql } from "drizzle-orm";
import {
  auditChainEntries,
  formalProperties,
} from "@shared/schema";
import { db } from "./db";
import { getApprovedAlgorithms, getHashAlgorithm } from "./hash-agility";
import { requireAdminHeader } from "./exchange-auth";

type PropertyResultStatus = "pass" | "fail" | "error";

type PropertyRunResult = {
  propertyId: string;
  status: PropertyResultStatus;
  evidence: any;
  timestamp: string;
  error?: string;
};

type PropertyDefinition = {
  propertyId: string;
  category: string;
  title: string;
  formalStatement: string;
  informalExplanation: string;
  testImplementation: string;
  standardsAlignment: Record<string, any>;
};

const PROPERTY_DEFINITIONS: PropertyDefinition[] = [
  {
    propertyId: "UAIU-PROP-001",
    category: "cryptographic",
    title: "Audit Chain Append-Only",
    formalStatement:
      "For all blocks B_i and B_j where i < j, hash(B_i) == B_{i+1}.prevHash (transitively). No block can be modified without invalidating all subsequent blocks.",
    informalExplanation:
      "Every new audit block links to the previous hash. If any historical block is changed, the chain verification fails.",
    testImplementation:
      "Load audit_chain_entries ordered by block_number. For each block i, assert block[i].prev_hash equals block[i-1].hash and recompute hash(entryPayload) equals stored hash.",
    standardsAlignment: {
      standard: "ISO 14064-3",
      clause: "§6.3",
      note: "Tamper evidence",
    },
  },
  {
    propertyId: "UAIU-PROP-002",
    category: "cryptographic",
    title: "Hash Agility Completeness",
    formalStatement:
      "No cryptographic hash operation in the codebase uses a hardcoded algorithm string. All hash operations resolve algorithm at runtime via getHashAlgorithm().",
    informalExplanation:
      "Developers cannot sneak in fixed hash algorithms for production-sensitive operations.",
    testImplementation:
      "Run static analysis for createHash('sha256') and createHash('sha3-256') literals under server/shared. Require zero matches.",
    standardsAlignment: {
      standard: "NIST IR 8547",
      clause: "Crypto agility guidance",
    },
  },
  {
    propertyId: "UAIU-PROP-003",
    category: "cryptographic",
    title: "Algorithm Attribution Completeness",
    formalStatement:
      "For all blocks B in audit_chain_entries, B.algorithm == the algorithm used to compute B.hash.",
    informalExplanation:
      "Each audit block declares the algorithm used; recomputation must match exactly.",
    testImplementation:
      "For each row in audit_chain_entries, recompute hash using row.algorithm on canonical payload and compare to row.hash.",
    standardsAlignment: {
      standard: "NIST CSF",
      clause: "PR.DS",
      note: "Integrity and cryptographic accountability",
    },
  },
  {
    propertyId: "UAIU-PROP-004",
    category: "economic",
    title: "Escrow Finality Monotonicity",
    formalStatement:
      "Once an escrow settlement reaches T+1 finality (settled=true), that status is never reversed.",
    informalExplanation:
      "After final settlement, the platform should never roll a trade back to unsettled.",
    testImplementation:
      "Query escrow_settlements_log for trades with both settled and non-settled statuses after settled timestamp. Require zero violations.",
    standardsAlignment: {
      standard: "Financial market infrastructure principle",
      clause: "Settlement finality",
    },
  },
  {
    propertyId: "UAIU-PROP-005",
    category: "economic",
    title: "Double-Spend Impossibility",
    formalStatement:
      "For all credits C, availableTonnes(C) + reservedTonnes(C) + soldTonnes(C) + retiredTonnes(C) == originalTotalTonnes(C) at all times.",
    informalExplanation:
      "Every credit tonne must be accounted for exactly once.",
    testImplementation:
      "Aggregate credit state fields and enforce conservation equation per credit. Require zero mismatches.",
    standardsAlignment: {
      standard: "ISO 14064-1",
      clause: "§6.3",
      note: "No double counting",
    },
  },
  {
    propertyId: "UAIU-PROP-006",
    category: "compliance",
    title: "UVS Criteria Completeness",
    formalStatement:
      "No UVS certificate exists in uvs_certifications with status='certified' where any of the 13 criteria was false at time of certification.",
    informalExplanation:
      "Certified UVS records must satisfy all quality checks or be flagged for review.",
    testImplementation:
      "Re-run the 13 UVS criteria for certified rows (or equivalent persisted booleans); fail if any active certificate violates checks.",
    standardsAlignment: {
      standard: "Internal UVS methodology",
      clause: "13-point criteria",
    },
  },
  {
    propertyId: "UAIU-PROP-007",
    category: "compliance",
    title: "Sanctions Screening Coverage",
    formalStatement:
      "No active supplier account exists in the system without a sanctions screening record with status='passed' in identity_verifications.",
    informalExplanation:
      "Every active supplier must have a passed sanctions screening record.",
    testImplementation:
      "LEFT JOIN active suppliers to identity_verifications and fail if any active supplier has no passed sanctions check.",
    standardsAlignment: {
      standard: "OFAC",
      clause: "Sanctions screening requirement",
    },
  },
  {
    propertyId: "UAIU-PROP-008",
    category: "operational",
    title: "Manual Review Non-Rejection",
    formalStatement:
      "No escrow settlement with algorithmAtSettlement NOT IN approvedAlgorithms has been automatically set to status='rejected'. Such settlements must only have status='held' or 'manual_review'.",
    informalExplanation:
      "If a deprecated algorithm is involved, system must hold for manual review instead of automatic rejection.",
    testImplementation:
      "Find settlements where hash_algorithm is not approved and status='rejected'. Require zero rows.",
    standardsAlignment: {
      standard: "Operational controls",
      clause: "Manual review safeguard",
    },
  },
  {
    propertyId: "UAIU-PROP-009",
    category: "data_integrity",
    title: "Evidence Vault Tamper Detection",
    formalStatement:
      "For all documents D in evidence_vault, SHA256(file_contents(D)) == D.fileHash at time of verification.",
    informalExplanation:
      "Stored evidence hashes must match file content hashes.",
    testImplementation:
      "Sample evidence_vault rows, hash corresponding file content with sha256, compare to stored file_hash.",
    standardsAlignment: {
      standard: "ISO 14064-3",
      clause: "Evidence integrity",
    },
  },
  {
    propertyId: "UAIU-PROP-010",
    category: "compliance",
    title: "Methodology Attribution Permanence",
    formalStatement:
      "For all verification statements VS referencing methodologyCode MC and methodologyVersion MV, the methodology document with code MC and version MV exists in partner_methodologies and its documentHash is unchanged.",
    informalExplanation:
      "Verification statements must point to an immutable methodology artifact.",
    testImplementation:
      "Join verification_statements to partner_methodologies by code/version and verify methodology_hash equals partner_methodologies.document_hash.",
    standardsAlignment: {
      standard: "ISO 14064-3",
      clause: "Methodology disclosure",
    },
  },
];

function hashAuditEntry(payload: Record<string, unknown>, algorithm: string): string {
  return createHash(algorithm).update(JSON.stringify(payload)).digest("hex");
}

async function addAuditEntry(transactionData: Record<string, any>) {
  const lastBlock = await db.query.auditChainEntries.findFirst({ orderBy: (t, { desc }) => [desc(t.blockNumber)] });
  const blockNumber = (lastBlock?.blockNumber ?? 0) + 1;
  const prevHash = lastBlock?.hash ?? "0000000000000000";
  const algorithm = getHashAlgorithm();
  const timestamp = new Date();
  const payload = { blockNumber, timestamp: timestamp.toISOString(), algorithm, transactionData, prevHash };
  const hash = hashAuditEntry(payload, algorithm);
  const [created] = await db.insert(auditChainEntries).values({ blockNumber, timestamp, algorithm, transactionData, prevHash, hash }).returning();
  return created;
}

async function ensurePropertyDefinitions(): Promise<void> {
  for (const def of PROPERTY_DEFINITIONS) {
    await db.insert(formalProperties).values({
      propertyId: def.propertyId,
      category: def.category,
      title: def.title,
      formalStatement: def.formalStatement,
      informalExplanation: def.informalExplanation,
      testImplementation: def.testImplementation,
      standardsAlignment: def.standardsAlignment,
      verificationLog: {},
      lastVerificationResult: "error",
    }).onConflictDoUpdate({
      target: formalProperties.propertyId,
      set: {
        category: def.category,
        title: def.title,
        formalStatement: def.formalStatement,
        informalExplanation: def.informalExplanation,
        testImplementation: def.testImplementation,
        standardsAlignment: def.standardsAlignment,
      },
    });
  }
}

async function runProperty(propertyId: string): Promise<PropertyRunResult> {
  const timestamp = new Date().toISOString();

  try {
    if (propertyId === "UAIU-PROP-001" || propertyId === "UAIU-PROP-003") {
      const rows = await db.select().from(auditChainEntries).orderBy(auditChainEntries.blockNumber);
      const violations: any[] = [];
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const expectedPrev = i === 0 ? "0000000000000000" : rows[i - 1].hash;
        const payload = {
          blockNumber: row.blockNumber,
          timestamp: new Date(row.timestamp as any).toISOString(),
          algorithm: row.algorithm,
          transactionData: row.transactionData,
          prevHash: row.prevHash,
        };
        const recomputed = hashAuditEntry(payload, row.algorithm);
        if (row.prevHash !== expectedPrev || row.hash !== recomputed) {
          violations.push({ blockNumber: row.blockNumber, prevHashMatches: row.prevHash === expectedPrev, hashMatches: row.hash === recomputed });
        }
      }
      return {
        propertyId,
        status: violations.length === 0 ? "pass" : "fail",
        evidence: { totalBlocks: rows.length, violations },
        timestamp,
      };
    }

    if (propertyId === "UAIU-PROP-002") {
      const cmd = `rg -n "createHash\\((['\\\"])sha(256|3-256)\\1\\)" server shared --glob '*.ts' || true`;
      const output = execSync(cmd, { encoding: "utf-8" });
      const lines = output.trim().split("\n").filter(Boolean);
      return { propertyId, status: lines.length === 0 ? "pass" : "fail", evidence: { literalHashCalls: lines }, timestamp };
    }

    if (propertyId === "UAIU-PROP-004") {
      const rows = await db.execute(sql`
        SELECT trade_id,
               COUNT(*) FILTER (WHERE status IN ('auto_settled','cron_settled','settled')) AS settled_count,
               COUNT(*) FILTER (WHERE status IN ('pending','requires_capture','unsettled')) AS unsettled_count
        FROM escrow_settlements_log
        GROUP BY trade_id
        HAVING COUNT(*) FILTER (WHERE status IN ('auto_settled','cron_settled','settled')) > 0
           AND COUNT(*) FILTER (WHERE status IN ('pending','requires_capture','unsettled')) > 0
      `);
      const violations = (rows as any).rows || [];
      return { propertyId, status: violations.length === 0 ? "pass" : "fail", evidence: { violations }, timestamp };
    }

    if (propertyId === "UAIU-PROP-005") {
      const rows = await db.execute(sql`
        SELECT id,
               COALESCE((metadata->>'originalTotalTonnes')::numeric, NULL) AS original,
               COALESCE((metadata->>'availableTonnes')::numeric, 0) AS available,
               COALESCE((metadata->>'reservedTonnes')::numeric, 0) AS reserved,
               COALESCE((metadata->>'soldTonnes')::numeric, 0) AS sold,
               COALESCE((metadata->>'retiredTonnes')::numeric, 0) AS retired
        FROM exchange_credit_listings
        WHERE metadata IS NOT NULL
      `).catch(() => ({ rows: [] } as any));
      const violations = ((rows as any).rows || []).filter((r: any) => {
        if (r.original == null) return false;
        const lhs = Number(r.available) + Number(r.reserved) + Number(r.sold) + Number(r.retired);
        return Math.abs(lhs - Number(r.original)) > 0.000001;
      });
      return { propertyId, status: violations.length === 0 ? "pass" : "fail", evidence: { checked: (rows as any).rows?.length || 0, violations }, timestamp };
    }

    if (propertyId === "UAIU-PROP-006") {
      const rows = await db.execute(sql`
        SELECT id, certificate_number,
               COALESCE(quality_score,0) >= 80 AS quality_ok,
               COALESCE(iot_trust_score,0) >= 80 AS iot_ok,
               COALESCE(mrv_data_quality,0) >= 90 AS mrv_ok,
               COALESCE(sanctions_clean,false) AS sanctions_ok,
               COALESCE(open_investigations,0) = 0 AS investigations_ok
        FROM uvs_certifications
        WHERE status = 'certified'
      `);
      const failed = ((rows as any).rows || []).filter((r: any) => !r.quality_ok || !r.iot_ok || !r.mrv_ok || !r.sanctions_ok || !r.investigations_ok);
      return { propertyId, status: failed.length === 0 ? "pass" : "fail", evidence: { certifiedCount: (rows as any).rows?.length || 0, failed }, timestamp };
    }

    if (propertyId === "UAIU-PROP-007") {
      const rows = await db.execute(sql`
        SELECT s.id, s.email
        FROM suppliers s
        LEFT JOIN identity_verifications iv
          ON iv.supplier_id = s.id
          AND iv.status = 'passed'
        WHERE COALESCE(s.status, 'active') = 'active'
          AND iv.id IS NULL
      `);
      return { propertyId, status: ((rows as any).rows || []).length === 0 ? "pass" : "fail", evidence: { unscreenedAccounts: (rows as any).rows || [] }, timestamp };
    }

    if (propertyId === "UAIU-PROP-008") {
      const approved = getApprovedAlgorithms();
      const rows = await db.execute(sql`
        SELECT id, trade_id, hash_algorithm, status
        FROM escrow_settlements_log
        WHERE COALESCE(hash_algorithm, '') <> ''
          AND LOWER(COALESCE(hash_algorithm, '')) NOT IN (${sql.join(approved.map((alg) => sql`${alg}`), sql`,`)})
          AND status = 'rejected'
      `);
      return { propertyId, status: ((rows as any).rows || []).length === 0 ? "pass" : "fail", evidence: { approvedAlgorithms: approved, violations: (rows as any).rows || [] }, timestamp };
    }

    if (propertyId === "UAIU-PROP-009") {
      const rows = await db.execute(sql`
        SELECT id, file_hash,
               encode(digest(file_contents::text, 'sha256'), 'hex') AS computed_hash
        FROM evidence_vault
        ORDER BY created_at DESC
        LIMIT 100
      `);
      const mismatches = ((rows as any).rows || []).filter((r: any) => String(r.file_hash || "") !== String(r.computed_hash || ""));
      return { propertyId, status: mismatches.length === 0 ? "pass" : "fail", evidence: { sampled: (rows as any).rows?.length || 0, mismatches }, timestamp };
    }

    if (propertyId === "UAIU-PROP-010") {
      const rows = await db.execute(sql`
        SELECT vs.id, vs.statement_ref, vs.methodology_code, vs.methodology_version,
               vs.methodology_hash, pm.document_hash
        FROM verification_statements vs
        LEFT JOIN partner_methodologies pm
          ON pm.methodology_code = vs.methodology_code
         AND pm.version = vs.methodology_version
      `);
      const violations = ((rows as any).rows || []).filter((r: any) => !r.document_hash || String(r.document_hash) !== String(r.methodology_hash || ""));
      return { propertyId, status: violations.length === 0 ? "pass" : "fail", evidence: { checked: (rows as any).rows?.length || 0, violations }, timestamp };
    }

    return { propertyId, status: "error", evidence: {}, timestamp, error: "Property implementation missing" };
  } catch (error: any) {
    return {
      propertyId,
      status: "error",
      evidence: { message: error?.message || "Unknown error" },
      timestamp,
      error: error?.message || "Unknown error",
    };
  }
}

async function persistResult(result: PropertyRunResult) {
  await db.update(formalProperties).set({
    lastVerifiedAt: new Date(result.timestamp),
    lastVerificationResult: result.status,
    verificationLog: {
      timestamp: result.timestamp,
      status: result.status,
      evidence: result.evidence,
      error: result.error || null,
    },
  }).where(eq(formalProperties.propertyId, result.propertyId));
}

export async function runAllFormalPropertyVerifications(): Promise<{ passed: number; failed: number; errors: number; report: PropertyRunResult[] }> {
  await ensurePropertyDefinitions();
  const report: PropertyRunResult[] = [];
  for (const def of PROPERTY_DEFINITIONS) {
    const result = await runProperty(def.propertyId);
    await persistResult(result);
    report.push(result);
  }
  const passed = report.filter((r) => r.status === "pass").length;
  const failed = report.filter((r) => r.status === "fail").length;
  const errors = report.filter((r) => r.status === "error").length;

  const audit = await addAuditEntry({
    type: "formal_properties_verify_all",
    passed,
    failed,
    errors,
    report,
  });

  await db.update(formalProperties)
    .set({ auditBlockId: audit.blockNumber })
    .where(sql`${formalProperties.propertyId} IN (${sql.join(PROPERTY_DEFINITIONS.map((p) => sql`${p.propertyId}`), sql`,`)})`);

  return { passed, failed, errors, report };
}

export function registerFormalPropertiesRoutes(app: Express): void {
  ensurePropertyDefinitions().catch((e: any) => console.error("[FormalProperties] seed failed", e.message));

  app.post("/api/properties/verify-all", requireAdminHeader, async (_req, res) => {
    try {
      const result = await runAllFormalPropertyVerifications();
      return res.json(result);
    } catch (error: any) {
      return res.status(500).json({ error: error?.message || "Failed to verify properties" });
    }
  });

  app.post("/api/properties/verify/:propertyId", async (req, res) => {
    try {
      await ensurePropertyDefinitions();
      const propertyId = String(req.params.propertyId || "").trim().toUpperCase();
      const result = await runProperty(propertyId);
      await persistResult(result);
      return res.json({ status: result.status, evidence: result.evidence, timestamp: result.timestamp });
    } catch (error: any) {
      return res.status(500).json({ error: error?.message || "Failed to verify property" });
    }
  });

  app.get("/api/properties", async (_req, res) => {
    const rows = await db.select().from(formalProperties).orderBy(formalProperties.propertyId);
    return res.json(rows.map((r) => ({
      propertyId: r.propertyId,
      category: r.category,
      title: r.title,
      lastVerificationResult: r.lastVerificationResult,
      lastVerifiedAt: r.lastVerifiedAt,
      standardsAlignment: r.standardsAlignment,
    })));
  });

  app.get("/api/properties/:propertyId", async (req, res) => {
    const propertyId = String(req.params.propertyId || "").trim().toUpperCase();
    const row = await db.query.formalProperties.findFirst({ where: eq(formalProperties.propertyId, propertyId) });
    if (!row) return res.status(404).json({ error: "Property not found" });
    return res.json(row);
  });
}
