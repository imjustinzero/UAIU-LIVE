import { 
  type User, 
  type InsertUser,
  type Match,
  type InsertMatch,
  type PayoutRequest,
  type InsertPayoutRequest,
  type ActionLogEntry,
  type InsertActionLog,
  users,
  matches,
  payoutRequests,
  actionLog,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserCredits(userId: string, credits: number): Promise<void>;
  updateUserStats(userId: string, stats: { wins?: number; losses?: number; matchesPlayed?: number; totalEarnings?: number }): Promise<void>;
  getLeaderboard(limit: number): Promise<User[]>;
  
  createMatch(match: InsertMatch): Promise<Match>;
  getRecentMatches(limit: number): Promise<Match[]>;
  
  createPayoutRequest(request: InsertPayoutRequest): Promise<PayoutRequest>;
  
  getActionLog(limit: number): Promise<ActionLogEntry[]>;
  addActionLog(entry: InsertActionLog): Promise<void>;
}

export class DbStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUserCredits(userId: string, credits: number): Promise<void> {
    await db.update(users)
      .set({ credits })
      .where(eq(users.id, userId));
  }

  async updateUserStats(userId: string, stats: { 
    wins?: number; 
    losses?: number; 
    matchesPlayed?: number; 
    totalEarnings?: number 
  }): Promise<void> {
    await db.update(users)
      .set(stats)
      .where(eq(users.id, userId));
  }

  async getLeaderboard(limit: number): Promise<User[]> {
    return await db.select()
      .from(users)
      .orderBy(desc(users.credits))
      .limit(limit);
  }

  async createMatch(insertMatch: InsertMatch): Promise<Match> {
    const [match] = await db.insert(matches).values(insertMatch).returning();
    return match;
  }

  async getRecentMatches(limit: number): Promise<Match[]> {
    return await db.select()
      .from(matches)
      .orderBy(desc(matches.timestamp))
      .limit(limit);
  }

  async createPayoutRequest(insertRequest: InsertPayoutRequest): Promise<PayoutRequest> {
    const [request] = await db.insert(payoutRequests).values(insertRequest).returning();
    return request;
  }

  async getActionLog(limit: number): Promise<ActionLogEntry[]> {
    return await db.select()
      .from(actionLog)
      .orderBy(desc(actionLog.timestamp))
      .limit(limit);
  }

  async addActionLog(entry: InsertActionLog): Promise<void> {
    await db.insert(actionLog).values(entry);
  }
}

export const storage = new DbStorage();
