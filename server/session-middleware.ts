/**
 * Session Middleware for Authentication
 * 
 * PRODUCTION TODO:
 * This is a basic implementation for the MVP. For production, you should:
 * 
 * 1. Use express-session with a secure session store (Redis, PostgreSQL)
 * 2. Implement proper CSRF protection
 * 3. Add rate limiting to prevent brute force attacks
 * 4. Use secure, httpOnly cookies
 * 5. Implement refresh tokens for long-lived sessions
 * 6. Add logout functionality
 * 
 * For now, we're using a simple in-memory session map for demonstration.
 * This works for the MVP but should NOT be used in production.
 */

import type { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

interface UserSession {
  userId: string;
  email: string;
  createdAt: number;
}

const sessions = new Map<string, UserSession>();
const SESSION_DURATION = 24 * 60 * 60 * 1000;

export function createSession(userId: string, email: string): string {
  const sessionId = randomUUID();
  sessions.set(sessionId, {
    userId,
    email,
    createdAt: Date.now(),
  });
  
  setTimeout(() => {
    sessions.delete(sessionId);
  }, SESSION_DURATION);
  
  return sessionId;
}

export function getSession(sessionId: string): UserSession | undefined {
  const session = sessions.get(sessionId);
  if (!session) return undefined;
  
  if (Date.now() - session.createdAt > SESSION_DURATION) {
    sessions.delete(sessionId);
    return undefined;
  }
  
  return session;
}

export function deleteSession(sessionId: string): void {
  sessions.delete(sessionId);
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const sessionId = req.headers.authorization?.replace('Bearer ', '');
  
  if (!sessionId) {
    res.status(401).json({ message: 'No authorization token provided' });
    return;
  }
  
  const session = getSession(sessionId);
  if (!session) {
    res.status(401).json({ message: 'Invalid or expired session' });
    return;
  }
  
  (req as any).userId = session.userId;
  (req as any).userEmail = session.email;
  next();
}
