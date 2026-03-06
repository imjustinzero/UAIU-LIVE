import { 
  type User, 
  type InsertUser,
  type Match,
  type InsertMatch,
  type PayoutRequest,
  type InsertPayoutRequest,
  type ActionLogEntry,
  type InsertActionLog,
  type Post,
  type InsertPost,
  type Like,
  type InsertLike,
  type Comment,
  type InsertComment,
  type Friendship,
  type InsertFriendship,
  type ReferralPayout,
  type InsertReferralPayout,
  type LiveMatchSession,
  type InsertLiveMatchSession,
  type ExchangeListing,
  type InsertExchangeListing,
  type ExchangeAccount,
  type InsertExchangeAccount,
  type ExchangeRfq,
  type InsertExchangeRfq,
  type ExchangeCreditListing,
  type InsertExchangeCreditListing,
  users,
  matches,
  payoutRequests,
  actionLog,
  posts,
  likes,
  comments,
  friendships,
  referralPayouts,
  liveMatchSessions,
  exchangeListings,
  exchangeAccounts,
  exchangeRfqs,
  exchangeCreditListings,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, or, and, sql, inArray } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByVerificationToken(token: string): Promise<User | undefined>;
  getUserByAffiliateCode(affiliateCode: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(userId: string, updates: Partial<User>): Promise<void>;
  updateUserCredits(userId: string, credits: number): Promise<void>;
  updateUserStats(userId: string, stats: { wins?: number; losses?: number; matchesPlayed?: number; totalEarnings?: number }): Promise<void>;
  getLeaderboard(limit: number): Promise<User[]>;
  
  createMatch(match: InsertMatch): Promise<Match>;
  getRecentMatches(limit: number): Promise<Match[]>;
  
  createPayoutRequest(request: InsertPayoutRequest): Promise<PayoutRequest>;
  
  getActionLog(limit: number): Promise<ActionLogEntry[]>;
  addActionLog(entry: InsertActionLog): Promise<void>;
  
  // Social features
  createPost(post: InsertPost): Promise<Post>;
  getPostById(postId: string): Promise<Post | undefined>;
  getFeedPosts(userId: string, limit: number): Promise<Post[]>;
  deletePost(postId: string, userId: string): Promise<boolean>;
  
  createLike(like: InsertLike): Promise<Like>;
  hasLiked(postId: string, userId: string): Promise<boolean>;
  deleteLike(postId: string, userId: string): Promise<void>;
  processLikeTransaction(likerId: string, creatorId: string, postId: string, likerUsername: string): Promise<boolean>;
  
  createComment(comment: InsertComment): Promise<Comment>;
  getPostComments(postId: string): Promise<Comment[]>;
  getLastCommentTime(postId: string, userId: string): Promise<Date | null>;
  processCommentTransaction(commenterId: string, creatorId: string, postId: string, commenterUsername: string, content: string): Promise<Comment | null>;
  
  addFriend(userId: string, friendIdentifier: string): Promise<Friendship>;
  removeFriend(userId: string, friendId: string): Promise<void>;
  getFriends(userId: string): Promise<User[]>;
  areFriends(userId: string, friendId: string): Promise<boolean>;
  
  // Referral payouts
  createReferralPayout(payout: InsertReferralPayout): Promise<ReferralPayout | null>;
  getReferralPayoutBySessionId(sessionId: string): Promise<ReferralPayout | undefined>;
  
  // Live video chat sessions
  createLiveMatchSession(session: InsertLiveMatchSession): Promise<LiveMatchSession>;

  // Exchange
  getExchangeListings(standard?: string): Promise<ExchangeListing[]>;
  seedExchangeListings(listings: InsertExchangeListing[]): Promise<void>;
  getExchangeAccountByEmail(email: string): Promise<ExchangeAccount | null>;
  createExchangeAccount(account: InsertExchangeAccount): Promise<ExchangeAccount>;
  createExchangeRfq(rfq: InsertExchangeRfq): Promise<ExchangeRfq>;
  createExchangeCreditListing(listing: InsertExchangeCreditListing): Promise<ExchangeCreditListing>;
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

  async getUserByVerificationToken(token: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.emailVerificationToken, token));
    return user;
  }

  async getUserByAffiliateCode(affiliateCode: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.affiliateCode, affiliateCode));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUser(userId: string, updates: Partial<User>): Promise<void> {
    await db.update(users)
      .set(updates)
      .where(eq(users.id, userId));
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

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createPost(insertPost: InsertPost): Promise<Post> {
    const [post] = await db.insert(posts).values(insertPost).returning();
    return post;
  }

  async getPostById(postId: string): Promise<Post | undefined> {
    const [post] = await db.select().from(posts).where(eq(posts.id, postId));
    return post;
  }

  async getFeedPosts(userId: string, limit: number): Promise<Post[]> {
    // Get user's friends
    const userFriendships = await db.select({ friendId: friendships.friendId })
      .from(friendships)
      .where(eq(friendships.userId, userId));
    
    const friendIds = userFriendships.map(f => f.friendId);
    friendIds.push(userId); // Include user's own posts

    // Get admin user ID for public posts
    const adminUser = await this.getUserByEmail('imjustinzero@gmail.com');
    
    // Get posts from user and friends, plus public posts from admin only
    const conditions = [inArray(posts.userId, friendIds)];
    if (adminUser) {
      const adminCondition = and(
        eq(posts.visibility, 'public'),
        eq(posts.userId, adminUser.id)
      );
      if (adminCondition) {
        conditions.push(adminCondition);
      }
    }

    return await db.select()
      .from(posts)
      .where(or(...conditions))
      .orderBy(desc(posts.createdAt))
      .limit(limit);
  }

  async deletePost(postId: string, userId: string): Promise<boolean> {
    const result = await db.delete(posts)
      .where(and(eq(posts.id, postId), eq(posts.userId, userId)))
      .returning();
    return result.length > 0;
  }

  async createLike(insertLike: InsertLike): Promise<Like> {
    const [like] = await db.insert(likes).values(insertLike).returning();
    
    // Increment like count on post
    await db.update(posts)
      .set({ likesCount: sql`${posts.likesCount} + 1` })
      .where(eq(posts.id, insertLike.postId));
    
    return like;
  }

  async hasLiked(postId: string, userId: string): Promise<boolean> {
    const [like] = await db.select()
      .from(likes)
      .where(and(eq(likes.postId, postId), eq(likes.userId, userId)));
    return !!like;
  }

  async deleteLike(postId: string, userId: string): Promise<void> {
    await db.delete(likes)
      .where(and(eq(likes.postId, postId), eq(likes.userId, userId)));
    
    // Decrement like count on post
    await db.update(posts)
      .set({ likesCount: sql`${posts.likesCount} - 1` })
      .where(eq(posts.id, postId));
  }

  async processLikeTransaction(likerId: string, creatorId: string, postId: string, likerUsername: string): Promise<boolean> {
    try {
      // Check if user has enough credits first
      const liker = await db.select({ credits: users.credits })
        .from(users)
        .where(eq(users.id, likerId));
      
      if (!liker[0] || liker[0].credits < 1) {
        return false;
      }

      // Check if already liked (duplicate check)
      const existingLike = await db.select()
        .from(likes)
        .where(and(eq(likes.postId, postId), eq(likes.userId, likerId)));
      
      if (existingLike.length > 0) {
        return false;
      }

      // Create like (unique constraint will prevent race conditions)
      await db.insert(likes).values({
        postId,
        userId: likerId,
        username: likerUsername,
      });

      // Deduct 1 credit from liker (atomic with balance check)
      const likerUpdate = await db.update(users)
        .set({ credits: sql`${users.credits} - 1` })
        .where(and(eq(users.id, likerId), sql`${users.credits} >= 1`))
        .returning();

      // If credit deduction failed, rollback like
      if (likerUpdate.length === 0) {
        await db.delete(likes)
          .where(and(eq(likes.postId, postId), eq(likes.userId, likerId)));
        return false;
      }

      // Add 0.6 credits to creator (atomic)
      await db.update(users)
        .set({ credits: sql`${users.credits} + 0.6` })
        .where(eq(users.id, creatorId));

      // Increment like count on post (atomic)
      await db.update(posts)
        .set({ likesCount: sql`${posts.likesCount} + 1` })
        .where(eq(posts.id, postId));

      return true;
    } catch (error: any) {
      if (error.code === '23505') {
        // Duplicate like - unique constraint violation
        return false;
      }
      console.error('Like transaction error:', error);
      return false;
    }
  }

  async createComment(insertComment: InsertComment): Promise<Comment> {
    const [comment] = await db.insert(comments).values(insertComment).returning();
    
    // Increment comment count on post
    await db.update(posts)
      .set({ commentsCount: sql`${posts.commentsCount} + 1` })
      .where(eq(posts.id, insertComment.postId));
    
    return comment;
  }

  async getPostComments(postId: string): Promise<Comment[]> {
    return await db.select()
      .from(comments)
      .where(eq(comments.postId, postId))
      .orderBy(desc(comments.createdAt));
  }

  async getLastCommentTime(postId: string, userId: string): Promise<Date | null> {
    const [comment] = await db.select({ createdAt: comments.createdAt })
      .from(comments)
      .where(and(eq(comments.postId, postId), eq(comments.userId, userId)))
      .orderBy(desc(comments.createdAt))
      .limit(1);
    
    return comment ? comment.createdAt : null;
  }

  async processCommentTransaction(commenterId: string, creatorId: string, postId: string, commenterUsername: string, content: string): Promise<Comment | null> {
    try {
      // Check rate limiting (user accepted race condition risk)
      const lastCommentTime = await this.getLastCommentTime(postId, commenterId);
      if (lastCommentTime) {
        const secondsSinceLastComment = (Date.now() - lastCommentTime.getTime()) / 1000;
        if (secondsSinceLastComment < 30) {
          return null; // Rate limited
        }
      }

      // Check if user has enough credits
      const commenter = await db.select({ credits: users.credits })
        .from(users)
        .where(eq(users.id, commenterId));
      
      if (!commenter[0] || commenter[0].credits < 1) {
        return null;
      }

      // Create comment
      const [comment] = await db.insert(comments).values({
        postId,
        userId: commenterId,
        username: commenterUsername,
        content,
      }).returning();

      // Deduct 1 credit from commenter (atomic with balance check)
      const commenterUpdate = await db.update(users)
        .set({ credits: sql`${users.credits} - 1` })
        .where(and(eq(users.id, commenterId), sql`${users.credits} >= 1`))
        .returning();

      // If credit deduction failed, rollback comment
      if (commenterUpdate.length === 0) {
        await db.delete(comments).where(eq(comments.id, comment.id));
        return null;
      }

      // Add 0.6 credits to creator (atomic)
      await db.update(users)
        .set({ credits: sql`${users.credits} + 0.6` })
        .where(eq(users.id, creatorId));

      // Increment comment count on post (atomic)
      await db.update(posts)
        .set({ commentsCount: sql`${posts.commentsCount} + 1` })
        .where(eq(posts.id, postId));

      return comment;
    } catch (error: any) {
      console.error('Comment transaction error:', error);
      return null;
    }
  }

  async addFriend(userId: string, friendIdentifier: string): Promise<Friendship> {
    // Find friend by username or email
    let friend: User | undefined;
    if (friendIdentifier.startsWith('@')) {
      friend = await this.getUserByUsername(friendIdentifier);
    } else {
      friend = await this.getUserByEmail(friendIdentifier);
    }

    if (!friend) {
      throw new Error('User not found');
    }

    if (friend.id === userId) {
      throw new Error('Cannot add yourself as a friend');
    }

    // Check if already friends
    const existing = await db.select()
      .from(friendships)
      .where(and(eq(friendships.userId, userId), eq(friendships.friendId, friend.id)));
    
    if (existing.length > 0) {
      throw new Error('Already friends');
    }

    const [friendship] = await db.insert(friendships)
      .values({ userId, friendId: friend.id, status: 'accepted' })
      .returning();
    
    // Create reciprocal friendship
    await db.insert(friendships)
      .values({ userId: friend.id, friendId: userId, status: 'accepted' });
    
    return friendship;
  }

  async removeFriend(userId: string, friendId: string): Promise<void> {
    await db.delete(friendships)
      .where(and(eq(friendships.userId, userId), eq(friendships.friendId, friendId)));
    
    // Remove reciprocal friendship
    await db.delete(friendships)
      .where(and(eq(friendships.userId, friendId), eq(friendships.friendId, userId)));
  }

  async getFriends(userId: string): Promise<User[]> {
    const userFriendships = await db.select({ friendId: friendships.friendId })
      .from(friendships)
      .where(eq(friendships.userId, userId));
    
    const friendIds = userFriendships.map(f => f.friendId);
    
    if (friendIds.length === 0) return [];
    
    return await db.select()
      .from(users)
      .where(inArray(users.id, friendIds));
  }

  async areFriends(userId: string, friendId: string): Promise<boolean> {
    const [friendship] = await db.select()
      .from(friendships)
      .where(and(eq(friendships.userId, userId), eq(friendships.friendId, friendId)));
    return !!friendship;
  }
  
  async createReferralPayout(payout: InsertReferralPayout): Promise<ReferralPayout | null> {
    try {
      const [result] = await db.insert(referralPayouts)
        .values(payout)
        .returning();
      return result;
    } catch (error: any) {
      // Check if this is a unique constraint violation on stripeSessionId
      if (error?.code === '23505' && error?.constraint === 'referral_payouts_stripe_session_id_unique') {
        // Duplicate session - this payout was already processed
        return null;
      }
      throw error;
    }
  }
  
  async getReferralPayoutBySessionId(sessionId: string): Promise<ReferralPayout | undefined> {
    const [payout] = await db.select()
      .from(referralPayouts)
      .where(eq(referralPayouts.stripeSessionId, sessionId));
    return payout;
  }
  
  async createLiveMatchSession(session: InsertLiveMatchSession): Promise<LiveMatchSession> {
    const [result] = await db.insert(liveMatchSessions)
      .values(session)
      .returning();
    return result;
  }

  async getExchangeListings(standard?: string): Promise<ExchangeListing[]> {
    if (standard && standard !== 'ALL') {
      return db.select().from(exchangeListings)
        .where(eq(exchangeListings.standard, standard))
        .orderBy(desc(exchangeListings.pricePerTonne));
    }
    return db.select().from(exchangeListings)
      .orderBy(desc(exchangeListings.pricePerTonne));
  }

  async seedExchangeListings(listings: InsertExchangeListing[]): Promise<void> {
    await db.insert(exchangeListings).values(listings);
  }

  async createExchangeAccount(account: InsertExchangeAccount): Promise<ExchangeAccount> {
    const [result] = await db.insert(exchangeAccounts).values(account).returning();
    return result;
  }

  async createExchangeRfq(rfq: InsertExchangeRfq): Promise<ExchangeRfq> {
    const [result] = await db.insert(exchangeRfqs).values(rfq).returning();
    return result;
  }

  async createExchangeCreditListing(listing: InsertExchangeCreditListing): Promise<ExchangeCreditListing> {
    const [result] = await db.insert(exchangeCreditListings).values(listing).returning();
    return result;
  }

  async getExchangeAccountByEmail(email: string): Promise<ExchangeAccount | null> {
    const trimmed = email.toLowerCase().trim();
    const [account] = await db.select().from(exchangeAccounts)
      .where(eq(exchangeAccounts.email, trimmed))
      .limit(1);
    return account || null;
  }
}

export const storage = new DbStorage();
