import type { Express } from "express";
import express from "express";
import { createHash } from "crypto";
import rateLimit from "express-rate-limit";
import { requireExchangeAuth, requireAdminHeader, createExchangeSession, safeError, verifyExchangeToken } from "./exchange-auth";
import { logSecurityEvent } from "./security-utils";
import { createServer, type Server } from "http";
import { Server as SocketIOServer, Socket } from "socket.io";
import { storage } from "./storage";
import bcrypt from "bcrypt";
import { sql, eq, desc } from "drizzle-orm";
import type { GameState } from "@shared/schema";
import { liveMatchSessions } from "@shared/schema";
import { db } from "./db";
import { sendPayoutNotification } from "./email-config";
import { sendSignupNotification, sendFormSubmissionEmail, sendExchangeEmail } from "./email-service";
import { insertExchangeAccountSchema, insertExchangeCreditListingSchema, insertExchangeRfqSchema } from "@shared/schema";
import { exchangeCreditListings, exchangeRfqs } from "@shared/schema";
import multer from "multer";
import path from "path";
import fs from "fs";
import PDFDocument from "pdfkit";
import { createSession, getSession, requireAuth } from "./session-middleware";
import { initStripe } from "./stripe-init";
import { WebhookHandlers } from "./webhookHandlers";
import { gameManager, type GameType } from "./game-manager";
import { nanoid } from "nanoid";
import { startCronJobs } from "./cron";
import { generateTradePDF } from "./pdf-generator";
import { sendZohoEmail, isZohoConfigured } from "./zoho-mailer";
import { getLivePrices, getPriceHistory } from "./exchange-prices";

// Legacy Pong code removed - all games now use GameManager

// Legacy Pong functions removed - all game logic now in GameManager

let stripeReady = false;
let stripeReadyAt: string | null = null;

export async function registerRoutes(app: Express, httpServer: Server): Promise<void> {
  const exchangeSigninLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many signin attempts. Please try again later." },
  });

  const exchangeAccountCreateLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 3,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many account creation attempts. Please try again later." },
  });

  const exchangeCheckoutLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    keyGenerator: (req) => String(req.headers["x-exchange-token"] || 'anon'),
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many checkout attempts. Please try again later." },
  });
  // ── FIX 7: Stripe startup health check ──────────────────────────────────────
  // Validates key on startup. Escrow endpoints are blocked if this fails.
  (async () => {
    try {
      const sk = process.env.STRIPE_SECRET_KEY;
      if (!sk) throw new Error('STRIPE_SECRET_KEY not set');
      const { default: Stripe } = await import('stripe');
      const stripe = new Stripe(sk, { apiVersion: '2024-12-18.acacia' as any });
      await stripe.paymentIntents.list({ limit: 1 });
      stripeReady = true;
      stripeReadyAt = new Date().toISOString();
      console.log('[Stripe] ✅ Key valid — escrow enabled');
    } catch (e: any) {
      stripeReady = false;
      console.error('[Stripe] ❌ Key invalid — escrow disabled:', e.message);
    }
  })();

  // Persist webhook UUID across server restarts via STRIPE_WEBHOOK_UUID secret
  let webhookUuid = process.env.STRIPE_WEBHOOK_UUID;
  if (!webhookUuid) {
    webhookUuid = nanoid(32);
    process.env.STRIPE_WEBHOOK_UUID = webhookUuid;
    console.log(`⚠️  STRIPE_WEBHOOK_UUID not set. Generated: ${webhookUuid}`);
    console.log(`⚠️  Add STRIPE_WEBHOOK_UUID = ${webhookUuid} to Replit Secrets to persist it.`);
  }

  const stripeInit = await initStripe();

  // Register Stripe webhook route BEFORE express.json()
  // This route needs raw Buffer for signature verification
  if (stripeInit) {
    app.post(
      '/api/stripe/webhook/:uuid',
      express.raw({ type: 'application/json' }),
      async (req, res) => {
        const signature = req.headers['stripe-signature'];
        if (!signature) return res.status(400).json({ error: 'Missing stripe-signature' });

        // Validate UUID matches persisted value — blocks spoofed webhook calls
        const { uuid } = req.params;
        if (uuid !== process.env.STRIPE_WEBHOOK_UUID) {
          console.error('[Webhook] UUID mismatch — rejected');
          return res.status(403).json({ error: 'Invalid webhook endpoint' });
        }

        try {
          const sig = Array.isArray(signature) ? signature[0] : signature;
          if (!Buffer.isBuffer(req.body)) {
            console.error('STRIPE WEBHOOK ERROR: req.body is not a Buffer');
            return res.status(500).json({ error: 'Webhook processing error' });
          }

          await WebhookHandlers.processWebhook(req.body as Buffer, sig, uuid);

          // ── AUTO ESCROW RELEASE + COMPENSATION + PDF (Fix 4, 5, 8) ─────────
          try {
            const stripeKey = process.env.STRIPE_SECRET_KEY;
            const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
            if (stripeKey && webhookSecret) {
              const { default: Stripe } = await import('stripe');
              const stripe = new Stripe(stripeKey, { apiVersion: '2024-12-18.acacia' as any });
              const event = stripe.webhooks.constructEvent(req.body as Buffer, sig, webhookSecret);

              if (
                event.type === 'payment_intent.amount_capturable_updated' ||
                event.type === 'payment_intent.requires_capture'
              ) {
                const pi = event.data.object as any;
                if (pi.metadata?.escrow_type === 'carbon_credit_t1' && pi.status === 'requires_capture') {
                  const trade_id   = pi.metadata?.trade_id || 'unknown';
                  const buyer_email = pi.metadata?.buyer_email || pi.receipt_email || '';
                  console.log(`[Escrow Auto-Release] Capturing trade ${trade_id} — PI: ${pi.id}`);

                  // Helper: perform capture + downstream writes/email/PDF
                  const doCapture = async (): Promise<void> => {
                    const captured   = await stripe.paymentIntents.capture(pi.id);
                    const gross      = captured.amount / 100;
                    const uaiu_fee   = gross * 0.0075;
                    const seller_net = gross - uaiu_fee;
                    const settled_at = new Date().toISOString();
                    const charge_id  = captured.latest_charge as string;

                    await db.execute(sql`
                      INSERT INTO escrow_settlements_log
                        (trade_id, payment_intent_id, amount_eur, uaiu_fee_eur,
                         seller_net_eur, status, settled_at, stripe_charge_id)
                      VALUES
                        (${trade_id}, ${pi.id}, ${gross}, ${uaiu_fee},
                         ${seller_net}, 'auto_settled', NOW(), ${charge_id})
                      ON CONFLICT (payment_intent_id) DO UPDATE
                        SET status = 'auto_settled', settled_at = NOW()
                    `).catch((e: any) => console.error('[Escrow PG log]', e.message));

                    await (req.app.locals.supabase as any)
                      ?.from('escrow_settlements')
                      .update({ status: 'auto_settled', settled_at, uaiu_fee_eur: uaiu_fee, seller_net_eur: seller_net, stripe_charge_id: charge_id })
                      .eq('payment_intent_id', pi.id)
                      .catch((e: any) => console.error('[Escrow Supabase]', e.message));

                    sendExchangeEmail(`Trade ${trade_id} — Auto-Settled`, {
                      'Trade ID':          trade_id,
                      'Gross':             `€${gross.toLocaleString()}`,
                      'UAIU Fee (0.75%)':  `€${uaiu_fee.toFixed(2)}`,
                      'Net to Seller':     `€${seller_net.toFixed(2)}`,
                      'Stripe Charge':     charge_id,
                      'Settled At':        settled_at,
                    }).catch((e: any) => console.error('[Escrow Email]', e.message));

                    // ── FIX 4: Auto-generate and email PDF audit pack ────────
                    const receiptData = `${trade_id}:${pi.id}:${charge_id}:${gross}:${settled_at}`;
                    const receiptHash = createHash('sha256').update(receiptData).digest('hex');
                    generateTradePDF({
                      trade_id,
                      side:                'BUY',
                      standard:            pi.metadata?.standard || 'Carbon Credit',
                      volume_tonnes:       parseFloat(pi.metadata?.volume_tonnes || '0'),
                      price_eur_per_tonne: gross / (parseFloat(pi.metadata?.volume_tonnes || '1') || 1),
                      gross_eur:           gross,
                      fee_eur:             uaiu_fee,
                      receipt_hash:        receiptHash,
                      prev_receipt_hash:   '',
                      payment_intent_id:   pi.id,
                      stripe_charge_id:    charge_id,
                      settled_at,
                      buyer_email,
                    }).then(pdfBuffer => {
                      const recipients = ['info@uaiu.live'];
                      if (buyer_email && buyer_email !== 'info@uaiu.live') recipients.push(buyer_email);
                      const attachment = [{ filename: `UAIU-Trade-${trade_id}.pdf`, content: pdfBuffer, contentType: 'application/pdf' }];
                      const emailHtml = `<div style="font-family:Arial;background:#022c22;color:#ecfdf5;padding:20px"><h2 style="color:#34d399">UAIU.LIVE/X — Trade Confirmed</h2><p>Trade <strong>${trade_id}</strong> has settled. Please find your audit pack PDF attached.</p><p style="color:#6ee7b7;font-size:12px">UAIU Exchange — info@uaiu.live</p></div>`;
                      return sendZohoEmail(recipients.join(','), `Your UAIU Trade Confirmation — ${trade_id}`, emailHtml, attachment);
                    }).catch((e: any) => console.error('[PDF email]', e.message));

                    console.log(`[Escrow Auto-Release] ✅ Trade ${trade_id} settled. Gross: €${gross}`);
                  };

                  // ── FIX 5: Compensation — first attempt + 60s retry ─────
                  try {
                    await doCapture();
                  } catch (firstErr: any) {
                    console.error(`[Escrow] ⚠️ First capture attempt failed for PI ${pi.id}:`, firstErr.message);
                    setTimeout(async () => {
                      try {
                        await doCapture();
                        console.log(`[Escrow] ✅ Retry capture succeeded for PI ${pi.id}`);
                      } catch (retryErr: any) {
                        console.error(`[Escrow] ❌ Retry capture also failed for PI ${pi.id}:`, retryErr.message);
                        await (req.app.locals.supabase as any)
                          ?.from('escrow_settlements')
                          .update({ status: 'capture_failed' })
                          .eq('payment_intent_id', pi.id)
                          .catch(() => {});
                        await db.execute(sql`
                          INSERT INTO escrow_settlements_log (trade_id, payment_intent_id, amount_eur, uaiu_fee_eur, seller_net_eur, status, settled_at, stripe_charge_id)
                          VALUES (${trade_id}, ${pi.id}, ${pi.amount / 100}, 0, 0, 'capture_failed', NOW(), '')
                          ON CONFLICT (payment_intent_id) DO UPDATE SET status = 'capture_failed', settled_at = NOW()
                        `).catch(() => {});
                        sendExchangeEmail('🚨 CAPTURE FAILED — Manual action required', {
                          'Trade ID':   trade_id,
                          'PI ID':      pi.id,
                          'Amount':     `€${(pi.amount / 100).toLocaleString()}`,
                          'Error':      retryErr.message,
                          'Attempts':   '2',
                          'Action':     'Manual capture required in Stripe Dashboard',
                          'Timestamp':  new Date().toISOString(),
                        }).catch(() => {});
                      }
                    }, 60_000);
                  }
                }
              }

              // KYC auto-confirm on Stripe Identity verified
              if (event.type === 'identity.verification_session.verified') {
                const session = event.data.object as any;
                const account_id = session.metadata?.account_id;
                const email      = session.metadata?.email;
                if (account_id) {
                  await db.execute(sql`
                    UPDATE exchange_accounts
                    SET kyc_status = 'verified', kyc_verified_at = NOW()
                    WHERE id = ${account_id}
                  `).catch((e: any) => console.error('[KYC webhook update]', e.message));

                  if (email) {
                    sendExchangeEmail('KYC Verified — Account Active', {
                      'Account ID':  account_id,
                      'Email':       email,
                      'Status':      'VERIFIED — Trading enabled',
                      'Verified At': new Date().toISOString(),
                    }).catch((e: any) => console.error('[KYC email]', e.message));
                  }
                  console.log(`[KYC] Account ${account_id} verified via webhook`);
                }
              }

              // Exchange spot trade — checkout.session.completed
              if (event.type === 'checkout.session.completed') {
                const cs = event.data.object as any;
                const meta = cs.metadata || {};
                const tradeId     = meta.trade_id || cs.id;
                const standard    = meta.standard || 'Carbon Credit';
                const volumeT     = parseFloat(meta.volume_tonnes || '0');
                const pricePerT   = parseFloat(meta.price_per_tonne || '0');
                const side        = meta.side || 'BUY';
                const email       = meta.email || cs.customer_email || '';
                const grossEur    = (cs.amount_total || 0) / 100;
                const feeEur      = grossEur * 0.0075;
                const settled_at  = new Date().toISOString();
                const receiptData = `${tradeId}:${cs.id}:${grossEur}:${settled_at}`;
                const receiptHash = createHash('sha256').update(receiptData).digest('hex');

                // Store trade record in DB
                storage.createExchangeTrade({
                  accountEmail:    email,
                  tradeId,
                  side,
                  standard,
                  volumeTonnes:    volumeT,
                  pricePerTonne:   pricePerT,
                  grossEur,
                  feeEur,
                  receiptHash,
                  stripeSessionId: cs.id,
                  status:          'completed',
                }).catch((e: any) => console.error('[Exchange Trade DB]', e.message));

                // Generate and email PDF receipt
                generateTradePDF({
                  trade_id:            tradeId,
                  side,
                  standard,
                  volume_tonnes:       volumeT,
                  price_eur_per_tonne: pricePerT,
                  gross_eur:           grossEur,
                  fee_eur:             feeEur,
                  receipt_hash:        receiptHash,
                  prev_receipt_hash:   '',
                  payment_intent_id:   cs.payment_intent || '',
                  stripe_charge_id:    '',
                  settled_at,
                  buyer_email:         email,
                }).then(pdfBuffer => {
                  const recipients = ['info@uaiu.live'];
                  if (email && email !== 'info@uaiu.live') recipients.push(email);
                  const attachment = [{ filename: `UAIU-Trade-${tradeId}.pdf`, content: pdfBuffer, contentType: 'application/pdf' }];
                  const emailHtml = `<div style="font-family:Arial;background:#0d1220;color:#e8dcc8;padding:28px;border:1px solid #d4a843"><h2 style="color:#d4a843;font-family:Georgia">UAIU.LIVE/X — Trade Confirmed</h2><p>Your trade <strong>${tradeId}</strong> has been executed successfully.</p><table style="width:100%;border-collapse:collapse;margin:16px 0"><tr><td style="padding:8px;color:#9b9b7a">Standard:</td><td style="padding:8px;color:#e8dcc8"><strong>${standard}</strong></td></tr><tr><td style="padding:8px;color:#9b9b7a">Volume:</td><td style="padding:8px;color:#e8dcc8"><strong>${volumeT.toLocaleString()} tCO₂e</strong></td></tr><tr><td style="padding:8px;color:#9b9b7a">Gross:</td><td style="padding:8px;color:#d4a843"><strong>€${grossEur.toLocaleString()}</strong></td></tr><tr><td style="padding:8px;color:#9b9b7a">Settlement:</td><td style="padding:8px;color:#e8dcc8">T+1 (next business day)</td></tr></table><p style="font-size:12px;color:#9b9b7a">Receipt Hash: ${receiptHash.slice(0, 32)}...</p><p style="font-size:12px;color:#9b9b7a">UAIU Exchange · info@uaiu.live</p></div>`;
                  return sendZohoEmail(recipients.join(','), `UAIU Trade Confirmation — ${tradeId}`, emailHtml, attachment);
                }).catch((e: any) => console.error('[Exchange Trade PDF email]', e.message));

                console.log(`[Exchange Checkout] ✅ Trade ${tradeId} completed via Stripe. Gross: €${grossEur}`);
              }
            }
          } catch (autoErr: any) {
            // ── FIX 8: Dead-letter queue — log unhandled webhook errors ────
            console.error('[Webhook Auto-Handler]', autoErr.message);
            let eventId: string | undefined;
            let eventType = 'unknown';
            let trade_id: string | undefined;
            let piId: string | undefined;
            try {
              const sk = process.env.STRIPE_SECRET_KEY;
              const ws = process.env.STRIPE_WEBHOOK_SECRET;
              if (sk && ws) {
                const { default: Stripe } = await import('stripe');
                const s = new Stripe(sk, { apiVersion: '2024-12-18.acacia' as any });
                const ev = s.webhooks.constructEvent(req.body as Buffer, sig, ws);
                eventId   = ev.id;
                eventType = ev.type;
                const obj = ev.data.object as any;
                trade_id  = obj?.metadata?.trade_id;
                piId      = obj?.id;
              }
            } catch {}
            storage.logWebhookFailure({
              eventId,
              eventType,
              tradeId:          trade_id,
              paymentIntentId:  piId,
              payload:          req.body.toString(),
              errorMessage:     autoErr.message,
              lastAttemptedAt:  new Date(),
            }).catch(() => {});
            sendExchangeEmail('🚨 WEBHOOK FAILURE — Dead-letter queue', {
              'Event Type':  eventType,
              'Event ID':    eventId || 'unknown',
              'Trade ID':    trade_id || 'unknown',
              'PI ID':       piId || 'unknown',
              'Error':       autoErr.message,
              'Timestamp':   new Date().toISOString(),
              'Action':      'Check /admin for retry options',
            }).catch(() => {});
          }

          res.status(200).json({ received: true });
        } catch (error: any) {
          console.error('Webhook error:', error.message);
          res.status(400).json({ error: 'Webhook processing error' });
        }
      }
    );
    console.log(`✅ Stripe webhook registered at /api/stripe/webhook/${webhookUuid}`);
    console.log(`   → Set this URL in Stripe Dashboard → Developers → Webhooks`);
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

      const sessionId = await createSession(user.id, user.email);
      
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

      const sessionId = await createSession(user.id, user.email);
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

  // ── EXCHANGE: Live price feed ─────────────────────────────────────────────
  app.get('/api/exchange/prices', (_req, res) => {
    res.json(getLivePrices());
  });

  app.get('/api/exchange/prices/:symbol/history', (req, res) => {
    const sym = decodeURIComponent(req.params.symbol);
    const history = getPriceHistory(sym);
    if (!history.length) return res.status(404).json({ error: 'Symbol not found' });
    res.json(history);
  });

  // ── EXCHANGE: Account signin ──────────────────────────────────────────────
  app.post('/api/exchange/account/signin', exchangeSigninLimiter, async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email) return res.status(400).json({ error: 'email required' });
      const account = await storage.getExchangeAccountByEmail(email.trim().toLowerCase());
      if (!account) return res.status(404).json({ error: 'No account found for that email.' });
      if (account.lockedUntil && new Date(account.lockedUntil) > new Date()) {
        await logSecurityEvent({ email: account.email, eventType: 'signin_lockout', req, detail: { lockedUntil: account.lockedUntil } });
        return res.status(429).json({ error: 'Account temporarily locked. Please try again later.' });
      }
      if (account.passwordHash) {
        if (!password) return res.status(401).json({ error: 'Password required.' });
        const ok = await bcrypt.compare(password, account.passwordHash);
        if (!ok) {
          const lock = await storage.incrementExchangeFailedLogin(account.email);
          await logSecurityEvent({ email: account.email, eventType: 'signin_fail', req, detail: { failedLoginAttempts: lock?.failedLoginAttempts || 0 } });
          if (lock?.lockedUntil) {
            return res.status(429).json({ error: 'Account temporarily locked. Please try again later.' });
          }
          return res.status(401).json({ error: 'Incorrect password.' });
        }
      }
      await storage.resetExchangeFailedLogin(account.email);
      const token = await createExchangeSession(account.email);
      await logSecurityEvent({ email: account.email, eventType: 'signin_success', req, detail: { tokenIssued: true } });
      res.json({ account, token });
    } catch (e: any) {
      res.status(500).json({ error: safeError(e) });
    }
  });

  app.post('/api/exchange/account/verify-token', async (req, res) => {
    try {
      const token = String(req.headers['x-exchange-token'] || req.body?.token || '').trim();
      if (!token) return res.status(401).json({ error: 'Exchange authentication required.' });
      const session = await verifyExchangeToken(token);
      if (!session) return res.status(401).json({ error: 'Invalid or expired exchange session.' });
      const account = await storage.getExchangeAccountByEmail(String(session.email));
      if (!account) return res.status(404).json({ error: 'Account not found.' });
      return res.json({ account });
    } catch (e: any) {
      return res.status(500).json({ error: safeError(e) });
    }
  });

  // ── EXCHANGE: Set password (first-time for existing passwordless accounts) ─
  app.post('/api/exchange/account/set-password', async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) return res.status(400).json({ error: 'email and password required' });
      if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });
      const account = await storage.getExchangeAccountByEmail(email.trim().toLowerCase());
      if (!account) return res.status(404).json({ error: 'Account not found.' });
      const hash = await bcrypt.hash(password, 12);
      await storage.updateExchangeAccountPassword(email.trim().toLowerCase(), hash);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: safeError(e) });
    }
  });

  // ── EXCHANGE: Accept terms ────────────────────────────────────────────────
  app.patch('/api/exchange/account/accept-terms', requireExchangeAuth, async (req, res) => {
    try {
      const email = (req as any).exchangeEmail;
      const account = await storage.updateExchangeAccountTerms(email);
      await logSecurityEvent({ email, eventType: 'terms_accepted', req });
      res.json(account);
    } catch (e: any) {
      res.status(500).json({ error: safeError(e) });
    }
  });

  // ── EXCHANGE: Spot trade Stripe Checkout ──────────────────────────────────
  app.post('/api/exchange/spot-checkout', requireExchangeAuth, exchangeCheckoutLimiter, async (req, res) => {
    try {
      const email = (req as any).exchangeEmail;
      const { standard, volumeTonnes, pricePerTonne, tradeId, side } = req.body;
      if (!standard || !volumeTonnes || !tradeId) {
        return res.status(400).json({ error: 'Missing required fields' });
      }
      const account = await storage.getExchangeAccountByEmail(email);
      if (!account || account.kycStatus !== 'verified') {
        return res.status(403).json({ error: 'KYC verification required before trading.' });
      }
      const listings = await storage.getExchangeListingsByStandard(String(standard));
      const activeListing = listings[0];
      if (!activeListing) {
        return res.status(400).json({ error: 'No active listing found for that standard.' });
      }
      const serverPrice = Number(activeListing.pricePerTonne);
      const submittedPrice = Number(pricePerTonne || 0);
      if (submittedPrice > 0) {
        const delta = Math.abs(serverPrice - submittedPrice) / serverPrice;
        if (delta > 0.05) {
          await logSecurityEvent({ email, eventType: 'suspicious_price', req, detail: { standard, submittedPrice, serverPrice, delta } });
        }
      }
      const stripeInit = await initStripe();
      if (!stripeInit?.stripeSync) return res.status(503).json({ error: 'Payment processor unavailable.' });
      const stripe = stripeInit.stripeSync;
      const gross = serverPrice * parseFloat(volumeTonnes);
      const fee = gross * 0.0075;
      const totalCents = Math.round((gross + fee) * 100);
      const origin = req.headers.origin || `https://${req.headers.host}` || 'https://uaiu.live';
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        mode: 'payment',
        line_items: [{
          price_data: {
            currency: 'eur',
            product_data: {
              name: `${standard} Carbon Credits — ${volumeTonnes} tonnes`,
              description: `${side || 'BUY'} order · Trade ID: ${tradeId} · Platform fee (0.75%) included`,
            },
            unit_amount: totalCents,
          },
          quantity: 1,
        }],
        metadata: { trade_id: tradeId, standard, volume_tonnes: String(volumeTonnes), email, side: side || 'BUY', price_per_tonne: String(serverPrice) },
        success_url: `${origin}/x?trade=success&id=${tradeId}`,
        cancel_url: `${origin}/x`,
        customer_email: email,
      });
      await logSecurityEvent({ email, eventType: 'trade_executed', req, detail: { tradeId, standard, volumeTonnes, serverPrice } });
      res.json({ url: session.url });
    } catch (e: any) {
      console.error('[Spot Checkout]', e.message);
      res.status(500).json({ error: safeError(e) });
    }
  });

  // ── EXCHANGE: Fetch trade history ─────────────────────────────────────────
  app.get('/api/exchange/trades', requireExchangeAuth, async (req, res) => {
    try {
      const email = (req as any).exchangeEmail;
      const trades = await storage.getExchangeTradesByEmail(email);
      res.json(trades);
    } catch (e: any) {
      res.status(500).json({ error: safeError(e) });
    }
  });

  // Trade recording is handled exclusively by the Stripe webhook handler.
  // The public /api/exchange/trade/record endpoint has been removed for security.

  // ── EXCHANGE: Retire credits ──────────────────────────────────────────────
  app.post('/api/exchange/retire', requireExchangeAuth, async (req, res) => {
    try {
      const email = (req as any).exchangeEmail;
      const { tradeId, volumeTonnes, standard, retireeName, purpose } = req.body;
      if (!tradeId || !volumeTonnes || !standard || !retireeName) {
        return res.status(400).json({ error: 'Missing required fields' });
      }
      const account = await storage.getExchangeAccountByEmail(email);
      if (!account || account.kycStatus !== 'verified') {
        return res.status(403).json({ error: 'KYC verification required before trading.' });
      }
      const trade = await storage.getExchangeTradeByTradeId(tradeId);
      if (!trade || trade.accountEmail !== email) {
        return res.status(403).json({ error: 'You do not own this trade.' });
      }
      if (trade.status !== 'completed') {
        return res.status(400).json({ error: 'Only completed trades can be retired.' });
      }
      await storage.updateExchangeTradeStatus(tradeId, 'retired');
      await logSecurityEvent({ email, eventType: 'trade_retire', req, detail: { tradeId, volumeTonnes, standard } });
      const certId = `UAIU-RET-${Date.now()}`;
      const certDate = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
      const certContent = `${certId}|${retireeName}|${standard}|${volumeTonnes}|${certDate}|${purpose || ''}`;
      const hash = createHash('sha256').update(certContent).digest('hex');
      const doc = new PDFDocument({ size: 'A4', margin: 60 });
      const chunks: Buffer[] = [];
      doc.on('data', c => chunks.push(c));
      await new Promise<void>((resolve, reject) => {
        doc.on('end', resolve);
        doc.on('error', reject);
        doc.rect(0, 0, doc.page.width, doc.page.height).fill('#060810');
        doc.fillColor('#d4a843').fontSize(8).font('Helvetica-Bold').text('UAIU.LIVE/X  ·  CARIBBEAN CARBON EXCHANGE', 60, 50, { align: 'center', width: doc.page.width - 120 });
        doc.moveDown(1.5);
        doc.fillColor('#f2ead8').fontSize(28).font('Helvetica-Bold').text('CARBON CREDIT RETIREMENT CERTIFICATE', { align: 'center' });
        doc.moveDown(0.5);
        doc.fillColor('#d4a843').fontSize(11).text('PERMANENT RETIREMENT FROM GLOBAL REGISTRY', { align: 'center' });
        doc.moveDown(2);
        doc.fillColor('#f2ead8').fontSize(14).text(`Certificate Number: ${certId}`, { align: 'center' });
        doc.moveDown(0.3);
        doc.fillColor('rgba(242,234,216,0.6)').fontSize(10).text(`Date of Retirement: ${certDate}`, { align: 'center' });
        doc.moveDown(2);
        doc.fillColor('#f2ead8').fontSize(13).text(`This certifies that`, { align: 'center' });
        doc.moveDown(0.5);
        doc.fillColor('#d4a843').fontSize(20).font('Helvetica-Bold').text(retireeName, { align: 'center' });
        doc.moveDown(0.5);
        doc.fillColor('#f2ead8').fontSize(13).font('Helvetica').text(`has permanently retired`, { align: 'center' });
        doc.moveDown(0.5);
        doc.fillColor('#d4a843').fontSize(24).font('Helvetica-Bold').text(`${parseFloat(volumeTonnes).toLocaleString()} tCO₂e`, { align: 'center' });
        doc.moveDown(0.5);
        doc.fillColor('#f2ead8').fontSize(13).font('Helvetica').text(`of ${standard} carbon credits from global circulation.`, { align: 'center' });
        if (purpose) {
          doc.moveDown(1);
          doc.fillColor('rgba(242,234,216,0.7)').fontSize(11).text(`Purpose: ${purpose}`, { align: 'center' });
        }
        doc.moveDown(2.5);
        doc.fillColor('rgba(212,168,67,0.4)').fontSize(8).font('Helvetica').text(`Tamper-evident SHA-256: ${hash}`, { align: 'center' });
        doc.moveDown(0.5);
        doc.text(`Trade Reference: ${tradeId}`, { align: 'center' });
        doc.end();
      });
      const pdfBuffer = Buffer.concat(chunks);
      if (isZohoConfigured()) {
        sendZohoEmail(email, `Carbon Credit Retirement Certificate — ${certId}`,
          `<div style="font-family:Arial;background:#060810;color:#f2ead8;padding:24px"><h2 style="color:#d4a843">UAIU.LIVE/X — Retirement Certificate</h2><p>Dear ${retireeName},</p><p>Your carbon credit retirement has been permanently recorded. Certificate: <strong>${certId}</strong></p><p>Volume: <strong>${volumeTonnes} tCO₂e</strong> of ${standard}</p><p>Please find your PDF certificate attached.</p></div>`,
          [{ filename: `UAIU-Retirement-${certId}.pdf`, content: pdfBuffer, contentType: 'application/pdf' }]
        ).catch(e => console.error('[Retire Email]', e.message));
      }
      res.json({ success: true, certificateId: certId, hash });
    } catch (e: any) {
      console.error('[Retire]', e.message);
      res.status(500).json({ error: safeError(e) });
    }
  });

  // ── EXCHANGE: KYC status update ───────────────────────────────────────────
  app.patch('/api/exchange/account/kyc-status', requireExchangeAuth, async (req, res) => {
    try {
      const email = (req as any).exchangeEmail;
      const { kycStatus } = req.body;
      if (!kycStatus) return res.status(400).json({ error: 'kycStatus required' });
      await storage.updateExchangeAccountKyc(email, kycStatus);
      await logSecurityEvent({ email, eventType: kycStatus === 'verified' ? 'kyc_verified' : 'kyc_started', req, detail: { kycStatus } });
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: safeError(e) });
    }
  });

  app.post('/api/exchange/account', requireAuth, exchangeAccountCreateLimiter, async (req, res) => {
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
      if (body.password) {
        accountData.passwordHash = await bcrypt.hash(body.password, 12);
      }
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

  app.post('/api/exchange/rfq', requireAuth, async (req, res) => {
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

  app.post('/api/exchange/list-credits', requireAuth, async (req, res) => {
    try {
      const parsed = insertExchangeCreditListingSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid form data', errors: parsed.error.flatten() });
      }

      // Save as 'pending' — admin must approve before appearing on marketplace
      const listing = await storage.createExchangeCreditListing(parsed.data);
      const volumeNum = parseFloat(String(parsed.data.volumeTonnes)) || 0;
      const priceNum  = parseFloat(String(parsed.data.askingPricePerTonne)) || 0;

      sendExchangeEmail('New Credit Listing — Pending Review', {
        'Organization':      parsed.data.orgName,
        'Contact':           parsed.data.contactName,
        'Email':             parsed.data.email,
        'Standard':          parsed.data.standard,
        'Credit Type':       parsed.data.creditType,
        'Volume (Tonnes)':   String(volumeNum),
        'Asking Price EUR/t': String(priceNum),
        'Project Origin':    parsed.data.projectOrigin,
        'Registry Serial':   parsed.data.registrySerial || 'Not provided',
        'Status':            'PENDING REVIEW — Go to /admin to approve or reject',
        'Submission ID':     listing.id,
      }).catch(err => console.error('Exchange email error:', err));

      res.json({
        success:   true,
        id:        listing.id,
        published: false,
        message:   'Your listing is under review. You will be notified once approved.',
      });
    } catch (error) {
      console.error('Exchange list credits error:', error);
      res.status(500).json({ message: 'Failed to submit credit listing' });
    }
  });

  // ── PARTNER API — Swiss X REDD UK Limited live inventory push ─────────────
  // POST /api/partner/listings
  // Authenticated by PARTNER_API_KEY secret. Alki's team calls this to push
  // live credit inventory directly into the marketplace in real time.
  app.post('/api/partner/listings', async (req, res) => {
    try {
      const { api_key, listings } = req.body;
      const validKey = process.env.PARTNER_API_KEY;
      if (!validKey) return res.status(500).json({ error: 'PARTNER_API_KEY not configured in Replit Secrets' });
      if (!api_key || api_key !== validKey) return res.status(401).json({ error: 'Invalid API key' });
      if (!Array.isArray(listings) || listings.length === 0) return res.status(400).json({ error: 'listings array required' });
      if (listings.length > 100) return res.status(400).json({ error: 'Max 100 listings per request' });

      const inserted: string[] = [];
      const errors: string[]   = [];

      for (const item of listings) {
        try {
          if (!item.name || !item.standard || !item.pricePerTonne) {
            errors.push(`Skipped (missing fields): ${JSON.stringify(item).slice(0, 60)}`);
            continue;
          }
          await storage.seedExchangeListings([{
            standard:          item.standard,
            badgeLabel:        item.badgeLabel || item.standard,
            name:              item.name,
            origin:            item.origin || 'Caribbean Basin',
            pricePerTonne:     parseFloat(item.pricePerTonne),
            changePercent:     parseFloat(item.changePercent) || 0,
            changeDirection:   item.changeDirection || 'up',
            status:            'active',
            isAcceptingOrders: true,
          }]);
          inserted.push(item.name);
        } catch (itemErr: any) {
          errors.push(`Failed: ${item.name} — ${itemErr.message}`);
        }
      }

      sendExchangeEmail('Partner Inventory Push — Marketplace Updated', {
        'Partner':          'Swiss X REDD UK Limited',
        'Listings Pushed':  String(inserted.length),
        'Errors':           errors.length > 0 ? errors.join('; ') : 'None',
        'Timestamp':        new Date().toISOString(),
      }).catch((e: any) => console.error('[Partner Email]', e.message));

      res.json({
        success:  true,
        inserted: inserted.length,
        listings: inserted,
        errors:   errors.length > 0 ? errors : undefined,
        message:  `${inserted.length} listing(s) are now live on marketplace.`,
      });
    } catch (err: any) {
      console.error('[Partner API]', err);
      res.status(500).json({ error: 'Partner listing push failed' });
    }
  });

  // ── SELLER DASHBOARD ─────────────────────────────────────────────────────
  // GET /api/seller/dashboard — authenticated seller view of their own data
  app.get('/api/seller/dashboard', requireAuth, async (req, res) => {
    try {
      const sessionUser = await storage.getUser((req as any).userId);
      if (!sessionUser) return res.status(401).json({ error: 'User not found' });
      const e = sessionUser.email.trim().toLowerCase();

      const listings = await db.select().from(exchangeCreditListings)
        .where(sql`LOWER(${exchangeCreditListings.email}) = ${e}`)
        .orderBy(desc(exchangeCreditListings.createdAt))
        .limit(50)
        .catch(() => []);

      const rfqs = await db.select().from(exchangeRfqs)
        .orderBy(desc(exchangeRfqs.createdAt))
        .limit(20)
        .catch(() => []);

      const escrows = await (req.app.locals.supabase as any)
        ?.from('escrow_settlements')
        .select('trade_id, amount_eur, uaiu_fee_eur, seller_net_eur, status, created_at, settled_at')
        .order('created_at', { ascending: false })
        .limit(20)
        .catch(() => ({ data: [] }));

      res.json({
        email: e,
        listings,
        rfqs,
        escrows:  escrows?.data || [],
        summary: {
          total_listings:  listings.length,
          total_rfqs:      rfqs.length,
          settled_trades:  (escrows?.data || []).filter((s: any) => s.status?.includes('settled')).length,
        },
      });
    } catch (err: any) {
      console.error('[Seller Dashboard]', err);
      res.status(500).json({ error: 'Dashboard load failed' });
    }
  });

  // DELETE /api/seller/listing/:id — remove own listing (auth required, ownership verified)
  app.delete('/api/seller/listing/:id', requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const sessionUser = await storage.getUser((req as any).userId);
      if (!sessionUser) return res.status(401).json({ error: 'User not found' });
      const email = sessionUser.email.trim().toLowerCase();
      await db.delete(exchangeCreditListings)
        .where(sql`id = ${id} AND LOWER(${exchangeCreditListings.email}) = ${email}`);
      res.json({ success: true, message: 'Listing removed.' });
    } catch (err: any) {
      console.error('[Delete Listing]', err);
      res.status(500).json({ error: 'Failed to remove listing' });
    }
  });

  // ── KYC — Stripe Identity ─────────────────────────────────────────────────
  // POST /api/kyc/start  — create a verification session, return URL for buyer
  app.post('/api/kyc/start', requireAuth, async (req, res) => {
    try {
      const { account_id, email, return_url } = req.body;
      if (!account_id || !email) return res.status(400).json({ error: 'account_id and email required' });
      const stripeKey = process.env.STRIPE_SECRET_KEY;
      if (!stripeKey) return res.status(500).json({ error: 'Stripe not configured' });

      const { default: Stripe } = await import('stripe');
      const stripe = new Stripe(stripeKey, { apiVersion: '2024-12-18.acacia' as any });
      const session = await stripe.identity.verificationSessions.create({
        type: 'document',
        metadata: { account_id: String(account_id), email: email.trim().toLowerCase(), platform: 'uaiu_exchange' },
        options: { document: { allowed_types: ['driving_license', 'passport', 'id_card'], require_matching_selfie: true } },
        return_url: return_url || 'https://uaiu.live/x?kyc=complete',
      });

      await db.execute(sql`
        UPDATE exchange_accounts
        SET kyc_session_id = ${session.id}, kyc_status = 'pending'
        WHERE id = ${account_id}
      `).catch((e: any) => console.error('[KYC update]', e.message));

      res.json({
        success:          true,
        session_id:       session.id,
        verification_url: session.url,
        status:           'pending',
        message:          'Direct buyer to verification_url to complete identity check.',
      });
    } catch (err: any) {
      console.error('[KYC Start]', err);
      res.status(500).json({ error: err.message || 'KYC session creation failed' });
    }
  });

  // GET /api/kyc/status/:session_id — poll to check verification result
  app.get('/api/kyc/status/:session_id', async (req, res) => {
    try {
      const stripeKey = process.env.STRIPE_SECRET_KEY;
      if (!stripeKey) return res.status(500).json({ error: 'Stripe not configured' });
      const { default: Stripe } = await import('stripe');
      const stripe  = new Stripe(stripeKey, { apiVersion: '2024-12-18.acacia' as any });
      const session = await stripe.identity.verificationSessions.retrieve(req.params.session_id);
      const verified = session.status === 'verified';

      if (verified) {
        await db.execute(sql`
          UPDATE exchange_accounts
          SET kyc_status = 'verified', kyc_verified_at = NOW()
          WHERE kyc_session_id = ${req.params.session_id}
        `).catch((e: any) => console.error('[KYC verified update]', e.message));

        const email = session.metadata?.email;
        if (email) {
          sendExchangeEmail('KYC Verified — Account Active', {
            'Account ID':  session.metadata?.account_id || 'N/A',
            'Email':       email,
            'Status':      'VERIFIED — Trading enabled',
            'Verified At': new Date().toISOString(),
          }).catch((e: any) => console.error('[KYC email]', e.message));
        }
      }

      res.json({ session_id: req.params.session_id, status: session.status, verified });
    } catch (err: any) {
      console.error('[KYC Status]', err);
      res.status(500).json({ error: err.message || 'KYC status check failed' });
    }
  });

  // ── HEALTH CHECK — full system test ──────────────────────────────────────
  // GET /api/admin/health-check (X-Admin-Key header required)
  app.get('/api/admin/health-check', requireAdminHeader, async (req, res) => {

    const results: Record<string, any> = {};

    // PostgreSQL
    try { await db.execute(sql`SELECT 1`); results.postgresql = { status: 'OK' }; }
    catch (e: any) { results.postgresql = { status: 'FAIL', error: e.message }; }

    // Live marketplace
    try {
      const listings = await storage.getExchangeListings();
      results.marketplace = { status: 'OK', live_listings: listings.length };
    } catch (e: any) { results.marketplace = { status: 'FAIL', error: e.message }; }

    // Stripe
    try {
      const sk = process.env.STRIPE_SECRET_KEY;
      if (!sk) throw new Error('STRIPE_SECRET_KEY not set');
      const { default: Stripe } = await import('stripe');
      const stripe = new Stripe(sk, { apiVersion: '2024-12-18.acacia' as any });
      await stripe.paymentIntents.list({ limit: 1 });
      results.stripe = { status: 'OK' };
    } catch (e: any) { results.stripe = { status: 'FAIL', error: e.message }; }

    // Webhook UUID
    const wuuid = process.env.STRIPE_WEBHOOK_UUID;
    results.stripe_webhook = {
      status: !!(wuuid && process.env.STRIPE_WEBHOOK_SECRET) ? 'OK' : 'WARN',
    };

    // Email
    results.email = {
      status: process.env.ZOHO_SMTP_USER ? 'OK' : 'WARN',
    };

    // Partner API
    results.partner_api = {
      status:   process.env.PARTNER_API_KEY ? 'OK — Key set' : 'WARN — Add PARTNER_API_KEY to Replit Secrets',
      endpoint: 'POST /api/partner/listings',
    };

    // KYC
    results.kyc = {
      status:   process.env.STRIPE_SECRET_KEY ? 'OK — Stripe Identity ready' : 'FAIL — Stripe key missing',
      endpoint: 'POST /api/kyc/start',
    };

    // Stripe startup validation (Fix 7)
    results.stripe_startup = {
      status:       stripeReady ? 'OK — Key validated at startup' : 'FAIL — Key invalid or not yet validated',
      validated_at: stripeReadyAt || 'not yet',
      escrow_gate:  stripeReady ? 'open' : 'blocked',
    };

    // Supabase
    try {
      const sb = res.app.locals.supabase;
      if (!sb) throw new Error('Not attached');
      await sb.from('escrow_settlements').select('count').limit(1);
      results.supabase = { status: 'OK' };
    } catch (e: any) { results.supabase = { status: 'WARN — Supabase unavailable (PostgreSQL fallback active)' }; }

    const allOk = Object.values(results).every((r: any) => r.status === 'OK');
    res.json({
      platform:   'UAIU.LIVE/X',
      timestamp:  new Date().toISOString(),
      ready:      allOk,
      systems:    results,
      next_steps: allOk
        ? '✅ All systems operational. Safe to onboard Swiss X REDD UK Limited.'
        : '❌ Fix FAIL items above before going live to Alki\'s network.',
    });
  });

  // ── ADMIN: Security event log ─────────────────────────────────────────────
  app.get('/api/admin/security-log', requireAdminHeader, async (req, res) => {
    try {
      const limit = Math.min(Number(req.query.limit || 100), 500);
      const rows = await storage.getRecentSecurityEvents(limit);
      res.json(rows);
    } catch (e: any) {
      res.status(500).json({ error: safeError(e) });
    }
  });

  // ── ADMIN: Pending Seller Listings ────────────────────────────────────────
  app.get('/api/admin/listings/pending', requireAdminHeader, async (req, res) => {
    try {
      const listings = await storage.getPendingCreditListings();
      res.json(listings);
    } catch (e: any) {
      res.status(500).json({ error: safeError(e) });
    }
  });

  app.post('/api/admin/listings/:id/approve', requireAdminHeader, async (req, res) => {
    try {
      const [submission] = await db.select().from(exchangeCreditListings).where(eq(exchangeCreditListings.id, req.params.id));
      const newListing = await storage.approveCreditListing(req.params.id);
      sendExchangeEmail('Listing Approved — Now Live on Marketplace', {
        'Listing ID':   req.params.id,
        'Name':         newListing.name,
        'Standard':     newListing.standard,
        'Price EUR/t':  String(newListing.pricePerTonne),
        'Approved At':  new Date().toISOString(),
      }).catch(() => {});
      if (submission?.email && isZohoConfigured()) {
        const approveHtml = `<div style="font-family:Arial;background:#060810;color:#f2ead8;padding:24px"><h2 style="color:#d4a843">UAIU.LIVE/X — Your Credits Are Live</h2><p>Dear ${submission.contactName || 'Seller'},</p><p>Your carbon credit listing has been approved and is now visible to institutional buyers on <strong>UAIU.LIVE/X</strong>.</p><ul><li><strong>Credit Type:</strong> ${submission.creditType}</li><li><strong>Standard:</strong> ${submission.standard}</li><li><strong>Volume:</strong> ${submission.volumeTonnes} tonnes</li><li><strong>Asking Price:</strong> €${submission.askingPricePerTonne}/tonne</li></ul><p>You will be contacted directly when a buyer matches your listing.</p><p style="color:#d4a843;margin-top:24px">UAIU Holdings Corp · info@uaiu.live</p></div>`;
        sendZohoEmail(submission.email, 'Your Carbon Credits Are Live — UAIU Exchange', approveHtml).catch(() => {});
      }
      res.json({ success: true, listing: newListing });
    } catch (e: any) {
      res.status(500).json({ error: safeError(e) });
    }
  });

  app.post('/api/admin/listings/:id/reject', requireAdminHeader, async (req, res) => {
    try {
      const rejected = await storage.rejectCreditListing(req.params.id);
      // Email the seller
      const reason = req.body.reason || 'Your listing did not meet our current marketplace requirements.';
      const html = `<div style="font-family:Arial;background:#022c22;color:#ecfdf5;padding:20px"><h2 style="color:#34d399">UAIU.LIVE/X — Listing Review</h2><p>Thank you for submitting your carbon credits to UAIU.LIVE/X.</p><p>After review, we are unable to approve your listing at this time.</p><p><strong>Reason:</strong> ${reason}</p><p>Please contact info@uaiu.live if you have questions.</p></div>`;
      if (rejected.email && isZohoConfigured()) {
        sendZohoEmail(rejected.email, 'UAIU.LIVE/X — Your listing was not approved', html).catch(() => {});
      }
      res.json({ success: true, id: req.params.id });
    } catch (e: any) {
      res.status(500).json({ error: safeError(e) });
    }
  });

  // ── ADMIN: Webhook Dead-Letter Queue (Fix 8) ────────────────────────────────
  app.get('/api/admin/webhooks/failures', requireAdminHeader, async (req, res) => {
    try {
      const failures = await storage.getWebhookFailures(false);
      res.json(failures);
    } catch (e: any) {
      res.status(500).json({ error: safeError(e) });
    }
  });

  app.post('/api/admin/webhooks/retry/:id', requireAdminHeader, async (req, res) => {
    try {
      const failures = await storage.getWebhookFailures();
      const failure = failures.find(f => f.id === req.params.id);
      if (!failure) return res.status(404).json({ error: 'Failure record not found' });

      await storage.incrementWebhookRetry(req.params.id);

      // If we have a PI ID, attempt to re-capture
      if (failure.paymentIntentId && stripeReady) {
        const stripeKey = process.env.STRIPE_SECRET_KEY!;
        const { default: Stripe } = await import('stripe');
        const stripe = new Stripe(stripeKey, { apiVersion: '2024-12-18.acacia' as any });
        const pi = await stripe.paymentIntents.retrieve(failure.paymentIntentId);
        if (pi.status === 'requires_capture') {
          const captured = await stripe.paymentIntents.capture(pi.id);
          const gross = captured.amount / 100;
          const uaiu_fee = gross * 0.0075;
          const seller_net = gross - uaiu_fee;
          await db.execute(sql`
            INSERT INTO escrow_settlements_log (trade_id, payment_intent_id, amount_eur, uaiu_fee_eur, seller_net_eur, status, settled_at, stripe_charge_id)
            VALUES (${failure.tradeId || 'manual-retry'}, ${pi.id}, ${gross}, ${uaiu_fee}, ${seller_net}, 'manual_retry_settled', NOW(), ${captured.latest_charge as string})
            ON CONFLICT (payment_intent_id) DO UPDATE SET status = 'manual_retry_settled', settled_at = NOW()
          `).catch(() => {});
          await storage.resolveWebhookFailure(req.params.id);
          return res.json({ success: true, action: 'captured', gross_eur: gross });
        }
      }

      await storage.resolveWebhookFailure(req.params.id);
      res.json({ success: true, action: 'resolved_no_capture' });
    } catch (e: any) {
      res.status(500).json({ error: safeError(e) });
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

  io.on('connection', async (socket: Socket) => {
    console.log('=== SOCKET CONNECTION ===');
    console.log('Socket ID:', socket.id);
    const sessionId = (socket.handshake.auth as any).sessionId;
    if (!sessionId) {
      console.error('Socket connection rejected: No sessionId in auth');
      socket.disconnect();
      return;
    }
    
    const session = await getSession(sessionId);
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

        // Atomic credit deduction — only succeeds if user has enough credits
        const deducted = await storage.deductCredits(userId, betAmount);
        if (!deducted) {
          socket.emit('error', { message: `Not enough credits. You need ${betAmount} credits to join.` });
          const freshUser = await storage.getUser(userId);
          socket.emit('creditsUpdated', freshUser?.credits ?? 0);
          return;
        }
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

        // Atomic credit deduction — only succeeds if user has enough credits
        const deducted = await storage.deductCredits(userId, targetBetAmount);
        if (!deducted) {
          socket.emit('error', { message: `Not enough credits. You need ${targetBetAmount} credits.` });
          const freshUser = await storage.getUser(userId);
          socket.emit('creditsUpdated', freshUser?.credits ?? 0);
          return;
        }
        socket.emit('creditsUpdated', user.credits - targetBetAmount);

        // Join the match with socket ID
        const success = gameManager.joinSpecificMatch(userId, data.targetUserId, user.name, socket.id, io);
        
        // Refund if join fails (race condition or match already started)
        if (!success) {
          const freshUser = await storage.getUser(userId);
          await storage.updateUserCredits(userId, (freshUser?.credits ?? 0) + targetBetAmount);
          socket.emit('creditsUpdated', (freshUser?.credits ?? 0) + targetBetAmount);
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

      // Forfeit any active game match with a 5-second grace period
      if (userId && !isUserOnline(userId)) {
        setTimeout(async () => {
          if (!isUserOnline(userId)) {
            await gameManager.forfeitMatch(userId, io);
          }
        }, 5000);
      }
    });
  });

  // ─── AI Exchange Routes ───────────────────────────────────────────

  app.post('/api/exchange/ai-rfq', requireAuth, async (req, res) => {
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

  app.post('/api/exchange/ai-intelligence', requireAuth, async (req, res) => {
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

  app.post('/api/exchange/ai-vision', requireAuth, async (req, res) => {
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

  app.post('/api/exchange/multisig-approval', requireAuth, async (req, res) => {
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

  // ─── Wave 3: Stripe Escrow Routes ────────────────────────────────

  app.post('/api/escrow/create', async (req, res) => {
    if (!stripeReady) return res.status(503).json({ error: 'Escrow unavailable — Stripe key validation failed at startup' });
    try {
      const { trade_id, amount_eur, buyer_email, listing_id, volume_tonnes, standard } = req.body;
      if (!trade_id || !amount_eur || amount_eur < 100) {
        return res.status(400).json({ error: 'Invalid escrow parameters' });
      }
      const stripeKey = process.env.STRIPE_SECRET_KEY;
      if (!stripeKey) return res.status(500).json({ error: 'Stripe not configured' });
      const { default: Stripe } = await import('stripe');
      const stripe = new Stripe(stripeKey, { apiVersion: '2024-12-18.acacia' as any });
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount_eur * 100),
        currency: 'eur',
        capture_method: 'manual',
        receipt_email: buyer_email,
        metadata: { trade_id, listing_id: listing_id || '', volume_tonnes: String(volume_tonnes), standard: standard || '', escrow_type: 'carbon_credit_t1', platform: 'uaiu_exchange', buyer_email: buyer_email || '', created_at: new Date().toISOString() },
        description: `UAIU Carbon Credit Escrow — Trade ${trade_id} — ${volume_tonnes?.toLocaleString()}t ${standard}`,
        statement_descriptor: 'UAIU EXCH',
      });
      await (req.app.locals.supabase as any)?.from('escrow_settlements').insert({ trade_id, payment_intent_id: paymentIntent.id, amount_eur, status: 'held', buyer_email, volume_tonnes, standard, created_at: new Date().toISOString() });
      res.json({ client_secret: paymentIntent.client_secret, payment_intent_id: paymentIntent.id, escrow_status: 'held', message: 'Funds held in escrow. Release triggered at T+1 settlement confirmation.' });
    } catch (e: any) {
      console.error('Escrow create error:', e);
      res.status(500).json({ error: safeError(e) });
    }
  });

  app.post('/api/escrow/verify', async (req, res) => {
    if (!stripeReady) return res.status(503).json({ error: 'Escrow unavailable — Stripe key validation failed at startup' });
    try {
      const { trade_id, payment_intent_id, receipt_hash } = req.body;
      if (!payment_intent_id) return res.status(400).json({ error: 'Missing payment intent ID' });
      const stripeKey = process.env.STRIPE_SECRET_KEY;
      if (!stripeKey) return res.status(500).json({ error: 'Stripe not configured' });
      const { default: Stripe } = await import('stripe');
      const stripe = new Stripe(stripeKey, { apiVersion: '2024-12-18.acacia' as any });
      const pi = await stripe.paymentIntents.retrieve(payment_intent_id);
      if (pi.status !== 'requires_capture') {
        return res.status(400).json({ error: `Cannot verify — payment intent status is ${pi.status}. Expected requires_capture.` });
      }
      await (req.app.locals.supabase as any)?.from('escrow_settlements').update({ status: 'verified', verified_at: new Date().toISOString(), receipt_hash }).eq('payment_intent_id', payment_intent_id);
      res.json({ success: true, status: 'verified', message: 'Credits verified. T+1 settlement will release funds automatically.', next_step: 'Call /api/escrow/release within 24 hours to complete settlement.' });
    } catch (e: any) {
      console.error('Escrow verify error:', e);
      res.status(500).json({ error: safeError(e) });
    }
  });

  app.post('/api/escrow/release', async (req, res) => {
    if (!stripeReady) return res.status(503).json({ error: 'Escrow unavailable — Stripe key validation failed at startup' });
    try {
      const { payment_intent_id, trade_id } = req.body;
      if (!payment_intent_id) return res.status(400).json({ error: 'Missing payment intent ID' });
      const stripeKey = process.env.STRIPE_SECRET_KEY;
      if (!stripeKey) return res.status(500).json({ error: 'Stripe not configured' });
      const { default: Stripe } = await import('stripe');
      const stripe = new Stripe(stripeKey, { apiVersion: '2024-12-18.acacia' as any });
      const captured = await stripe.paymentIntents.capture(payment_intent_id);
      const gross = captured.amount / 100;
      const uaiu_fee = gross * 0.0075;
      const seller_net = gross - uaiu_fee;
      await (req.app.locals.supabase as any)?.from('escrow_settlements').update({ status: 'settled', settled_at: new Date().toISOString(), uaiu_fee_eur: uaiu_fee, seller_net_eur: seller_net, stripe_charge_id: captured.latest_charge }).eq('payment_intent_id', payment_intent_id);
      try {
        const { sendExchangeEmail } = await import('./email-service');
        await sendExchangeEmail(`Trade ${trade_id} — Settlement Confirmed`, { 'Gross': `€${gross.toLocaleString()}`, 'UAIU Fee (0.75%)': `€${uaiu_fee.toFixed(2)}`, 'Net Settled': `€${seller_net.toFixed(2)}`, 'Stripe Charge': captured.latest_charge as string });
      } catch (emailError) { console.error('Settlement email error:', emailError); }
      res.json({ success: true, status: 'settled', gross_eur: gross, uaiu_fee_eur: uaiu_fee, seller_net_eur: seller_net, stripe_charge_id: captured.latest_charge, message: `Trade ${trade_id} settled. €${gross.toLocaleString()} captured.` });
    } catch (e: any) {
      console.error('Escrow release error:', e);
      res.status(500).json({ error: safeError(e) });
    }
  });

  app.post('/api/escrow/cancel', async (req, res) => {
    if (!stripeReady) return res.status(503).json({ error: 'Escrow unavailable — Stripe key validation failed at startup' });
    try {
      const { payment_intent_id, trade_id, reason } = req.body;
      if (!payment_intent_id) return res.status(400).json({ error: 'Missing payment intent ID' });
      const stripeKey = process.env.STRIPE_SECRET_KEY;
      if (!stripeKey) return res.status(500).json({ error: 'Stripe not configured' });
      const { default: Stripe } = await import('stripe');
      const stripe = new Stripe(stripeKey, { apiVersion: '2024-12-18.acacia' as any });
      await stripe.paymentIntents.cancel(payment_intent_id, { cancellation_reason: 'abandoned' });
      await (req.app.locals.supabase as any)?.from('escrow_settlements').update({ status: 'cancelled', cancelled_at: new Date().toISOString(), cancellation_reason: reason || 'trade_cancelled' }).eq('payment_intent_id', payment_intent_id);
      res.json({ success: true, status: 'cancelled', message: 'Escrow cancelled. Funds will be released back to buyer within 5-10 business days.' });
    } catch (e: any) {
      console.error('Escrow cancel error:', e);
      res.status(500).json({ error: safeError(e) });
    }
  });

  app.get('/api/escrow/status/:trade_id', async (req, res) => {
    try {
      const { data } = await (req.app.locals.supabase as any)?.from('escrow_settlements').select('*').eq('trade_id', req.params.trade_id).single() || {};
      if (!data) return res.status(404).json({ error: 'Escrow record not found' });
      res.json(data);
    } catch (e) {
      res.status(500).json({ error: 'Status check failed' });
    }
  });

  // ─── Wave 3: AI + Calendar Routes ────────────────────────────────

  app.post('/api/ai/copilot', async (req, res) => {
    try {
      const { messages, system } = req.body;
      if (!messages?.length) return res.status(400).json({ error: 'No messages' });
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) return res.json({ reply: '[Demo Mode] I\'m the UAIU Carbon Compliance Co-Pilot. To activate AI responses, configure the ANTHROPIC_API_KEY secret.' });
      const Anthropic = (await import('@anthropic-ai/sdk')).default;
      const client = new Anthropic({ apiKey });
      const msg = await client.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 1000,
        system: system || 'You are a carbon market compliance expert for UAIU.LIVE/X Caribbean Carbon Exchange.',
        messages: messages.slice(-10),
      });
      const reply = (msg.content.find((b: any) => b.type === 'text') as any)?.text || '';
      res.json({ reply });
    } catch (e: any) {
      console.error('Copilot error:', e);
      res.status(500).json({ error: 'AI response failed' });
    }
  });

  let predictionCache: { data: any; ts: number } | null = null;

  app.post('/api/ai/price-prediction', async (req, res) => {
    try {
      if (predictionCache && Date.now() - predictionCache.ts < 6 * 60 * 60 * 1000) {
        return res.json({ prediction: predictionCache.data, cached: true });
      }
      const { current_price } = req.body;
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        const mockPrediction = { forecast_7d: (current_price || 67.43) * 1.02, forecast_30d: (current_price || 67.43) * 1.05, direction: 'bullish', confidence: 72, rationale: '[Demo Mode] Caribbean premium carbon credits showing bullish momentum driven by EU ETS compliance demand and CORSIA Phase 1 requirements.', range_7d: { low: (current_price || 67.43) * 0.98, high: (current_price || 67.43) * 1.04 }, range_30d: { low: (current_price || 67.43) * 0.95, high: (current_price || 67.43) * 1.08 }, key_drivers: ['EU ETS surrender deadline Q3 2026', 'CORSIA Phase 1 aviation demand', 'Caribbean sovereign wealth fund floor', 'IMO GHG maritime compliance', 'USD/EUR exchange rate stability'] };
        return res.json({ prediction: mockPrediction });
      }
      const Anthropic = (await import('@anthropic-ai/sdk')).default;
      const client = new Anthropic({ apiKey });
      const msg = await client.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 800,
        messages: [{ role: 'user', content: `You are a carbon market price analyst. Current UAIU Caribbean Premium Index: €${current_price}/tonne. Date: ${new Date().toDateString()}. Analyze and forecast. Respond ONLY with JSON no markdown: {"forecast_7d":number,"forecast_30d":number,"direction":"bullish"|"bearish"|"neutral","confidence":number,"rationale":"2-3 sentences","range_7d":{"low":number,"high":number},"range_30d":{"low":number,"high":number},"key_drivers":["5 specific market factors"]}` }],
      });
      const text = (msg.content.find((b: any) => b.type === 'text') as any)?.text || '{}';
      const prediction = JSON.parse(text.replace(/```json|```/g, '').trim());
      predictionCache = { data: prediction, ts: Date.now() };
      res.json({ prediction });
    } catch (e: any) {
      console.error('Prediction error:', e);
      res.status(500).json({ error: 'Prediction failed' });
    }
  });

  app.post('/api/ai/due-diligence', async (req, res) => {
    try {
      const { listing, market_price } = req.body;
      if (!listing) return res.status(400).json({ error: 'No listing provided' });
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        const mockReport = { summary: `[Demo Mode] ${listing.name} is a verified Caribbean carbon credit listing with strong compliance credentials. Registry verification pending final confirmation.`, registry_status: 'Verified — VCS v4 Registry', standard_analysis: 'Meets CORSIA and EU ETS eligibility requirements.', risk_score: 28, risk_factors: ['Currency risk (EUR/USD)', 'Registry verification timeline', 'Vintage year alignment', 'Buyer compliance deadline proximity'], comparable_trades: [], recommended_price_range: { low: (market_price || 64) * 0.95, high: (market_price || 64) * 1.05 }, recommendation: 'buy', recommendation_rationale: 'Strong registry credentials and favorable pricing relative to EU ETS spot.', sections: [{ title: 'Project Overview', content: `${listing.name} is a Caribbean-origin carbon credit project meeting international verification standards.` }, { title: 'Recommendation', content: 'Recommended for institutional buyers seeking CORSIA-eligible Caribbean premium credits.' }] };
        return res.json({ report: mockReport });
      }
      const Anthropic = (await import('@anthropic-ai/sdk')).default;
      const client = new Anthropic({ apiKey });
      const msg = await client.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 2000,
        messages: [{ role: 'user', content: `Generate a due diligence report for this carbon credit listing. Listing: ${JSON.stringify(listing)} Market Index Price: €${market_price}/tonne. Respond ONLY with JSON no markdown: {"summary":"string","registry_status":"string","standard_analysis":"string","risk_score":number,"risk_factors":["strings"],"comparable_trades":[{"date":"YYYY-MM-DD","price":number,"volume":number,"standard":"string"}],"recommended_price_range":{"low":number,"high":number},"recommendation":"strong_buy"|"buy"|"hold"|"pass","recommendation_rationale":"string","sections":[{"title":"string","content":"string"}]}` }],
      });
      const text = (msg.content.find((b: any) => b.type === 'text') as any)?.text || '{}';
      const report = JSON.parse(text.replace(/```json|```/g, '').trim());
      res.json({ report });
    } catch (e: any) {
      console.error('Due diligence error:', e);
      res.status(500).json({ error: 'Due diligence generation failed' });
    }
  });

  app.post('/api/exchange/calendar-subscribe', async (req, res) => {
    try {
      const { email, deadline_ids } = req.body;
      if (!email) return res.status(400).json({ error: 'Email required' });
      await (req.app.locals.supabase as any)?.from('calendar_subscriptions').upsert({ email, deadline_ids, created_at: new Date().toISOString(), active: true }, { onConflict: 'email' });
      try {
        const { sendExchangeEmail } = await import('./email-service');
        await sendExchangeEmail('Compliance Calendar Reminders Set', { 'Email': email, 'Deadlines Selected': deadline_ids?.length || 0, 'Reminder Schedule': '90, 60, 30, and 7 days before each deadline', 'Manage at': 'uaiu.live/x#calendar' });
      } catch (emailError) { console.error('Calendar subscription email error:', emailError); }
      res.json({ success: true, count: deadline_ids?.length || 0 });
    } catch (e: any) {
      res.status(500).json({ error: 'Subscription failed' });
    }
  });

  // ── FIX 3: Start cron watchdog for stuck escrow trades ──────────────────────
  startCronJobs(app);

  // Socket.IO is now attached to the HTTP server passed in from runApp
  // No need to return the server
}
