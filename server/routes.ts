import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { Server as SocketIOServer, Socket } from "socket.io";
import { storage } from "./storage";
import bcrypt from "bcrypt";
import { sql } from "drizzle-orm";
import type { GameState } from "@shared/schema";
import { sendSignupNotification, sendPayoutNotification } from "./email-config";
import { generateVerificationToken, sendVerificationEmail, sendWelcomeEmail } from "./email-service";
import { createSession, getSession, requireAuth } from "./session-middleware";
import { initStripe } from "./stripe-init";
import { WebhookHandlers } from "./webhookHandlers";
import { gameManager, type GameType } from "./game-manager";

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
      const { email, name, password } = req.body;

      if (!email || !name || !password) {
        return res.status(400).json({ message: 'Email, name, and password are required' });
      }

      const existing = await storage.getUserByEmail(email);
      if (existing) {
        return res.status(400).json({ message: 'Email already registered' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const verificationToken = generateVerificationToken();
      
      const user = await storage.createUser({ 
        email, 
        name, 
        password: hashedPassword,
      });

      // Set verification token
      await storage.updateUser(user.id, { emailVerificationToken: verificationToken });

      await storage.addActionLog({
        userId: user.id,
        userName: name,
        type: 'signup',
        message: `${name} joined UAIU Arcade!`,
      });

      // Send verification and notification emails
      await Promise.all([
        sendVerificationEmail(email, name, verificationToken),
        sendSignupNotification(email, name),
      ]);

      const sessionId = createSession(user.id, user.email);
      res.json({ ...user, sessionId });
    } catch (error) {
      console.error('Signup error:', error);
      res.status(500).json({ message: 'Signup failed' });
    }
  });

  app.get('/api/auth/verify-email', async (req, res) => {
    try {
      const { token } = req.query;

      if (!token || typeof token !== 'string') {
        return res.status(400).json({ message: 'Invalid verification token' });
      }

      const user = await storage.getUserByVerificationToken(token);
      if (!user) {
        return res.status(404).json({ message: 'Invalid or expired verification token' });
      }

      await storage.updateUser(user.id, {
        emailVerified: true,
        emailVerificationToken: null,
      });

      await sendWelcomeEmail(user.email, user.name);

      res.json({ message: 'Email verified successfully!' });
    } catch (error) {
      console.error('Email verification error:', error);
      res.status(500).json({ message: 'Verification failed' });
    }
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
      console.log('=== FETCHING CREDIT PACKAGES ===');
      console.log('User ID:', (req as any).userId);
      console.log('User Email:', (req as any).userEmail);
      
      const result = await storage.db.execute(sql`
        SELECT 
          p.id as product_id,
          p.name as product_name,
          p.description as product_description,
          p.metadata as product_metadata,
          pr.id as price_id,
          pr.unit_amount,
          pr.currency
        FROM stripe.products p
        JOIN stripe.prices pr ON pr.product = p.id
        WHERE p.metadata->>'type' = 'arcade_credits'
        AND p.active = true
        AND pr.active = true
        ORDER BY pr.unit_amount ASC
      `);

      console.log(`Query returned ${result.rows.length} products`);

      const packages = result.rows.map((row: any) => ({
        productId: row.product_id,
        priceId: row.price_id,
        name: row.product_name,
        description: row.product_description,
        amount: row.unit_amount / 100, // Convert cents to dollars
        currency: row.currency,
        credits: parseInt(row.product_metadata?.credits || '0', 10),
      }));

      console.log(`Returning ${packages.length} packages`);
      res.json({ packages });
    } catch (error) {
      console.error('Failed to fetch credit packages - ERROR:', error);
      res.status(500).json({ message: 'Failed to fetch credit packages' });
    }
  });

  // Use the HTTP server passed in from runApp
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });
  
  console.log('Socket.IO server initialized on shared HTTP server');

  // GameManager handles all matchmaking including bot fallback

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
    console.log('Client connected:', socket.id, 'User:', session.userId, session.email);

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

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
      // GameManager handles cleanup automatically
    });
  });

  // Socket.IO is now attached to the HTTP server passed in from runApp
  // No need to return the server
}
