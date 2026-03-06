import type { Request } from "express";
import { db } from "./db";
import { sql } from "drizzle-orm";
import { getClientIp } from "./exchange-auth";

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
