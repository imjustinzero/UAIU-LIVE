import { sql } from "drizzle-orm";
import { pgTable, text, varchar, real, integer, serial, timestamp, boolean, unique, check, date, jsonb, numeric, uuid } from "drizzle-orm/pg-core";
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
}, (table) => ({
  creditsNonNegative: check('credits_non_negative', sql`${table.credits} >= 0`),
}));

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
}, (table) => ({
  uniquePair: unique('unique_friendship_pair').on(table.userId, table.friendId),
}));

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

export const liveMatchSessions = pgTable("live_match_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  user1Id: varchar("user1_id").notNull(),
  user1Name: text("user1_name").notNull(),
  user2Id: varchar("user2_id").notNull(),
  user2Name: text("user2_name").notNull(),
  status: text("status").notNull().default('active'),
  durationSeconds: integer("duration_seconds").notNull().default(60),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  endedAt: timestamp("ended_at"),
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

export const insertLiveMatchSessionSchema = createInsertSchema(liveMatchSessions).omit({
  id: true,
  status: true,
  startedAt: true,
  endedAt: true,
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
export type InsertLiveMatchSession = z.infer<typeof insertLiveMatchSessionSchema>;
export type LiveMatchSession = typeof liveMatchSessions.$inferSelect;

export const exchangeListings = pgTable("exchange_listings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  standard: varchar("standard").notNull(),
  badgeLabel: varchar("badge_label").notNull(),
  name: varchar("name").notNull(),
  origin: varchar("origin").notNull(),
  sellerProfileId: varchar("seller_profile_id"),
  registrySerial: varchar("registry_serial"),
  registryName: varchar("registry_name"),
  vintageYear: integer("vintage_year"),
  pricePerTonne: real("price_per_tonne").notNull(),
  changePercent: real("change_percent").notNull().default(0),
  changeDirection: varchar("change_direction").notNull().default('up'),
  registryStatus: varchar("registry_status").notNull().default('active'),
  corsiaEligible: boolean("corsia_eligible"),
  status: varchar("status").notNull().default('active'),
  isAcceptingOrders: boolean("is_accepting_orders").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const exchangeAccounts = pgTable("exchange_accounts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgName: varchar("org_name"),
  contactName: varchar("contact_name"),
  email: varchar("email").notNull(),
  role: varchar("role"),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  phone: varchar("phone"),
  accountType: varchar("account_type"),
  annualCo2Exposure: varchar("annual_co2_exposure"),
  registryAccountId: varchar("registry_account_id"),
  registryName: varchar("registry_name"),
  passwordHash: varchar("password_hash"),
  acceptedTermsAt: timestamp("accepted_terms_at"),
  kycStatus: varchar("kyc_status").notNull().default('not_started'),
  kycCompletedAt: timestamp("kyc_completed_at"),
  kycProviderReference: varchar("kyc_provider_reference"),
  kybStatus: varchar("kyb_status").notNull().default('not_started'),
  kybCompletedAt: timestamp("kyb_completed_at"),
  kybProviderReference: varchar("kyb_provider_reference"),
  failedLoginAttempts: integer("failed_login_attempts").notNull().default(0),
  lockedUntil: timestamp("locked_until"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const exchangeTrades = pgTable("exchange_trades", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  accountEmail: varchar("account_email").notNull(),
  tradeId: varchar("trade_id").notNull().unique(),
  side: varchar("side").notNull(),
  standard: varchar("standard").notNull(),
  volumeTonnes: real("volume_tonnes").notNull(),
  pricePerTonne: real("price_per_tonne").notNull(),
  grossEur: real("gross_eur").notNull(),
  feeEur: real("fee_eur").notNull().default(0),
  receiptHash: varchar("receipt_hash"),
  stripeSessionId: varchar("stripe_session_id"),
  buyerRegistryAccountId: varchar("buyer_registry_account_id"),
  buyerRegistryName: varchar("buyer_registry_name"),
  sellerEmail: varchar("seller_email"),
  sellerRegistryName: varchar("seller_registry_name"),
  sellerRegistrySerial: varchar("seller_registry_serial"),
  vintageYear: integer("vintage_year"),
  retirementStatus: varchar("retirement_status"),
  retirementCertificateId: varchar("retirement_certificate_id"),
  retirementCertificateUrl: text("retirement_certificate_url"),
  retirementCertificateGeneratedAt: timestamp("retirement_certificate_generated_at"),
  retirementPurpose: varchar("retirement_purpose"),
  paymentModel: varchar("payment_model"),
  prevReceiptHash: varchar("prev_receipt_hash"),
  sellerProfileId: varchar("seller_profile_id"),
  listingId: varchar("listing_id"),
  operatorId: varchar("operator_id"),
  installationId: varchar("installation_id"),
  activityType: varchar("activity_type"),
  verifiedEmissionsQuantity: real("verified_emissions_quantity"),
  corsiaEligible: boolean("corsia_eligible"),
  icaoOperatorCode: varchar("icao_operator_code"),
  eligibleProgram: varchar("eligible_program"),
  vesselImo: varchar("vessel_imo"),
  voyageReference: varchar("voyage_reference"),
  fuelConsumptionOffset: real("fuel_consumption_offset"),
  status: varchar("status").notNull().default('completed'),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const exchangeRfqs = pgTable("exchange_rfqs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  company: varchar("company").notNull(),
  contact: varchar("contact").notNull(),
  email: varchar("email").notNull(),
  side: varchar("side").notNull(),
  standard: varchar("standard").notNull(),
  volumeTonnes: integer("volume_tonnes").notNull(),
  targetPrice: real("target_price"),
  preferredOrigin: varchar("preferred_origin"),
  vintageYear: integer("vintage_year"),
  deadline: varchar("deadline"),
  notes: varchar("notes"),
  status: varchar("status").notNull().default('active'),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const exchangeCreditListings = pgTable("exchange_credit_listings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgName: varchar("org_name").notNull(),
  contactName: varchar("contact_name").notNull(),
  email: varchar("email").notNull(),
  standard: varchar("standard").notNull(),
  creditType: varchar("credit_type").notNull(),
  volumeTonnes: varchar("volume_tonnes").notNull(),
  askingPricePerTonne: varchar("asking_price_per_tonne").notNull(),
  projectOrigin: varchar("project_origin").notNull(),
  registrySerial: varchar("registry_serial"),
  registryName: varchar("registry_name"),
  vintageYear: integer("vintage_year"),
  status: varchar("status").notNull().default('pending'),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const tradeRetirementCertificates = pgTable("trade_retirement_certificates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tradeId: varchar("trade_id").notNull(),
  uploadUrl: text("upload_url"),
  uploadedAt: timestamp("uploaded_at"),
  uploadedBy: varchar("uploaded_by"),
  certificateFilename: varchar("certificate_filename"),
  supabaseStoragePath: varchar("supabase_storage_path"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const retirementUploadTokens = pgTable("retirement_upload_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tradeId: varchar("trade_id").notNull(),
  tokenHash: varchar("token_hash").notNull(),
  sellerEmail: varchar("seller_email"),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const alertSubscribers = pgTable("alert_subscribers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").notNull(),
  organization: varchar("organization").notNull(),
  sector: varchar("sector").notNull(),
  frameworks: text("frameworks").array().notNull().default(sql`ARRAY[]::text[]`),
  alertTiming: text("alert_timing").array().notNull().default(sql`ARRAY[]::text[]`),
  source: varchar("source"),
  confirmed: boolean("confirmed").notNull().default(false),
  confirmToken: varchar("confirm_token").notNull().unique(),
  unsubscribeToken: varchar("unsubscribe_token").notNull().unique(),
  subscribedAt: timestamp("subscribed_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const webhookFailures = pgTable("webhook_failures", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventId: varchar("event_id"),
  eventType: varchar("event_type").notNull(),
  tradeId: varchar("trade_id"),
  paymentIntentId: varchar("payment_intent_id"),
  payload: text("payload"),
  errorMessage: text("error_message"),
  retryCount: integer("retry_count").notNull().default(0),
  lastAttemptedAt: timestamp("last_attempted_at").notNull().defaultNow(),
  resolved: boolean("resolved").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const exchangeSessions = pgTable("exchange_sessions", {
  id: serial("id").primaryKey(),
  email: varchar("email").notNull(),
  token: varchar("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
});

export const exchangeSecurityLog = pgTable("exchange_security_log", {
  id: serial("id").primaryKey(),
  email: varchar("email"),
  eventType: varchar("event_type").notNull(),
  ip: varchar("ip"),
  detail: text("detail").notNull().default('{}'),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const auditChainEntries = pgTable("audit_chain_entries", {
  id: serial("id").primaryKey(),
  blockNumber: integer("block_number").notNull(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  algorithm: varchar("algorithm").notNull(),
  transactionData: jsonb("transaction_data").notNull(),
  prevHash: varchar("prev_hash").notNull(),
  hash: varchar("hash").notNull(),
});

export const escrowSettlementsLog = pgTable("escrow_settlements_log", {
  id: serial("id").primaryKey(),
  tradeId: varchar("trade_id").notNull(),
  paymentIntentId: varchar("payment_intent_id").notNull(),
  amountEur: real("amount_eur").notNull(),
  uaiuFeeEur: real("uaiu_fee_eur"),
  sellerNetEur: real("seller_net_eur"),
  status: varchar("status").notNull(),
  settledAt: timestamp("settled_at"),
  hashAlgorithm: varchar("hash_algorithm"),
});

export const algorithmRotationLog = pgTable("algorithm_rotation_log", {
  id: serial("id").primaryKey(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  previousAlgorithm: varchar("previous_algorithm").notNull(),
  newAlgorithm: varchar("new_algorithm").notNull(),
  triggeredBy: varchar("triggered_by").notNull(),
  signatureHash: varchar("signature_hash").notNull(),
  notes: text("notes"),
});



export const auditReports = pgTable("audit_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  overallStatus: varchar("overall_status").notNull(),
  reportData: jsonb("report_data").notNull(),
  triggeredBy: varchar("triggered_by").notNull().default("system"),
});

export const apiKeys = pgTable("api_keys", {
  id: serial("id").primaryKey(),
  key: varchar("key").notNull(),
  organizationName: varchar("organization_name").notNull(),
  permissions: jsonb("permissions").notNull().default(sql`'[]'::jsonb`),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  lastUsedAt: timestamp("last_used_at"),
  active: boolean("active").notNull().default(true),
});

export const webhooks = pgTable("webhooks", {
  id: serial("id").primaryKey(),
  orgId: varchar("org_id").notNull(),
  url: text("url").notNull(),
  events: jsonb("events").notNull().default(sql`'[]'::jsonb`),
  secret: varchar("secret").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const webhookDeliveryLog = pgTable("webhook_delivery_log", {
  id: serial("id").primaryKey(),
  webhookId: integer("webhook_id").notNull(),
  event: varchar("event").notNull(),
  payload: jsonb("payload").notNull(),
  responseStatus: integer("response_status"),
  deliveredAt: timestamp("delivered_at").notNull().defaultNow(),
  success: boolean("success").notNull().default(false),
});

export const complianceDocuments = pgTable("compliance_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  documentType: varchar("document_type").notNull(),
  organizationName: varchar("organization_name").notNull(),
  dateRange: jsonb("date_range").notNull(),
  filePath: text("file_path").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const creditReservations = pgTable("credit_reservations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  creditId: varchar("credit_id").notNull(),
  tonnes: real("tonnes").notNull(),
  buyerOrg: varchar("buyer_org").notNull(),
  reservedAt: timestamp("reserved_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
  status: varchar("status").notNull().default("reserved"),
});

export const sessions = pgTable("sessions", {
  id: varchar("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  userEmail: varchar("user_email").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
});



export const iotDevices = pgTable("iot_devices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  deviceId: varchar("device_id").notNull().unique(),
  deviceType: varchar("device_type").notNull(),
  projectId: varchar("project_id").notNull(),
  supplierId: varchar("supplier_id"),
  publicKey: text("public_key").notNull(),
  firmwareVersion: varchar("firmware_version"),
  location: jsonb("location").notNull().default(sql`'{}'::jsonb`),
  calibrationData: jsonb("calibration_data").notNull().default(sql`'{}'::jsonb`),
  status: varchar("status").notNull().default("offline"),
  lastSeenAt: timestamp("last_seen_at"),
  registeredAt: timestamp("registered_at").notNull().defaultNow(),
  approvedBy: varchar("approved_by"),
  apiSecretHash: text("api_secret_hash"),
});

export const iotReadings = pgTable("iot_readings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  deviceId: varchar("device_id").notNull().references(() => iotDevices.id),
  projectId: varchar("project_id").notNull(),
  timestamp: timestamp("timestamp").notNull(),
  receivedAt: timestamp("received_at").notNull().defaultNow(),
  readingType: varchar("reading_type").notNull(),
  value: real("value").notNull(),
  unit: varchar("unit").notNull(),
  rawPayload: jsonb("raw_payload").notNull().default(sql`'{}'::jsonb`),
  deviceSignature: varchar("device_signature"),
  signatureValid: boolean("signature_valid").notNull().default(false),
  auditBlockId: integer("audit_block_id").references(() => auditChainEntries.id),
  anomalyFlag: boolean("anomaly_flag").notNull().default(false),
  anomalyReason: varchar("anomaly_reason"),
});

export const mrvReports = pgTable("mrv_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull(),
  supplierId: varchar("supplier_id"),
  reportingPeriod: jsonb("reporting_period").notNull(),
  readingsCount: integer("readings_count").notNull().default(0),
  totalCO2Sequestered: real("total_co2_sequestered").notNull().default(0),
  totalMethaneFlowed: real("total_methane_flowed").notNull().default(0),
  totalEnergyGenerated: real("total_energy_generated").notNull().default(0),
  creditsCalculated: real("credits_calculated").notNull().default(0),
  calculationMethodology: varchar("calculation_methodology").notNull(),
  dataQualityScore: real("data_quality_score").notNull().default(0),
  anomaliesDetected: integer("anomalies_detected").notNull().default(0),
  auditBlockIds: jsonb("audit_block_ids").notNull().default(sql`'[]'::jsonb`),
  status: varchar("status").notNull().default("draft"),
  verifiedBy: varchar("verified_by"),
  verifiedAt: timestamp("verified_at"),
  creditsIssued: real("credits_issued").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const anomalyEvents = pgTable("anomaly_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  deviceId: varchar("device_id").notNull().references(() => iotDevices.id),
  readingId: varchar("reading_id").references(() => iotReadings.id),
  detectedAt: timestamp("detected_at").notNull().defaultNow(),
  anomalyType: varchar("anomaly_type").notNull(),
  severity: varchar("severity").notNull(),
  description: text("description").notNull(),
  resolved: boolean("resolved").notNull().default(false),
  resolvedAt: timestamp("resolved_at"),
  resolvedBy: varchar("resolved_by"),
  resolution: text("resolution"),
});

export const firmwareVersions = pgTable("firmware_versions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  version: varchar("version").notNull().unique(),
  releaseNotes: text("release_notes"),
  checksum: varchar("checksum").notNull(),
  releasedAt: timestamp("released_at").notNull().defaultNow(),
  mandatory: boolean("mandatory").notNull().default(false),
});

export const satelliteReadings = pgTable("satellite_readings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  source: varchar("source").notNull(),
  projectId: varchar("project_id").notNull(),
  timestamp: timestamp("timestamp").notNull(),
  dataType: varchar("data_type").notNull(),
  payload: jsonb("payload").notNull().default(sql`'{}'::jsonb`),
  auditBlockId: integer("audit_block_id").references(() => auditChainEntries.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const iotTrustScores = pgTable("iot_trust_scores", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull(),
  trustScore: real("trust_score").notNull(),
  grade: varchar("grade").notNull(),
  components: jsonb("components").notNull().default(sql`'{}'::jsonb`),
  calculatedAt: timestamp("calculated_at").notNull().defaultNow(),
});

export const iotRawPayloads = pgTable("iot_raw_payloads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  deviceId: varchar("device_id"),
  source: varchar("source").notNull(),
  rawPayload: jsonb("raw_payload").notNull().default(sql`'{}'::jsonb`),
  receivedAt: timestamp("received_at").notNull().defaultNow(),
  processed: boolean("processed").notNull().default(false),
  readingIds: jsonb("reading_ids").notNull().default(sql`'[]'::jsonb`),
});

export const deviceCertifications = pgTable("device_certifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  manufacturer: varchar("manufacturer").notNull(),
  deviceModel: varchar("device_model").notNull(),
  firmwareVersion: varchar("firmware_version"),
  testResults: jsonb("test_results").notNull().default(sql`'{}'::jsonb`),
  certifiedAt: timestamp("certified_at"),
  certificationLevel: varchar("certification_level").notNull().default("compatible"),
  badgeUrl: varchar("badge_url"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});



export const creditRegistry = pgTable("credit_registry", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  status: varchar("status").notNull().default("active"),
  registry: varchar("registry"),
  projectType: varchar("project_type"),
  corsiaEligible: boolean("corsia_eligible").default(false),
  article6Eligible: boolean("article6_eligible").default(false),
  uvsEligible: boolean("uvs_eligible").notNull().default(false),
  uvsCertificateId: varchar("uvs_certificate_id"),
  uvsGrade: varchar("uvs_grade"),
  uvsCertifiedAt: timestamp("uvs_certified_at"),
  uvsExpiresAt: timestamp("uvs_expires_at"),
});

export const verificationStatements = pgTable("verification_statements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  statementRef: varchar("statement_ref").notNull(),
  signedAt: timestamp("signed_at").notNull().defaultNow(),
  methodologyCode: varchar("methodology_code"),
  methodologyVersion: varchar("methodology_version"),
  methodologyHash: varchar("methodology_hash"),
});

export const partnerReferrals = pgTable("partner_referrals", {
  id: uuid("id").defaultRandom().primaryKey(),
  methodologyId: uuid("methodology_id"),
  methodologyVersion: varchar("methodology_version"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const partnerMethodologies = pgTable("partner_methodologies", {
  id: uuid("id").defaultRandom().primaryKey(),
  partnerId: uuid("partner_id").notNull(),
  methodologyCode: varchar("methodology_code").notNull().unique(),
  version: varchar("version").notNull(),
  title: varchar("title").notNull(),
  description: text("description"),
  scope: text("scope"),
  applicableStandards: jsonb("applicable_standards").notNull().default(sql`'[]'::jsonb`),
  applicableCreditTypes: jsonb("applicable_credit_types").notNull().default(sql`'[]'::jsonb`),
  applicableGeographies: jsonb("applicable_geographies").notNull().default(sql`'[]'::jsonb`),
  methodology: text("methodology").notNull(),
  changeLog: text("change_log"),
  publishedAt: timestamp("published_at"),
  supersededBy: uuid("superseded_by"),
  status: varchar("status").notNull().default("draft"),
  documentHash: varchar("document_hash").notNull(),
  evidenceVaultId: uuid("evidence_vault_id"),
  auditBlockId: integer("audit_block_id"),
  downloadCount: integer("download_count").notNull().default(0),
  citationCount: integer("citation_count").notNull().default(0),
});

export const methodologyCitations = pgTable("methodology_citations", {
  id: uuid("id").defaultRandom().primaryKey(),
  methodologyId: uuid("methodology_id").notNull().references(() => partnerMethodologies.id),
  creditId: varchar("credit_id").notNull(),
  projectName: varchar("project_name"),
  creditsVerified: real("credits_verified").notNull().default(0),
  buyerOrganization: varchar("buyer_organization"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const uvsCertifications = pgTable("uvs_certifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  creditId: varchar("credit_id").notNull().references(() => creditRegistry.id),
  certificateNumber: varchar("certificate_number").notNull().unique(),
  status: varchar("status").notNull().default("pending"),
  certifiedAt: timestamp("certified_at"),
  expiresAt: timestamp("expires_at"),
  revokedAt: timestamp("revoked_at"),
  revocationReason: text("revocation_reason"),
  qualityScore: real("quality_score"),
  qualityGrade: varchar("quality_grade"),
  iotTrustScore: real("iot_trust_score"),
  mrvDataQuality: real("mrv_data_quality"),
  verifierId: varchar("verifier_id"),
  verifierStatementId: varchar("verifier_statement_id").references(() => verificationStatements.id),
  article6Status: varchar("article6_status"),
  corsiaEligible: boolean("corsia_eligible").default(false),
  sdgCount: integer("sdg_count").default(0),
  sanctionsClean: boolean("sanctions_clean").default(false),
  openInvestigations: integer("open_investigations").default(0),
  auditBlockId: integer("audit_block_id"),
  certificateHash: varchar("certificate_hash"),
  publicUrl: varchar("public_url"),
  qrCodePath: varchar("qr_code_path"),
  evidencePackageHash: varchar("evidence_package_hash"),
}, (table) => ({
  qualityScoreMinimum: check("uvs_quality_score_minimum", sql`${table.qualityScore} IS NULL OR ${table.qualityScore} >= 80`),
  iotTrustMinimum: check("uvs_iot_trust_minimum", sql`${table.iotTrustScore} IS NULL OR ${table.iotTrustScore} >= 80`),
  mrvQualityMinimum: check("uvs_mrv_quality_minimum", sql`${table.mrvDataQuality} IS NULL OR ${table.mrvDataQuality} >= 90`),
}));

export const committeeMembers = pgTable("committee_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  organization: varchar("organization").notNull(),
  role: varchar("role").notNull(),
  expertise: varchar("expertise").notNull(),
  joinedAt: timestamp("joined_at").notNull().defaultNow(),
  active: boolean("active").notNull().default(true),
  bio: text("bio"),
  photoUrl: text("photo_url"),
});

export const methodologyAmendments = pgTable("methodology_amendments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  proposedBy: varchar("proposed_by").notNull(),
  title: varchar("title").notNull(),
  description: text("description").notNull(),
  status: varchar("status").notNull().default("proposed"),
  proposedAt: timestamp("proposed_at").notNull().defaultNow(),
  votingClosesAt: timestamp("voting_closes_at"),
  approvedAt: timestamp("approved_at"),
  votes: jsonb("votes").notNull().default(sql`'{"for": [], "against": [], "abstain": []}'::jsonb`),
  auditBlockId: integer("audit_block_id"),
});

export const pushSubscriptions = pgTable("push_subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  endpoint: text("endpoint").notNull(),
  keys: jsonb("keys").notNull(),
  deviceType: varchar("device_type").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const cbamDeclarations = pgTable("cbam_declarations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").notNull(),
  declarationPeriod: varchar("declaration_period").notNull(),
  goodsCategory: varchar("goods_category").notNull(),
  importedTonnes: numeric("imported_tonnes"),
  embeddedCarbonTonnesPerTonne: numeric("embedded_carbon_tonnes_per_tonne"),
  totalEmbeddedCarbonTonnes: numeric("total_embedded_carbon_tonnes"),
  cbamCertificatesRequired: numeric("cbam_certificates_required"),
  offsetCreditsLinked: jsonb("offset_credits_linked").notNull().default(sql`'[]'::jsonb`),
  declarationStatus: varchar("declaration_status").notNull().default("draft"),
  cbamRegistryReference: varchar("cbam_registry_reference"),
  submittedAt: timestamp("submitted_at"),
  auditBlockId: integer("audit_block_id"),
});

export const epdRecords = pgTable("epd_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").notNull(),
  productName: varchar("product_name").notNull(),
  productCategory: varchar("product_category").notNull(),
  epdReference: varchar("epd_reference").notNull(),
  epdSource: varchar("epd_source").notNull(),
  iso14025Compliant: boolean("iso14025_compliant").notNull().default(false),
  functionalUnit: varchar("functional_unit").notNull(),
  embeddedCarbonA1A3: numeric("embedded_carbon_a1_a3"),
  embeddedCarbonA4: numeric("embedded_carbon_a4"),
  embeddedCarbonA5: numeric("embedded_carbon_a5"),
  embeddedCarbonB1B7: numeric("embedded_carbon_b1_b7"),
  embeddedCarbonC1C4: numeric("embedded_carbon_c1_c4"),
  totalEmbeddedCarbon: numeric("total_embedded_carbon"),
  verifierOrg: varchar("verifier_org"),
  verifiedAt: timestamp("verified_at"),
  expiresAt: timestamp("expires_at"),
  documentHash: varchar("document_hash"),
  evidenceVaultId: varchar("evidence_vault_id"),
  linkedRetirementIds: jsonb("linked_retirement_ids").notNull().default(sql`'[]'::jsonb`),
  auditBlockId: integer("audit_block_id"),
});

export const productCarbonPassports = pgTable("product_carbon_passports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").notNull(),
  productName: varchar("product_name").notNull(),
  productSku: varchar("product_sku").notNull(),
  batchReference: varchar("batch_reference"),
  batchSize: numeric("batch_size"),
  batchUnit: varchar("batch_unit"),
  epdId: varchar("epd_id"),
  embeddedCarbonPerUnit: numeric("embedded_carbon_per_unit"),
  totalBatchCarbon: numeric("total_batch_carbon"),
  retirementIds: jsonb("retirement_ids").notNull().default(sql`'[]'::jsonb`),
  uvsCreditsUsed: jsonb("uvs_credits_used").notNull().default(sql`'[]'::jsonb`),
  certificateNumber: varchar("certificate_number").notNull().unique(),
  qrCodePath: varchar("qr_code_path"),
  publicUrl: varchar("public_url"),
  status: varchar("status").notNull().default("active"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  auditBlockId: integer("audit_block_id"),
});

export const isoVerifiers = pgTable("iso_verifiers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgName: varchar("org_name").notNull(),
  accreditationBody: varchar("accreditation_body").notNull(),
  accreditationNumber: varchar("accreditation_number").notNull(),
  isoStandards: jsonb("iso_standards").notNull().default(sql`'[]'::jsonb`),
  validUntil: timestamp("valid_until"),
  verificationCount: integer("verification_count").notNull().default(0),
  reputationScore: numeric("reputation_score"),
  status: varchar("status").notNull().default("active"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const isoVerificationEngagements = pgTable("iso_verification_engagements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  verifierId: varchar("verifier_id").notNull(),
  clientOrgId: varchar("client_org_id").notNull(),
  engagementType: varchar("engagement_type").notNull(),
  scope: text("scope"),
  standardVersion: varchar("standard_version"),
  status: varchar("status").notNull().default("proposed"),
  startDate: timestamp("start_date"),
  completionDate: timestamp("completion_date"),
  statementOfVerification: text("statement_of_verification"),
  statementHash: varchar("statement_hash"),
  materialityThreshold: numeric("materiality_threshold"),
  confidenceLevel: varchar("confidence_level"),
  auditBlockId: integer("audit_block_id"),
});

export const supplyChainCarbonMap = pgTable("supply_chain_carbon_map", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  enterpriseOrgId: varchar("enterprise_org_id").notNull(),
  supplierOrgId: varchar("supplier_org_id"),
  supplierName: varchar("supplier_name").notNull(),
  componentName: varchar("component_name").notNull(),
  componentCategory: varchar("component_category").notNull(),
  annualVolumeUnits: numeric("annual_volume_units"),
  unitType: varchar("unit_type"),
  embeddedCarbonPerUnit: numeric("embedded_carbon_per_unit"),
  totalAnnualEmbeddedCarbon: numeric("total_annual_embedded_carbon"),
  epdReference: varchar("epd_reference"),
  epdId: varchar("epd_id"),
  dataSource: varchar("data_source").notNull().default("estimate"),
  dataQuality: varchar("data_quality").notNull().default("estimated"),
  offsetStatus: varchar("offset_status").notNull().default("none"),
  retiredTonnes: numeric("retired_tonnes"),
  lastUpdated: timestamp("last_updated").notNull().defaultNow(),
});

export const insertExchangeListingSchema = createInsertSchema(exchangeListings).omit({
  id: true,
  createdAt: true,
});
export const insertExchangeAccountSchema = createInsertSchema(exchangeAccounts).omit({
  id: true,
  createdAt: true,
});
export const insertExchangeRfqSchema = createInsertSchema(exchangeRfqs).omit({
  id: true,
  createdAt: true,
});
export const insertExchangeCreditListingSchema = createInsertSchema(exchangeCreditListings).omit({
  id: true,
  status: true,
  createdAt: true,
});

export const insertWebhookFailureSchema = createInsertSchema(webhookFailures).omit({
  id: true,
  retryCount: true,
  resolved: true,
  createdAt: true,
});

export const insertExchangeTradeSchema = createInsertSchema(exchangeTrades).omit({
  id: true,
  createdAt: true,
});

export const insertTradeRetirementCertificateSchema = createInsertSchema(tradeRetirementCertificates).omit({
  id: true,
  createdAt: true,
});
export const tradeSignatures = pgTable("trade_signatures", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tradeId: varchar("trade_id").notNull().references(() => exchangeTrades.tradeId),
  documentHash: varchar("document_hash").notNull(),
  contractTextHash: varchar("contract_text_hash").notNull(),
  signerFullName: varchar("signer_full_name").notNull(),
  signerEmail: varchar("signer_email").notNull(),
  signerIp: varchar("signer_ip").notNull(),
  signerUserAgent: varchar("signer_user_agent").notNull(),
  signedAt: timestamp("signed_at").notNull().defaultNow(),
  explicitConsent: boolean("explicit_consent").notNull(),
  retentionUntil: date("retention_until").notNull(),
  platformAttestation: varchar("platform_attestation").notNull(),
}, (table) => ({
  uniqueTradeSignerPair: unique('idx_trade_signatures_trade_email').on(table.tradeId, table.signerEmail),
  consentMustBeTrue: check('chk_explicit_consent_true', sql`${table.explicitConsent} = true`),
}));

export const insertTradeSignatureSchema = createInsertSchema(tradeSignatures).omit({
  id: true,
});

export const insertAlertSubscriberSchema = createInsertSchema(alertSubscribers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  subscribedAt: true,
});

export type ExchangeListing = typeof exchangeListings.$inferSelect;
export type InsertExchangeListing = z.infer<typeof insertExchangeListingSchema>;
export type ExchangeAccount = typeof exchangeAccounts.$inferSelect;
export type InsertExchangeAccount = z.infer<typeof insertExchangeAccountSchema>;
export type ExchangeRfq = typeof exchangeRfqs.$inferSelect;
export type InsertExchangeRfq = z.infer<typeof insertExchangeRfqSchema>;
export type ExchangeCreditListing = typeof exchangeCreditListings.$inferSelect;
export type InsertExchangeCreditListing = z.infer<typeof insertExchangeCreditListingSchema>;
export type WebhookFailure = typeof webhookFailures.$inferSelect;
export type InsertWebhookFailure = z.infer<typeof insertWebhookFailureSchema>;
export type ExchangeTrade = typeof exchangeTrades.$inferSelect;
export type InsertExchangeTrade = z.infer<typeof insertExchangeTradeSchema>;
export type TradeRetirementCertificate = typeof tradeRetirementCertificates.$inferSelect;
export type AlertSubscriber = typeof alertSubscribers.$inferSelect;
export type InsertTradeRetirementCertificate = z.infer<typeof insertTradeRetirementCertificateSchema>;
export type TradeSignature = typeof tradeSignatures.$inferSelect;
export type InsertTradeSignature = z.infer<typeof insertTradeSignatureSchema>;
export type AuditChainEntry = typeof auditChainEntries.$inferSelect;
export type EscrowSettlementLog = typeof escrowSettlementsLog.$inferSelect;
export type AlgorithmRotationLog = typeof algorithmRotationLog.$inferSelect;
export type AuditReport = typeof auditReports.$inferSelect;
export type ApiKey = typeof apiKeys.$inferSelect;
export type Webhook = typeof webhooks.$inferSelect;
export type WebhookDeliveryLog = typeof webhookDeliveryLog.$inferSelect;
export type ComplianceDocument = typeof complianceDocuments.$inferSelect;
export type CreditReservation = typeof creditReservations.$inferSelect;

export type IotDevice = typeof iotDevices.$inferSelect;
export type IotReading = typeof iotReadings.$inferSelect;
export type IotRawPayload = typeof iotRawPayloads.$inferSelect;
export type DeviceCertification = typeof deviceCertifications.$inferSelect;
export type MrvReport = typeof mrvReports.$inferSelect;
export type AnomalyEvent = typeof anomalyEvents.$inferSelect;
export type FirmwareVersion = typeof firmwareVersions.$inferSelect;
export type SatelliteReading = typeof satelliteReadings.$inferSelect;
export type IotTrustScore = typeof iotTrustScores.$inferSelect;

export type CreditRegistry = typeof creditRegistry.$inferSelect;
export type UvsCertification = typeof uvsCertifications.$inferSelect;
export type CommitteeMember = typeof committeeMembers.$inferSelect;
export type MethodologyAmendment = typeof methodologyAmendments.$inferSelect;
export type PushSubscription = typeof pushSubscriptions.$inferSelect;
export type CbamDeclaration = typeof cbamDeclarations.$inferSelect;
export type EpdRecord = typeof epdRecords.$inferSelect;
export type ProductCarbonPassport = typeof productCarbonPassports.$inferSelect;
export type IsoVerifier = typeof isoVerifiers.$inferSelect;
export type IsoVerificationEngagement = typeof isoVerificationEngagements.$inferSelect;
export type SupplyChainCarbonMap = typeof supplyChainCarbonMap.$inferSelect;
export type PartnerMethodology = typeof partnerMethodologies.$inferSelect;
export type MethodologyCitation = typeof methodologyCitations.$inferSelect;

// ── Admin Action Audit Log ───────────────────────────────────────────────────
export const actionLogs = pgTable("action_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  adminId: varchar("admin_id").notNull(),
  actionType: varchar("action_type").notNull(),
  affectedRecordId: varchar("affected_record_id"),
  notes: text("notes"),
  details: text("details"),
  ip: varchar("ip"),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

export const insertAdminActionLogSchema = createInsertSchema(actionLogs).omit({ id: true, timestamp: true });
export type AdminActionLog = typeof actionLogs.$inferSelect;
export type InsertAdminActionLog = z.infer<typeof insertAdminActionLogSchema>;

// ── Backup & Disaster Recovery ──────────────────────────────────────────────
export const backupLogs = pgTable("backup_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  filename: text("filename").notNull(),
  fileSizeBytes: integer("file_size_bytes"),
  checksumSha256: text("checksum_sha256"),
  storagePath: text("storage_path"),
  storageProvider: text("storage_provider").default("local"),
  uploadStatus: text("upload_status").default("pending"),
  backupType: text("backup_type").default("scheduled"),
  triggeredBy: text("triggered_by").default("cron"),
  errorMessage: text("error_message"),
  verifiedAt: timestamp("verified_at"),
  verifyStatus: text("verify_status"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertBackupLogSchema = createInsertSchema(backupLogs).omit({
  id: true,
  createdAt: true,
});

export type BackupLog = typeof backupLogs.$inferSelect;
export type InsertBackupLog = z.infer<typeof insertBackupLogSchema>;

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),
  tokenHash: text("token_hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
});

export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;

export interface GameState {
  matchId: string;
  player1: { id: string; name: string; y: number; score: number };
  player2: { id: string; name: string; y: number; score: number };
  ball: { x: number; y: number; vx: number; vy: number };
  status: 'waiting' | 'playing' | 'finished';
  winner?: string;
}
