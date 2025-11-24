import { 
  type User, 
  type InsertUser,
  type Match,
  type InsertMatch,
  type PayoutRequest,
  type InsertPayoutRequest,
  type ActionLogEntry
} from "@shared/schema";
import { randomUUID } from "crypto";

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
  addActionLog(entry: Omit<ActionLogEntry, 'id' | 'timestamp'>): Promise<void>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private matches: Map<string, Match>;
  private payoutRequests: Map<string, PayoutRequest>;
  private actionLog: ActionLogEntry[];

  constructor() {
    this.users = new Map();
    this.matches = new Map();
    this.payoutRequests = new Map();
    this.actionLog = [];
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.email === email,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const now = new Date();
    const user: User = {
      ...insertUser,
      id,
      credits: 10,
      matchesPlayed: 0,
      wins: 0,
      losses: 0,
      totalEarnings: 0,
      createdAt: now,
    };
    this.users.set(id, user);
    return user;
  }

  async updateUserCredits(userId: string, credits: number): Promise<void> {
    const user = this.users.get(userId);
    if (user) {
      user.credits = credits;
    }
  }

  async updateUserStats(userId: string, stats: { wins?: number; losses?: number; matchesPlayed?: number; totalEarnings?: number }): Promise<void> {
    const user = this.users.get(userId);
    if (user) {
      if (stats.wins !== undefined) user.wins = stats.wins;
      if (stats.losses !== undefined) user.losses = stats.losses;
      if (stats.matchesPlayed !== undefined) user.matchesPlayed = stats.matchesPlayed;
      if (stats.totalEarnings !== undefined) user.totalEarnings = stats.totalEarnings;
    }
  }

  async getLeaderboard(limit: number): Promise<User[]> {
    return Array.from(this.users.values())
      .sort((a, b) => b.credits - a.credits)
      .slice(0, limit);
  }

  async createMatch(insertMatch: InsertMatch): Promise<Match> {
    const id = randomUUID();
    const match: Match = {
      ...insertMatch,
      id,
      timestamp: new Date(),
    };
    this.matches.set(id, match);
    return match;
  }

  async getRecentMatches(limit: number): Promise<Match[]> {
    return Array.from(this.matches.values())
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  async createPayoutRequest(insertRequest: InsertPayoutRequest): Promise<PayoutRequest> {
    const id = randomUUID();
    const request: PayoutRequest = {
      ...insertRequest,
      id,
      processed: false,
      timestamp: new Date(),
    };
    this.payoutRequests.set(id, request);
    return request;
  }

  async getActionLog(limit: number): Promise<ActionLogEntry[]> {
    return this.actionLog
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  async addActionLog(entry: Omit<ActionLogEntry, 'id' | 'timestamp'>): Promise<void> {
    this.actionLog.push({
      ...entry,
      id: randomUUID(),
      timestamp: Date.now(),
    });
    
    if (this.actionLog.length > 100) {
      this.actionLog = this.actionLog.slice(0, 100);
    }
  }
}

export const storage = new MemStorage();
