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
import { sendSignupNotification, sendFormSubmissionEmail } from "./email-service";
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

  app.get('/api/turn', async (req, res) => {
    try {
      let appName = process.env.METERED_APP_NAME;
      const apiKey = process.env.METERED_API_KEY;

      if (!appName || !apiKey) {
        return res.status(500).json({ error: 'TURN server not configured' });
      }

      // Handle both "uaiulive" and "uaiulive.metered.live" formats
      appName = appName.replace(/\.metered\.live$/i, '');

      const url = `https://${appName}.metered.live/api/v1/turn/credentials?apiKey=${apiKey}`;
      const r = await fetch(url);

      if (!r.ok) {
        const text = await r.text();
        console.error('Metered TURN request failed:', r.status, text);
        return res.status(500).json({ error: 'Failed to fetch TURN credentials' });
      }

      const data = await r.json();
      const iceServers = data.iceServers ?? data;
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

  // Live video chat matchmaking queue and active sessions
  const liveVideoQueue: { userId: string; joinedAt: number }[] = [];
  const userSocketMap = new Map<string, string>(); // userId -> socketId mapping
  const liveVideoSessions = new Map<string, {
    sessionId: string;
    user1Id: string;
    user2Id: string;
    user1SocketId: string;
    user2SocketId: string;
    startedAt: number;
    timer: NodeJS.Timeout;
  }>();

  io.on('connection', (socket: Socket) => {
    console.log('=== SOCKET CONNECTION ATTEMPT ===');
    console.log('Socket ID:', socket.id);
    console.log('================================');
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
    
    // Update userId -> socketId mapping for live video matchmaking
    userSocketMap.set(session.userId, socket.id);
    console.log('Client connected:', socket.id, 'User:', session.userId, session.email);
    console.log('[LiveVideo] Updated socket mapping:', session.userId, '->', socket.id);

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

    // Helper function to find active session for a user
    const findUserSession = (userId: string) => {
      for (const [sessionId, session] of liveVideoSessions.entries()) {
        if (session.user1Id === userId || session.user2Id === userId) {
          return { sessionId, session };
        }
      }
      return null;
    };

    // Helper function to end a live video session
    const endLiveVideoSession = async (sessionId: string, reason: string = 'completed') => {
      const session = liveVideoSessions.get(sessionId);
      if (!session) return;

      console.log(`[LiveVideo] Ending session ${sessionId} (${reason})`);

      // Clear timer
      clearTimeout(session.timer);

      // Notify both clients
      const user1Socket = io.sockets.sockets.get(session.user1SocketId);
      const user2Socket = io.sockets.sockets.get(session.user2SocketId);
      
      if (user1Socket) {
        user1Socket.emit('liveMatch:ended');
      }
      if (user2Socket) {
        user2Socket.emit('liveMatch:ended');
      }

      // Update database - mark session as completed
      await db.update(liveMatchSessions)
        .set({ 
          status: 'completed',
          endedAt: new Date()
        })
        .where(eq(liveMatchSessions.id, sessionId));

      // Remove from active sessions
      liveVideoSessions.delete(sessionId);
    };

    // Live video chat events
    socket.on('liveMatch:join', async () => {
      console.log('[LiveVideo] ===== liveMatch:join event received =====');
      try {
        const userId = (socket as any).userId;
        console.log('[LiveVideo] User ID:', userId);
        if (!userId) {
          console.log('[LiveVideo] No userId found - unauthorized');
          socket.emit('error', { message: 'Unauthorized' });
          return;
        }

        const user = await storage.getUser(userId);
        console.log('[LiveVideo] User fetched:', user?.name, 'Credits:', user?.credits);
        if (!user) {
          console.log('[LiveVideo] User not found in database');
          socket.emit('error', { message: 'User not found' });
          return;
        }

        // Check if already in a session
        const existingSession = findUserSession(userId);
        if (existingSession) {
          console.log(`[LiveVideo] User ${userId} already in active session ${existingSession.sessionId}`);
          console.log('[LiveVideo] Existing session details:', {
            sessionId: existingSession.sessionId,
            user1: existingSession.session.user1Id,
            user2: existingSession.session.user2Id,
            startedAt: new Date(existingSession.session.startedAt).toISOString()
          });
          socket.emit('error', { message: 'Already in a session. Please refresh the page and try again.' });
          return;
        }

        // Check if already in queue
        if (liveVideoQueue.some(p => p.userId === userId)) {
          console.log(`[LiveVideo] User ${userId} already in queue`);
          return;
        }
        
        // Update socket mapping (in case of reconnection)
        userSocketMap.set(userId, socket.id);

        // Check credits (don't deduct yet - only on match)
        if (user.credits < 1) {
          console.log('[LiveVideo] Insufficient credits');
          socket.emit('error', { message: 'Not enough credits. You need 1 credit for a live video session.' });
          return;
        }

        console.log(`[LiveVideo] User ${userId} (${user.name}) joining queue with socket ${socket.id}`);

        // Check if there's someone waiting
        let matchFound = false;
        while (liveVideoQueue.length > 0 && !matchFound) {
          const partner = liveVideoQueue.shift()!;
          
          // Get partner's CURRENT socket ID from mapping
          const partnerSocketId = userSocketMap.get(partner.userId);
          const partnerSocket = partnerSocketId ? io.sockets.sockets.get(partnerSocketId) : null;
          const partnerUser = await storage.getUser(partner.userId);
          
          if (!partnerSocket || !partnerUser || partnerUser.credits < 1) {
            console.log(`[LiveVideo] Partner ${partner.userId} invalid (socket: ${partnerSocketId}), skipping`);
            // If partner lacks credits or isn't connected, skip
            continue;
          }
          
          // Get current user's socket ID from mapping
          const currentSocketId = userSocketMap.get(userId);
          if (!currentSocketId) {
            console.log(`[LiveVideo] Current user ${userId} socket not found in mapping`);
            socket.emit('error', { message: 'Connection error' });
            return;
          }

          // Match found! Deduct credits from both users
          await storage.updateUserCredits(partner.userId, partnerUser.credits - 1);
          await storage.updateUserCredits(userId, user.credits - 1);
          
          partnerSocket.emit('creditsUpdated', partnerUser.credits - 1);
          socket.emit('creditsUpdated', user.credits - 1);

          console.log(`[LiveVideo] Match found: ${userId} <-> ${partner.userId}`);
          
          // Create database record
          const [dbSession] = await db.insert(liveMatchSessions)
            .values({
              user1Id: partner.userId,
              user1Name: partnerUser.name,
              user2Id: userId,
              user2Name: user.name,
              durationSeconds: 60,
            })
            .returning();

          // Create in-memory session with 60-second timer
          const timer = setTimeout(async () => {
            await endLiveVideoSession(dbSession.id, 'timeout');
          }, 60000); // 60 seconds

          liveVideoSessions.set(dbSession.id, {
            sessionId: dbSession.id,
            user1Id: partner.userId,
            user2Id: userId,
            user1SocketId: partnerSocketId!, // Safe because partnerSocket exists
            user2SocketId: currentSocketId!, // Safe because currentSocket will be checked
            startedAt: Date.now(),
            timer,
          });

          // Notify both clients using current socket IDs from mapping
          console.log(`[LiveVideo] Emitting liveMatch:found to socket ${currentSocketId} (user ${userId}) with partnerId ${partner.userId}`);
          const currentSocket = io.sockets.sockets.get(currentSocketId);
          currentSocket?.emit('liveMatch:found', { partnerId: partner.userId, sessionId: dbSession.id });
          
          console.log(`[LiveVideo] Emitting liveMatch:found to socket ${partnerSocketId} (user ${partner.userId}) with partnerId ${userId}`);
          partnerSocket.emit('liveMatch:found', { partnerId: userId, sessionId: dbSession.id });
          
          console.log('[LiveVideo] Both liveMatch:found events emitted successfully');
          matchFound = true;
        }

        if (!matchFound) {
          // Add to queue (socketId tracked in userSocketMap)
          liveVideoQueue.push({ userId, joinedAt: Date.now() });
          console.log(`[LiveVideo] User ${userId} added to queue. Queue size: ${liveVideoQueue.length}`);
        }
      } catch (error) {
        console.error('[LiveVideo] Error joining match:', error);
        socket.emit('error', { message: 'Failed to join live video match' });
      }
    });

    socket.on('liveMatch:offer', (data: { offer: RTCSessionDescriptionInit; to: string }) => {
      const fromUserId = (socket as any).userId;
      if (!fromUserId) return;
      
      // Verify this is a valid matched pair
      const sessionData = findUserSession(fromUserId);
      if (!sessionData) {
        console.log(`[LiveVideo] Rejected offer from ${fromUserId}: not in session`);
        return;
      }

      const { session } = sessionData;
      const partnerId = session.user1Id === fromUserId ? session.user2Id : session.user1Id;
      
      // Verify recipient matches the partner
      if (data.to !== partnerId) {
        console.log(`[LiveVideo] Rejected offer from ${fromUserId} to ${data.to}: not matched partner`);
        return;
      }

      console.log(`[LiveVideo] Forwarding offer from ${fromUserId} to ${data.to}`);
      
      const recipientSocketId = session.user1Id === data.to ? session.user1SocketId : session.user2SocketId;
      const recipientSocket = io.sockets.sockets.get(recipientSocketId);
      
      if (recipientSocket) {
        recipientSocket.emit('liveMatch:offer', { offer: data.offer, from: fromUserId });
      }
    });

    socket.on('liveMatch:answer', (data: { answer: RTCSessionDescriptionInit; to: string }) => {
      const fromUserId = (socket as any).userId;
      if (!fromUserId) return;
      
      // Verify this is a valid matched pair
      const sessionData = findUserSession(fromUserId);
      if (!sessionData) {
        console.log(`[LiveVideo] Rejected answer from ${fromUserId}: not in session`);
        return;
      }

      const { session } = sessionData;
      const partnerId = session.user1Id === fromUserId ? session.user2Id : session.user1Id;
      
      // Verify recipient matches the partner
      if (data.to !== partnerId) {
        console.log(`[LiveVideo] Rejected answer from ${fromUserId} to ${data.to}: not matched partner`);
        return;
      }

      console.log(`[LiveVideo] Forwarding answer from ${fromUserId} to ${data.to}`);
      
      const recipientSocketId = session.user1Id === data.to ? session.user1SocketId : session.user2SocketId;
      const recipientSocket = io.sockets.sockets.get(recipientSocketId);
      
      if (recipientSocket) {
        recipientSocket.emit('liveMatch:answer', { answer: data.answer });
      }
    });

    socket.on('liveMatch:iceCandidate', (data: { candidate: RTCIceCandidateInit; to: string }) => {
      const fromUserId = (socket as any).userId;
      if (!fromUserId) return;
      
      // Verify this is a valid matched pair
      const sessionData = findUserSession(fromUserId);
      if (!sessionData) return;

      const { session } = sessionData;
      const partnerId = session.user1Id === fromUserId ? session.user2Id : session.user1Id;
      
      // Verify recipient matches the partner
      if (data.to !== partnerId) return;
      
      const recipientSocketId = session.user1Id === data.to ? session.user1SocketId : session.user2SocketId;
      const recipientSocket = io.sockets.sockets.get(recipientSocketId);
      
      if (recipientSocket) {
        recipientSocket.emit('liveMatch:iceCandidate', { 
          candidate: data.candidate, 
          from: fromUserId 
        });
      }
    });

    socket.on('liveMatch:leave', async () => {
      const userId = (socket as any).userId;
      if (!userId) return;
      
      console.log(`[LiveVideo] User ${userId} left session`);
      
      // Remove from queue if present
      const queueIndex = liveVideoQueue.findIndex(p => p.userId === userId);
      if (queueIndex !== -1) {
        liveVideoQueue.splice(queueIndex, 1);
        console.log(`[LiveVideo] Removed ${userId} from queue`);
      }
      
      // End active session if present
      const sessionData = findUserSession(userId);
      if (sessionData) {
        await endLiveVideoSession(sessionData.sessionId, 'user_left');
      }
    });

    socket.on('liveMatch:next', async () => {
      const userId = (socket as any).userId;
      if (!userId) return;
      
      console.log(`[LiveVideo] User ${userId} clicked next`);
      
      // End current session
      const sessionData = findUserSession(userId);
      if (sessionData) {
        await endLiveVideoSession(sessionData.sessionId, 'user_next');
      }
      
      // Frontend will automatically rejoin queue
    });

    socket.on('disconnect', async () => {
      console.log('Client disconnected:', socket.id);
      
      const userId = (socket as any).userId;
      if (userId) {
        // Remove from live video queue if present
        const queueIndex = liveVideoQueue.findIndex(p => p.userId === userId);
        if (queueIndex !== -1) {
          liveVideoQueue.splice(queueIndex, 1);
          console.log(`[LiveVideo] Removed user ${userId} from queue on disconnect`);
        }
        
        // End active live video session if present
        const sessionData = findUserSession(userId);
        if (sessionData) {
          await endLiveVideoSession(sessionData.sessionId, 'disconnect');
        }
      }
      
      // GameManager handles game cleanup automatically
    });
  });

  // Socket.IO is now attached to the HTTP server passed in from runApp
  // No need to return the server
}
