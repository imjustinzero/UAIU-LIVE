import { sql } from "drizzle-orm";
import { pgTable, text, varchar, real, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  password: text("password").notNull(),
  credits: real("credits").notNull().default(0),
  matchesPlayed: integer("matches_played").notNull().default(0),
  wins: integer("wins").notNull().default(0),
  losses: integer("losses").notNull().default(0),
  totalEarnings: real("total_earnings").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const matches = pgTable("matches", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  player1Id: varchar("player1_id").notNull(),
  player2Id: varchar("player2_id").notNull(),
  player1Name: text("player1_name").notNull(),
  player2Name: text("player2_name").notNull(),
  winnerId: varchar("winner_id").notNull(),
  winnerName: text("winner_name").notNull(),
  player1Score: integer("player1_score").notNull(),
  player2Score: integer("player2_score").notNull(),
  creditsBurned: real("credits_burned").notNull().default(0.4),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

export const payoutRequests = pgTable("payout_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  userName: text("user_name").notNull(),
  userEmail: text("user_email").notNull(),
  amount: real("amount").notNull(),
  paymentMethod: text("payment_method").notNull(),
  paymentInfo: text("payment_info").notNull(),
  processed: boolean("processed").notNull().default(false),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  credits: true,
  matchesPlayed: true,
  wins: true,
  losses: true,
  totalEarnings: true,
  createdAt: true,
});

export const insertMatchSchema = createInsertSchema(matches).omit({
  id: true,
  timestamp: true,
});

export const insertPayoutRequestSchema = createInsertSchema(payoutRequests).omit({
  id: true,
  processed: true,
  timestamp: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertMatch = z.infer<typeof insertMatchSchema>;
export type Match = typeof matches.$inferSelect;
export type InsertPayoutRequest = z.infer<typeof insertPayoutRequestSchema>;
export type PayoutRequest = typeof payoutRequests.$inferSelect;

export interface ActionLogEntry {
  id: string;
  type: 'match' | 'signup' | 'payout' | 'credit';
  message: string;
  timestamp: number;
}

export interface GameState {
  matchId: string;
  player1: { id: string; name: string; y: number; score: number };
  player2: { id: string; name: string; y: number; score: number };
  ball: { x: number; y: number; vx: number; vy: number };
  status: 'waiting' | 'playing' | 'finished';
  winner?: string;
}
