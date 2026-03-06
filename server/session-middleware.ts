import type { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { db } from './db';
import { sql } from 'drizzle-orm';

interface UserSession {
  userId: string;
  email: string;
  createdAt: number;
}

const SESSION_DURATION = 24 * 60 * 60 * 1000;

export async function createSession(userId: string, email: string): Promise<string> {
  const sessionId = randomUUID();
  await db.execute(sql`
    INSERT INTO sessions (id, user_id, user_email, created_at, expires_at)
    VALUES (${sessionId}, ${userId}, ${email}, NOW(), NOW() + INTERVAL '24 hours')
  `);
  return sessionId;
}

export async function getSession(sessionId: string): Promise<UserSession | undefined> {
  const result = await db.execute(sql`
    SELECT user_id, user_email, created_at
    FROM sessions
    WHERE id = ${sessionId} AND expires_at > NOW()
    LIMIT 1
  `);
  const row = (result as any).rows?.[0];
  if (!row) return undefined;
  return {
    userId: row.user_id,
    email: row.user_email,
    createdAt: new Date(row.created_at).getTime(),
  };
}

export async function deleteSession(sessionId: string): Promise<void> {
  await db.execute(sql`DELETE FROM sessions WHERE id = ${sessionId}`);
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const sessionId = req.headers.authorization?.replace('Bearer ', '');

  if (!sessionId) {
    res.status(401).json({ message: 'No authorization token provided' });
    return;
  }

  const session = await getSession(sessionId);
  if (!session) {
    res.status(401).json({ message: 'Invalid or expired session' });
    return;
  }

  (req as any).userId = session.userId;
  (req as any).userEmail = session.email;
  next();
}
