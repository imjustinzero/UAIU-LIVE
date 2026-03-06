import type { Request } from "express";
import { db } from "./db";
import { sql } from "drizzle-orm";
import { getClientIp } from "./exchange-auth";
import { createHash, timingSafeEqual } from "crypto";

export function secureTokenMatch(rawToken: string, expectedHash: string): boolean {
  if (!rawToken || !expectedHash) return false;
  const digest = createHash("sha256").update(rawToken).digest("hex");
  const a = Buffer.from(digest);
  const b = Buffer.from(expectedHash);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function logSecurityEvent(input: {
  email?: string | null;
  eventType: string;
  req?: Request | null;
  detail?: unknown;
}) {
  try {
    await db.execute(sql`
      INSERT INTO exchange_security_log (email, event_type, ip, detail, created_at)
      VALUES (
        ${input.email || null},
        ${input.eventType},
        ${input.req ? getClientIp(input.req) : "system"},
        ${JSON.stringify(input.detail || {})}::jsonb,
        NOW()
      )
    `);
  } catch (e) {
    console.error("[SECURITY-LOG-FAIL]", e);
  }
}
