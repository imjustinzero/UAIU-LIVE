import type { NextFunction, Request, Response } from "express";
import { createHash, timingSafeEqual } from "crypto";
import { nanoid } from "nanoid";
import { db } from "./db";
import { sql } from "drizzle-orm";

export type ExchangeSessionRecord = {
  email: string;
  token: string;
  expires_at: string | Date;
};

export function hashTokenForLogs(token: string): string {
  return createHash("sha256").update(token).digest("hex").slice(0, 24);
}

export function getClientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0].trim();
  }
  return req.ip || (req.socket?.remoteAddress) || "unknown";
}

export function safeError(e: any, fallback = "An error occurred. Please try again."): string {
  const msg = e?.message || "unknown_error";
  const stack = e?.stack || "";
  console.error("[SECURE-ERROR]", msg, stack);
  return fallback;
}

export async function createExchangeSession(email: string): Promise<string> {
  const token = nanoid(32);
  await db.execute(sql`
    INSERT INTO exchange_sessions (email, token, created_at, expires_at)
    VALUES (${email.toLowerCase().trim()}, ${token}, NOW(), NOW() + INTERVAL '24 hours')
  `);
  return token;
}

export async function verifyExchangeToken(token: string): Promise<ExchangeSessionRecord | null> {
  const result = await db.execute(sql`
    SELECT email, token, expires_at
    FROM exchange_sessions
    WHERE token = ${token}
      AND expires_at > NOW()
    LIMIT 1
  `);
  const rows = (result as any).rows || [];
  return rows[0] || null;
}

export async function deleteExchangeSession(token: string): Promise<void> {
  await db.execute(sql`DELETE FROM exchange_sessions WHERE token = ${token}`);
}

export async function requireExchangeAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const token = String(req.headers["x-exchange-token"] || "").trim();
    if (!token) {
      return res.status(401).json({ error: "Exchange authentication required." });
    }
    const session = await verifyExchangeToken(token);
    if (!session) {
      return res.status(401).json({ error: "Invalid or expired exchange session." });
    }
    (req as any).exchangeEmail = String(session.email).toLowerCase().trim();
    (req as any).exchangeTokenHash = hashTokenForLogs(token);
    return next();
  } catch (e) {
    console.error("[EXCHANGE-AUTH]", e);
    return res.status(500).json({ error: safeError(e) });
  }
}

export function isTimingSafeMatch(provided: string, expected: string): boolean {
  try {
    const p = Buffer.from(provided || "");
    const e = Buffer.from(expected || "");
    if (p.length !== e.length) return false;
    return timingSafeEqual(p, e);
  } catch {
    return false;
  }
}

export function requireAdminHeader(req: Request, res: Response, next: NextFunction) {
  const stored = process.env.ADMIN_SECRET_KEY || "";
  const provided = String(req.headers["x-admin-key"] || "");
  if (!stored || !provided || !isTimingSafeMatch(provided, stored)) {
    return res.status(403).json({ error: "Forbidden" });
  }
  return next();
}
