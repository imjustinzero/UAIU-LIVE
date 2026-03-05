import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { Server as SocketIOServer, Socket } from "socket.io";
import { storage } from "./storage";
import bcrypt from "bcrypt";
import { sql, eq } from "drizzle-orm";
import type { GameState } from "@shared/schema";
import { liveMatchSessions } from "@shared/schema";
import { db } from "./db";
import { sendPayoutNotification } from "./email-config";
import { sendSignupNotification, sendFormSubmissionEmail, sendExchangeEmail } from "./email-service";
import { insertExchangeAccountSchema, insertExchangeCreditListingSchema, insertExchangeRfqSchema } from "@shared/schema";
import multer from "multer";
import path from "path";
import fs from "fs";
import PDFDocument from "pdfkit";
import { createSession, getSession, requireAuth } from "./session-middleware";
import { initStripe } from "./stripe-init";
import { WebhookHandlers } from "./webhookHandlers";
import { gameManager, type GameType } from "./game-manager";
import { nanoid } from "nanoid";

// Legacy Pong code removed - all games now use GameManager

// Legacy Pong functions removed - all game logic now in GameManager

export async function registerRoutes(app: Express, httpServer: Server): Promise<void> {
  // Initialize Stripe and get webhook UUID
  const stripeInit = await initStripe();

  // Register Stripe webhook route BEFORE express.json()
  // This route needs raw Buffer for signature verification
  if (stripeInit) {
    app.post(
      '/api/stripe/webhook/:uuid',
      express.raw({ type: 'application/json' }),
      async (req, res) => {
        const signature = req.headers['stripe-signature'];

        if (!signature) {
          return res.status(400).json({ error: 'Missing stripe-signature' });
        }

        try {
          const sig = Array.isArray(signature) ? signature[0] : signature;

          if (!Buffer.isBuffer(req.body)) {
            const errorMsg = 'STRIPE WEBHOOK ERROR: req.body is not a Buffer';
            console.error(errorMsg);
            return res.status(500).json({ error: 'Webhook processing error' });
          }

          const { uuid } = req.params;
          await WebhookHandlers.processWebhook(req.body as Buffer, sig, uuid);

          res.status(200).json({ received: true });
        } catch (error: any) {
          console.error('Webhook error:', error.message);
          res.status(400).json({ error: 'Webhook processing error' });
        }
      }
    );
    console.log('✅ Stripe webhook endpoint registered at /api/stripe/webhook/:uuid');
  }

  // NOW apply JSON middleware for all other routes
  app.use(express.json());

  app.post('/api/auth/signup', async (req, res) => {
    try {
      const { email, name, password, referralCode } = req.body;

      if (!email || !name || !password) {
        return res.status(400).json({ message: 'Email, name, and password are required' });
      }

      const existing = await storage.getUserByEmail(email);
      if (existing) {
        return res.status(400).json({ message: 'Email already registered' });
      }

      // Validate referral code if provided
      let referrerId: string | undefined;
      if (referralCode && referralCode.trim()) {
        const referrer = await storage.getUserByAffiliateCode(referralCode.trim());
        if (!referrer) {
          return res.status(400).json({ message: 'Invalid referral code' });
        }
        referrerId = referrer.id;
      }

      // Generate unique username from name
      let username = name.toLowerCase().replace(/[^a-z0-9]/g, '');
      let suffix = 0;
      let finalUsername = username;
      
      while (await storage.getUserByUsername(finalUsername)) {
        suffix++;
        finalUsername = `${username}${suffix}`;
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      
      // Generate unique affiliate code with retry logic for collisions
      let user;
      let attempts = 0;
      const maxAttempts = 5;
      
      while (attempts < maxAttempts) {
        try {
          const affiliateCode = nanoid(8).toUpperCase();
          user = await storage.createUser({ 
            email, 
            name,
            password: hashedPassword,
            affiliateCode,
            referredBy: referrerId,
          });
          break; // Success, exit loop
        } catch (error: any) {
          // Check if error is due to unique constraint violation on affiliateCode
          if (error.message?.includes('affiliate_code') || error.code === '23505') {
            attempts++;
            if (attempts >= maxAttempts) {
              throw new Error('Failed to generate unique affiliate code. Please try again.');
            }
            // Retry with new code
            continue;
          }
          // Re-throw other errors
          throw error;
        }
      }

      if (!user) {
        throw new Error('User creation failed');
      }

      // Update username separately
      await storage.updateUser(user.id, { username: finalUsername });

      // Give 1 free credit immediately upon signup
      await storage.updateUserCredits(user.id, 1);

      await storage.addActionLog({
        userId: user.id,
        userName: name,
        type: 'signup',
        message: `${name} joined UAIU Arcade!${referrerId ? ' (referred)' : ''}`,
      });

      // Optionally send admin notification (silently fail if it doesn't work)
      sendSignupNotification(email, name, new Date()).catch(err => {
        console.error('❌ Signup notification error:', err);
      });

      const sessionId = createSession(user.id, user.email);
      
      // Fetch updated user with credits
      const updatedUser = await storage.getUser(user.id);
      res.json({ ...updatedUser, sessionId });
    } catch (error) {
      console.error('Signup error:', error);
      res.status(500).json({ message: 'Signup failed' });
    }
  });

  // Explicitly return 404 for removed verification endpoints
  app.get('/api/auth/verify-email', (req, res) => {
    res.status(404).json({ message: 'Email verification is no longer required' });
  });

  app.post('/api/auth/resend-verification', (req, res) => {
    res.status(404).json({ message: 'Email verification is no longer required' });
  });

  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
      }

      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ message: 'Invalid email or password' });
      }

      const valid = await bcrypt.compare(password, user.password);
      if (!valid) {
        return res.status(401).json({ message: 'Invalid email or password' });
      }

      const sessionId = createSession(user.id, user.email);
      res.json({ ...user, sessionId });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ message: 'Login failed' });
    }
  });

  app.get('/api/auth/me', requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      res.json(user);
    } catch (error) {
      console.error('Get user error:', error);
      res.status(500).json({ message: 'Failed to get user' });
    }
  });

  app.patch('/api/profile/update', requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const { name } = req.body;

      if (!name || !name.trim()) {
        return res.status(400).json({ message: 'Name is required' });
      }

      await storage.updateUser(userId, { name: name.trim() });
      const updatedUser = await storage.getUser(userId);

      if (!updatedUser) {
        return res.status(404).json({ message: 'User not found' });
      }

      res.json(updatedUser);
    } catch (error) {
      console.error('Update profile error:', error);
      res.status(500).json({ message: 'Failed to update profile' });
    }
  });

  app.get('/api/leaderboard', async (req, res) => {
    try {
      const leaders = await storage.getLeaderboard(10);
      res.json(leaders);
    } catch (error) {
      console.error('Leaderboard error:', error);
      res.status(500).json({ message: 'Failed to fetch leaderboard' });
    }
  });

  app.get('/api/action-log', async (req, res) => {
    try {
      const logs = await storage.getActionLog(50);
      res.json(logs);
    } catch (error) {
      console.error('Action log error:', error);
      res.status(500).json({ message: 'Failed to fetch action log' });
    }
  });

  app.get('/api/turn', async (_req, res) => {
    try {
      const iceServers = [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ];
      return res.json({ iceServers });
    } catch (err) {
      console.error('TURN credentials error:', err);
      return res.status(500).json({ error: 'Server error fetching TURN credentials' });
    }
  });

  app.get('/api/games', async (req, res) => {
    try {
      const games = [
        { id: 'pong', name: 'Pong', description: 'Classic paddle battle', players: '1v1', difficulty: 'Easy' },
        { id: 'tetris', name: 'Tetris', description: 'Battle mode competition', players: '1v1', difficulty: 'Hard' },
        { id: 'snake', name: 'Snake', description: 'Multiplayer survival race', players: '1v1', difficulty: 'Medium' },
        { id: 'breakout', name: 'Breakout', description: 'Brick breaking duel', players: '1v1', difficulty: 'Medium' },
        { id: 'flappybird', name: 'Flappy Bird', description: 'Survival race challenge', players: '1v1', difficulty: 'Hard' },
        { id: 'connect4', name: 'Connect 4', description: 'Strategic drop game', players: '1v1', difficulty: 'Easy' },
      ];
      res.json(games);
    } catch (error) {
      console.error('Games list error:', error);
      res.status(500).json({ message: 'Failed to fetch games' });
    }
  });

  // Social Feed Routes
  app.get('/api/feed', requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const posts = await storage.getFeedPosts(userId, 50);
      res.json(posts);
    } catch (error) {
      console.error('Feed error:', error);
      res.status(500).json({ message: 'Failed to fetch feed' });
    }
  });

  app.post('/api/posts', requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const { content, youtubeUrl, visibility } = req.body;

      if (!content || content.trim().length === 0) {
        return res.status(400).json({ message: 'Content is required' });
      }

      const user = await storage.getUser(userId);
      if (!user || !user.username) {
        return res.status(400).json({ message: 'User not found or missing username' });
      }

      // Determine final visibility: only imjustinzero@gmail.com can set public
      let finalVisibility = user.postsVisibility || 'friends';
      if (visibility) {
        if (visibility === 'public' && user.email !== 'imjustinzero@gmail.com') {
          return res.status(403).json({ message: 'Only admin can create public posts' });
        }
        finalVisibility = visibility;
      }

      const post = await storage.createPost({
        userId,
        username: user.username,
        content: content.trim(),
        youtubeUrl: youtubeUrl || null,
        visibility: finalVisibility,
      });

      res.json(post);
    } catch (error) {
      console.error('Create post error:', error);
      res.status(500).json({ message: 'Failed to create post' });
    }
  });

  app.post('/api/posts/:postId/like', requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const { postId } = req.params;

      // Get post and validate authorization
      const post = await storage.getPostById(postId);
      if (!post) {
        return res.status(404).json({ message: 'Post not found' });
      }

      // Cannot like own post
      if (post.userId === userId) {
        return res.status(400).json({ message: 'Cannot like your own post' });
      }

      // Verify user can see this post (must be friends or own post)
      if (post.userId !== userId) {
        const areFriends = await storage.areFriends(userId, post.userId);
        if (!areFriends) {
          return res.status(403).json({ message: 'You can only like posts from friends' });
        }
      }

      const user = await storage.getUser(userId);
      if (!user || !user.username) {
        return res.status(400).json({ message: 'User not found' });
      }

      // Perform atomic credit transaction (unique constraint prevents duplicates)
      const success = await storage.processLikeTransaction(userId, post.userId, postId, user.username);
      
      if (!success) {
        return res.status(400).json({ message: 'Already liked or insufficient credits' });
      }

      // Get updated user credits
      const updatedUser = await storage.getUser(userId);
      res.json({ success: true, newCredits: updatedUser?.credits || 0 });
    } catch (error) {
      console.error('Like error:', error);
      res.status(500).json({ message: 'Failed to like post' });
    }
  });

  app.delete('/api/posts/:postId/like', requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const { postId } = req.params;

      await storage.deleteLike(postId, userId);
      res.json({ success: true });
    } catch (error) {
      console.error('Unlike error:', error);
      res.status(500).json({ message: 'Failed to unlike post' });
    }
  });

  app.post('/api/posts/:postId/comment', requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const { postId } = req.params;
      const { content } = req.body;

      if (!content || content.trim().length === 0) {
        return res.status(400).json({ message: 'Comment content is required' });
      }

      // Get post and validate authorization
      const post = await storage.getPostById(postId);
      if (!post) {
        return res.status(404).json({ message: 'Post not found' });
      }

      // Cannot comment on own post
      if (post.userId === userId) {
        return res.status(400).json({ message: 'Cannot comment on your own post' });
      }

      // Verify user can see this post (must be friends or own post)
      if (post.userId !== userId) {
        const areFriends = await storage.areFriends(userId, post.userId);
        if (!areFriends) {
          return res.status(403).json({ message: 'You can only comment on posts from friends' });
        }
      }

      const user = await storage.getUser(userId);
      if (!user || !user.username) {
        return res.status(400).json({ message: 'User not found' });
      }

      // Perform atomic credit transaction and create comment (includes rate limiting)
      const comment = await storage.processCommentTransaction(
        userId,
        post.userId,
        postId,
        user.username,
        content.trim()
      );

      if (!comment) {
        return res.status(400).json({ message: 'Insufficient credits. You need 1 credit to comment.' });
      }

      // Get updated user credits
      const updatedUser = await storage.getUser(userId);
      res.json({ comment, newCredits: updatedUser?.credits || 0 });
    } catch (error: any) {
      if (error.message === 'RATE_LIMITED') {
        return res.status(429).json({ 
          message: 'Please wait 30 seconds before commenting again on this post',
          waitTime: 30
        });
      }
      console.error('Comment error:', error);
      res.status(500).json({ message: 'Failed to create comment' });
    }
  });

  app.get('/api/posts/:postId/comments', requireAuth, async (req, res) => {
    try {
      const { postId } = req.params;
      const comments = await storage.getPostComments(postId);
      res.json(comments);
    } catch (error) {
      console.error('Get comments error:', error);
      res.status(500).json({ message: 'Failed to fetch comments' });
    }
  });

  app.post('/api/friends', requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const { friendIdentifier } = req.body;

      if (!friendIdentifier) {
        return res.status(400).json({ message: 'Friend identifier (@username or email) is required' });
      }

      const friendship = await storage.addFriend(userId, friendIdentifier.trim());
      res.json(friendship);
    } catch (error: any) {
      console.error('Add friend error:', error);
      res.status(400).json({ message: error.message || 'Failed to add friend' });
    }
  });

  app.get('/api/friends', requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const friends = await storage.getFriends(userId);
      res.json(friends);
    } catch (error) {
      console.error('Get friends error:', error);
      res.status(500).json({ message: 'Failed to fetch friends' });
    }
  });

  app.delete('/api/friends/:friendId', requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const { friendId } = req.params;

      await storage.removeFriend(userId, friendId);
      res.json({ success: true });
    } catch (error) {
      console.error('Remove friend error:', error);
      res.status(500).json({ message: 'Failed to remove friend' });
    }
  });

  app.post('/api/payout/request', requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const { paymentMethod, paymentInfo } = req.body;

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      const amount = user.credits;

      if (amount < 1) {
        return res.status(400).json({ message: 'Insufficient credits for payout' });
      }

      await storage.createPayoutRequest({
        userId,
        userName: user.name,
        userEmail: user.email,
        amount,
        paymentMethod,
        paymentInfo,
      });

      await storage.updateUserCredits(userId, 0);

      await storage.addActionLog({
        userId: user.id,
        userName: user.name,
        type: 'payout',
        message: `${user.name} requested payout of ${amount.toFixed(1)} credits via ${paymentMethod}`,
      });

      await sendPayoutNotification(user.name, user.email, amount, paymentMethod, paymentInfo);

      res.json({ success: true });
    } catch (error) {
      console.error('Payout error:', error);
      res.status(500).json({ message: 'Payout request failed' });
    }
  });

  // Send credits to another user
  app.post('/api/credits/send', requireAuth, async (req, res) => {
    try {
      const senderId = (req as any).userId;
      const { recipientId, amount } = req.body;

      if (!recipientId || !amount) {
        return res.status(400).json({ message: 'Recipient and amount are required' });
      }

      const creditAmount = parseFloat(amount);
      if (isNaN(creditAmount) || creditAmount <= 0) {
        return res.status(400).json({ message: 'Amount must be a positive number' });
      }

      if (creditAmount < 1) {
        return res.status(400).json({ message: 'Minimum transfer is 1 credit' });
      }

      const sender = await storage.getUser(senderId);
      if (!sender) {
        return res.status(404).json({ message: 'Sender not found' });
      }

      if (sender.credits < creditAmount) {
        return res.status(400).json({ message: 'Insufficient credits' });
      }

      const recipient = await storage.getUser(recipientId);
      if (!recipient) {
        return res.status(404).json({ message: 'Recipient not found' });
      }

      if (senderId === recipientId) {
        return res.status(400).json({ message: 'Cannot send credits to yourself' });
      }

      // Deduct from sender
      await storage.updateUserCredits(senderId, sender.credits - creditAmount);
      // Add to recipient
      await storage.updateUserCredits(recipientId, recipient.credits + creditAmount);

      // Log the transfer
      await storage.addActionLog({
        userId: senderId,
        userName: sender.name,
        type: 'credit_transfer',
        message: `${sender.name} sent ${creditAmount.toFixed(1)} credits to ${recipient.name}`,
      });

      const updatedSender = await storage.getUser(senderId);
      res.json({ 
        success: true, 
        newCredits: updatedSender?.credits || 0,
        message: `Successfully sent ${creditAmount.toFixed(1)} credits to ${recipient.name}`
      });
    } catch (error) {
      console.error('Credit transfer error:', error);
      res.status(500).json({ message: 'Credit transfer failed' });
    }
  });

  // Create Stripe checkout session for credit purchases
  app.post('/api/stripe/create-checkout', requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const userEmail = (req as any).userEmail;

      const { priceId } = req.body;

      if (!priceId) {
        return res.status(400).json({ message: 'Price ID required' });
      }

      const { getUncachableStripeClient } = await import('./stripeClient');
      const stripe = await getUncachableStripeClient();

      const session = await stripe.checkout.sessions.create({
        customer_email: userEmail,
        payment_method_types: ['card'],
        line_items: [{
          price: priceId,
          quantity: 1,
        }],
        mode: 'payment',
        success_url: `${req.protocol}://${req.get('host')}?credits_added=true`,
        cancel_url: `${req.protocol}://${req.get('host')}?credits_cancelled=true`,
      });

      res.json({ url: session.url });
    } catch (error) {
      console.error('Checkout session creation error:', error);
      res.status(500).json({ message: 'Failed to create checkout session' });
    }
  });

  // Get available credit packages
  app.get('/api/stripe/credit-packages', requireAuth, async (req, res) => {
    try {
      // Return hardcoded credit packages for now
      // TODO: Query Stripe products via Stripe SDK when needed
      const packages = [
        {
          productId: 'prod_credits_10',
          priceId: 'price_1QSsqTGBTN1pG4rP8qA0mA88',
          name: '10 Credits',
          description: 'Get 10 credits for $1',
          amount: 1,
          currency: 'usd',
          credits: 10,
        },
      ];
      res.json({ packages });
    } catch (error) {
      console.error('Failed to fetch credit packages - ERROR:', error);
      res.status(500).json({ message: 'Failed to fetch credit packages' });
    }
  });

  // Form submission API routes for business landing page
  const uploadsDir = path.join(process.cwd(), 'uploads');
  const dataDir = path.join(process.cwd(), 'data');
  
  // Ensure directories exist
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  // Configure multer for file uploads
  const storage_multer = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => {
      const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
      cb(null, `${Date.now()}-${safeName}`);
    }
  });

  const upload = multer({
    storage: storage_multer,
    limits: { fileSize: 15 * 1024 * 1024 }, // 15MB per file
    fileFilter: (req, file, cb) => {
      const allowedExtensions = ['.pdf', '.xlsx', '.csv', '.docx', '.png', '.jpg', '.jpeg'];
      const allowedMimes = [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/csv',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'image/png',
        'image/jpeg'
      ];
      const ext = path.extname(file.originalname).toLowerCase();
      const mimeValid = allowedMimes.includes(file.mimetype);
      const extValid = allowedExtensions.includes(ext);
      
      if (mimeValid && extValid) {
        cb(null, true);
      } else {
        console.warn(`Rejected file upload: ${file.originalname} (MIME: ${file.mimetype}, ext: ${ext})`);
        cb(new Error('Invalid file type'));
      }
    }
  });

  // Simple rate limiting for form submissions
  const formSubmissionTimes = new Map<string, number[]>();
  const RATE_LIMIT_WINDOW = 60000; // 1 minute
  const MAX_SUBMISSIONS = 5;

  const checkRateLimit = (ip: string): boolean => {
    const now = Date.now();
    const times = formSubmissionTimes.get(ip) || [];
    const recentTimes = times.filter(t => now - t < RATE_LIMIT_WINDOW);
    
    if (recentTimes.length >= MAX_SUBMISSIONS) return false;
    
    recentTimes.push(now);
    formSubmissionTimes.set(ip, recentTimes);
    return true;
  };

  // Buy Box PDF download
  app.get('/api/buybox-pdf', (req, res) => {
    const doc = new PDFDocument({ margin: 50 });
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="UAIU-Buy-Box.pdf"');
    
    doc.pipe(res);
    
    // Title
    doc.fontSize(20).font('Helvetica-Bold').text('UAIU Holding Co — Acquisition Criteria (Buy Box)', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(14).font('Helvetica').text('Justin Zaragoza | Principal Buyer', { align: 'center' });
    doc.fontSize(10).text('uaiu.live | uaiulive@gmail.com | 844-789-2300 | 530-808-5208', { align: 'center' });
    doc.moveDown(1);
    
    // Positioning
    doc.fontSize(12).font('Helvetica-Bold').text('I buy. I operate. I close. I don\'t shop.');
    doc.fontSize(10).font('Helvetica').text('Confidential discussions. Fast yes/no. Respectful process.');
    doc.moveDown(1);
    
    // What I'm Buying
    doc.fontSize(12).font('Helvetica-Bold').text('What I\'m Buying');
    doc.fontSize(10).font('Helvetica');
    doc.text('• Focus: Cash-flowing construction & specialty trades businesses in Northern California');
    doc.text('• Target Size: $5M+ revenue preferred (open to larger)');
    doc.text('• Profitability: EBITDA/SDE positive (clean add-backs preferred)');
    doc.text('• Typical Industries: HVAC; Plumbing; Electrical; Restoration (water/fire/mold); Concrete; Grading/Earthwork; Roofing; Paving/Asphalt; Landscaping (commercial, recurring-heavy); General Contractor (strong systems + repeat clients); Other construction services with stable demand.');
    doc.moveDown(0.5);
    
    // What 'Good' Looks Like
    doc.fontSize(12).font('Helvetica-Bold').text('What \'Good\' Looks Like');
    doc.fontSize(10).font('Helvetica');
    doc.text('• Established operation (7+ years preferred) with a strong local reputation');
    doc.text('• Stable crews + supervisors/foremen (not 100% owner-dependent)');
    doc.text('• Repeat customers, service contracts, or consistent bid/negotiated work');
    doc.text('• Basic financial reporting (P&L, balance sheet; job costing/WIP if applicable)');
    doc.text('• Clean licensing/insurance posture (bonding/surety relationship where relevant)');
    doc.moveDown(0.5);
    
    // Deal Approach
    doc.fontSize(12).font('Helvetica-Bold').text('Deal Approach');
    doc.fontSize(10).font('Helvetica');
    doc.text('• Flexible structures: cash at close, seller note, and earnout when appropriate');
    doc.text('• Owner transition supported: typically 3–12 months');
    doc.text('• Discreet process: no employee/customer outreach without permission');
    doc.text('• Fast screening: quick yes/no after basic info');
    doc.moveDown(0.5);
    
    // What I Need First
    doc.fontSize(12).font('Helvetica-Bold').text('What I Need First (to evaluate)');
    doc.fontSize(10).font('Helvetica');
    doc.text('• TTM P&L (and last 2–3 years if available)');
    doc.text('• Revenue by service line / customer type');
    doc.text('• Headcount + key roles (foremen/supervisors)');
    doc.text('• Licenses/insurance/bonding status (as applicable)');
    doc.text('• If project-based: basic WIP/job costing summary');
    doc.moveDown(0.5);
    
    // Not a Fit
    doc.fontSize(12).font('Helvetica-Bold').text('Not a Fit (save us both time)');
    doc.fontSize(10).font('Helvetica');
    doc.text('• Negative cash flow');
    doc.text('• Unresolved litigation/compliance problems');
    doc.text('• No basic financials or unwilling to share high-level numbers');
    doc.text('• Extreme one-customer dependence');
    doc.text('• Pre-revenue/startups');
    doc.moveDown(1);
    
    // Footer
    doc.fontSize(9).font('Helvetica-Oblique').text('Not a broker-dealer. Confidential discussions. For initial introductions only.', { align: 'center' });
    
    doc.end();
  });

  // Request a Call form
  app.post('/api/forms/request-call', async (req, res) => {
    try {
      const ip = req.ip || req.connection.remoteAddress || 'unknown';
      if (!checkRateLimit(ip)) {
        return res.status(429).json({ message: 'Too many requests. Please try again later.' });
      }

      const { fullName, phone, email, bestDays, timeWindow, timezone, notes, honeypot } = req.body;

      // Spam check
      if (honeypot) {
        return res.status(200).json({ success: true }); // Silent success for bots
      }

      if (!fullName || !phone || !email || !bestDays || bestDays.length === 0 || !timeWindow) {
        return res.status(400).json({ message: 'Missing required fields' });
      }

      const submission = {
        type: 'Request a Call',
        fullName,
        phone,
        email,
        bestDays: bestDays.join(', '),
        timeWindow,
        timezone: timezone || 'Pacific',
        notes: notes || '',
        submittedAt: new Date().toISOString(),
        ip
      };

      // Save to file
      const filename = `call-${Date.now()}.json`;
      fs.writeFileSync(path.join(dataDir, filename), JSON.stringify(submission, null, 2));

      // Send email
      await sendFormSubmissionEmail('Request a Call', submission);

      console.log(`📞 Call request received from ${fullName} (${email})`);
      res.json({ success: true });
    } catch (error) {
      console.error('Form submission error:', error);
      res.status(500).json({ message: 'Failed to submit form' });
    }
  });

  // Company For Sale form with file uploads
  app.post('/api/forms/company-for-sale', upload.array('files', 10), async (req, res) => {
    try {
      const ip = req.ip || req.connection.remoteAddress || 'unknown';
      if (!checkRateLimit(ip)) {
        return res.status(429).json({ message: 'Too many requests. Please try again later.' });
      }

      const { yourName, role, companyName, industry, location, ttmRevenue, ebitda, 
              askingPrice, reasonForSale, timing, sellerInvolvement, sellerInvolvementDetail,
              confidentialityConfirmed, honeypot } = req.body;

      // Spam check
      if (honeypot) {
        return res.status(200).json({ success: true });
      }

      if (!yourName || !role || !industry || !location || !ttmRevenue || !ebitda || 
          !timing || !sellerInvolvement || confidentialityConfirmed !== 'true') {
        return res.status(400).json({ message: 'Missing required fields' });
      }

      const files = (req.files as Express.Multer.File[]) || [];
      const fileNames = files.map(f => f.filename);

      const submission = {
        type: 'Company For Sale',
        yourName,
        role,
        companyName: companyName || 'Not provided',
        industry,
        location,
        ttmRevenue: `$${Number(ttmRevenue).toLocaleString()}`,
        ebitda: `$${Number(ebitda).toLocaleString()}`,
        askingPrice: askingPrice ? `$${Number(askingPrice).toLocaleString()}` : 'Not provided',
        reasonForSale: reasonForSale || 'Not provided',
        timing,
        sellerInvolvement,
        sellerInvolvementDetail: sellerInvolvementDetail || '',
        files: fileNames,
        submittedAt: new Date().toISOString(),
        ip
      };

      // Save to file
      const timestamp = Date.now();
      const filename = `company-${timestamp}.json`;
      fs.writeFileSync(path.join(dataDir, filename), JSON.stringify(submission, null, 2));

      // Generate Deal Summary PDF
      const pdfFilename = `deal-summary-${timestamp}.pdf`;
      const pdfPath = path.join(uploadsDir, pdfFilename);
      
      const pdfDoc = new PDFDocument({ margin: 50 });
      const pdfStream = fs.createWriteStream(pdfPath);
      pdfDoc.pipe(pdfStream);
      
      // PDF Header
      pdfDoc.fontSize(18).font('Helvetica-Bold').text('UAIU Holding Co — Deal Summary', { align: 'center' });
      pdfDoc.moveDown(0.5);
      pdfDoc.fontSize(10).font('Helvetica').text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
      pdfDoc.moveDown(1);
      
      // Company Info
      pdfDoc.fontSize(14).font('Helvetica-Bold').text('Company Information');
      pdfDoc.fontSize(10).font('Helvetica');
      pdfDoc.text(`Company: ${companyName || 'Not disclosed'}`);
      pdfDoc.text(`Industry: ${industry}`);
      pdfDoc.text(`Location: ${location}`);
      pdfDoc.moveDown(0.5);
      
      // Financials
      pdfDoc.fontSize(14).font('Helvetica-Bold').text('Financial Overview');
      pdfDoc.fontSize(10).font('Helvetica');
      pdfDoc.text(`TTM Revenue: $${Number(ttmRevenue).toLocaleString()}`);
      pdfDoc.text(`EBITDA/SDE: $${Number(ebitda).toLocaleString()}`);
      pdfDoc.text(`Asking Price: ${askingPrice ? '$' + Number(askingPrice).toLocaleString() : 'Not provided'}`);
      pdfDoc.moveDown(0.5);
      
      // Deal Context
      pdfDoc.fontSize(14).font('Helvetica-Bold').text('Deal Context');
      pdfDoc.fontSize(10).font('Helvetica');
      pdfDoc.text(`Reason for Sale: ${reasonForSale || 'Not provided'}`);
      pdfDoc.text(`Timing: ${timing}`);
      pdfDoc.text(`Seller Involvement: ${sellerInvolvement}${sellerInvolvementDetail ? ' - ' + sellerInvolvementDetail : ''}`);
      pdfDoc.moveDown(0.5);
      
      // Contact
      pdfDoc.fontSize(14).font('Helvetica-Bold').text('Submitted By');
      pdfDoc.fontSize(10).font('Helvetica');
      pdfDoc.text(`Name: ${yourName}`);
      pdfDoc.text(`Role: ${role}`);
      pdfDoc.moveDown(0.5);
      
      // Files
      if (fileNames.length > 0) {
        pdfDoc.fontSize(14).font('Helvetica-Bold').text('Uploaded Documents');
        pdfDoc.fontSize(10).font('Helvetica');
        fileNames.forEach(f => pdfDoc.text(`• ${f}`));
      }
      
      pdfDoc.moveDown(1);
      pdfDoc.fontSize(9).font('Helvetica-Oblique').text('Confidential — UAIU Holding Co', { align: 'center' });
      
      pdfDoc.end();
      
      // Wait for PDF to finish writing
      await new Promise<void>((resolve) => pdfStream.on('finish', resolve));

      // Send email with PDF path
      const submissionWithPdf = { ...submission, dealSummaryPdf: `/uploads/${pdfFilename}` };
      await sendFormSubmissionEmail('Company For Sale', submissionWithPdf, fileNames);

      console.log(`🏢 Company submission received from ${yourName} - ${companyName || 'Unnamed'}, PDF: ${pdfFilename}`);
      res.json({ success: true });
    } catch (error) {
      console.error('Form submission error:', error);
      res.status(500).json({ message: 'Failed to submit form' });
    }
  });

  // Referral form
  app.post('/api/forms/referral', async (req, res) => {
    try {
      const ip = req.ip || req.connection.remoteAddress || 'unknown';
      if (!checkRateLimit(ip)) {
        return res.status(429).json({ message: 'Too many requests. Please try again later.' });
      }

      const { yourName, contact, referralInfo, notes, okToMention, honeypot } = req.body;

      // Spam check
      if (honeypot) {
        return res.status(200).json({ success: true });
      }

      if (!yourName || !contact || !referralInfo || !okToMention) {
        return res.status(400).json({ message: 'Missing required fields' });
      }

      const submission = {
        type: 'Referral',
        yourName,
        contact,
        referralInfo,
        notes: notes || '',
        okToMention: okToMention ? 'Yes' : 'No',
        submittedAt: new Date().toISOString(),
        ip
      };

      // Save to file
      const filename = `referral-${Date.now()}.json`;
      fs.writeFileSync(path.join(dataDir, filename), JSON.stringify(submission, null, 2));

      // Send email
      await sendFormSubmissionEmail('Referral', submission);

      console.log(`👥 Referral received from ${yourName} - referring ${referralInfo}`);
      res.json({ success: true });
    } catch (error) {
      console.error('Form submission error:', error);
      res.status(500).json({ message: 'Failed to submit form' });
    }
  });

  // ==================== EXCHANGE ROUTES ====================

  const EXCHANGE_SEED_LISTINGS = [
    { standard: 'EU ETS', badgeLabel: 'EU ETS', name: 'EU ETS Compliance Credits', origin: 'Caribbean Basin · EU Registered', pricePerTonne: 63.40, changePercent: 2.3, changeDirection: 'up', status: 'active', isAcceptingOrders: true },
    { standard: 'VCS', badgeLabel: 'VCS', name: 'SwissX B100 Biofuel Credits', origin: 'Antigua, Caribbean · FOB Bunkering', pricePerTonne: 71.80, changePercent: 4.2, changeDirection: 'up', status: 'active', isAcceptingOrders: true },
    { standard: 'GOLD STD', badgeLabel: 'GOLD STD', name: 'REDD++ Forest Conservation', origin: 'Honduras · Antigua · Verified 2024', pricePerTonne: 58.20, changePercent: 1.1, changeDirection: 'up', status: 'active', isAcceptingOrders: true },
    { standard: 'VCS', badgeLabel: 'VCS', name: 'Blue Carbon Seagrass Fields', origin: 'Antigua & Barbuda · 28M Acres', pricePerTonne: 45.60, changePercent: 0.8, changeDirection: 'down', status: 'active', isAcceptingOrders: true },
    { standard: 'CORSIA', badgeLabel: 'CORSIA', name: 'CORSIA Aviation Offsets', origin: 'Caribbean · ICAO Verified', pricePerTonne: 29.70, changePercent: 3.1, changeDirection: 'up', status: 'active', isAcceptingOrders: true },
    { standard: 'GOLD STD', badgeLabel: 'GOLD STD', name: 'Renewable Energy Credits', origin: 'St. Lucia · Solar & Wind', pricePerTonne: 22.40, changePercent: 0.6, changeDirection: 'up', status: 'active', isAcceptingOrders: true },
  ];

  let exchangeSeeded = false;

  app.get('/api/exchange/listings', async (req, res) => {
    try {
      const standard = req.query.standard as string | undefined;
      let listings = await storage.getExchangeListings(standard);
      if (listings.length === 0 && !exchangeSeeded) {
        exchangeSeeded = true;
        await storage.seedExchangeListings(EXCHANGE_SEED_LISTINGS);
        listings = await storage.getExchangeListings(standard);
      }
      res.json(listings);
    } catch (error) {
      console.error('Exchange listings error:', error);
      res.status(500).json({ message: 'Failed to fetch listings' });
    }
  });

  app.post('/api/exchange/account', async (req, res) => {
    try {
      const body = req.body;
      if (!body.email) {
        return res.status(400).json({ message: 'Email is required' });
      }
      const accountData: any = { email: body.email };
      if (body.orgName) accountData.orgName = body.orgName;
      if (body.contactName) accountData.contactName = body.contactName;
      if (body.role) accountData.role = body.role;
      if (body.firstName) accountData.firstName = body.firstName;
      if (body.lastName) accountData.lastName = body.lastName;
      if (body.phone) accountData.phone = body.phone;
      if (body.accountType) accountData.accountType = body.accountType;
      if (body.annualCo2Exposure) accountData.annualCo2Exposure = body.annualCo2Exposure;
      const account = await storage.createExchangeAccount(accountData);
      sendExchangeEmail('Open Account Request', {
        'Name': body.firstName ? `${body.firstName} ${body.lastName || ''}`.trim() : (body.contactName || 'N/A'),
        'Organization': body.orgName || body.company || 'N/A',
        'Email': body.email,
        'Phone': body.phone || 'N/A',
        'Account Type': body.accountType || body.role || 'N/A',
        'Annual CO₂ Exposure': body.annualCo2Exposure || 'N/A',
      }).catch(err => console.error('Exchange email error:', err));
      res.json({ success: true, id: account.id });
    } catch (error) {
      console.error('Exchange account error:', error);
      res.status(500).json({ message: 'Failed to submit account request' });
    }
  });

  app.post('/api/exchange/rfq', async (req, res) => {
    try {
      const body = req.body;
      if (!body.company || !body.contact || !body.email || !body.side || !body.standard || !body.volumeTonnes) {
        return res.status(400).json({ message: 'Missing required fields: company, contact, email, side, standard, volumeTonnes' });
      }
      const volume = parseInt(body.volumeTonnes);
      if (isNaN(volume) || volume < 1000) {
        return res.status(400).json({ message: 'Minimum RFQ volume is 1,000 tonnes' });
      }
      const rfqData: any = {
        company: String(body.company),
        contact: String(body.contact),
        email: String(body.email),
        side: String(body.side),
        standard: String(body.standard),
        volumeTonnes: volume,
      };
      if (body.targetPrice) rfqData.targetPrice = parseFloat(body.targetPrice);
      if (body.preferredOrigin) rfqData.preferredOrigin = String(body.preferredOrigin);
      if (body.vintageYear) rfqData.vintageYear = parseInt(body.vintageYear);
      if (body.deadline) rfqData.deadline = String(body.deadline);
      if (body.notes) rfqData.notes = String(body.notes);
      const rfq = await storage.createExchangeRfq(rfqData);
      sendExchangeEmail('RFQ Desk Submission', {
        'Company': rfqData.company,
        'Contact': rfqData.contact,
        'Email': rfqData.email,
        'Side': rfqData.side,
        'Standard': rfqData.standard,
        'Volume (tonnes)': rfqData.volumeTonnes.toLocaleString(),
        'Target Price': rfqData.targetPrice ? `€${rfqData.targetPrice}/tonne` : 'Open',
        'Preferred Origin': rfqData.preferredOrigin || 'Any',
        'Vintage Year': rfqData.vintageYear?.toString() || 'Any',
        'Compliance Deadline': rfqData.deadline || 'Not specified',
        'Notes': rfqData.notes || 'None',
      }).catch(err => console.error('Exchange email error:', err));
      res.json({ success: true, id: rfq.id });
    } catch (error) {
      console.error('Exchange RFQ error:', error);
      res.status(500).json({ message: 'Failed to submit RFQ' });
    }
  });

  app.post('/api/exchange/list-credits', async (req, res) => {
    try {
      const parsed = insertExchangeCreditListingSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid form data', errors: parsed.error.flatten() });
      }
      const listing = await storage.createExchangeCreditListing(parsed.data);
      sendExchangeEmail('List Credits Submission', {
        'Organization': parsed.data.orgName,
        'Contact Name': parsed.data.contactName,
        'Email': parsed.data.email,
        'Standard': parsed.data.standard,
        'Credit Type': parsed.data.creditType,
        'Volume (Tonnes)': parsed.data.volumeTonnes,
        'Asking Price (EUR/tonne)': parsed.data.askingPricePerTonne,
        'Project Origin': parsed.data.projectOrigin,
        'Registry Serial': parsed.data.registrySerial || 'Not provided',
      }).catch(err => console.error('Exchange email error:', err));
      res.json({ success: true, id: listing.id });
    } catch (error) {
      console.error('Exchange list credits error:', error);
      res.status(500).json({ message: 'Failed to submit credit listing' });
    }
  });

  // ==================== END EXCHANGE ROUTES ====================

  // Use the HTTP server passed in from runApp
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: true, // Allow all origins with credentials
      methods: ["GET", "POST"],
      credentials: true
    },
    transports: ['polling', 'websocket'], // Match client transport order
    allowEIO3: true // Allow older engine.io clients for compatibility
  });
  
  console.log('Socket.IO server initialized on shared HTTP server');

  // GameManager handles all matchmaking including bot fallback

  // Daily.co configuration
  const DAILY_API_KEY = process.env.DAILY_API_KEY;
  const DAILY_ROOM_DOMAIN = process.env.DAILY_ROOM_DOMAIN || '';

  console.log('[Daily] Config - API Key set:', !!DAILY_API_KEY, ', Domain:', DAILY_ROOM_DOMAIN || '(empty)');
  if (!DAILY_API_KEY) {
    console.error('[Daily] WARNING: Missing DAILY_API_KEY - live video will not work!');
  }

  async function createDailyRoom(): Promise<{ roomName: string; roomUrl: string } | null> {
    if (!DAILY_API_KEY) {
      console.error('[Daily] Missing API key');
      return null;
    }
    try {
      const roomName = `uaiu-${nanoid(10)}`;
      const res = await fetch('https://api.daily.co/v1/rooms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${DAILY_API_KEY}`,
        },
        body: JSON.stringify({
          name: roomName,
          privacy: 'private',
          properties: {
            max_participants: 2,
            enable_chat: false,
            enable_knocking: false,
            exp: Math.floor(Date.now() / 1000) + 3600,
          },
        }),
      });
      if (!res.ok) {
        console.error('[Daily] Room creation failed:', res.status, await res.text());
        return null;
      }
      const data = await res.json();
      console.log('[Daily] Room created:', data.name, data.url);
      return { roomName: data.name, roomUrl: data.url };
    } catch (err) {
      console.error('[Daily] Room creation error:', err);
      return null;
    }
  }

  async function createDailyToken(roomName: string, userName: string): Promise<string | null> {
    if (!DAILY_API_KEY) return null;
    try {
      const res = await fetch('https://api.daily.co/v1/meeting-tokens', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${DAILY_API_KEY}`,
        },
        body: JSON.stringify({
          properties: {
            room_name: roomName,
            user_name: userName,
            exp: Math.floor(Date.now() / 1000) + 3600,
            enable_screenshare: false,
          },
        }),
      });
      if (!res.ok) {
        console.error('[Daily] Token creation failed:', res.status, await res.text());
        return null;
      }
      const data = await res.json();
      return data.token;
    } catch (err) {
      console.error('[Daily] Token creation error:', err);
      return null;
    }
  }

  async function deleteDailyRoom(roomName: string): Promise<void> {
    if (!DAILY_API_KEY) return;
    try {
      await fetch(`https://api.daily.co/v1/rooms/${roomName}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${DAILY_API_KEY}` },
      });
      console.log('[Daily] Room deleted:', roomName);
    } catch (err) {
      console.error('[Daily] Room deletion error:', err);
    }
  }

  // Live video chat matchmaking queue and active sessions
  const liveVideoQueue: { userId: string; joinedAt: number }[] = [];
  const userSocketMap = new Map<string, Set<string>>();
  const liveVideoSessions = new Map<string, {
    sessionId: string;
    user1Id: string;
    user2Id: string;
    startedAt: number;
    roomName: string;
    roomUrl: string;
  }>();
  const userToSession = new Map<string, string>();
  const disconnectGraceTimers = new Map<string, NodeJS.Timeout>();

  function removeFromLiveVideoQueue(userId: string) {
    const idx = liveVideoQueue.findIndex(p => p.userId === userId);
    if (idx !== -1) {
      liveVideoQueue.splice(idx, 1);
      console.log(`[LiveVideo] Removed ${userId} from queue (cleanup)`);
    }
  }

  function addUserSocket(userId: string, socketId: string) {
    let set = userSocketMap.get(userId);
    if (!set) { set = new Set(); userSocketMap.set(userId, set); }
    set.add(socketId);
  }

  function removeUserSocket(userId: string, socketId: string) {
    const set = userSocketMap.get(userId);
    if (set) {
      set.delete(socketId);
      if (set.size === 0) userSocketMap.delete(userId);
    }
  }

  function getUserSockets(userId: string): Socket[] {
    const set = userSocketMap.get(userId);
    if (!set) return [];
    const sockets: Socket[] = [];
    const sids = Array.from(set);
    for (let i = 0; i < sids.length; i++) {
      const s = io.sockets.sockets.get(sids[i]);
      if (s) sockets.push(s);
    }
    return sockets;
  }

  function emitToUser(userId: string, event: string, data?: any) {
    for (const s of getUserSockets(userId)) {
      s.emit(event, data);
    }
  }

  function isUserOnline(userId: string): boolean {
    return getUserSockets(userId).length > 0;
  }

  // ── Listing Chat In-Memory Store ─────────────────────────────────
  const listingChatHistory = new Map<string, any[]>();
  const listingOnlineUsers = new Map<string, Set<string>>();

  io.on('connection', (socket: Socket) => {
    console.log('=== SOCKET CONNECTION ===');
    console.log('Socket ID:', socket.id);
    const sessionId = (socket.handshake.auth as any).sessionId;
    if (!sessionId) {
      console.error('Socket connection rejected: No sessionId in auth');
      socket.disconnect();
      return;
    }
    
    const session = getSession(sessionId);
    if (!session) {
      console.error('Socket connection rejected: Invalid or expired session');
      socket.disconnect();
      return;
    }
    
    (socket as any).userId = session.userId;
    (socket as any).userEmail = session.email;
    
    addUserSocket(session.userId, socket.id);
    console.log('Client connected:', socket.id, 'User:', session.userId, session.email);

    const existingGrace = disconnectGraceTimers.get(session.userId);
    if (existingGrace) {
      clearTimeout(existingGrace);
      disconnectGraceTimers.delete(session.userId);
      console.log(`[LiveVideo] Reconnect within grace period for ${session.userId}, match preserved`);
    }

    socket.on('joinMatchmaking', async (data: { gameType: GameType; betAmount?: number }) => {
      try {
        const userId = (socket as any).userId;
        if (!userId) {
          socket.emit('error', { message: 'Unauthorized' });
          return;
        }

        const user = await storage.getUser(userId);
        if (!user) {
          socket.emit('error', { message: 'User not found' });
          return;
        }

        // Validate and default bet amount (1-100 credits)
        const betAmount = data.betAmount && data.betAmount >= 1 && data.betAmount <= 100 
          ? Math.floor(data.betAmount) 
          : 1;

        if (user.credits < betAmount) {
          socket.emit('error', { message: `Not enough credits. You need ${betAmount} credits to join.` });
          socket.emit('creditsUpdated', user.credits);
          return;
        }

        // Deduct bet amount entry fee upfront
        await storage.updateUserCredits(userId, user.credits - betAmount);
        socket.emit('creditsUpdated', user.credits - betAmount);

        const gameType = data.gameType || 'pong';

        // All games now use GameManager for consistent matchmaking
        gameManager.joinQueue({ 
          userId, 
          socketId: socket.id, 
          name: user.name, 
          betAmount,
          timeLimit: 60,
          joinedAt: Date.now(),
          gameType 
        }, io);
      } catch (error) {
        console.error('Matchmaking error:', error);
        socket.emit('error', { message: 'Matchmaking failed' });
      }
    });

    socket.on('gameInput', (data: { matchId: string; input: any }) => {
      const userId = (socket as any).userId;
      if (!userId) return;

      gameManager.handleInput(data.matchId, userId, data.input);
    });

    socket.on('leaveMatchmaking', () => {
      const userId = (socket as any).userId;
      if (!userId) return;
      
      gameManager.leaveQueue(userId, io);
    });

    socket.on('matchNow', () => {
      const userId = (socket as any).userId;
      if (!userId) return;
      
      const success = gameManager.matchNow(userId, io);
      if (!success) {
        socket.emit('error', { message: 'Not in matchmaking queue' });
      }
    });

    socket.on('joinSpecificMatch', async (data: { targetUserId: string }) => {
      try {
        const userId = (socket as any).userId;
        if (!userId) {
          socket.emit('error', { message: 'Unauthorized' });
          return;
        }

        const user = await storage.getUser(userId);
        if (!user) {
          socket.emit('error', { message: 'User not found' });
          return;
        }

        // Get target player's bet amount and validate before deducting credits
        const targetBetAmount = gameManager.getPlayerBetAmount(data.targetUserId);
        if (!targetBetAmount) {
          socket.emit('error', { message: 'Match request no longer available' });
          return;
        }

        // Validate user has enough credits
        if (user.credits < targetBetAmount) {
          socket.emit('error', { message: `Not enough credits. You need ${targetBetAmount} credits.` });
          socket.emit('creditsUpdated', user.credits);
          return;
        }

        // Deduct bet amount upfront
        await storage.updateUserCredits(userId, user.credits - targetBetAmount);
        socket.emit('creditsUpdated', user.credits - targetBetAmount);

        // Join the match with socket ID
        const success = gameManager.joinSpecificMatch(userId, data.targetUserId, user.name, socket.id, io);
        
        // Always refund if join fails (race condition or match already started)
        if (!success) {
          await storage.updateUserCredits(userId, user.credits);
          socket.emit('creditsUpdated', user.credits);
          socket.emit('error', { message: 'Match request no longer available' });
        }
      } catch (error) {
        console.error('Error joining specific match:', error);
        socket.emit('error', { message: 'Failed to join match' });
      }
    });

    const findUserSession = (userId: string) => {
      const sessionId = userToSession.get(userId);
      if (!sessionId) return null;
      const session = liveVideoSessions.get(sessionId);
      if (!session) { userToSession.delete(userId); return null; }
      return { sessionId, session };
    };

    const reasonMessages: Record<string, string> = {
      'completed': 'Session ended.',
      'user_left': 'You left the session.',
      'user_next': 'Moving to next match...',
      'peer_disconnected': 'Your partner disconnected.',
      'stale_cleanup': 'Session expired.',
      'disconnect': 'Connection lost.',
      'join_failed': 'Failed to connect to video room.',
    };

    const endLiveVideoSession = async (sessionId: string, reasonCode: string = 'completed') => {
      const session = liveVideoSessions.get(sessionId);
      if (!session) return;

      console.log(`[LiveVideo] Ending session ${sessionId} (reason: ${reasonCode})`);

      const payload = { reasonCode, message: reasonMessages[reasonCode] || 'Session ended.' };

      emitToUser(session.user1Id, 'liveMatch:ended', payload);
      emitToUser(session.user2Id, 'liveMatch:ended', payload);

      // Ensure users can match again immediately
      removeFromLiveVideoQueue(session.user1Id);
      removeFromLiveVideoQueue(session.user2Id);

      userToSession.delete(session.user1Id);
      userToSession.delete(session.user2Id);

      const grace1 = disconnectGraceTimers.get(session.user1Id);
      if (grace1) { clearTimeout(grace1); disconnectGraceTimers.delete(session.user1Id); }
      const grace2 = disconnectGraceTimers.get(session.user2Id);
      if (grace2) { clearTimeout(grace2); disconnectGraceTimers.delete(session.user2Id); }

      if (session.roomName) {
        deleteDailyRoom(session.roomName).catch(() => {});
      }

      const durationSeconds = Math.floor((Date.now() - session.startedAt) / 1000);
      await db.update(liveMatchSessions)
        .set({ 
          status: 'completed',
          endedAt: new Date(),
          durationSeconds,
        })
        .where(eq(liveMatchSessions.id, sessionId));

      liveVideoSessions.delete(sessionId);
      console.log(`[LiveVideo] Session ${sessionId} cleaned up, both users freed`);
    };

    
    socket.on('liveMatch:resume', async () => {
      try {
        const userId = (socket as any).userId;
        if (!userId) return;
        const sessionData = findUserSession(userId);
        if (!sessionData) return;

        const { sessionId, session } = sessionData;

        // Re-issue a fresh token for this user and re-send room info
        const user = await storage.getUser(userId);
        const token = await createDailyToken(session.roomName, user?.name || 'User');
        if (!token) return;

        emitToUser(userId, 'liveMatch:found', {
          sessionId,
          roomUrl: session.roomUrl,
          token,
          resumed: true,
        });

        console.log(`[LiveVideo] Resumed session ${sessionId} for ${userId}`);
      } catch (err) {
        console.error('[LiveVideo] Error in liveMatch:resume:', err);
      }
    });

// Live video chat events
    socket.on('liveMatch:join', async () => {
      console.log('[LiveVideo] liveMatch:join from socket', socket.id);
      try {
        const userId = (socket as any).userId;
        if (!userId) {
          socket.emit('error', { message: 'Unauthorized' });
          return;
        }

        const user = await storage.getUser(userId);
        if (!user) {
          socket.emit('error', { message: 'User not found' });
          return;
        }

        console.log(`[LiveVideo] User ${userId} (${user.name}) credits=${user.credits}`);

        // Idempotent: if already in active session, clean stale or reject
        const existingSession = findUserSession(userId);
        if (existingSession) {
          const { sessionId, session } = existingSession;
          const sessionAge = Date.now() - session.startedAt;
          const u1Online = isUserOnline(session.user1Id);
          const u2Online = isUserOnline(session.user2Id);

          if ((!u1Online && !u2Online) || sessionAge > 5 * 60 * 1000) {
            console.log(`[LiveVideo] Auto-cleaning stale session ${sessionId}`);
            await endLiveVideoSession(sessionId, 'stale_cleanup');
          } else {
            socket.emit('error', { message: 'Already in a session. Disconnect first.' });
            return;
          }
        }

        // Idempotent: remove any existing queue entry for this user
        const qIdx = liveVideoQueue.findIndex(p => p.userId === userId);
        if (qIdx !== -1) {
          liveVideoQueue.splice(qIdx, 1);
          console.log(`[LiveVideo] Removed existing queue entry for ${userId}`);
        }

        if (user.credits < 1) {
          socket.emit('error', { message: 'Not enough credits. You need 1 credit.' });
          return;
        }

        // Purge stale queue entries (>60s or offline)
        for (let i = liveVideoQueue.length - 1; i >= 0; i--) {
          const entry = liveVideoQueue[i];
          if (!isUserOnline(entry.userId) || (Date.now() - entry.joinedAt) > 60000) {
            console.log(`[LiveVideo] Purging stale queue: ${entry.userId}`);
            liveVideoQueue.splice(i, 1);
          }
        }

        // Try to find a match (skip self)
        let matchFound = false;
        while (liveVideoQueue.length > 0 && !matchFound) {
          const partner = liveVideoQueue.shift()!;

          // BUG 2 FIX: never match a user with themselves
          if (partner.userId === userId) {
            console.log(`[LiveVideo] Skipping self-match for ${userId}`);
            continue;
          }

          if (!isUserOnline(partner.userId)) {
            console.log(`[LiveVideo] Partner ${partner.userId} offline, skipping`);
            continue;
          }

          const partnerUser = await storage.getUser(partner.userId);
          if (!partnerUser || partnerUser.credits < 1) {
            console.log(`[LiveVideo] Partner ${partner.userId} invalid, skipping`);
            continue;
          }

          const dailyRoom = await createDailyRoom();
          if (!dailyRoom) {
            socket.emit('error', { message: 'Failed to create video room. Please try again.' });
            liveVideoQueue.unshift(partner);
            return;
          }

          const [token1, token2] = await Promise.all([
            createDailyToken(dailyRoom.roomName, partnerUser.name),
            createDailyToken(dailyRoom.roomName, user.name),
          ]);

          if (!token1 || !token2) {
            socket.emit('error', { message: 'Failed to create video tokens. Please try again.' });
            deleteDailyRoom(dailyRoom.roomName).catch(() => {});
            liveVideoQueue.unshift(partner);
            return;
          }

          await storage.updateUserCredits(partner.userId, partnerUser.credits - 1);
          await storage.updateUserCredits(userId, user.credits - 1);

          emitToUser(partner.userId, 'creditsUpdated', partnerUser.credits - 1);
          emitToUser(userId, 'creditsUpdated', user.credits - 1);

          console.log(`[LiveVideo] Match created: ${userId} <-> ${partner.userId}, room: ${dailyRoom.roomName}`);

          const [dbSession] = await db.insert(liveMatchSessions)
            .values({
              user1Id: partner.userId,
              user1Name: partnerUser.name,
              user2Id: userId,
              user2Name: user.name,
              durationSeconds: 0,
            })
            .returning();

          liveVideoSessions.set(dbSession.id, {
            sessionId: dbSession.id,
            user1Id: partner.userId,
            user2Id: userId,
            startedAt: Date.now(),
            roomName: dailyRoom.roomName,
            roomUrl: dailyRoom.roomUrl,
          });
          userToSession.set(partner.userId, dbSession.id);
          userToSession.set(userId, dbSession.id);

          emitToUser(userId, 'liveMatch:found', {
            sessionId: dbSession.id,
            roomUrl: dailyRoom.roomUrl,
            token: token2,
          });
          emitToUser(partner.userId, 'liveMatch:found', {
            sessionId: dbSession.id,
            roomUrl: dailyRoom.roomUrl,
            token: token1,
          });

          console.log(`[LiveVideo] Both users notified, room: ${dailyRoom.roomName}`);
          matchFound = true;
        }

        if (!matchFound) {
          liveVideoQueue.push({ userId, joinedAt: Date.now() });
          console.log(`[LiveVideo] ${userId} queued. Queue size: ${liveVideoQueue.length}`);
        }
      } catch (error) {
        console.error('[LiveVideo] Error in liveMatch:join:', error);
        socket.emit('error', { message: 'Failed to join live video match' });
      }
    });


    socket.on('liveMatch:leave', async () => {
      const userId = (socket as any).userId;
      if (!userId) return;
      
      console.log(`[LiveVideo] User ${userId} left session`);
      
      const queueIndex = liveVideoQueue.findIndex(p => p.userId === userId);
      if (queueIndex !== -1) {
        liveVideoQueue.splice(queueIndex, 1);
      }
      
      const sessionData = findUserSession(userId);
      if (sessionData) {
        await endLiveVideoSession(sessionData.sessionId, 'user_left');
      }
    });

    socket.on('liveMatch:chat', (data: { message: string }) => {
      const userId = (socket as any).userId;
      if (!userId || !data.message || data.message.trim().length === 0) return;

      const sessionData = findUserSession(userId);
      if (!sessionData) return;

      const { session } = sessionData;
      const partnerId = session.user1Id === userId ? session.user2Id : session.user1Id;
      emitToUser(partnerId, 'liveMatch:chat', {
        from: userId,
        message: data.message.trim().substring(0, 500),
      });
    });

    socket.on('liveMatch:next', async () => {
      const userId = (socket as any).userId;
      if (!userId) return;
      
      console.log(`[LiveVideo] User ${userId} clicked next`);
      
      const sessionData = findUserSession(userId);
      if (sessionData) {
        await endLiveVideoSession(sessionData.sessionId, 'user_next');
      }
    });

    // ── Listing Chat Handlers ────────────────────────────────────────
    socket.on('join-listing-chat', ({ room, listingId, listingName, userHandle }: any) => {
      socket.join(room);
      if (!listingOnlineUsers.has(room)) listingOnlineUsers.set(room, new Set());
      listingOnlineUsers.get(room)!.add(socket.id);
      const history = listingChatHistory.get(room) || [];
      socket.emit('chat-history', history);
      const count = listingOnlineUsers.get(room)!.size;
      io.to(room).emit('listing-online-count', { listing_id: listingId, count });
      const joinMsg = { id: Math.random().toString(36).slice(2), listing_id: listingId, sender: 'SYSTEM', sender_type: 'system', text: `${userHandle} joined`, timestamp: new Date().toISOString() };
      if (!listingChatHistory.has(room)) listingChatHistory.set(room, []);
      listingChatHistory.get(room)!.push(joinMsg);
      socket.to(room).emit('chat-message', joinMsg);
    });

    socket.on('listing-chat-message', ({ room, message }: any) => {
      if (!listingChatHistory.has(room)) listingChatHistory.set(room, []);
      const history = listingChatHistory.get(room)!;
      history.push(message);
      if (history.length > 100) history.splice(0, history.length - 100);
      socket.to(room).emit('chat-message', message);
    });

    socket.on('leave-listing-chat', ({ room, listingId }: any) => {
      socket.leave(room);
      const users = listingOnlineUsers.get(room);
      if (users) {
        users.delete(socket.id);
        io.to(room).emit('listing-online-count', { listing_id: listingId, count: users.size });
      }
    });

    socket.on('disconnect', async () => {
      const userId = (socket as any).userId;
      console.log(`Client disconnected: ${socket.id} (user: ${userId})`);

      if (userId) {
        removeUserSocket(userId, socket.id);

        // Remove from queue if they have no sockets left
        if (!isUserOnline(userId)) {
          const queueIndex = liveVideoQueue.findIndex(p => p.userId === userId);
          if (queueIndex !== -1) {
            liveVideoQueue.splice(queueIndex, 1);
            console.log(`[LiveVideo] Removed ${userId} from queue (all sockets gone)`);
          }

          // BUG 4 FIX: grace period instead of immediate session end
          const sessionData = findUserSession(userId);
          if (sessionData) {
            console.log(`[LiveVideo] Starting 15s grace timer for ${userId} (session ${sessionData.sessionId})`);
            const timer = setTimeout(async () => {
              disconnectGraceTimers.delete(userId);
              if (!isUserOnline(userId)) {
                console.log(`[LiveVideo] Grace expired for ${userId}, ending session`);
                const stillActive = findUserSession(userId);
                if (stillActive) {
                  await endLiveVideoSession(stillActive.sessionId, 'peer_disconnected');
                }
              } else {
                console.log(`[LiveVideo] Grace expired but ${userId} reconnected, keeping session`);
              }
            }, 15000);
            disconnectGraceTimers.set(userId, timer);
          }
        } else {
          console.log(`[LiveVideo] ${userId} still has ${getUserSockets(userId).length} socket(s), not triggering grace`);
        }
      }
      
      // Listing chat cleanup
      Array.from(listingOnlineUsers.entries()).forEach(([room, users]) => {
        if (users.has(socket.id)) {
          users.delete(socket.id);
          const listingId = room.replace('listing-chat-', '');
          io.to(room).emit('listing-online-count', { listing_id: listingId, count: users.size });
        }
      });

      // GameManager handles game cleanup automatically
    });
  });

  // ─── AI Exchange Routes ───────────────────────────────────────────

  app.post('/api/exchange/ai-rfq', async (req, res) => {
    try {
      const { message } = req.body;
      if (!message) return res.status(400).json({ error: 'message required' });
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        return res.json({ parsed: { volume_tonnes: 50000, standard: 'EU ETS — European Allowances', side: 'BUY', notes: message }, summary: '[Demo] Parsed RFQ from your description.' });
      }
      const Anthropic = (await import('@anthropic-ai/sdk')).default;
      const client = new Anthropic({ apiKey });
      const response = await client.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 600,
        messages: [{
          role: 'user',
          content: `You are a carbon credit RFQ parsing assistant. Extract structured RFQ data from this message and return ONLY valid JSON with these fields (all optional): side (BUY or SELL), standard (one of: EU ETS — European Allowances, Verra VCS — Verified Carbon Standard, Gold Standard, CORSIA — Aviation Offsets, Blue Carbon — Seagrass / Coral, REDD++ — Forest Conservation, SwissX B100 — Caribbean Biofuel), volume_tonnes (integer), target_price_eur (number), deadline (YYYY-MM-DD), notes (string). Message: "${message}"`
        }]
      });
      const text = response.content[0].type === 'text' ? response.content[0].text : '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return res.json({ error: 'Could not parse response', summary: text });
      const parsed = JSON.parse(jsonMatch[0]);
      res.json({ parsed, summary: `Parsed: ${parsed.side || 'BUY'} ${parsed.volume_tonnes?.toLocaleString() || '?'} tonnes of ${parsed.standard || 'carbon credits'}` });
    } catch (err: any) {
      console.error('AI RFQ error:', err?.message);
      res.json({ parsed: null, error: 'AI service unavailable. Please fill the form manually.' });
    }
  });

  app.post('/api/exchange/ai-intelligence', async (req, res) => {
    try {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        return res.json({ cards: [
          { eyebrow: 'EU ETS Market', headline: 'European allowances hold above €63 amid power sector demand', summary: 'EUA futures remained resilient as utility buyers absorbed supply ahead of winter. Analysts cite tightening Phase IV caps as the primary price floor.' },
          { eyebrow: 'Shipping Emissions', headline: 'IMO 2030 compliance accelerates Caribbean blue carbon demand', summary: 'Shipping companies facing CII ratings are moving early into verified Caribbean blue carbon credits. Inquiry volume up 3x vs prior year.' },
          { eyebrow: 'Caribbean Carbon Supply', headline: 'Antigua and Roatan projects near listing — Q2 2025 expected', summary: 'Two flagship UAIU projects have cleared preliminary review and are expected to list on UAIU.LIVE/X in Q2. Supply addition may moderate prices.' },
        ]});
      }
      const Anthropic = (await import('@anthropic-ai/sdk')).default;
      const client = new Anthropic({ apiKey });
      const response = await client.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 900,
        messages: [{
          role: 'user',
          content: `Generate a daily carbon market intelligence briefing with exactly 3 items. Return ONLY a JSON array of objects with fields: eyebrow (short category, max 4 words), headline (compelling title, max 12 words), summary (2 sentences, ~50 words). Topics: 1) EU ETS price/policy news, 2) shipping/aviation emissions news, 3) Caribbean/tropical carbon supply update. Use realistic current market context for ${new Date().toISOString().split('T')[0]}.`
        }]
      });
      const text = response.content[0].type === 'text' ? response.content[0].text : '';
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error('No JSON array found');
      const cards = JSON.parse(jsonMatch[0]);
      res.json({ cards });
    } catch (err: any) {
      console.error('AI intelligence error:', err?.message);
      res.status(500).json({ error: 'AI service unavailable' });
    }
  });

  app.post('/api/exchange/ai-vision', async (req, res) => {
    try {
      const { imageBase64, mimeType } = req.body;
      if (!imageBase64) return res.status(400).json({ error: 'imageBase64 required' });
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        return res.json({ report: '[Demo Mode] AI Vision Analysis:\nLocation Assessment: Tropical coastal region detected\nVegetation Analysis: Dense canopy cover ~85%\nCarbon Estimate: 12–18 tCO₂e/ha/year\nRecommended Standard: Verra VCS Blue Carbon' });
      }
      const Anthropic = (await import('@anthropic-ai/sdk')).default;
      const client = new Anthropic({ apiKey });
      const response = await client.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 600,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: (mimeType || 'image/jpeg') as any, data: imageBase64 } },
            { type: 'text', text: 'You are a carbon project verification assistant. Analyze this image and provide a preliminary project verification report with these sections: Location Assessment, Vegetation Analysis, Carbon Sequestration Estimate (tCO₂e/ha/year range), and Recommended Standard (VCS/Gold Standard/Blue Carbon). Be concise and technical. Max 150 words.' }
          ]
        }]
      });
      const report = response.content[0].type === 'text' ? response.content[0].text : 'Analysis complete.';
      res.json({ report });
    } catch (err: any) {
      console.error('AI vision error:', err?.message);
      res.json({ report: '[Demo Mode] AI Vision Analysis:\nLocation Assessment: Project area detected\nVegetation Analysis: Moderate to dense coverage\nCarbon Estimate: 8–15 tCO₂e/ha/year\nRecommended Standard: Verra VCS' });
    }
  });

  app.post('/api/exchange/multisig-approval', async (req, res) => {
    try {
      const { tradeId, receiptHash, complianceEmail } = req.body;
      if (!tradeId || !complianceEmail) return res.status(400).json({ error: 'tradeId and complianceEmail required' });
      const token = 'APPR-' + Math.random().toString(36).slice(2, 10).toUpperCase() + '-' + Date.now().toString().slice(-4);
      const approvalUrl = `https://uaiu.live/approve/${token}`;
      // Send approval email via existing Zoho/Resend
      try {
        const { sendExchangeEmail } = await import('./email-service');
        await sendExchangeEmail('Compliance Approval Required', {
          'Trade ID': tradeId,
          'Receipt Hash': receiptHash?.slice(0, 32) + '...',
          'Approval Token': token,
          'Approval URL': approvalUrl,
          'Action Required': 'Click the approval URL to authorize final settlement of this trade.',
        });
      } catch (emailErr) {
        console.warn('Approval email failed:', emailErr);
      }
      res.json({ token, approvalUrl, status: 'pending' });
    } catch (err: any) {
      console.error('MultiSig error:', err?.message);
      res.status(500).json({ error: 'Failed to create approval request' });
    }
  });

  // ─── AI Trade Negotiator Route ────────────────────────────────────
  app.post('/api/ai/negotiate', async (req, res) => {
    try {
      const { rfq, market } = req.body;
      if (!rfq) return res.status(400).json({ error: 'rfq required' });

      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        return res.json({
          recommendation: {
            action: 'ACCEPT',
            counter_price: market?.indexPrice ? (market.indexPrice * 0.97).toFixed(2) : '62.50',
            counter_volume: rfq.volume_tonnes || 5000,
            rationale: '[Demo Mode] Based on current Caribbean carbon credit market conditions and your RFQ parameters, we recommend accepting near the index price with a slight discount for bulk volume. Standard settlement terms apply.',
            risk_assessment: 'LOW',
            settlement_days: 5,
            confidence: 87,
          }
        });
      }

      const prompt = `You are a carbon credit trade negotiator for UAIU.LIVE/X Caribbean Carbon Exchange.

Analyze this RFQ and provide a trade recommendation:

RFQ Details:
- Side: ${rfq.side || 'BUY'}
- Standard: ${rfq.standard || 'VCS'}
- Volume: ${rfq.volume_tonnes || 0} tonnes CO2e
- Target Price: €${rfq.target_price_eur || 'market'}/tonne
- Deadline: ${rfq.deadline || 'flexible'}
- Notes: ${rfq.notes || 'none'}

Market Context:
- Index Price: €${market?.indexPrice || 67.43}/tonne
- EU ETS Price: €${market?.etsPrice || 72.10}/tonne
- Market Trend: ${market?.trend || 'stable'}

Respond with a JSON object (no markdown) with these exact fields:
{
  "action": "ACCEPT" | "COUNTER" | "REJECT",
  "counter_price": number (EUR/tonne),
  "counter_volume": number (tonnes),
  "rationale": "string (2-3 sentences explaining recommendation)",
  "risk_assessment": "LOW" | "MEDIUM" | "HIGH",
  "settlement_days": number,
  "confidence": number (0-100)
}`;

      const { default: Anthropic } = await import('@anthropic-ai/sdk');
      const client = new Anthropic({ apiKey });
      const msg = await client.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 512,
        messages: [{ role: 'user', content: prompt }],
      });

      const text = (msg.content[0] as any).text?.trim() || '{}';
      let recommendation: any;
      try {
        recommendation = JSON.parse(text);
      } catch {
        recommendation = { action: 'ACCEPT', counter_price: (market?.indexPrice || 67.43) * 0.97, counter_volume: rfq.volume_tonnes, rationale: text, risk_assessment: 'LOW', settlement_days: 5, confidence: 75 };
      }
      res.json({ recommendation });
    } catch (err: any) {
      console.error('Negotiate error:', err?.message);
      res.status(500).json({ error: 'Negotiation engine error' });
    }
  });

  // Socket.IO is now attached to the HTTP server passed in from runApp
  // No need to return the server
}
