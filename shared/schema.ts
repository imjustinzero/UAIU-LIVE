import { sql } from "drizzle-orm";
import { pgTable, text, varchar, real, integer, timestamp, boolean, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  username: text("username").unique(),
  password: text("password").notNull(),
  credits: real("credits").notNull().default(0),
  matchesPlayed: integer("matches_played").notNull().default(0),
  wins: integer("wins").notNull().default(0),
  losses: integer("losses").notNull().default(0),
  totalEarnings: real("total_earnings").notNull().default(0),
  emailVerified: boolean("email_verified").notNull().default(false),
  emailVerificationToken: text("email_verification_token"),
  stripeCustomerId: text("stripe_customer_id"),
  subscriptionId: text("subscription_id"),
  subscriptionStatus: text("subscription_status"),
  subscriptionEndsAt: timestamp("subscription_ends_at"),
  lastLoginAt: timestamp("last_login_at"),
  loginStreak: integer("login_streak").notNull().default(0),
  lastDailyBonus: timestamp("last_daily_bonus"),
  postsVisibility: text("posts_visibility").notNull().default('friends'),
  affiliateCode: text("affiliate_code").unique(),
  referredBy: text("referred_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const matches = pgTable("matches", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  gameType: text("game_type").notNull().default('pong'),
  player1Id: varchar("player1_id").notNull(),
  player2Id: varchar("player2_id").notNull(),
  player1Name: text("player1_name").notNull(),
  player2Name: text("player2_name").notNull(),
  winnerId: varchar("winner_id"),
  winnerName: text("winner_name"),
  player1Score: integer("player1_score").notNull().default(0),
  player2Score: integer("player2_score").notNull().default(0),
  betAmount: real("bet_amount").notNull().default(1),
  creditsBurned: real("credits_burned").notNull().default(0.4),
  status: text("status").notNull().default('playing'),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
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

export const actionLog = pgTable("action_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id"),
  userName: text("user_name").notNull(),
  type: text("type").notNull(),
  message: text("message").notNull(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

export const friendships = pgTable("friendships", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  friendId: varchar("friend_id").notNull(),
  status: text("status").notNull().default('pending'),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const achievements = pgTable("achievements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  achievementType: text("achievement_type").notNull(),
  achievementName: text("achievement_name").notNull(),
  achievementDescription: text("achievement_description").notNull(),
  unlockedAt: timestamp("unlocked_at").notNull().defaultNow(),
});

export const dailyMissions = pgTable("daily_missions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  missionType: text("mission_type").notNull(),
  missionDescription: text("mission_description").notNull(),
  progress: integer("progress").notNull().default(0),
  targetProgress: integer("target_progress").notNull(),
  reward: integer("reward").notNull(),
  completed: boolean("completed").notNull().default(false),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  type: text("type").notNull(),
  message: text("message").notNull(),
  read: boolean("read").notNull().default(false),
  data: text("data"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const posts = pgTable("posts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  username: text("username").notNull(),
  content: text("content").notNull(),
  youtubeUrl: text("youtube_url"),
  visibility: text("visibility").notNull().default('friends'),
  likesCount: integer("likes_count").notNull().default(0),
  commentsCount: integer("comments_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const likes = pgTable("likes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  postId: varchar("post_id").notNull(),
  userId: varchar("user_id").notNull(),
  username: text("username").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  uniqueUserPost: unique().on(table.postId, table.userId),
}));

export const comments = pgTable("comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  postId: varchar("post_id").notNull(),
  userId: varchar("user_id").notNull(),
  username: text("username").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const referralPayouts = pgTable("referral_payouts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  stripeSessionId: text("stripe_session_id").notNull().unique(),
  referrerId: varchar("referrer_id").notNull(),
  referrerName: text("referrer_name").notNull(),
  refereeId: varchar("referee_id").notNull(),
  refereeName: text("referee_name").notNull(),
  creditsAwarded: real("credits_awarded").notNull(),
  purchaseAmount: real("purchase_amount").notNull(),
  creditsPurchased: integer("credits_purchased").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  username: true,
  credits: true,
  matchesPlayed: true,
  wins: true,
  losses: true,
  totalEarnings: true,
  emailVerified: true,
  emailVerificationToken: true,
  stripeCustomerId: true,
  subscriptionId: true,
  subscriptionStatus: true,
  subscriptionEndsAt: true,
  lastLoginAt: true,
  loginStreak: true,
  lastDailyBonus: true,
  postsVisibility: true,
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

export const insertActionLogSchema = createInsertSchema(actionLog).omit({
  id: true,
  timestamp: true,
});

export const insertFriendshipSchema = createInsertSchema(friendships).omit({
  id: true,
  status: true,
  createdAt: true,
});

export const insertAchievementSchema = createInsertSchema(achievements).omit({
  id: true,
  unlockedAt: true,
});

export const insertDailyMissionSchema = createInsertSchema(dailyMissions).omit({
  id: true,
  progress: true,
  completed: true,
  createdAt: true,
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  read: true,
  createdAt: true,
});

export const insertPostSchema = createInsertSchema(posts).omit({
  id: true,
  likesCount: true,
  commentsCount: true,
  createdAt: true,
});

export const insertLikeSchema = createInsertSchema(likes).omit({
  id: true,
  createdAt: true,
});

export const insertCommentSchema = createInsertSchema(comments).omit({
  id: true,
  createdAt: true,
});

export const insertReferralPayoutSchema = createInsertSchema(referralPayouts).omit({
  id: true,
  createdAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertMatch = z.infer<typeof insertMatchSchema>;
export type Match = typeof matches.$inferSelect;
export type InsertPayoutRequest = z.infer<typeof insertPayoutRequestSchema>;
export type PayoutRequest = typeof payoutRequests.$inferSelect;
export type InsertActionLog = z.infer<typeof insertActionLogSchema>;
export type ActionLogEntry = typeof actionLog.$inferSelect;
export type InsertFriendship = z.infer<typeof insertFriendshipSchema>;
export type Friendship = typeof friendships.$inferSelect;
export type InsertAchievement = z.infer<typeof insertAchievementSchema>;
export type Achievement = typeof achievements.$inferSelect;
export type InsertDailyMission = z.infer<typeof insertDailyMissionSchema>;
export type DailyMission = typeof dailyMissions.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notifications.$inferSelect;
export type InsertPost = z.infer<typeof insertPostSchema>;
export type Post = typeof posts.$inferSelect;
export type InsertLike = z.infer<typeof insertLikeSchema>;
export type Like = typeof likes.$inferSelect;
export type InsertComment = z.infer<typeof insertCommentSchema>;
export type Comment = typeof comments.$inferSelect;
export type InsertReferralPayout = z.infer<typeof insertReferralPayoutSchema>;
export type ReferralPayout = typeof referralPayouts.$inferSelect;

export interface GameState {
  matchId: string;
  player1: { id: string; name: string; y: number; score: number };
  player2: { id: string; name: string; y: number; score: number };
  ball: { x: number; y: number; vx: number; vy: number };
  status: 'waiting' | 'playing' | 'finished';
  winner?: string;
}
