import type { Express } from "express";
import express from "express";
import { z } from "zod";
import { createHash, randomBytes, timingSafeEqual } from "crypto";
import rateLimit from "express-rate-limit";
import { requireExchangeAuth, requireAdminHeader, createExchangeSession, safeError, verifyExchangeToken, getClientIp } from "./exchange-auth";
import { logSecurityEvent, secureTokenMatch } from "./security-utils";
import { createServer, type Server } from "http";
import { Server as SocketIOServer, Socket } from "socket.io";
import { storage } from "./storage";
import bcrypt from "bcrypt";
import { sql, eq, desc } from "drizzle-orm";
import type { GameState } from "@shared/schema";
import { liveMatchSessions } from "@shared/schema";
import { db } from "./db";
import { sendPayoutNotification } from "./email-config";
import { sendSignupNotification, sendFormSubmissionEmail, sendExchangeEmail, buildPasswordResetHtml } from "./email-service";
import { insertAlertSubscriberSchema, insertExchangeAccountSchema, insertExchangeCreditListingSchema, insertExchangeRfqSchema } from "@shared/schema";
import { alertSubscribers, exchangeCreditListings, exchangeListings, exchangeRfqs, exchangeTrades, retirementUploadTokens, tradeRetirementCertificates } from "@shared/schema";
import multer from "multer";
import path from "path";
import { registerOpsRoutes } from "./ops-routes";
import { registerAutonomousMarketplaceRoutes } from "./autonomous-marketplace";
import fs from "fs";
import PDFDocument from "pdfkit";
import { createSession, getSession, requireAuth } from "./session-middleware";
import { initStripe } from "./stripe-init";
import { WebhookHandlers } from "./webhookHandlers";
import { gameManager, type GameType } from "./game-manager";
import { nanoid } from "nanoid";
import { startCronJobs } from "./cron";
import { generateTradePDF, generateSignatureCertificatePDF } from "./pdf-generator";
import { sendZohoEmail, isZohoConfigured } from "./zoho-mailer";
import { getLivePrices, getPriceHistory } from "./exchange-prices";
import { registerNavigatorRoutes } from "./navigator-routes";

const ALLOWED_REGISTRY_NAMES = ['Verra', 'Gold Standard', 'EU ETS', 'ACR', 'CAR', 'other'] as const;

const partnerListingItemSchema = z.object({
  name: z.string().min(1, 'name is required'),
  standard: z.string().min(1, 'standard must be a non-empty string'),
  pricePerTonne: z.coerce.number().positive('pricePerTonne must be a positive number'),
  volume_tonnes: z.coerce.number().positive('volume_tonnes must be a positive number'),
  registry_serial: z.string().min(1, 'registry_serial is required'),
  registry_name: z.enum(ALLOWED_REGISTRY_NAMES, { errorMap: () => ({ message: `registry_name must be one of: ${ALLOWED_REGISTRY_NAMES.join(', ')}` }) }),
  vintage_year: z.coerce.number().int().min(2010).max(new Date().getFullYear(), { message: `vintage_year must be between 2010 and ${new Date().getFullYear()}` }),
  badgeLabel: z.string().optional(),
  origin: z.string().optional(),
  changePercent: z.coerce.number().optional(),
  changeDirection: z.string().optional(),
});

async function logAdminAction(req: any, type: string, message: string, details?: { affectedRecordId?: string; metadata?: Record<string, any>; critical?: boolean }): Promise<void> {
  const adminKey = String(req.headers['x-admin-key'] || '');
  const adminId = adminKey
    ? createHash('sha256').update(adminKey).digest('hex').slice(0, 16)
    : 'unknown';
  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
  const entry = {
    adminId,
    actionType: type,
    affectedRecordId: details?.affectedRecordId || null,
    notes: message,
    details: details?.metadata ? JSON.stringify(details.metadata) : null,
    ip,
  };
  if (details?.critical) {
    await storage.addAdminActionLog(entry);
  } else {
    storage.addAdminActionLog(entry)
      .catch(err => console.error(`[AUDIT] Failed to write admin log for action ${type}:`, err));
  }
}

function createRetirementUploadToken(): { token: string; tokenHash: string } {
  const token = randomBytes(24).toString('hex');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  return { token, tokenHash };
}


async function sendRetirementUploadRequest(params: {
  tradeId: string;
  volumeTonnes: number;
  standard: string;
  sellerEmail: string;
  pdfBuffer?: Buffer;
  registrySerial?: string;
  registryName?: string;
  vintageYear?: number;
}): Promise<void> {
  if (!params.sellerEmail || !isZohoConfigured()) return;
  try {
    const { token, tokenHash } = createRetirementUploadToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await db.insert(retirementUploadTokens).values({
      tradeId: params.tradeId,
      tokenHash,
      sellerEmail: params.sellerEmail,
      expiresAt,
    }).catch(() => {});
    const uploadUrl = `https://uaiu.live/retire/${params.tradeId}?token=${token}`;
    const regDetails = [
      params.registryName ? `<li><strong>Registry:</strong> ${params.registryName}</li>` : '',
      params.registrySerial ? `<li><strong>Serial:</strong> ${params.registrySerial}</li>` : '',
      params.vintageYear ? `<li><strong>Vintage Year:</strong> ${params.vintageYear}</li>` : '',
    ].join('');
    const html = `<div style="font-family:Arial;background:#060810;color:#f2ead8;padding:24px"><h2 style="color:#d4a843">UAIU.LIVE/X — Retirement Certificate Required</h2><p>Trade <strong>${params.tradeId}</strong> has settled. Please upload your carbon credit retirement certificate within 48 hours.</p><ul><li><strong>Trade ID:</strong> ${params.tradeId}</li><li><strong>Volume:</strong> ${params.volumeTonnes.toLocaleString()} tonnes ${params.standard}</li>${regDetails}<li><strong>Deadline:</strong> ${expiresAt.toISOString().split('T')[0]}</li></ul><p><a href="${uploadUrl}" style="color:#d4a843">Upload Retirement Certificate →</a></p><p style="font-size:11px;color:rgba(242,234,216,0.4)">Link expires in 24 hours. Contact desk@uaiu.live for assistance.</p></div>`;
    await sendZohoEmail(params.sellerEmail, `UAIU Retirement Certificate Required — ${params.tradeId}`, html);
  } catch (e: any) {
    console.error('[sendRetirementUploadRequest]', e.message);
  }
}

function estimateNextStripePayoutDate(from = new Date()): string {
  const next = new Date(from);
  next.setDate(next.getDate() + 2);
  return next.toISOString().split('T')[0];
}

async function sendSellerDestinationPayoutEmail(params: {
  sellerEmail: string;
  tradeId: string;
  payoutAmountEur: number;
  chargeId?: string | null;
}): Promise<void> {
  if (!params.sellerEmail || !isZohoConfigured()) return;
  const expectedPayoutDate = estimateNextStripePayoutDate();
  const html = `<div style="font-family:Arial;background:#060810;color:#f2ead8;padding:24px"><h2 style="color:#d4a843">UAIU.LIVE/X — Seller Payout Confirmed</h2><p>Your payout has been routed by Stripe.</p><ul><li><strong>Trade ID:</strong> ${params.tradeId}</li><li><strong>Payout Amount:</strong> €${params.payoutAmountEur.toFixed(2)}</li><li><strong>Expected Stripe Payout Date:</strong> ${expectedPayoutDate}</li><li><strong>Charge:</strong> ${params.chargeId || 'n/a'}</li></ul><p>Funds were sent using Stripe Connect destination charges. No funds passed through UAIU's account.</p></div>`;
  await sendZohoEmail(params.sellerEmail, `UAIU Seller Payout Confirmed — ${params.tradeId}`, html);
}

// Legacy Pong code removed - all games now use GameManager

// Legacy Pong functions removed - all game logic now in GameManager

let stripeReady = false;
let stripeReadyAt: string | null = null;

async function getMostRecentReceiptHash(): Promise<string> {
  try {
    const rows = await db.execute(
      sql`SELECT receipt_hash FROM exchange_trades WHERE receipt_hash IS NOT NULL AND receipt_hash != '' ORDER BY created_at DESC LIMIT 1`
    );
    const hash = (rows as any).rows?.[0]?.receipt_hash;
    return hash || 'GENESIS_BLOCK_UAIU_CARIBBEAN_CARBON_EXCHANGE';
  } catch {
    return 'GENESIS_BLOCK_UAIU_CARIBBEAN_CARBON_EXCHANGE';
  }
}

const LISTING_CACHE_TTL_MS = 5 * 60 * 1000;
const listingCache = new Map<string, { data: any; expiresAt: number }>();

function getCachedListings(key: string): any | null {
  const entry = listingCache.get(key);
  if (entry && Date.now() < entry.expiresAt) return entry.data;
  if (entry) listingCache.delete(key);
  return null;
}

function setCachedListings(key: string, data: any): void {
  listingCache.set(key, { data, expiresAt: Date.now() + LISTING_CACHE_TTL_MS });
}

export function invalidateListingCache(): void {
  listingCache.clear();
}

async function ensureExchangeIndexes(): Promise<void> {
  const indexes = [
    `CREATE INDEX IF NOT EXISTS idx_exchange_trades_account_email ON exchange_trades (account_email)`,
    `CREATE INDEX IF NOT EXISTS idx_exchange_trades_receipt_hash ON exchange_trades (receipt_hash)`,
    `CREATE INDEX IF NOT EXISTS idx_exchange_trades_status_created ON exchange_trades (status, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_exchange_trades_receipt_notnull ON exchange_trades (created_at DESC, receipt_hash) WHERE receipt_hash IS NOT NULL AND receipt_hash != ''`,
    `CREATE INDEX IF NOT EXISTS idx_exchange_trades_seller_serial_status ON exchange_trades (seller_registry_serial, status)`,
    `CREATE INDEX IF NOT EXISTS idx_exchange_listings_status_standard ON exchange_listings (status, standard)`,
    `CREATE INDEX IF NOT EXISTS idx_exchange_rfqs_email ON exchange_rfqs (email)`,
    `CREATE INDEX IF NOT EXISTS idx_exchange_rfqs_status ON exchange_rfqs (status)`,
    `CREATE INDEX IF NOT EXISTS idx_exchange_rfq_matches_rfq_id ON exchange_rfq_matches (rfq_id)`,
  ];
  for (const stmt of indexes) {
    await db.execute(sql.raw(stmt)).catch((e: any) => console.error('[Index]', e.message));
  }
  console.log('[Indexes] Exchange performance indexes ensured');
}

async function fixKycDefaults(): Promise<void> {
  await db.execute(sql`ALTER TABLE exchange_accounts ALTER COLUMN kyc_status SET DEFAULT 'not_started'`).catch(() => {});
  const result = await db.execute(sql`UPDATE exchange_accounts SET kyc_status = 'not_started' WHERE kyc_status = 'pending' AND kyc_provider_reference IS NULL`);
  const rowCount = (result as any).rowCount ?? 0;
  if (rowCount > 0) {
    console.log(`[KYC Fix] Reset ${rowCount} stuck account(s) from 'pending' to 'not_started'`);
  }
  console.log('[KYC Fix] DB default and stuck accounts verified');
}

export async function registerRoutes(app: Express, httpServer: Server): Promise<void> {
  ensureExchangeIndexes().catch((e: any) => console.error('[Indexes] Failed to ensure indexes:', e.message));
  fixKycDefaults().catch((e: any) => console.error('[KYC Fix] Failed:', e.message));

  const authLoginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 8,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many login attempts. Please try again later.' },
  });

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

  const partnerApiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many partner API requests. Please try again later." },
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

          // ── Verify signature + enforce 300s tolerance BEFORE any processing ──
          // Fail closed: reject immediately if Stripe credentials are not configured.
          const stripeKey = process.env.STRIPE_SECRET_KEY;
          const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
          if (!stripeKey || !webhookSecret) {
            console.error('[Webhook] Stripe key or webhook secret not configured — rejecting');
            return res.status(503).json({ error: 'Webhook endpoint not configured' });
          }

          const { default: Stripe } = await import('stripe');
          const stripe = new Stripe(stripeKey, { apiVersion: '2024-12-18.acacia' as any });

          let verifiedEvent: any;
          try {
            verifiedEvent = stripe.webhooks.constructEvent(req.body as Buffer, sig, webhookSecret, 300);
          } catch (verifyErr: any) {
            console.error('[Webhook] Signature verification failed:', verifyErr.message);
            return res.status(400).json({ error: 'Webhook signature verification failed' });
          }

          const eventAgeSec = Math.floor(Date.now() / 1000) - verifiedEvent.created;
          if (eventAgeSec > 300) {
            console.warn(`[Webhook] Rejecting stale event ${verifiedEvent.id} — age: ${eventAgeSec}s (>300s)`);
            return res.status(400).json({ error: 'Event timestamp too old — rejected' });
          }

          await WebhookHandlers.processWebhook(req.body as Buffer, sig, uuid);

          // ── Escrow + financial event handlers ─────────
          try {
            {
              const event = verifiedEvent;

              // ── Explicit if/else if chain for required event types ──
              if (
                event.type === 'payment_intent.amount_capturable_updated' ||
                (event.type as string) === 'payment_intent.requires_capture'
              ) {
                const pi = event.data.object as any;
                if (pi.metadata?.escrow_type === 'carbon_credit_t1' && pi.status === 'requires_capture') {
                  const trade_id   = pi.metadata?.trade_id || 'unknown';
                  const buyer_email = pi.metadata?.buyer_email || pi.receipt_email || '';
                  const gross      = pi.amount / 100;
                  console.log(`[Escrow T+1] Funds authorized for trade ${trade_id} — PI: ${pi.id} — €${gross}. Settlement in 24h.`);

                  await db.execute(sql`
                    INSERT INTO escrow_settlements_log
                      (trade_id, payment_intent_id, amount_eur, status)
                    VALUES
                      (${trade_id}, ${pi.id}, ${gross}, 'pending_t1')
                    ON CONFLICT (payment_intent_id) DO UPDATE
                      SET status = 'pending_t1'
                  `).catch((e: any) => console.error('[Escrow PG log]', e.message));

                  await (req.app.locals.supabase as any)
                    ?.from('escrow_settlements')
                    .update({ status: 'pending_t1' })
                    .eq('payment_intent_id', pi.id)
                    .catch(() => {});

                  sendExchangeEmail(`Trade ${trade_id} — Funds Authorized (T+1 Hold)`, {
                    'Trade ID':   trade_id,
                    'Gross':      `€${gross.toLocaleString()}`,
                    'Status':     'Funds held — settlement in 24 hours',
                    'PI ID':      pi.id,
                    'Buyer':      buyer_email || 'n/a',
                    'Authorized': new Date().toISOString(),
                  }).catch((e: any) => console.error('[Escrow Email]', e.message));
                }
              } else if (event.type === 'payment_intent.succeeded') {
                const pi = event.data.object as any;
                console.log(`[Webhook] payment_intent.succeeded — PI: ${pi.id}`);
              } else if (event.type === 'payment_intent.payment_failed') {
                const pi = event.data.object as any;
                const trade_id = pi.metadata?.trade_id || 'unknown';
                console.log(`[Webhook] payment_intent.payment_failed — PI: ${pi.id}, trade: ${trade_id}`);

                const failedListingId = pi.metadata?.listing_id;
                if (failedListingId) {
                  await db.execute(sql`
                    UPDATE exchange_listings SET status = 'active'
                    WHERE id = ${failedListingId} AND status = 'reserved'
                  `).catch(() => {});
                  console.log(`[Webhook] payment_intent.payment_failed — restored listing ${failedListingId} to active`);
                }

                await db.execute(sql`
                  UPDATE escrow_settlements_log
                  SET status = 'payment_failed', settled_at = NOW()
                  WHERE payment_intent_id = ${pi.id}
                `).catch(() => {});

                await (req.app.locals.supabase as any)
                  ?.from('escrow_settlements')
                  .update({ status: 'payment_failed' })
                  .eq('payment_intent_id', pi.id)
                  .catch(() => {});

                sendExchangeEmail(`Trade ${trade_id} — Payment Failed`, {
                  'Trade ID':   trade_id,
                  'PI ID':      pi.id,
                  'Status':     'Payment failed — escrow release cancelled',
                  'Reason':     pi.last_payment_error?.message || 'Unknown',
                  'Timestamp':  new Date().toISOString(),
                }).catch(() => {});
              } else if (event.type === 'charge.dispute.created') {
                const dispute = event.data.object as any;
                const disputedPI = dispute.payment_intent;
                const chargeId = dispute.charge;
                console.log(`[Webhook] charge.dispute.created — charge: ${chargeId}, PI: ${disputedPI}`);

                if (disputedPI) {
                  await db.execute(sql`
                    UPDATE escrow_settlements_log
                    SET status = 'dispute_hold', settled_at = NOW()
                    WHERE payment_intent_id = ${disputedPI}
                      AND status IN ('held', 'pending_t1')
                  `).catch(() => {});

                  await (req.app.locals.supabase as any)
                    ?.from('escrow_settlements')
                    .update({ status: 'dispute_hold' })
                    .eq('payment_intent_id', disputedPI)
                    .catch(() => {});

                  try {
                    const disputedPIObj = await stripe.paymentIntents.retrieve(String(disputedPI));
                    if (disputedPIObj.status === 'requires_capture') {
                      await stripe.paymentIntents.cancel(String(disputedPI));
                      console.log(`[Webhook] Cancelled uncaptured PI ${disputedPI} due to dispute`);
                    }
                  } catch (cancelErr: any) {
                    console.error(`[Webhook] Failed to cancel disputed PI ${disputedPI}:`, cancelErr.message);
                  }
                }

                sendExchangeEmail('Dispute Filed — Escrow Hold', {
                  'Charge ID':  chargeId,
                  'PI ID':      disputedPI || 'unknown',
                  'Amount':     `€${((dispute.amount || 0) / 100).toLocaleString()}`,
                  'Reason':     dispute.reason || 'unknown',
                  'Status':     'Escrow release blocked — dispute_hold',
                  'Timestamp':  new Date().toISOString(),
                }).catch(() => {});
              } else if ((event.type as string) === 'transfer.created') {
                const transfer = event.data.object as any;
                console.log(`[Webhook] transfer.created — ${transfer.id}, amount: €${(transfer.amount / 100).toLocaleString()}`);
              } else if (event.type === 'identity.verification_session.verified') {
                const session = event.data.object as any;
                const account_id = session.metadata?.account_id;
                const email      = session.metadata?.email;
                if (account_id) {
                  await db.execute(sql`
                    UPDATE exchange_accounts
                    SET kyc_status = 'verified', kyc_completed_at = NOW(), kyc_provider_reference = ${session.id}
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
              } else if (event.type === 'checkout.session.expired') {
                const expiredCs = event.data.object as any;
                const expiredMeta = expiredCs.metadata || {};
                const expiredListingId = expiredMeta.listing_id;
                if (expiredListingId) {
                  await db.execute(sql`
                    UPDATE exchange_listings SET status = 'active'
                    WHERE id = ${expiredListingId} AND status = 'reserved'
                  `).catch((e: any) => console.error('[Webhook] Failed to restore listing on session expired', e.message));
                  console.log(`[Webhook] checkout.session.expired — restored listing ${expiredListingId} to active`);
                }
              } else if (event.type === 'checkout.session.completed') {
                const cs = event.data.object as any;
                const meta = cs.metadata || {};
                const tradeId     = meta.trade_id || cs.id;
                const standard    = meta.standard || 'Carbon Credit';
                const volumeT     = parseFloat(meta.volume_tonnes || '0');
                const pricePerT   = parseFloat(meta.price_per_tonne || '0');
                const side        = meta.side || 'BUY';
                const email       = meta.email || cs.customer_email || '';
                const grossEur    = Number(meta.gross_eur || ((cs.amount_total || 0) / 100));
                const feeEur      = Number(meta.fee_eur || (grossEur * 0.0075));
                const paymentModel = String(meta.payment_model || 'platform_collect');
                const settled_at  = new Date().toISOString();
                const receiptData = `${tradeId}:${cs.id}:${grossEur}:${settled_at}`;
                const receiptHash = createHash('sha256').update(receiptData).digest('hex');
                const prevReceiptHashVal = await getMostRecentReceiptHash();
                const webhookListingId = meta.listing_id || null;

                let sellerEmail = '';
                let destinationTransferId = '';
                if (meta.seller_profile_id) {
                  const sellerProfileLookup = await db.execute(sql`
                    SELECT exchange_account_email
                    FROM seller_profiles
                    WHERE id = ${meta.seller_profile_id}
                    LIMIT 1
                  `).catch(() => ({ rows: [] } as any));
                  sellerEmail = (sellerProfileLookup as any).rows?.[0]?.exchange_account_email || '';
                }

                if (webhookListingId) {
                  await db.execute(sql`
                    UPDATE exchange_listings SET status = 'sold'
                    WHERE id = ${webhookListingId} AND status IN ('reserved', 'active')
                  `).catch((e: any) => console.error('[Webhook] Failed to mark listing as sold', e.message));
                  invalidateListingCache();
                }

                try {
                  await storage.createExchangeTrade({
                    accountEmail:    email,
                    tradeId,
                    side,
                    standard,
                    volumeTonnes:    volumeT,
                    pricePerTonne:   pricePerT,
                    grossEur,
                    feeEur,
                    receiptHash,
                    prevReceiptHash: prevReceiptHashVal,
                    sellerProfileId: meta.seller_profile_id || null,
                    listingId:       webhookListingId,
                    stripeSessionId: cs.id,
                    buyerRegistryAccountId: meta.buyer_registry_account_id || null,
                    buyerRegistryName: meta.buyer_registry_name || null,
                    sellerEmail:     sellerEmail || null,
                    sellerRegistryName: meta.seller_registry_name || null,
                    sellerRegistrySerial: meta.seller_registry_serial || null,
                    vintageYear: meta.vintage_year ? Number(meta.vintage_year) : null,
                    paymentModel:    paymentModel,
                    status:          'completed',
                  });

                  if (paymentModel === 'destination_charge' && cs.payment_intent) {
                    try {
                      const pi = await stripe.paymentIntents.retrieve(String(cs.payment_intent), { expand: ['latest_charge.transfer'] });
                      const latestCharge: any = pi.latest_charge as any;
                      destinationTransferId = typeof latestCharge?.transfer === 'string'
                        ? latestCharge.transfer
                        : latestCharge?.transfer?.id || '';
                    } catch (err: any) {
                      console.error('[Exchange Checkout] Failed to expand destination transfer', err.message);
                    }
                  }

                  if (meta.seller_profile_id) {
                    await db.execute(sql`
                      INSERT INTO seller_payouts (
                        trade_id, seller_profile_id, seller_email,
                        gross_eur, fee_eur, seller_net_eur,
                        payout_status, payout_provider, payout_reference,
                        settlement_method, stripe_destination_charge_id, stripe_transfer_id, released_at
                      ) VALUES (
                        ${tradeId},
                        ${meta.seller_profile_id},
                        ${sellerEmail || null},
                        ${grossEur},
                        ${feeEur},
                        ${grossEur - feeEur},
                        ${paymentModel === 'destination_charge' ? 'paid' : 'pending_release'},
                        ${paymentModel === 'destination_charge' ? 'stripe_destination' : 'workflow_only'},
                        ${paymentModel === 'destination_charge' ? (destinationTransferId || String(cs.payment_intent || cs.id)) : null},
                        ${paymentModel},
                        ${String(cs.payment_intent || '')},
                        ${destinationTransferId || null},
                        ${paymentModel === 'destination_charge' ? new Date() : null}
                      )
                    `);
                  }

                  if (paymentModel === 'destination_charge' && sellerEmail) {
                    await sendSellerDestinationPayoutEmail({
                      sellerEmail,
                      tradeId,
                      payoutAmountEur: grossEur - feeEur,
                      chargeId: String(cs.payment_intent || ''),
                    });
                  }

                  if (sellerEmail && tradeId) {
                    const uploadToken = nanoid(40);
                    const uploadTokenHash = createHash('sha256').update(uploadToken).digest('hex');
                    await db.execute(sql`
                      INSERT INTO retirement_upload_tokens (trade_id, seller_email, token_hash, created_at)
                      VALUES (${tradeId}, ${sellerEmail}, ${uploadTokenHash}, NOW())
                      ON CONFLICT DO NOTHING
                    `);
                    const retireUrl = `https://uaiu.live/retire/${encodeURIComponent(tradeId)}?token=${encodeURIComponent(uploadToken)}`;
                    if (isZohoConfigured()) {
                      const regMeta = [
                        meta.seller_registry_name ? `<li><strong>Registry:</strong> ${meta.seller_registry_name}</li>` : '',
                        meta.seller_registry_serial ? `<li><strong>Serial:</strong> ${meta.seller_registry_serial}</li>` : '',
                      ].join('');
                      const retireHtml = `<div style="font-family:Arial;background:#060810;color:#f2ead8;padding:24px"><h2 style="color:#d4a843">UAIU.LIVE/X — Upload Retirement Certificate</h2><p>A completed trade now needs retirement evidence.</p><ul><li><strong>Trade ID:</strong> ${tradeId}</li><li><strong>Volume:</strong> ${volumeT.toLocaleString()} tCO₂e ${standard}</li>${regMeta}<li><strong>Window:</strong> Due within 48 hours</li></ul><p><a href="${retireUrl}" style="color:#d4a843">Upload Retirement Certificate →</a></p><p style="font-size:11px;color:rgba(242,234,216,0.4)">This link is one-time use. Contact desk@uaiu.live for assistance.</p></div>`;
                      await sendZohoEmail(sellerEmail, `Retirement certificate upload required — ${tradeId}`, retireHtml);
                    }
                  }

                  const pdfBuffer = await generateTradePDF({
                    trade_id:            tradeId,
                    side,
                    standard,
                    volume_tonnes:       volumeT,
                    price_eur_per_tonne: pricePerT,
                    gross_eur:           grossEur,
                    fee_eur:             feeEur,
                    receipt_hash:        receiptHash,
                    prev_receipt_hash:   prevReceiptHashVal,
                    payment_intent_id:   cs.payment_intent || '',
                    stripe_charge_id:    '',
                    settled_at,
                    buyer_email:         email,
                    seller_email:        sellerEmail || undefined,
                    buyer_registry_account_id: meta.buyer_registry_account_id || '',
                    buyer_registry_name: meta.buyer_registry_name || '',
                    seller_registry_name: meta.seller_registry_name || '',
                    seller_registry_serial: meta.seller_registry_serial || '',
                    vintage_year: meta.vintage_year ? Number(meta.vintage_year) : undefined,
                  });
                  const recipients = ['info@uaiu.live'];
                  if (email && email !== 'info@uaiu.live') recipients.push(email);
                  const attachment = [{ filename: `UAIU-Trade-${tradeId}.pdf`, content: pdfBuffer, contentType: 'application/pdf' }];
                  const emailHtml = `<div style="font-family:Arial;background:#0d1220;color:#e8dcc8;padding:28px;border:1px solid #d4a843"><h2 style="color:#d4a843;font-family:Georgia">UAIU.LIVE/X — Trade Confirmed</h2><p>Your trade <strong>${tradeId}</strong> has been executed successfully.</p><table style="width:100%;border-collapse:collapse;margin:16px 0"><tr><td style="padding:8px;color:#9b9b7a">Standard:</td><td style="padding:8px;color:#e8dcc8"><strong>${standard}</strong></td></tr><tr><td style="padding:8px;color:#9b9b7a">Volume:</td><td style="padding:8px;color:#e8dcc8"><strong>${volumeT.toLocaleString()} tCO₂e</strong></td></tr><tr><td style="padding:8px;color:#9b9b7a">Gross:</td><td style="padding:8px;color:#d4a843"><strong>€${grossEur.toLocaleString()}</strong></td></tr><tr><td style="padding:8px;color:#9b9b7a">Settlement:</td><td style="padding:8px;color:#e8dcc8">T+1 (next business day)</td></tr></table><p style="font-size:12px;color:#9b9b7a">Receipt Hash: ${receiptHash.slice(0, 32)}...</p><p style="font-size:12px;color:#9b9b7a">UAIU Exchange · info@uaiu.live</p></div>`;
                  await sendZohoEmail(recipients.join(','), `UAIU Trade Confirmation — ${tradeId}`, emailHtml, attachment);
                } catch (postPaymentErr: any) {
                  console.error(`[Webhook] Post-payment failure for trade ${tradeId}:`, postPaymentErr.message);
                  await db.execute(sql`
                    INSERT INTO exchange_trades (
                      account_email, trade_id, side, standard, volume_tonnes,
                      price_per_tonne, gross_eur, fee_eur, receipt_hash,
                      prev_receipt_hash, seller_profile_id, listing_id,
                      stripe_session_id, seller_email, payment_model, status
                    ) VALUES (
                      ${email}, ${tradeId}, ${side}, ${standard}, ${volumeT},
                      ${pricePerT}, ${grossEur}, ${feeEur}, ${receiptHash},
                      ${prevReceiptHashVal}, ${meta.seller_profile_id || null}, ${webhookListingId},
                      ${cs.id}, ${sellerEmail || null}, ${paymentModel}, 'registry_pending_review'
                    )
                    ON CONFLICT (trade_id) DO UPDATE
                    SET status = 'registry_pending_review'
                  `).catch(() => {});
                  sendExchangeEmail('Post-Payment Failure — Trade Needs Review', {
                    'Trade ID':  tradeId,
                    'Buyer':     email,
                    'Gross':     `EUR ${grossEur}`,
                    'Error':     postPaymentErr.message,
                    'Status':    'registry_pending_review',
                    'Action':    'Manual review required — payment succeeded but post-payment step failed',
                    'Timestamp': new Date().toISOString(),
                  }).catch(() => {});
                }

                console.log(`[Exchange Checkout] Trade ${tradeId} completed via Stripe. Model: ${paymentModel}. Gross: EUR${grossEur}`);
              } else if (event.type === 'account.updated') {
                const acct = event.data.object as any;
                const accountId = acct.id;
                const detailsSubmitted = !!acct.details_submitted;
                const payoutsEnabled = !!acct.payouts_enabled;
                if (accountId) {
                  await db.execute(sql`
                    UPDATE seller_profiles
                    SET connect_onboarding_complete = ${detailsSubmitted && payoutsEnabled},
                        connect_details_submitted = ${detailsSubmitted},
                        updated_at = NOW()
                    WHERE stripe_connect_account_id = ${accountId}
                  `).catch((e: any) => console.error('[Connect account.updated]', e.message));
                  console.log('[Connect] account.updated - ' + accountId + ' ready=' + (detailsSubmitted && payoutsEnabled));
                }
              } else if ((event.type as string) === 'transfer.paid') {
                const transfer = event.data.object as any;
                await db.execute(sql`
                  UPDATE seller_payouts
                  SET payout_status = 'paid', released_at = NOW()
                  WHERE payout_reference = ${transfer.id} OR stripe_transfer_id = ${transfer.id}
                `).catch((e: any) => console.error('[Connect transfer.paid]', e.message));
                console.log('[Connect] transfer.paid - ' + transfer.id);
              } else if ((event.type as string) === 'transfer.failed') {
                const transfer = event.data.object as any;
                const reason = transfer.failure_message || 'Transfer failed';
                await db.execute(sql`
                  UPDATE seller_payouts
                  SET payout_status = 'failed', failure_reason = ${reason}
                  WHERE payout_reference = ${transfer.id} OR stripe_transfer_id = ${transfer.id}
                `).catch((e: any) => console.error('[Connect transfer.failed]', e.message));
                await db.execute(sql`
                  INSERT INTO exchange_exception_queue
                    (entity_type, entity_id, severity, status, code, message, detail)
                  VALUES ('transfer', ${transfer.id}, 'high', 'open', 'transfer_failed',
                    ${reason}, ${JSON.stringify({ transferId: transfer.id })}::jsonb)
                `).catch((e: any) => console.error('[Connect transfer.failed exception]', e.message));
                console.log('[Connect] transfer.failed - ' + transfer.id + ': ' + reason);
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

    // ── Secondary Stripe webhook endpoint (no UUID — signature is the sole gate) ─
    // Mirrors the same raw-body verification + 300s tolerance + explicit handlers.
    // Register this path in Stripe Dashboard as a fallback endpoint.
    app.post(
      '/api/stripe/webhook',
      express.raw({ type: 'application/json' }),
      async (req, res) => {
        const signature = req.headers['stripe-signature'];
        if (!signature) return res.status(400).json({ error: 'Missing stripe-signature' });

        try {
          const sig = Array.isArray(signature) ? signature[0] : signature;
          if (!Buffer.isBuffer(req.body)) {
            return res.status(500).json({ error: 'Webhook processing error — body not buffered' });
          }

          const stripeKey2    = process.env.STRIPE_SECRET_KEY;
          const webhookSecret2 = process.env.STRIPE_WEBHOOK_SECRET;
          if (!stripeKey2 || !webhookSecret2) {
            return res.status(503).json({ error: 'Stripe not configured' });
          }

          const { default: Stripe2 } = await import('stripe');
          const stripe2 = new Stripe2(stripeKey2, { apiVersion: '2024-12-18.acacia' as any });

          // Verify signature + enforce 300s tolerance BEFORE any processing
          let event2: any;
          try {
            event2 = stripe2.webhooks.constructEvent(req.body as Buffer, sig, webhookSecret2, 300);
          } catch (verifyErr: any) {
            console.error('[Webhook-Secondary] Signature verification failed:', verifyErr.message);
            return res.status(400).json({ error: 'Webhook signature verification failed' });
          }

          const eventAgeSec2 = Math.floor(Date.now() / 1000) - event2.created;
          if (eventAgeSec2 > 300) {
            console.warn(`[Webhook-Secondary] Rejecting stale event ${event2.id} — age: ${eventAgeSec2}s`);
            return res.status(400).json({ error: 'Event timestamp too old — rejected' });
          }

          // Delegate generic processing (product/price/subscription sync etc.)
          await WebhookHandlers.processWebhook(req.body as Buffer, sig, '').catch(() => {});

          // ── Explicit financial event handlers (mirror of primary endpoint) ──
          if (
            event2.type === 'payment_intent.amount_capturable_updated' ||
            (event2.type as string) === 'payment_intent.requires_capture'
          ) {
            const pi2 = event2.data.object as any;
            if (pi2.metadata?.escrow_type === 'carbon_credit_t1' && pi2.status === 'requires_capture') {
              const trade_id2   = pi2.metadata?.trade_id || 'unknown';
              const gross2      = pi2.amount / 100;
              console.log(`[Webhook-Secondary] T+1 escrow authorized — trade ${trade_id2} PI ${pi2.id}`);
              await db.execute(sql`
                INSERT INTO escrow_settlements_log (trade_id, payment_intent_id, amount_eur, status)
                VALUES (${trade_id2}, ${pi2.id}, ${gross2}, 'pending_t1')
                ON CONFLICT (payment_intent_id) DO UPDATE SET status = 'pending_t1'
              `).catch((e: any) => console.error('[Webhook-Secondary escrow log]', e.message));
            }
          } else if (event2.type === 'payment_intent.succeeded') {
            const pi2 = event2.data.object as any;
            console.log(`[Webhook-Secondary] payment_intent.succeeded — PI: ${pi2.id}`);
          } else if (event2.type === 'checkout.session.expired') {
            const expiredCs2 = event2.data.object as any;
            const expiredListingId2 = expiredCs2.metadata?.listing_id;
            if (expiredListingId2) {
              await db.execute(sql`
                UPDATE exchange_listings SET status = 'active'
                WHERE id = ${expiredListingId2} AND status = 'reserved'
              `).catch(() => {});
              console.log(`[Webhook-Secondary] checkout.session.expired — restored listing ${expiredListingId2} to active`);
            }
          } else if (event2.type === 'payment_intent.payment_failed') {
            const pi2 = event2.data.object as any;
            const trade_id2 = pi2.metadata?.trade_id || 'unknown';
            console.log(`[Webhook-Secondary] payment_intent.payment_failed — PI: ${pi2.id} trade: ${trade_id2}`);
            const failedListingId2 = pi2.metadata?.listing_id;
            if (failedListingId2) {
              await db.execute(sql`
                UPDATE exchange_listings SET status = 'active'
                WHERE id = ${failedListingId2} AND status = 'reserved'
              `).catch(() => {});
            }
            await db.execute(sql`
              UPDATE escrow_settlements_log
              SET status = 'payment_failed', settled_at = NOW()
              WHERE payment_intent_id = ${pi2.id}
            `).catch(() => {});
            sendExchangeEmail(`Trade ${trade_id2} — Payment Failed (secondary)`, {
              'Trade ID':  trade_id2,
              'PI ID':     pi2.id,
              'Status':    'Payment failed — escrow release cancelled',
              'Reason':    pi2.last_payment_error?.message || 'Unknown',
              'Timestamp': new Date().toISOString(),
            }).catch(() => {});
          } else if (event2.type === 'charge.dispute.created') {
            const dispute2   = event2.data.object as any;
            const disputedPI2 = dispute2.payment_intent;
            console.log(`[Webhook-Secondary] charge.dispute.created — PI: ${disputedPI2}`);
            if (disputedPI2) {
              await db.execute(sql`
                UPDATE escrow_settlements_log
                SET status = 'dispute_hold', settled_at = NOW()
                WHERE payment_intent_id = ${disputedPI2}
                  AND status IN ('held', 'pending_t1')
              `).catch(() => {});
              try {
                const dpi = await stripe2.paymentIntents.retrieve(String(disputedPI2));
                if (dpi.status === 'requires_capture') {
                  await stripe2.paymentIntents.cancel(String(disputedPI2));
                  console.log(`[Webhook-Secondary] Cancelled uncaptured PI ${disputedPI2} due to dispute`);
                }
              } catch (cancelErr2: any) {
                console.error(`[Webhook-Secondary] Failed to cancel disputed PI:`, cancelErr2.message);
              }
              sendExchangeEmail('Dispute Filed — Escrow Hold (secondary)', {
                'PI ID':    disputedPI2 || 'unknown',
                'Amount':   `€${((dispute2.amount || 0) / 100).toLocaleString()}`,
                'Reason':   dispute2.reason || 'unknown',
                'Status':   'dispute_hold',
                'Timestamp': new Date().toISOString(),
              }).catch(() => {});
            }
          } else if (event2.type === 'checkout.session.completed') {
            const cs2 = event2.data.object as any;
            const meta2 = cs2.metadata || {};
            const completedListingId2 = meta2.listing_id;
            if (completedListingId2) {
              await db.execute(sql`
                UPDATE exchange_listings SET status = 'sold'
                WHERE id = ${completedListingId2} AND status IN ('reserved', 'active')
              `).catch((e: any) => console.error('[Webhook-Secondary] Failed to mark listing as sold', e.message));
              console.log(`[Webhook-Secondary] checkout.session.completed — marked listing ${completedListingId2} as sold`);
            }
          } else if ((event2.type as string) === 'transfer.created') {
            const transfer2 = event2.data.object as any;
            console.log(`[Webhook-Secondary] transfer.created — ${transfer2.id} €${(transfer2.amount / 100).toLocaleString()}`);
          } else if (event2.type === 'identity.verification_session.verified') {
            const session2      = event2.data.object as any;
            const account_id2   = session2.metadata?.account_id;
            const kycEmail2     = session2.metadata?.email;
            if (account_id2) {
              await db.execute(sql`
                UPDATE exchange_accounts
                SET kyc_status = 'verified', kyc_completed_at = NOW(), kyc_provider_reference = ${session2.id}
                WHERE id = ${account_id2}
              `).catch((e: any) => console.error('[Webhook-Secondary KYC]', e.message));
              if (kycEmail2) {
                sendExchangeEmail('KYC Verified — Account Active (secondary)', {
                  'Account ID': account_id2,
                  'Email':      kycEmail2,
                  'Status':     'VERIFIED — Trading enabled',
                  'Verified At': new Date().toISOString(),
                }).catch(() => {});
              }
            }
          }

          res.status(200).json({ received: true });
        } catch (err: any) {
          console.error('[Webhook-Secondary] Error:', err.message);
          res.status(400).json({ error: 'Webhook processing error' });
        }
      }
    );
    console.log(`✅ Secondary Stripe webhook registered at /api/stripe/webhook`);
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

  app.post('/api/auth/login', authLoginLimiter, async (req, res) => {
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



  const ledgerHandler = async (req: any, res: any) => {
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(String(req.query.limit || '50'), 10) || 50));
    const offset = (page - 1) * limit;
    const totalsRes = await db.execute(sql`
      SELECT
        COUNT(*)::int AS trades,
        COALESCE(SUM(CASE WHEN status = 'retired' THEN volume_tonnes ELSE 0 END), 0)::float AS retired_tco2e,
        COALESCE(SUM(gross_eur), 0)::float AS total_volume_eur
      FROM exchange_trades
    `);
    const rowsRes = await db.execute(sql`
      SELECT trade_id, created_at, standard, seller_registry_name, vintage_year, volume_tonnes, price_per_tonne, status
      FROM exchange_trades
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `);
    const totals = (totalsRes as any).rows?.[0] || {};
    const total = Number(totals.trades || 0);
    const pages = Math.ceil(total / limit) || 1;
    const entries = ((rowsRes as any).rows || []).map((r: any) => {
      const p = Number(r.price_per_tonne || 0);
      const low = Math.max(0, p - 1).toFixed(0);
      const high = (p + 1).toFixed(0);
      return {
        tradeId: String(r.trade_id || ''),
        timestamp: r.created_at,
        creditType: String(r.standard || 'Carbon Credit'),
        registry: String(r.seller_registry_name || 'Registry'),
        vintage: String(r.vintage_year || 'N/A'),
        volumeTco2e: Number(r.volume_tonnes || 0),
        priceRange: `$${low}-${high}/tonne`,
        framework: String(r.standard || '').includes('CORSIA') ? 'CORSIA' : (String(r.standard || '').includes('EU ETS') ? 'EU ETS' : 'Voluntary'),
      };
    });

    return res.json({
      totals: {
        trades: total,
        retiredTco2e: Number(totals.retired_tco2e || 0),
        totalVolumeEur: Number(totals.total_volume_eur || 0),
      },
      trades: entries,
      entries,
      page,
      pages,
      total,
    });
  };
  app.get('/api/public/ledger', ledgerHandler);
  app.get('/api/exchange/ledger', ledgerHandler);

  app.get('/api/public/index', async (_req, res) => {
    const weekly = await db.execute(sql`
      SELECT standard,
             AVG(price_per_tonne)::float AS avg_price,
             COUNT(*)::int AS trades,
             COALESCE(SUM(volume_tonnes), 0)::float AS volume,
             MIN(price_per_tonne)::float AS low,
             MAX(price_per_tonne)::float AS high
      FROM exchange_trades
      WHERE created_at >= NOW() - INTERVAL '14 days'
      GROUP BY standard
    `);

    const rows = (weekly as any).rows || [];
    const bucket = (name: string, matcher: (s: string) => boolean) => {
      const f = rows.filter((r: any) => matcher(String(r.standard || '')));
      const trades = f.reduce((a: number, b: any) => a + Number(b.trades || 0), 0);
      const volume = f.reduce((a: number, b: any) => a + Number(b.volume || 0), 0);
      const thisWeek = f.length ? f.reduce((a: number, b: any) => a + Number(b.avg_price || 0), 0) / f.length : 0;
      const lastWeek = thisWeek * 0.97;
      const low = f.length ? Math.min(...f.map((x: any) => Number(x.low || 0))) : 0;
      const high = f.length ? Math.max(...f.map((x: any) => Number(x.high || 0))) : 0;
      return { name, thisWeek, lastWeek, changePct: lastWeek ? ((thisWeek - lastWeek) / lastWeek) * 100 : 0, volume, trades, range: `$${low.toFixed(1)}-$${high.toFixed(1)}` };
    };

    return res.json({
      indices: [
        bucket('UAIU Nature-Based Index (NBI)', (s) => /VCS|REDD|ARR|Blue/i.test(s)),
        bucket('UAIU Removal Index (RI)', (s) => /DAC|BECCS|ERW|Biochar/i.test(s)),
        bucket('UAIU CORSIA Eligible Index (CEI)', (s) => /CORSIA/i.test(s)),
        bucket('UAIU Maritime Compliance Index (MCI)', (s) => /EU ETS|Maritime/i.test(s)),
      ],
    });
  });

  app.get('/api/public/corsia-programs', async (_req, res) => {
    return res.json({
      lastUpdated: new Date().toISOString().split('T')[0],
      programs: [
        { program: 'Verra VCS', registry: 'Verra', phase1: 'Yes', phase2: 'Yes', approvedAt: '2020-03-13', notes: 'Subject to ICAO conditions by methodology/vintage.' },
        { program: 'Gold Standard', registry: 'Gold Standard', phase1: 'Yes', phase2: 'Yes', approvedAt: '2020-03-13', notes: 'Check latest ICAO update for scope limitations.' },
        { program: 'ART TREES', registry: 'ART', phase1: 'Yes', phase2: 'Pending', approvedAt: '2024-10-01', notes: 'Sovereign-scale jurisdictional REDD+ programs.' },
      ],
    });
  });

  app.get('/api/public/retirement-counter', async (_req, res) => {
    const rows = await db.execute(sql`SELECT COUNT(*)::int AS retired_count, COALESCE(SUM(volume_tonnes), 0)::float AS retired_volume FROM exchange_trades WHERE status = 'retired'`);
    return res.json({
      retiredCount: Number((rows as any).rows?.[0]?.retired_count || 0),
      retiredVolume: Number((rows as any).rows?.[0]?.retired_volume || 0),
    });
  });

  app.get('/api/alerts/public-deadlines', async (_req, res) => {
    const now = new Date();
    const deadlines = [
      { framework: 'EU ETS Maritime', dueDate: '2026-04-30' },
      { framework: 'CORSIA', dueDate: '2026-05-15' },
      { framework: 'FuelEU Maritime', dueDate: '2026-08-31' },
      { framework: 'CBAM', dueDate: '2026-10-31' },
      { framework: 'UK ETS', dueDate: '2026-12-31' },
      { framework: 'SEC Climate Disclosure', dueDate: '2027-01-31' },
    ].map((d) => ({
      ...d,
      daysRemaining: Math.max(0, Math.ceil((new Date(d.dueDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))),
    }));

    return res.json({ deadlines });
  });

  app.post('/api/alerts/subscribe', async (req, res) => {
    try {
      const parsed = insertAlertSubscriberSchema.safeParse({
        email: String(req.body?.email || '').trim().toLowerCase(),
        organization: String(req.body?.organization || '').trim(),
        sector: String(req.body?.sector || '').trim(),
        frameworks: Array.isArray(req.body?.frameworks) ? req.body.frameworks : [],
        alertTiming: Array.isArray(req.body?.alertTiming) ? req.body.alertTiming : [],
        source: req.body?.source ? String(req.body.source) : 'public_alerts_page',
        confirmToken: randomBytes(24).toString('hex'),
        unsubscribeToken: randomBytes(24).toString('hex'),
        confirmed: false,
      });

      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid subscription payload.' });
      }

      const existing = await db
        .select({ id: alertSubscribers.id })
        .from(alertSubscribers)
        .where(sql`lower(${alertSubscribers.email}) = lower(${parsed.data.email})`)
        .limit(1);

      if (existing.length > 0) {
        return res.status(200).json({ ok: true, message: 'Already subscribed. Please confirm via email if pending.' });
      }

      await db.insert(alertSubscribers).values(parsed.data);

      const confirmUrl = `https://uaiu.live/api/alerts/confirm?token=${parsed.data.confirmToken}`;
      if (isZohoConfigured()) {
        const html = `<div style="font-family:Arial;background:#060810;color:#f2ead8;padding:24px"><h2 style="color:#d4a843">Confirm your UAIU compliance deadline alerts</h2><p>Please confirm your subscription by clicking below.</p><p><a style="color:#d4a843" href="${confirmUrl}">Confirm alerts</a></p><p style="font-size:11px;color:rgba(242,234,216,0.5)">UAIU.LIVE/X · info@uaiu.live</p></div>`;
        await sendZohoEmail(parsed.data.email, 'Confirm your UAIU compliance deadline alerts', html);
      }

      return res.status(201).json({ ok: true });
    } catch (error: any) {
      return res.status(500).json({ error: safeError(error, 'Failed to subscribe.') });
    }
  });

  app.get('/api/alerts/confirm', async (req, res) => {
    const token = String(req.query?.token || '');
    if (!token) return res.status(400).send('Missing token');

    await db
      .update(alertSubscribers)
      .set({ confirmed: true, updatedAt: new Date() })
      .where(eq(alertSubscribers.confirmToken, token));

    return res.redirect('/alerts?confirmed=1');
  });

  app.get('/api/exchange/listings', async (req, res) => {
    try {
      const standard = req.query.standard as string | undefined;
      const cacheKey = `listings:${standard || 'ALL'}`;
      const cached = getCachedListings(cacheKey);
      if (cached) return res.json(cached);
      let listings = await storage.getExchangeListings(standard);
      if (listings.length === 0 && !exchangeSeeded) {
        exchangeSeeded = true;
        await storage.seedExchangeListings(EXCHANGE_SEED_LISTINGS);
        listings = await storage.getExchangeListings(standard);
      }
      setCachedListings(cacheKey, listings);
      res.json(listings);
    } catch (error) {
      console.error('Exchange listings error:', error);
      res.status(500).json({ message: 'Failed to fetch listings' });
    }
  });

  app.get('/api/exchange/listings/:standard', async (req, res) => {
    try {
      const standard = req.params.standard;
      const cacheKey = `listings-by-standard:${standard}`;
      const cached = getCachedListings(cacheKey);
      if (cached) return res.json(cached);
      const listings = await storage.getExchangeListingsByStandard(standard);
      setCachedListings(cacheKey, listings);
      res.json(listings);
    } catch (error) {
      console.error('Exchange listings by standard error:', error);
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
      res.json({ ...account, token });
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
      return res.json(account);
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
      const normalizedEmail = email.trim().toLowerCase();
      const account = await storage.getExchangeAccountByEmail(normalizedEmail);
      if (!account) return res.status(404).json({ error: 'Account not found.' });
      if (account.passwordHash) {
        const token = String(req.headers['x-exchange-token'] || '').trim();
        if (!token) return res.status(401).json({ error: 'Authentication required to change an existing password.' });
        const session = await verifyExchangeToken(token);
        if (!session || String(session.email).toLowerCase() !== normalizedEmail) {
          return res.status(403).json({ error: 'Not authorized to change this password.' });
        }
      }
      const hash = await bcrypt.hash(password, 12);
      await storage.updateExchangeAccountPassword(normalizedEmail, hash);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: safeError(e) });
    }
  });

  // ── EXCHANGE: Forgot password ────────────────────────────────────────────
  app.post('/api/exchange/account/forgot-password', async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) return res.status(400).json({ error: 'Email is required.' });
      const normalizedEmail = email.trim().toLowerCase();
      const account = await storage.getExchangeAccountByEmail(normalizedEmail);
      if (!account) {
        return res.json({ success: true });
      }
      const token = randomBytes(32).toString('hex');
      const tokenHash = createHash('sha256').update(token).digest('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
      await db.execute(sql`
        INSERT INTO password_reset_tokens (email, token_hash, expires_at)
        VALUES (${normalizedEmail}, ${tokenHash}, ${expiresAt})
      `);
      const baseUrl = process.env.APP_BASE_URL || 'https://uaiu.live';
      const resetLink = `${baseUrl}/x/reset-password?token=${token}`;
      const resetHtml = buildPasswordResetHtml(resetLink);
      await sendExchangeEmail('Password Reset', {}, { to: normalizedEmail, customHtml: resetHtml });
      await logSecurityEvent({ email: normalizedEmail, eventType: 'password_reset_requested', req });
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: safeError(e) });
    }
  });

  // ── EXCHANGE: Reset password ───────────────────────────────────────────
  app.post('/api/exchange/account/reset-password', async (req, res) => {
    try {
      const { token, newPassword } = req.body;
      if (!token || !newPassword) return res.status(400).json({ error: 'Token and new password are required.' });
      if (newPassword.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });
      const tokenHash = createHash('sha256').update(token).digest('hex');
      const lookup = await db.execute(sql`
        SELECT id, email, token_hash, expires_at, used_at
        FROM password_reset_tokens
        WHERE token_hash = ${tokenHash}
        LIMIT 1
      `);
      const record = ((lookup as any).rows || [])[0];
      if (!record) return res.status(400).json({ error: 'Invalid or expired reset link.' });
      if (record.used_at) return res.status(400).json({ error: 'This reset link has already been used.' });
      if (new Date(record.expires_at) < new Date()) return res.status(400).json({ error: 'This reset link has expired. Please request a new one.' });
      if (!secureTokenMatch(token, record.token_hash)) {
        return res.status(400).json({ error: 'Invalid or expired reset link.' });
      }
      const consumed = await db.execute(sql`
        UPDATE password_reset_tokens
        SET used_at = NOW()
        WHERE id = ${record.id} AND used_at IS NULL
        RETURNING email
      `);
      const rows = (consumed as any).rows || [];
      if (!rows.length) return res.status(400).json({ error: 'This reset link has already been used.' });
      const email = rows[0].email;
      const passwordHash = await bcrypt.hash(newPassword, 12);
      await storage.updateExchangeAccountPassword(email, passwordHash);
      const sessionToken = await createExchangeSession(email);
      await logSecurityEvent({ email, eventType: 'password_reset_completed', req });
      res.json({ success: true, token: sessionToken });
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

  // ── EXCHANGE: Update buyer registry account ───────────────────────────────
  app.patch('/api/exchange/account/registry', requireExchangeAuth, async (req, res) => {
    try {
      const email = (req as any).exchangeEmail;
      const { registryAccountId, registryName } = req.body;
      await db.execute(sql`
        UPDATE exchange_accounts
        SET registry_account_id = ${registryAccountId ? String(registryAccountId).trim() : null},
            registry_name = ${registryName ? String(registryName).trim() : null}
        WHERE email = ${email}
      `);
      const updated = await storage.getExchangeAccountByEmail(email);
      res.json(updated || { success: true });
    } catch (e: any) {
      res.status(500).json({ error: safeError(e) });
    }
  });

  // ── EXCHANGE: Spot trade Stripe Checkout ──────────────────────────────────
  app.post('/api/exchange/spot-checkout', requireExchangeAuth, exchangeCheckoutLimiter, async (req, res) => {
    let reservedListingId: string | null = null;
    try {
      const email = (req as any).exchangeEmail;
      const { standard, volumeTonnes, pricePerTonne, tradeId, side, registryAccountId, registryName, ddAcknowledged } = req.body;
      if (!standard || !volumeTonnes || !tradeId) {
        return res.status(400).json({ error: 'Missing required fields' });
      }
      if (!ddAcknowledged) {
        return res.status(400).json({ error: 'AI due diligence report must be reviewed before executing a trade. Acknowledge by setting ddAcknowledged: true after reviewing.' });
      }
      const account = await storage.getExchangeAccountByEmail(email);
      if (!account || account.kycStatus !== 'verified') {
        return res.status(403).json({ error: 'KYC verification required.' });
      }
      const buyerRegistryAccountId = registryAccountId || (account as any).registryAccountId || '';
      const buyerRegistryName = registryName || (account as any).registryName || '';
      if (registryAccountId || registryName) {
        await db.execute(sql`
          UPDATE exchange_accounts
          SET registry_account_id = ${buyerRegistryAccountId || null},
              registry_name = ${buyerRegistryName || null}
          WHERE email = ${email}
        `).catch(() => {});
      }
      const listings = await storage.getExchangeListingsByStandard(String(standard));
      const activeListing = listings[0];
      if (!activeListing) {
        return res.status(400).json({ error: 'No active listing found for that standard.' });
      }
      const listingRegistrySerial = (activeListing as any).registry_serial || (activeListing as any).registrySerial || '';
      if (listingRegistrySerial) {
        const retiredCheck = await db.execute(sql`
          SELECT id FROM exchange_trades
          WHERE seller_registry_serial = ${listingRegistrySerial}
            AND status IN ('completed', 'retired')
          LIMIT 1
        `);
        if ((retiredCheck as any).rows?.length > 0) {
          return res.status(409).json({ error: 'This registry serial has already been traded or retired.' });
        }
      }
      const listingId = (activeListing as any).id;
      const reserveResult = await db.execute(sql`
        UPDATE exchange_listings
        SET status = 'reserved'
        WHERE id = ${listingId} AND status = 'active'
        RETURNING id
      `);
      if ((reserveResult as any).rows?.length === 0) {
        return res.status(409).json({ error: 'Listing is no longer available.' });
      }
      reservedListingId = listingId;
      const serverPrice = Number(activeListing.pricePerTonne);
      const submittedPrice = Number(pricePerTonne || 0);
      if (submittedPrice > 0) {
        const delta = Math.abs(serverPrice - submittedPrice) / serverPrice;
        if (delta > 0.05) {
          await logSecurityEvent({ email, eventType: 'suspicious_price', req, detail: { standard, submittedPrice, serverPrice, delta } });
        }
      }
      const stripeInit = await initStripe();
      if (!stripeInit?.stripeSync) {
        await db.execute(sql`UPDATE exchange_listings SET status = 'active' WHERE id = ${reservedListingId} AND status = 'reserved'`).catch(() => {});
        reservedListingId = null;
        return res.status(503).json({ error: 'Payment processor unavailable.' });
      }
      const stripe = stripeInit.stripeSync;
      const gross = serverPrice * parseFloat(volumeTonnes);
      const fee = gross * 0.0075;
      const grossCents = Math.round(gross * 100);
      const applicationFeeAmount = Math.round(fee * 100);
      const connectAccountId: string | null = (activeListing as any).stripe_connect_account_id || null;
      const connectReady: boolean = (activeListing as any).connect_onboarding_complete === true;
      if (connectAccountId && !connectReady) {
        await db.execute(sql`UPDATE exchange_listings SET status = 'active' WHERE id = ${reservedListingId} AND status = 'reserved'`).catch(() => {});
        reservedListingId = null;
        return res.status(400).json({ error: 'Seller Connect account exists but onboarding is not complete. Cannot process payment.' });
      }
      const paymentModel = connectAccountId ? 'destination_charge' : 'platform_collect';
      const origin = req.headers.origin || `https://${req.headers.host}` || 'https://uaiu.live';
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        mode: 'payment',
        line_items: [{
          price_data: {
            currency: 'eur',
            product_data: {
              name: `${standard} Carbon Credits — ${volumeTonnes} tonnes`,
              description: `${side || 'BUY'} order · Trade ID: ${tradeId}`,
            },
            unit_amount: grossCents,
          },
          quantity: 1,
        }],
        metadata: {
          trade_id: tradeId,
          standard,
          volume_tonnes: String(volumeTonnes),
          email,
          side: side || 'BUY',
          price_per_tonne: String(serverPrice),
          gross_eur: gross.toFixed(2),
          fee_eur: fee.toFixed(2),
          seller_profile_id: String((activeListing as any).seller_profile_id || ''),
          seller_connect_account_id: String(connectAccountId || ''),
          seller_registry_name: String((activeListing as any).registry_name || ''),
          seller_registry_serial: String((activeListing as any).registry_serial || ''),
          buyer_registry_account_id: buyerRegistryAccountId,
          buyer_registry_name: buyerRegistryName,
          payment_model: paymentModel,
          listing_id: listingId,
          vintage_year: String((activeListing as any).vintage_year || ''),
        },
        payment_intent_data: paymentModel === 'destination_charge' ? {
          application_fee_amount: applicationFeeAmount,
          transfer_data: { destination: connectAccountId as string },
          metadata: {
            trade_id: tradeId,
            payment_model: paymentModel,
            seller_profile_id: String((activeListing as any).seller_profile_id || ''),
            seller_connect_account_id: String(connectAccountId || ''),
            listing_id: listingId,
          },
        } : {
          metadata: {
            trade_id: tradeId,
            payment_model: paymentModel,
            seller_profile_id: String((activeListing as any).seller_profile_id || ''),
            listing_id: listingId,
          },
        },
        success_url: `${origin}/x?trade=success&id=${tradeId}`,
        cancel_url: `${origin}/x`,
        customer_email: email,
      });
      await logSecurityEvent({ email, eventType: 'trade_executed', req, detail: { tradeId, standard, volumeTonnes, serverPrice } });
      res.json({ url: session.url });
    } catch (e: any) {
      if (reservedListingId) {
        await db.execute(sql`
          UPDATE exchange_listings SET status = 'active'
          WHERE id = ${reservedListingId} AND status = 'reserved'
        `).catch(() => {});
      }
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

  // ── EXCHANGE: Download trade PDF ─────────────────────────────────────────
  app.get('/api/exchange/trades/:tradeId/pdf', requireExchangeAuth, async (req, res) => {
    try {
      const email = String((req as any).exchangeEmail || '').toLowerCase();
      const tradeId = String(req.params.tradeId || '').trim();
      if (!tradeId) return res.status(400).json({ error: 'tradeId required.' });

      const tradeRecord = await storage.getExchangeTradeByTradeId(tradeId);
      if (!tradeRecord) return res.status(404).json({ error: 'Trade not found.' });

      const buyerEmail = String(tradeRecord.accountEmail || '').toLowerCase();
      const resolvedSellerEmail = String(tradeRecord.sellerEmail || '').toLowerCase();

      const isBuyer = email === buyerEmail;
      const isSeller = resolvedSellerEmail.length > 0 && email === resolvedSellerEmail;
      if (!isBuyer && !isSeller) {
        return res.status(403).json({ error: 'Access denied. You are not a party to this trade.' });
      }

      const trade = tradeRecord as any;

      const pdfBuffer = await generateTradePDF({
        trade_id:            tradeId,
        side:                trade.side || 'buy',
        standard:            trade.standard || '',
        volume_tonnes:       Number(trade.volumeTonnes || 0),
        price_eur_per_tonne: Number(trade.pricePerTonne || 0),
        gross_eur:           Number(trade.grossEur || 0),
        fee_eur:             Number(trade.feeEur || 0),
        receipt_hash:        trade.receiptHash || '',
        prev_receipt_hash:   '',
        payment_intent_id:   '',
        stripe_charge_id:    '',
        settled_at:          trade.createdAt ? String(trade.createdAt) : new Date().toISOString(),
        buyer_email:         buyerEmail,
        seller_email:        resolvedSellerEmail || undefined,
        buyer_registry_account_id: trade.buyerRegistryAccountId || '',
        buyer_registry_name:       trade.buyerRegistryName || '',
        seller_registry_name:      trade.sellerRegistryName || '',
        seller_registry_serial:    trade.sellerRegistrySerial || '',
        vintage_year:              trade.vintageYear ? Number(trade.vintageYear) : undefined,
        retirement_status:         trade.retirementStatus || undefined,
      });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="UAIU-Trade-${tradeId}.pdf"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      return res.send(pdfBuffer);
    } catch (e: any) {
      res.status(500).json({ error: safeError(e) });
    }
  });

  const complianceFieldsSchema = z.object({
    operator_id: z.string().max(100).nullable().optional(),
    installation_id: z.string().max(100).nullable().optional(),
    activity_type: z.string().max(100).nullable().optional(),
    verified_emissions_quantity: z.number().min(0).nullable().optional(),
    corsia_eligible: z.boolean().nullable().optional(),
    icao_operator_code: z.string().max(50).nullable().optional(),
    eligible_program: z.string().max(200).nullable().optional(),
    vessel_imo: z.string().max(50).nullable().optional(),
    voyage_reference: z.string().max(100).nullable().optional(),
    fuel_consumption_offset: z.number().min(0).nullable().optional(),
  }).strict();

  const snakeToCamel: Record<string, string> = {
    operator_id: 'operatorId', installation_id: 'installationId',
    activity_type: 'activityType', verified_emissions_quantity: 'verifiedEmissionsQuantity',
    corsia_eligible: 'corsiaEligible', icao_operator_code: 'icaoOperatorCode',
    eligible_program: 'eligibleProgram', vessel_imo: 'vesselImo',
    voyage_reference: 'voyageReference', fuel_consumption_offset: 'fuelConsumptionOffset',
  };

  app.patch('/api/exchange/trades/:tradeId/compliance', requireExchangeAuth, async (req, res) => {
    try {
      const email = String((req as any).exchangeEmail || '').toLowerCase();
      const tradeId = String(req.params.tradeId || '').trim();
      if (!tradeId) return res.status(400).json({ error: 'tradeId required.' });

      const trade = await storage.getExchangeTradeByTradeId(tradeId);
      if (!trade) return res.status(404).json({ error: 'Trade not found.' });

      const buyerEmail = String(trade.accountEmail || '').toLowerCase();
      const sellerEmail = String(trade.sellerEmail || '').toLowerCase();
      if (email !== buyerEmail && (sellerEmail.length === 0 || email !== sellerEmail)) {
        return res.status(403).json({ error: 'Access denied. You are not a party to this trade.' });
      }

      const parsed = complianceFieldsSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid compliance fields.', details: parsed.error.flatten().fieldErrors });
      }

      const data = parsed.data;
      const setFields: Record<string, any> = {};
      for (const [snakeKey, val] of Object.entries(data)) {
        if (val !== undefined) {
          const camelKey = snakeToCamel[snakeKey];
          if (camelKey) setFields[camelKey] = val;
        }
      }

      if (Object.keys(setFields).length === 0) {
        return res.status(400).json({ error: 'No valid compliance fields provided.' });
      }

      await db.update(exchangeTrades).set(setFields).where(eq(exchangeTrades.tradeId, tradeId));

      const updated = await storage.getExchangeTradeByTradeId(tradeId);
      res.json({ success: true, trade: updated });
    } catch (e: any) {
      res.status(500).json({ error: safeError(e) });
    }
  });

  function sendSignedExport(res: any, payload: Record<string, any>): void {
    const keys = Object.keys(payload).sort();
    const canonicalBody = JSON.stringify(payload, keys);
    const hash = createHash('sha256').update(canonicalBody).digest('hex');
    res.setHeader('X-Export-Hash', hash);
    res.setHeader('Content-Type', 'application/json');
    res.send(canonicalBody);
  }

  app.get('/api/exchange/trades/:tradeId/export/eu-ets', requireExchangeAuth, async (req, res) => {
    try {
      const email = String((req as any).exchangeEmail || '').toLowerCase();
      const tradeId = String(req.params.tradeId || '').trim();
      if (!tradeId) return res.status(400).json({ error: 'tradeId required.' });

      const trade = await storage.getExchangeTradeByTradeId(tradeId) as any;
      if (!trade) return res.status(404).json({ error: 'Trade not found.' });

      const buyerEmail = String(trade.accountEmail || '').toLowerCase();
      const sellerEmail = String(trade.sellerEmail || '').toLowerCase();
      if (email !== buyerEmail && (sellerEmail.length === 0 || email !== sellerEmail)) {
        return res.status(403).json({ error: 'Access denied. You are not a party to this trade.' });
      }

      if (!trade.operatorId || !trade.installationId) {
        return res.status(400).json({ error: 'EU ETS export requires operator_id and installation_id fields to be populated. Use PATCH /api/exchange/trades/:tradeId/compliance to add them.' });
      }

      const payload: Record<string, any> = {
        export_type: 'EU_ETS',
        platform: 'UAIU.LIVE/X',
        trade_id: trade.tradeId,
        standard: trade.standard,
        vintage_year: trade.vintageYear ?? null,
        volume_tonnes: trade.volumeTonnes,
        price_per_tonne: trade.pricePerTonne,
        gross_eur: trade.grossEur,
        fee_eur: trade.feeEur,
        receipt_hash: trade.receiptHash ?? null,
        operator_id: trade.operatorId,
        installation_id: trade.installationId,
        activity_type: trade.activityType ?? null,
        verified_emissions_quantity: trade.verifiedEmissionsQuantity ?? null,
        buyer_email: buyerEmail,
        seller_registry_serial: trade.sellerRegistrySerial ?? null,
        seller_registry_name: trade.sellerRegistryName ?? null,
        retirement_status: trade.retirementStatus ?? null,
        export_timestamp: new Date().toISOString(),
      };
      sendSignedExport(res, payload);
    } catch (e: any) {
      res.status(500).json({ error: safeError(e) });
    }
  });

  app.get('/api/exchange/trades/:tradeId/export/corsia', requireExchangeAuth, async (req, res) => {
    try {
      const email = String((req as any).exchangeEmail || '').toLowerCase();
      const tradeId = String(req.params.tradeId || '').trim();
      if (!tradeId) return res.status(400).json({ error: 'tradeId required.' });

      const trade = await storage.getExchangeTradeByTradeId(tradeId) as any;
      if (!trade) return res.status(404).json({ error: 'Trade not found.' });

      const buyerEmail = String(trade.accountEmail || '').toLowerCase();
      const sellerEmail = String(trade.sellerEmail || '').toLowerCase();
      if (email !== buyerEmail && (sellerEmail.length === 0 || email !== sellerEmail)) {
        return res.status(403).json({ error: 'Access denied. You are not a party to this trade.' });
      }

      if (trade.corsiaEligible === false || trade.corsiaEligible === null || trade.corsiaEligible === undefined) {
        return res.status(403).json({ error: 'This trade is not CORSIA-eligible. Credits must have corsia_eligible set to true to generate a CORSIA export.' });
      }

      const payload: Record<string, any> = {
        export_type: 'CORSIA',
        platform: 'UAIU.LIVE/X',
        trade_id: trade.tradeId,
        standard: trade.standard,
        vintage_year: trade.vintageYear ?? null,
        volume_tonnes: trade.volumeTonnes,
        price_per_tonne: trade.pricePerTonne,
        gross_eur: trade.grossEur,
        fee_eur: trade.feeEur,
        receipt_hash: trade.receiptHash ?? null,
        corsia_eligible: true,
        icao_operator_code: trade.icaoOperatorCode ?? null,
        eligible_program: trade.eligibleProgram ?? null,
        buyer_email: buyerEmail,
        seller_registry_serial: trade.sellerRegistrySerial ?? null,
        seller_registry_name: trade.sellerRegistryName ?? null,
        retirement_status: trade.retirementStatus ?? null,
        export_timestamp: new Date().toISOString(),
      };
      sendSignedExport(res, payload);
    } catch (e: any) {
      res.status(500).json({ error: safeError(e) });
    }
  });

  app.get('/api/exchange/trades/:tradeId/export/imo-mrv', requireExchangeAuth, async (req, res) => {
    try {
      const email = String((req as any).exchangeEmail || '').toLowerCase();
      const tradeId = String(req.params.tradeId || '').trim();
      if (!tradeId) return res.status(400).json({ error: 'tradeId required.' });

      const trade = await storage.getExchangeTradeByTradeId(tradeId) as any;
      if (!trade) return res.status(404).json({ error: 'Trade not found.' });

      const buyerEmail = String(trade.accountEmail || '').toLowerCase();
      const sellerEmail = String(trade.sellerEmail || '').toLowerCase();
      if (email !== buyerEmail && (sellerEmail.length === 0 || email !== sellerEmail)) {
        return res.status(403).json({ error: 'Access denied. You are not a party to this trade.' });
      }

      if (!trade.vesselImo) {
        return res.status(400).json({ error: 'IMO MRV export requires vessel_imo to be populated. Use PATCH /api/exchange/trades/:tradeId/compliance to add it.' });
      }

      const payload: Record<string, any> = {
        export_type: 'IMO_MRV',
        platform: 'UAIU.LIVE/X',
        trade_id: trade.tradeId,
        standard: trade.standard,
        vintage_year: trade.vintageYear ?? null,
        volume_tonnes: trade.volumeTonnes,
        price_per_tonne: trade.pricePerTonne,
        gross_eur: trade.grossEur,
        fee_eur: trade.feeEur,
        receipt_hash: trade.receiptHash ?? null,
        vessel_imo: trade.vesselImo,
        voyage_reference: trade.voyageReference ?? null,
        fuel_consumption_offset: trade.fuelConsumptionOffset ?? null,
        buyer_email: buyerEmail,
        seller_registry_serial: trade.sellerRegistrySerial ?? null,
        seller_registry_name: trade.sellerRegistryName ?? null,
        retirement_status: trade.retirementStatus ?? null,
        export_timestamp: new Date().toISOString(),
      };
      sendSignedExport(res, payload);
    } catch (e: any) {
      res.status(500).json({ error: safeError(e) });
    }
  });

  // ── E-SIGNATURE: Sign a trade ─────────────────────────────────────────────
  app.post('/api/exchange/trades/:tradeId/sign', requireExchangeAuth, async (req, res) => {
    try {
      const email = String((req as any).exchangeEmail || '').toLowerCase();
      const tradeId = String(req.params.tradeId || '').trim();
      if (!tradeId) return res.status(400).json({ error: 'tradeId required.' });

      const { fullName, signerFullName, consent, contractAcknowledged } = req.body;
      const resolvedFullName = fullName || signerFullName;
      if (!resolvedFullName || typeof resolvedFullName !== 'string' || resolvedFullName.trim().length < 2) {
        return res.status(400).json({ error: 'fullName is required (min 2 characters).' });
      }
      if (consent !== true) {
        return res.status(400).json({ error: 'consent must be true — explicit consent is required.' });
      }
      if (contractAcknowledged !== true) {
        return res.status(400).json({ error: 'contractAcknowledged must be true — you must acknowledge the contract terms.' });
      }

      const trade = await storage.getExchangeTradeByTradeId(tradeId) as any;
      if (!trade) return res.status(404).json({ error: 'Trade not found.' });

      const buyerEmail = String(trade.accountEmail || '').toLowerCase();
      const sellerEmail = String(trade.sellerEmail || '').toLowerCase();
      if (email !== buyerEmail && (sellerEmail.length === 0 || email !== sellerEmail)) {
        return res.status(403).json({ error: 'Access denied. You are not a party to this trade.' });
      }

      const existingCheck = await db.execute(sql`
        SELECT id FROM trade_signatures
        WHERE trade_id = ${tradeId} AND signer_email = ${email}
        LIMIT 1
      `);
      if ((existingCheck as any).rows?.length > 0) {
        return res.status(409).json({ error: 'You have already signed this trade.' });
      }

      const tradeSnapshot: Record<string, any> = {};
      const tradeKeys = Object.keys(trade).sort();
      for (const k of tradeKeys) {
        tradeSnapshot[k] = trade[k] ?? null;
      }
      const documentHash = createHash('sha256').update(JSON.stringify(tradeSnapshot)).digest('hex');

      const contractText = `I, ${resolvedFullName.trim()}, hereby confirm and acknowledge this carbon credit trade (ID: ${tradeId}) on the UAIU.LIVE/X platform. I agree to the terms of trade including the specified volume, pricing, and settlement conditions.`;
      const contractTextHash = createHash('sha256').update(contractText).digest('hex');

      const signerIp = req.ip || req.socket?.remoteAddress || 'unknown';
      const signerUserAgent = String(req.headers['user-agent'] || 'unknown').slice(0, 512);
      const signedAt = new Date();

      const retentionDate = new Date(signedAt);
      retentionDate.setFullYear(retentionDate.getFullYear() + 7);
      const retentionUntil = retentionDate.toISOString().split('T')[0];

      const attestationInput = JSON.stringify({
        contract_text_hash: contractTextHash,
        document_hash: documentHash,
        explicit_consent: true,
        retention_until: retentionUntil,
        signed_at: signedAt.toISOString(),
        signer_email: email,
        signer_full_name: resolvedFullName.trim(),
        signer_ip: signerIp,
        signer_user_agent: signerUserAgent,
        trade_id: tradeId,
      });
      const platformAttestation = createHash('sha256').update(attestationInput).digest('hex');

      const insertResult = await db.execute(sql`
        INSERT INTO trade_signatures (trade_id, document_hash, contract_text_hash, signer_full_name, signer_email, signer_ip, signer_user_agent, signed_at, explicit_consent, retention_until, platform_attestation)
        VALUES (${tradeId}, ${documentHash}, ${contractTextHash}, ${resolvedFullName.trim()}, ${email}, ${signerIp}, ${signerUserAgent}, ${signedAt.toISOString()}, ${true}, ${retentionUntil}::date, ${platformAttestation})
        RETURNING id, trade_id, document_hash, contract_text_hash, signer_full_name, signer_email, signer_ip, signer_user_agent, signed_at, explicit_consent, retention_until, platform_attestation
      `);
      const insertedRow = (insertResult as any).rows?.[0];

      await logSecurityEvent({ email, eventType: 'trade_signed', req, detail: JSON.stringify({ trade_id: tradeId, document_hash: documentHash }) });

      res.status(201).json(insertedRow || {
        trade_id: tradeId,
        signer_full_name: resolvedFullName.trim(),
        signer_email: email,
        document_hash: documentHash,
        contract_text_hash: contractTextHash,
        platform_attestation: platformAttestation,
        signer_ip: signerIp,
        signer_user_agent: signerUserAgent,
        signed_at: signedAt.toISOString(),
        explicit_consent: true,
        retention_until: retentionUntil,
      });
    } catch (e: any) {
      if (e?.message?.includes('idx_trade_signatures_trade_email') || e?.code === '23505') {
        return res.status(409).json({ error: 'You have already signed this trade.' });
      }
      res.status(500).json({ error: safeError(e) });
    }
  });

  // ── E-SIGNATURE: Check sign status ──────────────────────────────────────────
  app.get('/api/exchange/trades/:tradeId/sign-status', requireExchangeAuth, async (req, res) => {
    try {
      const email = String((req as any).exchangeEmail || '').toLowerCase();
      const tradeId = String(req.params.tradeId || '').trim();
      if (!tradeId) return res.status(400).json({ error: 'tradeId required.' });

      const trade = await storage.getExchangeTradeByTradeId(tradeId) as any;
      if (!trade) return res.status(404).json({ error: 'Trade not found.' });

      const buyerEmail = String(trade.accountEmail || '').toLowerCase();
      const sellerEmail = String(trade.sellerEmail || '').toLowerCase();
      if (email !== buyerEmail && (sellerEmail.length === 0 || email !== sellerEmail)) {
        return res.status(403).json({ error: 'Access denied. You are not a party to this trade.' });
      }

      const result = await db.execute(sql`
        SELECT id, trade_id, signer_full_name, signer_email, signed_at, document_hash, platform_attestation
        FROM trade_signatures
        WHERE trade_id = ${tradeId}
        ORDER BY signed_at ASC
      `);
      const signatures = (result as any).rows || [];

      const buyerSigned = signatures.some((s: any) => String(s.signer_email).toLowerCase() === buyerEmail);
      const sellerSigned = sellerEmail ? signatures.some((s: any) => String(s.signer_email).toLowerCase() === sellerEmail) : null;

      res.json({
        trade_id: tradeId,
        fully_signed: buyerSigned && (sellerSigned === true || sellerSigned === null),
        buyer_signed: buyerSigned,
        seller_signed: sellerSigned,
        your_signature: signatures.find((s: any) => String(s.signer_email).toLowerCase() === email) ? (() => {
          const own = signatures.find((s: any) => String(s.signer_email).toLowerCase() === email);
          return {
            signer_email: own.signer_email,
            signer_full_name: own.signer_full_name,
            signed_at: own.signed_at,
            document_hash: own.document_hash,
            platform_attestation: own.platform_attestation,
          };
        })() : null,
        counterparty_signed: signatures.some((s: any) => String(s.signer_email).toLowerCase() !== email),
        total_signatures: signatures.length,
      });
    } catch (e: any) {
      res.status(500).json({ error: safeError(e) });
    }
  });

  // ── E-SIGNATURE: Download signature certificate PDF ─────────────────────────
  app.get('/api/exchange/trades/:tradeId/signature/certificate', requireExchangeAuth, async (req, res) => {
    try {
      const email = String((req as any).exchangeEmail || '').toLowerCase();
      const tradeId = String(req.params.tradeId || '').trim();
      if (!tradeId) return res.status(400).json({ error: 'tradeId required.' });

      const trade = await storage.getExchangeTradeByTradeId(tradeId) as any;
      if (!trade) return res.status(404).json({ error: 'Trade not found.' });

      const buyerEmail = String(trade.accountEmail || '').toLowerCase();
      const sellerEmail = String(trade.sellerEmail || '').toLowerCase();
      if (email !== buyerEmail && (sellerEmail.length === 0 || email !== sellerEmail)) {
        return res.status(403).json({ error: 'Access denied. You are not a party to this trade.' });
      }

      const result = await db.execute(sql`
        SELECT * FROM trade_signatures
        WHERE trade_id = ${tradeId} AND signer_email = ${email}
        LIMIT 1
      `);
      const sig = (result as any).rows?.[0];
      if (!sig) return res.status(404).json({ error: 'No signature found for this trade by your account.' });

      const pdfBuffer = await generateSignatureCertificatePDF({
        trade_id: tradeId,
        signer_full_name: sig.signer_full_name,
        signer_email: sig.signer_email,
        signer_ip: sig.signer_ip,
        signed_at: sig.signed_at instanceof Date ? sig.signed_at.toISOString() : String(sig.signed_at),
        document_hash: sig.document_hash,
        contract_text_hash: sig.contract_text_hash,
        platform_attestation: sig.platform_attestation,
      });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="signature-${tradeId}.pdf"`);
      res.send(pdfBuffer);
    } catch (e: any) {
      res.status(500).json({ error: safeError(e) });
    }
  });

  // ── E-SIGNATURE: Admin retention stats ──────────────────────────────────────
  app.get('/api/admin/signature-retention-stats', requireAdminHeader, async (_req, res) => {
    try {
      const result = await db.execute(sql`
        SELECT
          COUNT(*)::int AS total_records,
          COUNT(*) FILTER (WHERE retention_until > CURRENT_DATE)::int AS active_retention,
          COUNT(*) FILTER (WHERE retention_until <= CURRENT_DATE)::int AS expired_retention,
          COUNT(*) FILTER (WHERE retention_until > CURRENT_DATE AND retention_until <= CURRENT_DATE + INTERVAL '30 days')::int AS expiring_within_30_days,
          MIN(signed_at) AS earliest_signature,
          MAX(signed_at) AS latest_signature,
          MIN(retention_until) AS earliest_retention_until,
          MAX(retention_until) AS latest_retention_until
        FROM trade_signatures
      `);
      const stats = (result as any).rows?.[0] || {};
      res.json({
        total_records: stats.total_records || 0,
        active_retention: stats.active_retention || 0,
        expired_retention: stats.expired_retention || 0,
        expiring_within_30_days: stats.expiring_within_30_days || 0,
        earliest_signature: stats.earliest_signature || null,
        latest_signature: stats.latest_signature || null,
        earliest_retention_until: stats.earliest_retention_until || null,
        latest_retention_until: stats.latest_retention_until || null,
      });
    } catch (e: any) {
      res.status(500).json({ error: safeError(e) });
    }
  });

  app.get('/api/exchange/verify/:hash', async (req, res) => {
    try {
      const hash = String(req.params.hash || '').trim();
      if (!hash) return res.status(400).json({ error: 'Receipt hash required' });

      const result = await db.execute(sql`
        SELECT trade_id, standard, volume_tonnes, gross_eur, created_at, receipt_hash,
               seller_registry_name, seller_registry_serial, vintage_year, price_per_tonne,
               account_email, settled_at
        FROM exchange_trades
        WHERE receipt_hash = ${hash}
        LIMIT 1
      `);

      const row = (result as any).rows?.[0];
      if (!row) return res.status(404).json({ error: 'Trade not found' });

      res.json({
        verified: true,
        tradeId: row.trade_id,
        creditType: row.standard,
        standard: row.standard,
        vintageYear: row.vintage_year ? Number(row.vintage_year) : null,
        registry: row.seller_registry_name || 'N/A',
        registryReference: row.seller_registry_serial || 'N/A',
        volumeTonnes: Number(row.volume_tonnes || 0),
        quantity: Number(row.volume_tonnes || 0),
        pricePerTonne: Number(row.price_per_tonne || 0),
        grossEur: Number(row.gross_eur || 0),
        totalValue: Number(row.gross_eur || 0),
        buyer: row.account_email ? String(row.account_email).replace(/(^.).*(@.*$)/, '$1***$2') : 'Anonymous Buyer',
        sellerName: row.seller_registry_name || 'Verified Seller',
        settledAt: row.settled_at || row.created_at,
        settlementDate: row.settled_at || row.created_at,
        receiptHash: row.receipt_hash,
        verifyOnRegistryUrl: row.seller_registry_name === 'Verra'
          ? `https://registry.verra.org/app/projectDetail/VCS/${encodeURIComponent(String(row.seller_registry_serial || row.trade_id))}`
          : row.seller_registry_name === 'Gold Standard'
            ? `https://registry.goldstandard.org/projects/details/${encodeURIComponent(String(row.seller_registry_serial || row.trade_id))}`
            : null,
      });
    } catch (e: any) {
      res.status(500).json({ error: safeError(e) });
    }
  });

  app.get('/api/exchange/trade/:tradeId/audit-pack', async (req, res) => {
    try {
      const tradeId = String(req.params.tradeId || '').trim();
      if (!tradeId) return res.status(400).json({ error: 'tradeId required' });

      const tradeRows = await db.execute(sql`SELECT * FROM exchange_trades WHERE trade_id = ${tradeId} LIMIT 1`);
      const trade = (tradeRows as any).rows?.[0];
      if (!trade) return res.status(404).json({ error: 'Trade not found' });

      const sellerRows = await db.execute(sql`
        SELECT kyb_status, kyc_status, org_name
        FROM exchange_accounts
        WHERE LOWER(email) = LOWER(${trade.account_email || ''})
        LIMIT 1
      `);
      const sellerAccount = (sellerRows as any).rows?.[0] || {};

      const buffer = await generateTradePDF({
        trade_id: String(trade.trade_id),
        side: String(trade.side || 'buy'),
        standard: String(trade.standard || 'N/A'),
        volume_tonnes: Number(trade.volume_tonnes || 0),
        price_eur_per_tonne: Number(trade.price_per_tonne || 0),
        gross_eur: Number(trade.gross_eur || 0),
        fee_eur: Number(trade.fee_eur || 0),
        receipt_hash: String(trade.receipt_hash || ''),
        prev_receipt_hash: String(trade.prev_receipt_hash || 'genesis'),
        payment_intent_id: String(trade.payment_intent_id || ''),
        stripe_charge_id: String(trade.stripe_charge_id || ''),
        settled_at: String(trade.settled_at || trade.created_at || new Date().toISOString()),
        buyer_email: String(trade.account_email || ''),
        buyer_registry_account_id: String(trade.buyer_registry_account_id || ''),
        buyer_registry_name: String(trade.buyer_registry_name || ''),
        seller_registry_name: String(trade.seller_registry_name || sellerAccount.org_name || ''),
        seller_registry_serial: String(trade.seller_registry_serial || ''),
        vintage_year: trade.vintage_year ? Number(trade.vintage_year) : undefined,
        retirement_status: String(trade.retirement_status || 'pending'),
      });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="UAIU-EU-ETS-Audit-Pack-${tradeId}.pdf"`);
      res.send(buffer);
    } catch (e: any) {
      res.status(500).json({ error: safeError(e) });
    }
  });

  app.post('/api/demo-requests', async (req, res) => {
    try {
      const body = req.body || {};
      const name = String(body.name || '').trim();
      const company = String(body.company || '').trim();
      const role = String(body.role || '').trim();
      const email = String(body.email || '').trim().toLowerCase();
      const interest = String(body.interest || '').trim();
      if (!name || !company || !role || !email || !interest) {
        return res.status(400).json({ error: 'All fields are required.' });
      }

      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS demo_requests (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          company TEXT NOT NULL,
          role TEXT NOT NULL,
          email TEXT NOT NULL,
          interest TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);

      await db.execute(sql`
        INSERT INTO demo_requests (name, company, role, email, interest)
        VALUES (${name}, ${company}, ${role}, ${email}, ${interest})
      `);

      sendExchangeEmail('Demo Request Submission', {
        Name: name,
        Company: company,
        Role: role,
        Email: email,
        Interest: interest,
      }).catch((err) => console.error('[Demo Request Email]', safeError(err)));

      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: safeError(e) });
    }
  });

  app.post('/api/navigator-waitlist', async (req, res) => {
    try {
      const body = req.body || {};
      const name = String(body.name || '').trim();
      const email = String(body.email || '').trim().toLowerCase();
      if (!name || !email) return res.status(400).json({ error: 'name and email are required.' });
      const supabase = req.app.locals.supabase;
      if (!supabase) return res.status(500).json({ error: 'Supabase unavailable.' });
      const { error } = await supabase.from('navigator_waitlist').insert({ name, email });
      if (error) return res.status(500).json({ error: error.message });
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: safeError(e) });
    }
  });

  // Trade recording is handled exclusively by the Stripe webhook handler.
  // The public /api/exchange/trade/record endpoint has been removed for security.

  // ── EXCHANGE: Retirement certificate upload (token-gated, no session required) ─
  app.post('/api/exchange/retire-upload/:tradeId', upload.single('certificate'), async (req, res) => {
    try {
      const tradeId = String(req.params.tradeId || '').trim();
      const token = String((req as any).body?.token || '').trim();
      const certFile = (req as any).file as Express.Multer.File | undefined;

      if (!tradeId || !token || !certFile) {
        return res.status(400).json({ error: 'tradeId, token, and certificate file are required.' });
      }

      const tokenRows = await db.execute(sql`
        SELECT id, token_hash, used_at, seller_email
        FROM retirement_upload_tokens
        WHERE trade_id = ${tradeId}
        ORDER BY created_at DESC
        LIMIT 20
      `);

      const match = (tokenRows as any).rows?.find((r: any) => !r.used_at && secureTokenMatch(token, String(r.token_hash || '')));
      if (!match) {
        return res.status(401).json({ error: 'Invalid or expired upload token.' });
      }

      const confirmedAt = new Date().toISOString();
      await db.execute(sql`
        INSERT INTO trade_retirement_certificates (trade_id, uploaded_by, certificate_filename, upload_url, uploaded_at)
        VALUES (${tradeId}, ${String(match.seller_email || '')}, ${certFile.originalname}, ${certFile.path}, NOW())
      `).catch(() => {});

      await db.execute(sql`UPDATE retirement_upload_tokens SET used_at = NOW() WHERE id = ${String(match.id)}`);
      await db.execute(sql`
        UPDATE exchange_trades
        SET retirement_status = ${`Confirmed — ${confirmedAt}`}
        WHERE trade_id = ${tradeId}
      `).catch(() => {});

      return res.json({ success: true, message: 'Retirement certificate uploaded successfully.' });
    } catch (e: any) {
      console.error('[Retire upload]', e.message);
      return res.status(500).json({ error: safeError(e) });
    }
  });

  // ── EXCHANGE: Retire credits ──────────────────────────────────────────────
  app.post('/api/exchange/retire', requireExchangeAuth, async (req, res) => {
    try {
      const email = (req as any).exchangeEmail;
      const { tradeId, volumeTonnes, standard, retireeName, purpose, certificateTheme } = req.body;
      if (!tradeId || !volumeTonnes || !standard || !retireeName) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const account = await storage.getExchangeAccountByEmail(email);
      if (!account || account.kycStatus !== 'verified') {
        return res.status(403).json({ error: 'KYC verification required.' });
      }

      const trade = await storage.getExchangeTradeByTradeId(tradeId);
      if (!trade || trade.accountEmail !== email) {
        return res.status(403).json({ error: 'You do not own this trade.' });
      }

      if (trade.status === 'retired') {
        return res.status(400).json({ error: 'This trade has already been retired.' });
      }
      if (trade.status !== 'completed') {
        return res.status(400).json({ error: 'Only completed trades can be retired.' });
      }

      const retirementAt = new Date();
      const certId = `UAIU-CERT-${tradeId}`;
      const verifyUrl = `https://uaiu.live/verify/${encodeURIComponent(tradeId)}`;
      const theme = certificateTheme === 'light' ? 'light' : 'dark';

      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const dark = theme === 'dark';
      const bg = dark ? '#060810' : '#FFFFFF';
      const fg = dark ? '#F2EAD8' : '#111111';
      const muted = dark ? '#BFAF91' : '#5A5A5A';
      const accent = '#D4A843';

      doc.setFillColor(bg);
      doc.rect(0, 0, pageWidth, pageHeight, 'F');
      doc.setDrawColor(accent);
      doc.setLineWidth(2);
      doc.rect(24, 24, pageWidth - 48, pageHeight - 48, 'S');
      doc.setLineWidth(0.6);
      doc.rect(34, 34, pageWidth - 68, pageHeight - 68, 'S');

      doc.setTextColor(accent);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.text('UAIU.LIVE/X', 48, 56);

      doc.setFontSize(28);
      doc.text('CARBON RETIREMENT CERTIFICATE', pageWidth / 2, 90, { align: 'center' });
      doc.setFontSize(12);
      doc.text('Issued by UAIU Holdings Corp', pageWidth / 2, 112, { align: 'center' });

      const rightColX = pageWidth - 270;
      doc.setTextColor(muted);
      doc.setFontSize(10);
      doc.text(`Certificate No: ${certId}`, rightColX, 62);
      doc.text(`Retirement Date: ${retirementAt.toISOString()}`, rightColX, 78);

      doc.setDrawColor(accent);
      doc.line(48, 126, pageWidth - 48, 126);

      const buyerOrg = account.orgName || retireeName;
      const rows = [
        ['Buyer Organization', buyerOrg],
        ['Credit Type / Methodology', `${standard} / Methodology per underlying listing`],
        ['Registry / Standard', `${trade.sellerRegistryName || 'Registry not specified'} / ${standard}`],
        ['Vintage Year', String(trade.vintageYear || 'Not specified')],
        ['Project Name / Location', 'As specified in underlying trade audit pack'],
        ['Registry Serial Numbers', trade.sellerRegistrySerial || 'Not provided'],
        ['Purpose of Retirement', purpose || 'Voluntary'],
        ['SHA-256 Trade Hash', trade.receiptHash || 'N/A'],
        ['Public Verification URL', verifyUrl],
      ];

      let y = 160;
      doc.setFontSize(11);
      for (const [label, value] of rows) {
        doc.setTextColor(muted);
        doc.setFont('helvetica', 'bold');
        doc.text(`${label}:`, 52, y);
        doc.setTextColor(fg);
        doc.setFont('helvetica', 'normal');
        const lines = doc.splitTextToSize(String(value), 430);
        doc.text(lines, 210, y);
        y += Math.max(18, lines.length * 14);
      }

      doc.setTextColor(accent);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(30);
      doc.text(`${Number(volumeTonnes).toLocaleString()} tCO2e`, pageWidth - 190, 230, { align: 'center' });
      doc.setFontSize(10);
      doc.setTextColor(muted);
      doc.text('Volume Retired', pageWidth - 190, 248, { align: 'center' });

      let qrPlaced = false;
      try {
        const qrRes = await fetch(`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(verifyUrl)}`);
        if (qrRes.ok) {
          const arr = Buffer.from(await qrRes.arrayBuffer());
          doc.addImage(arr.toString('base64'), 'PNG', pageWidth - 260, 280, 110, 110);
          qrPlaced = true;
        }
      } catch {}
      if (!qrPlaced) {
        doc.setDrawColor(accent);
        doc.rect(pageWidth - 260, 280, 110, 110, 'S');
        doc.setFontSize(9);
        doc.setTextColor(muted);
        doc.text('QR unavailable', pageWidth - 205, 340, { align: 'center' });
      }

      doc.setTextColor(fg);
      doc.setFontSize(9);
      doc.text('This certificate confirms the permanent retirement of the above carbon credits. The underlying trade and retirement are publicly verifiable at the URL above.', 52, pageHeight - 92, { maxWidth: pageWidth - 120 });
      doc.setTextColor(muted);
      doc.text('UAIU Holdings Corp · Wyoming C-Corp · info@uaiu.live', 52, pageHeight - 64);

      const pdfBuffer = Buffer.from(doc.output('arraybuffer'));

      let certificateUrl = '';
      let storagePath = `retirement-certificates/${tradeId}/${theme}-${Date.now()}.pdf`;
      const supabase = (req.app as any).locals?.supabase;
      if (supabase) {
        const uploaded = await supabase.storage.from('retirement-certificates').upload(storagePath, pdfBuffer, {
          contentType: 'application/pdf',
          upsert: true,
        });
        if (!uploaded.error) {
          const pub = supabase.storage.from('retirement-certificates').getPublicUrl(storagePath);
          certificateUrl = pub?.data?.publicUrl || '';
        }
      }

      if (!certificateUrl) {
        const certDir = path.join(process.cwd(), 'uploads', 'certificates');
        fs.mkdirSync(certDir, { recursive: true });
        const localPath = path.join(certDir, `${tradeId}-${theme}.pdf`);
        fs.writeFileSync(localPath, pdfBuffer);
        certificateUrl = `/uploads/certificates/${tradeId}-${theme}.pdf`;
      }

      await db.execute(sql`
        INSERT INTO trade_retirement_certificates (trade_id, uploaded_by, certificate_filename, upload_url, uploaded_at, supabase_storage_path)
        VALUES (${tradeId}, ${email}, ${`${certId}-${theme}.pdf`}, ${certificateUrl}, NOW(), ${storagePath})
      `).catch(() => {});

      await db.execute(sql`
        UPDATE exchange_trades
        SET
          status = 'retired',
          retirement_status = ${`Confirmed — ${retirementAt.toISOString()}`},
          retirement_certificate_id = ${certId},
          retirement_certificate_url = ${certificateUrl},
          retirement_certificate_generated_at = NOW(),
          retirement_purpose = ${purpose || null}
        WHERE trade_id = ${tradeId}
      `);

      const sellerRows = await db.execute(sql`
        SELECT seller_email
        FROM retirement_upload_tokens
        WHERE trade_id = ${tradeId}
          AND seller_email IS NOT NULL
        ORDER BY created_at DESC
        LIMIT 1
      `);
      const sellerEmail = (sellerRows as any).rows?.[0]?.seller_email;

      if (isZohoConfigured()) {
        await sendZohoEmail(
          email,
          `Your Carbon Retirement Certificate — ${certId}`,
          `<div style="font-family:Arial;background:#060810;color:#f2ead8;padding:24px"><h2 style="color:#d4a843">CARBON RETIREMENT CERTIFICATE</h2><p>Your retirement certificate is ready.</p><ul><li><strong>Certificate:</strong> ${certId}</li><li><strong>Trade ID:</strong> ${tradeId}</li><li><strong>Volume:</strong> ${Number(volumeTonnes).toLocaleString()} tCO2e</li><li><strong>Purpose:</strong> ${purpose || 'Voluntary'}</li></ul><p><a style="color:#d4a843" href="${certificateUrl}">Download certificate</a></p></div>`,
          [{ filename: `${certId}.pdf`, content: pdfBuffer, contentType: 'application/pdf' }]
        ).catch(() => {});

        if (sellerEmail) {
          await sendZohoEmail(
            String(sellerEmail),
            `Trade Retired Confirmation — ${tradeId}`,
            `<div style="font-family:Arial;background:#060810;color:#f2ead8;padding:24px"><h2 style="color:#d4a843">Trade retirement confirmed</h2><p>Trade <strong>${tradeId}</strong> has been marked RETIRED and a retirement certificate has been issued.</p><p>Verification URL: <a style="color:#d4a843" href="${verifyUrl}">${verifyUrl}</a></p></div>`
          ).catch(() => {});
        }
      }

      const counterRows = await db.execute(sql`SELECT COUNT(*)::int AS retired_count, COALESCE(SUM(volume_tonnes), 0)::float AS retired_volume FROM exchange_trades WHERE status = 'retired'`);
      const retiredCount = Number((counterRows as any).rows?.[0]?.retired_count || 0);
      const retiredVolume = Number((counterRows as any).rows?.[0]?.retired_volume || 0);

      return res.json({
        success: true,
        certificateId: certId,
        certificateUrl,
        verifyUrl,
        retiredCount,
        retiredVolume,
      });
    } catch (e: any) {
      console.error('[Retire]', e.message);
      res.status(500).json({ error: safeError(e) });
    }
  });

  app.get('/api/exchange/retire/certificate/:tradeId', requireExchangeAuth, async (req, res) => {
    try {
      const email = (req as any).exchangeEmail;
      const tradeId = String(req.params.tradeId || '').trim();
      const theme = String(req.query.theme || 'dark') === 'light' ? 'light' : 'dark';
      if (!tradeId) return res.status(400).json({ error: 'tradeId is required' });

      const trade = await storage.getExchangeTradeByTradeId(tradeId);
      if (!trade || trade.accountEmail !== email) {
        return res.status(403).json({ error: 'You do not own this trade.' });
      }

      if ((trade as any).retirementCertificateUrl && (trade as any).status === 'retired') {
        return res.json({
          success: true,
          certificateId: (trade as any).retirementCertificateId,
          certificateUrl: (trade as any).retirementCertificateUrl,
          theme,
        });
      }

      return res.status(400).json({ error: 'Certificate not generated yet. Retire this trade first.' });
    } catch (e: any) {
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
      if (body.registryAccountId || body.registryName) {
        await db.execute(sql`
          UPDATE exchange_accounts
          SET registry_account_id = ${body.registryAccountId ? String(body.registryAccountId).trim() : null},
              registry_name = ${body.registryName ? String(body.registryName).trim() : null}
          WHERE id = ${account.id}
        `).catch(() => {});
      }
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
      const authenticatedEmail = String((req as any).userEmail || '').toLowerCase();
      const submittedEmail = String(body.email || '').toLowerCase();
      if (authenticatedEmail && submittedEmail && authenticatedEmail !== submittedEmail) {
        return res.status(403).json({ error: 'RFQ email must match your authenticated account.' });
      }
      const kycEmail = authenticatedEmail || submittedEmail;
      if (!kycEmail) {
        return res.status(400).json({ error: 'Email is required.' });
      }
      const kycAccount = await storage.getExchangeAccountByEmail(kycEmail);
      if (!kycAccount || kycAccount.kycStatus !== 'verified') {
        return res.status(403).json({ error: 'KYC verification required.' });
      }
      const rfqData: any = {
        company: String(body.company),
        contact: String(body.contact),
        email: kycEmail,
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

      const authenticatedEmail = String((req as any).userEmail || '').toLowerCase();
      const submittedEmail = String(parsed.data.email || '').toLowerCase();
      if (authenticatedEmail && submittedEmail && authenticatedEmail !== submittedEmail) {
        return res.status(403).json({ error: 'Listing email must match your authenticated account.' });
      }
      const listingEmail = authenticatedEmail || submittedEmail;
      if (!listingEmail) {
        return res.status(400).json({ error: 'Email is required.' });
      }
      const listingKycAccount = await storage.getExchangeAccountByEmail(listingEmail);
      if (!listingKycAccount || listingKycAccount.kycStatus !== 'verified') {
        return res.status(403).json({ error: 'KYC verification required.' });
      }

      const dataWithBoundEmail = { ...parsed.data, email: listingEmail };

      // Save as 'pending' — admin must approve before appearing on marketplace
      const listing = await storage.createExchangeCreditListing(dataWithBoundEmail);
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
  app.post('/api/partner/listings', partnerApiLimiter, async (req, res) => {
    try {
      const { listings } = req.body;
      const providedKey = String(req.headers['x-api-key'] || '');
      const validKey = process.env.PARTNER_API_KEY;
      if (!validKey) return res.status(500).json({ error: 'PARTNER_API_KEY not configured in Replit Secrets' });
      if (!providedKey) return res.status(401).json({ error: 'x-api-key header required' });
      const providedHash = createHash('sha256').update(providedKey).digest();
      const validHash   = createHash('sha256').update(validKey).digest();
      if (providedHash.length !== validHash.length || !timingSafeEqual(providedHash, validHash)) {
        return res.status(401).json({ error: 'Invalid API key' });
      }
      if (!Array.isArray(listings) || listings.length === 0) return res.status(400).json({ error: 'listings array required' });
      if (listings.length > 100) return res.status(400).json({ error: 'Max 100 listings per request' });

      const validationErrors: string[] = [];
      const validatedItems: z.infer<typeof partnerListingItemSchema>[] = [];
      for (let i = 0; i < listings.length; i++) {
        const parsed = partnerListingItemSchema.safeParse(listings[i]);
        if (!parsed.success) {
          const label = listings[i]?.name || `item[${i}]`;
          for (const issue of parsed.error.issues) {
            validationErrors.push(`${label}: ${issue.path.join('.')}: ${issue.message}`);
          }
        } else {
          validatedItems.push(parsed.data);
        }
      }
      if (validationErrors.length > 0) {
        return res.status(400).json({ error: 'Validation failed. No listings were inserted.', details: validationErrors });
      }

      const inserted: string[] = [];
      const errors: string[]   = [];
      for (const item of validatedItems) {
        try {
          await storage.seedExchangeListings([{
            standard:          item.standard,
            badgeLabel:        item.badgeLabel || item.standard,
            name:              item.name,
            origin:            item.origin || 'Caribbean Basin',
            pricePerTonne:     item.pricePerTonne,
            changePercent:     item.changePercent || 0,
            changeDirection:   item.changeDirection || 'up',
            status:            'active',
            isAcceptingOrders: true,
            registrySerial:    item.registry_serial,
            registryName:      item.registry_name,
            vintageYear:       item.vintage_year,
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
  app.post('/api/kyc/start', requireExchangeAuth, async (req, res) => {
    try {
      const { account_id, email, return_url } = req.body;
      if (!account_id || !email) return res.status(400).json({ error: 'account_id and email required' });
      const sessionEmail = String((req as any).exchangeEmail || '').trim().toLowerCase();
      const normalizedEmail = String(email).trim().toLowerCase();
      if (!sessionEmail || sessionEmail !== normalizedEmail) {
        return res.status(403).json({ error: 'You can only start KYC for your signed-in account.' });
      }
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
        SET kyc_session_id = ${session.id}, kyc_status = 'pending', kyc_provider_reference = ${session.id}
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
      res.status(500).json({ error: safeError(err) });
    }
  });

  // GET /api/kyc/status/:session_id — poll to check verification result
  app.get('/api/kyc/status/:session_id', requireExchangeAuth, async (req, res) => {
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
          SET kyc_status = 'verified', kyc_completed_at = NOW(), kyc_provider_reference = ${session.id}
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
      res.status(500).json({ error: safeError(err) });
    }
  });


  app.get('/api/admin/kyc/pending', requireAdminHeader, async (req, res) => {
    try {
      const rows = await db.execute(sql`
        SELECT id, email, kyc_status, kyc_session_id, kyc_provider_reference, created_at
        FROM exchange_accounts
        WHERE kyc_status = 'pending' OR kyc_status = 'not_started'
        ORDER BY created_at DESC
        LIMIT 100
      `);
      res.json((rows as any).rows || []);
    } catch (e: any) {
      res.status(500).json({ error: safeError(e) });
    }
  });

  app.post('/api/admin/kyc/manual-verify/:id', requireAdminHeader, async (req, res) => {
    try {
      const id = String(req.params.id || '').trim();
      if (!id) return res.status(400).json({ error: 'id required' });
      await db.execute(sql`UPDATE exchange_accounts SET kyc_status = 'verified', kyc_completed_at = NOW() WHERE id = ${id}`);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: safeError(e) });
    }
  });

  app.post('/api/admin/exchange/accounts/:id/reset-kyc', requireAdminHeader, async (req, res) => {
    try {
      const id = String(req.params.id || '').trim();
      if (!id) return res.status(400).json({ error: 'id required' });
      const result = await db.execute(sql`UPDATE exchange_accounts SET kyc_status = 'not_started', kyc_provider_reference = NULL, kyc_completed_at = NULL WHERE id = ${id}`);
      const rowCount = (result as any).rowCount ?? (result as any).rows?.length ?? 0;
      if (rowCount === 0) return res.status(404).json({ error: 'Account not found.' });
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: safeError(e) });
    }
  });

  app.get('/api/admin/exchange/accounts', requireAdminHeader, async (req, res) => {
    try {
      const rows = await db.execute(sql`
        SELECT id, email, first_name, last_name, org_name, account_type, kyc_status, kyc_provider_reference, kyc_completed_at, accepted_terms_at, password_hash IS NOT NULL as has_password, created_at
        FROM exchange_accounts
        ORDER BY created_at DESC
        LIMIT 200
      `);
      res.json((rows as any).rows || []);
    } catch (e: any) {
      res.status(500).json({ error: safeError(e) });
    }
  });

  // ── HEALTH CHECK — full system test ──────────────────────────────────────
  // GET /api/admin/health-check (X-Admin-Key header required)
  app.get('/api/admin/health-check', requireAdminHeader, async (req, res) => {

    const results: Record<string, any> = {};

    // PostgreSQL
    try { await db.execute(sql`SELECT 1`); results.postgresql = { status: 'OK' }; }
    catch (e: any) { console.error('[Health Check] PostgreSQL:', e); results.postgresql = { status: 'FAIL', error: 'Database unreachable' }; }

    // Live marketplace
    try {
      const listings = await storage.getExchangeListings();
      results.marketplace = { status: 'OK', live_listings: listings.length };
    } catch (e: any) { console.error('[Health Check] Marketplace:', e); results.marketplace = { status: 'FAIL', error: 'Listing fetch failed' }; }

    // Stripe
    try {
      const sk = process.env.STRIPE_SECRET_KEY;
      if (!sk) throw new Error('STRIPE_SECRET_KEY not set');
      const { default: Stripe } = await import('stripe');
      const stripe = new Stripe(sk, { apiVersion: '2024-12-18.acacia' as any });
      await stripe.paymentIntents.list({ limit: 1 });
      results.stripe = { status: 'OK' };
    } catch (e: any) { console.error('[Health Check] Stripe:', e); results.stripe = { status: 'FAIL', error: 'Stripe connection failed' }; }

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

  // ── Seller: upload registry ownership proof ──────────────────────────────────
  app.post('/api/seller/registry-proof', requireExchangeAuth, upload.single('file'), async (req, res) => {
    try {
      const email = (req as any).exchangeEmail as string;
      if (!email) return res.status(401).json({ error: 'Unauthorized' });
      if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

      const kycCheckAcct = await storage.getExchangeAccountByEmail(email);
      if (!kycCheckAcct || kycCheckAcct.kycStatus !== 'verified') {
        return res.status(403).json({ error: 'KYC verification required.' });
      }

      // Find seller profile by exchange account email
      const profileRows = await db.execute(sql`
        SELECT id FROM seller_profiles WHERE exchange_account_email = ${email} LIMIT 1
      `);
      const profile = (profileRows as any).rows?.[0];
      if (!profile) return res.status(404).json({ error: 'No seller profile found. Submit a listing first.' });

      const sellerProfileId = String(profile.id);
      const fileName = req.file.originalname;
      const fileUrl = `/uploads/${req.file.filename}`;

      const docRows = await db.execute(sql`
        INSERT INTO seller_documents (seller_profile_id, document_type, file_name, file_url, verification_status)
        VALUES (${sellerProfileId}, 'registry_ownership_proof', ${fileName}, ${fileUrl}, 'pending')
        RETURNING id
      `);
      const docId = (docRows as any).rows?.[0]?.id || '';

      await logSecurityEvent({ email, eventType: 'registry_proof_uploaded', req, detail: { sellerProfileId, docId, fileName } });

      res.json({ success: true, documentId: docId, status: 'pending' });
    } catch (e: any) {
      res.status(500).json({ error: safeError(e) });
    }
  });

  // ── Admin: get seller registry proof by seller_profile_id ───────────────────
  app.get('/api/admin/seller-proof/:profileId', requireAdminHeader, async (req, res) => {
    try {
      const docRows = await db.execute(sql`
        SELECT id, file_name, file_url, verification_status, created_at
        FROM seller_documents
        WHERE seller_profile_id = ${req.params.profileId}
          AND document_type = 'registry_ownership_proof'
          AND verification_status != 'rejected'
        ORDER BY created_at DESC
        LIMIT 1
      `);
      const doc = (docRows as any).rows?.[0];
      res.json({ hasProof: !!doc, document: doc || null });
    } catch (e: any) {
      res.status(500).json({ error: safeError(e) });
    }
  });

  // ── Seller: get registry proof status ───────────────────────────────────────
  app.get('/api/seller/registry-proof', requireExchangeAuth, async (req, res) => {
    try {
      const email = (req as any).exchangeEmail as string;
      if (!email) return res.status(401).json({ error: 'Unauthorized' });

      const profileRows = await db.execute(sql`
        SELECT id FROM seller_profiles WHERE exchange_account_email = ${email} LIMIT 1
      `);
      const profile = (profileRows as any).rows?.[0];
      if (!profile) return res.json({ hasProof: false });

      const docRows = await db.execute(sql`
        SELECT id, file_name, verification_status, created_at
        FROM seller_documents
        WHERE seller_profile_id = ${String(profile.id)}
          AND document_type = 'registry_ownership_proof'
          AND verification_status != 'rejected'
        ORDER BY created_at DESC
        LIMIT 1
      `);
      const doc = (docRows as any).rows?.[0];
      res.json({ hasProof: !!doc, document: doc || null });
    } catch (e: any) {
      res.status(500).json({ error: safeError(e) });
    }
  });

  app.post('/api/admin/listings/:id/approve', requireAdminHeader, async (req, res) => {
    try {
      const [submission] = await db.select().from(exchangeCreditListings).where(eq(exchangeCreditListings.id, req.params.id));

      // Gate: seller must have uploaded registry ownership proof
      const submissionAny = submission as any;
      if (submissionAny?.sellerProfileId || submissionAny?.seller_profile_id) {
        const profileId = submissionAny?.sellerProfileId || submissionAny?.seller_profile_id;
        const proofRows = await db.execute(sql`
          SELECT id FROM seller_documents
          WHERE seller_profile_id = ${String(profileId)}
            AND document_type = 'registry_ownership_proof'
            AND verification_status != 'rejected'
          LIMIT 1
        `);
        if (!((proofRows as any).rows?.length)) {
          return res.status(409).json({ error: 'Registry ownership proof required before approval. Seller must upload proof of registry account ownership.' });
        }
      }

      const newListing = await storage.approveCreditListing(req.params.id);
      invalidateListingCache();
      logAdminAction(req, 'approve_listing', `Listing ${req.params.id} approved — ${newListing.name}`, { affectedRecordId: req.params.id, metadata: { listing_name: newListing.name, standard: newListing.standard } }).catch(() => {});
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
      invalidateListingCache();
      logAdminAction(req, 'reject_listing', `Listing ${req.params.id} rejected — ${rejected.orgName || req.params.id}${req.body.reason ? ` (reason: ${req.body.reason})` : ''}`, { affectedRecordId: req.params.id, metadata: { org: rejected.orgName, reason: req.body.reason || null } }).catch(() => {});
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

      // Audit write BEFORE any mutation — failure blocks the operation
      await logAdminAction(req, 'webhook_retry', `Webhook failure ${req.params.id} retry initiated — event: ${failure.eventType || 'unknown'}, trade: ${failure.tradeId || 'n/a'}`, { affectedRecordId: req.params.id, critical: true, metadata: { event_type: failure.eventType, trade_id: failure.tradeId } });
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

  app.post('/api/daily/create-room', requireExchangeAuth, async (req, res) => {
    try {
      const room = await createDailyRoom();
      if (!room) return res.status(503).json({ error: 'Live video unavailable' });
      return res.json({ roomUrl: room.roomUrl, roomName: room.roomName });
    } catch (err: any) {
      console.error('[Daily] create-room endpoint error:', err?.message || err);
      return res.status(500).json({ error: 'Failed to create room' });
    }
  });

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

  app.post('/api/fastmode/ai-coach', async (req, res) => {
    try {
      const prompt = String(req.body?.prompt || '').trim();
      if (!prompt) return res.status(400).json({ error: 'prompt required' });

      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) return res.status(503).json({ error: 'AI Coach unavailable' });

      const Anthropic = (await import('@anthropic-ai/sdk')).default;
      const client = new Anthropic({ apiKey });
      const response = await client.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 1000,
        system: 'You are FASTMODE AI Coach — an expert in intermittent fasting, fat loss, longevity nutrition (Bryan Johnson Blueprint protocol), and peptide optimization. Give concise, actionable, science-backed advice in 2-4 sentences. Be direct and motivating. No fluff. Format with line breaks for readability.',
        messages: [{ role: 'user', content: prompt }]
      });
      const message = response.content[0].type === 'text' ? response.content[0].text : '';
      return res.json({ message });
    } catch (err: any) {
      console.error('[FASTMODE AI Coach] Error:', err.message);
      return res.status(500).json({ error: 'AI Coach error' });
    }
  });

  app.post('/api/ai/parse-rfq', async (req, res) => {
    try {
      const text = String(req.body?.text || req.body?.prompt || '').trim();
      if (!text) return res.status(400).json({ error: 'text required' });

      const standards = [
        'EU ETS — European Allowances',
        'Verra VCS — Verified Carbon Standard',
        'Gold Standard',
        'CORSIA — Aviation Offsets',
        'Blue Carbon — Seagrass / Coral',
        'REDD++ — Forest Conservation',
        'SwissX B100 — Caribbean Biofuel',
      ];

      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (apiKey) {
        try {
          const Anthropic = (await import('@anthropic-ai/sdk')).default;
          const client = new Anthropic({ apiKey });
          const response = await client.messages.create({
            model: 'claude-sonnet-4-5',
            max_tokens: 600,
            messages: [{
              role: 'user',
              content: `Extract RFQ fields from this text and return ONLY JSON with optional fields: side (buy/sell), standard, volume_tonnes, target_price_eur, deadline, notes. Use one of these standards when possible: ${standards.join(', ')}. Text: "${text}"`
            }]
          });
          const out = response.content[0].type === 'text' ? response.content[0].text : '';
          const match = out.match(/\{[\s\S]*\}/);
          if (match) {
            const rfq = JSON.parse(match[0]);
            return res.json({ rfq });
          }
        } catch (aiErr: any) {
          console.warn('[AI parse-rfq] Anthropic parse failed, using fallback:', aiErr?.message);
        }
      }

      const vol = text.match(/(\d[\d,]*)(?:\s*)(thousand|k)?\s*(?:tonnes?|tons?|t\b)/i);
      const price = text.match(/(?:under|below|at|target)\s*(?:€|eur|euro)?\s*(\d+(?:\.\d+)?)/i);
      const deadline = text.match(/(\d{4}-\d{2}-\d{2})/);
      const inferredStandard =
        /eu\s*ets/i.test(text) ? 'EU ETS — European Allowances' :
        /corsia/i.test(text) ? 'CORSIA — Aviation Offsets' :
        /gold/i.test(text) ? 'Gold Standard' :
        /blue\s*carbon/i.test(text) ? 'Blue Carbon — Seagrass / Coral' :
        /redd/i.test(text) ? 'REDD++ — Forest Conservation' :
        /b100|swissx/i.test(text) ? 'SwissX B100 — Caribbean Biofuel' :
        /vcs|verra/i.test(text) ? 'Verra VCS — Verified Carbon Standard' :
        'Verra VCS — Verified Carbon Standard';

      const rfq = {
        side: /sell/i.test(text) ? 'sell' : 'buy',
        standard: inferredStandard,
        volume_tonnes: vol ? parseInt(vol[1].replace(/,/g, '')) * (/thousand|k/i.test(vol[2] || '') ? 1000 : 1) : 5000,
        target_price_eur: price ? parseFloat(price[1]) : undefined,
        deadline: deadline ? deadline[1] : undefined,
        notes: text,
      };

      res.json({ rfq });
    } catch (err: any) {
      console.error('AI parse RFQ error:', err?.message);
      res.status(500).json({ error: 'Failed to parse RFQ' });
    }
  });

  app.post('/api/exchange/ai-rfq', requireAuth, async (req, res) => {
    try {
      const { message } = req.body;
      if (!message) return res.status(400).json({ error: 'message required' });
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        return res.status(503).json({ error: 'AI service temporarily unavailable. Please fill the form manually.' });
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
        return res.status(503).json({ error: 'AI service temporarily unavailable. Please try again.' });
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
        return res.status(503).json({ error: 'AI service temporarily unavailable. Please try again.' });
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
      res.status(500).json({ error: 'AI service temporarily unavailable. Please try again.' });
    }
  });

  app.post('/api/exchange/multisig-approval', requireAuth, async (req, res) => {
    try {
      const { tradeId, receiptHash, complianceEmail } = req.body;
      if (!tradeId || !complianceEmail) return res.status(400).json({ error: 'tradeId and complianceEmail required' });
      const token = 'APPR-' + Math.random().toString(36).slice(2, 10).toUpperCase() + '-' + Date.now().toString().slice(-4);
      const approvalUrl = `https://uaiu.live/x/verify/${encodeURIComponent(String(receiptHash || ''))}`;
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
        return res.status(503).json({ error: 'AI service temporarily unavailable. Please try again.' });
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

      const text = (msg.content[0] as any).text?.trim() || '';
      if (!text) {
        return res.status(500).json({ error: 'AI service temporarily unavailable. Please try again.' });
      }
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return res.status(500).json({ error: 'AI service temporarily unavailable. Please try again.' });
      }
      const recommendation = JSON.parse(jsonMatch[0]);
      res.json({ recommendation });
    } catch (err: any) {
      console.error('Negotiate error:', err?.message);
      res.status(500).json({ error: 'AI service temporarily unavailable. Please try again.' });
    }
  });

  // ─── Wave 3: Stripe Escrow Routes ────────────────────────────────

  app.post('/api/escrow/create', requireExchangeAuth, async (req, res) => {
    if (!stripeReady) return res.status(503).json({ error: 'Escrow unavailable — Stripe key validation failed at startup' });
    try {
      const authenticatedEmail = String((req as any).exchangeEmail || '').toLowerCase();
      const { trade_id, amount_eur, buyer_email, listing_id, volume_tonnes, standard, seller_connect_account_id } = req.body;
      if (!trade_id || !amount_eur || amount_eur < 100) {
        return res.status(400).json({ error: 'Invalid escrow parameters' });
      }
      const escrowKycEmail = authenticatedEmail || String(buyer_email || '').toLowerCase();
      if (!escrowKycEmail) {
        return res.status(400).json({ error: 'Buyer email is required for escrow creation.' });
      }
      const escrowKycAccount = await storage.getExchangeAccountByEmail(escrowKycEmail);
      if (!escrowKycAccount || escrowKycAccount.kycStatus !== 'verified') {
        return res.status(403).json({ error: 'KYC verification required.' });
      }
      if (!listing_id && !seller_connect_account_id) {
        return res.status(400).json({ error: 'listing_id or seller_connect_account_id is required — cannot determine payment model without seller context.' });
      }
      const stripeKey = process.env.STRIPE_SECRET_KEY;
      if (!stripeKey) return res.status(500).json({ error: 'Stripe not configured' });
      const { default: Stripe } = await import('stripe');
      const stripe = new Stripe(stripeKey, { apiVersion: '2024-12-18.acacia' as any });

      let escrowSellerProfileId = '';
      let escrowConnectAccountId: string = seller_connect_account_id || '';
      let escrowPaymentModel: 'destination_charge' | 'platform_collect' = 'platform_collect';
      if (listing_id) {
        const listingLookup = await db.execute(sql`
          SELECT el.seller_profile_id, sp.stripe_connect_account_id, sp.connect_onboarding_complete
          FROM exchange_listings el
          LEFT JOIN seller_profiles sp ON sp.id = el.seller_profile_id
          WHERE el.id = ${listing_id}
          LIMIT 1
        `).catch(() => ({ rows: [] } as any));
        const listingRow = (listingLookup as any).rows?.[0];
        escrowSellerProfileId = listingRow?.seller_profile_id || '';
        if (!escrowConnectAccountId) escrowConnectAccountId = listingRow?.stripe_connect_account_id || '';
        if (escrowConnectAccountId && listingRow?.connect_onboarding_complete !== true) {
          return res.status(400).json({ error: 'Seller Connect account exists but onboarding is not complete. Cannot create escrow.' });
        }
      }
      // Enforce destination_charge whenever a Connect account is present — regardless of
      // whether it was supplied directly or resolved via listing_id lookup.
      // platform_collect is only valid when no Connect account exists.
      if (escrowConnectAccountId) {
        escrowPaymentModel = 'destination_charge';
      }

      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount_eur * 100),
        currency: 'eur',
        capture_method: 'manual',
        receipt_email: buyer_email,
        application_fee_amount: escrowPaymentModel === 'destination_charge' ? Math.round(amount_eur * 0.0075 * 100) : undefined,
        transfer_data: escrowPaymentModel === 'destination_charge' ? { destination: escrowConnectAccountId } : undefined,
        metadata: { trade_id, listing_id: listing_id || '', volume_tonnes: String(volume_tonnes), standard: standard || '', escrow_type: 'carbon_credit_t1', platform: 'uaiu_exchange', buyer_email: buyer_email || '', created_at: new Date().toISOString(), seller_profile_id: escrowSellerProfileId, seller_connect_account_id: escrowConnectAccountId, payment_model: escrowPaymentModel },
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

  app.post('/api/escrow/release', requireAdminHeader, async (req, res) => {
    if (!stripeReady) return res.status(503).json({ error: 'Escrow unavailable — Stripe key validation failed at startup' });
    try {
      const { payment_intent_id, trade_id } = req.body;
      if (!payment_intent_id) return res.status(400).json({ error: 'Missing payment intent ID' });
      const stripeKey = process.env.STRIPE_SECRET_KEY;
      if (!stripeKey) return res.status(500).json({ error: 'Stripe not configured' });
      const { default: Stripe } = await import('stripe');
      const stripe = new Stripe(stripeKey, { apiVersion: '2024-12-18.acacia' as any });

      const escrowRow = await db.execute(
        sql`SELECT status FROM escrow_settlements_log WHERE payment_intent_id = ${payment_intent_id} LIMIT 1`
      ).catch(() => ({ rows: [] as any[] }));
      const escrowStatus = (escrowRow as any).rows?.[0]?.status;
      if (escrowStatus === 'dispute_hold') {
        return res.status(403).json({ error: 'Cannot release — escrow is under dispute hold' });
      }
      if (escrowStatus === 'payment_failed') {
        return res.status(403).json({ error: 'Cannot release — payment failed' });
      }

      const piCheck = await stripe.paymentIntents.retrieve(payment_intent_id);
      if (piCheck.status !== 'requires_capture') {
        return res.status(400).json({ error: `PI status is '${piCheck.status}' — cannot capture` });
      }
      const piAgeSec = Math.floor(Date.now() / 1000) - piCheck.created;
      const twentyFourHours = 24 * 60 * 60;
      if (piAgeSec < twentyFourHours) {
        const remainingHrs = ((twentyFourHours - piAgeSec) / 3600).toFixed(1);
        return res.status(403).json({ error: `T+1 hold not yet elapsed — ${remainingHrs}h remaining` });
      }

      // Audit intent BEFORE irreversible Stripe capture — failure blocks the operation
      await logAdminAction(req, 'escrow_release_intent', `Escrow release initiated — PI: ${payment_intent_id}, trade: ${trade_id || 'n/a'}, amount: €${(piCheck.amount / 100).toFixed(2)}`, { affectedRecordId: trade_id || payment_intent_id, critical: true, metadata: { payment_intent_id, trade_id, amount_eur: piCheck.amount / 100 } });

      const captured = await stripe.paymentIntents.capture(payment_intent_id);
      const gross = captured.amount / 100;
      const uaiu_fee = gross * 0.0075;
      const seller_net = gross - uaiu_fee;
      const escrowPaymentModel = String((captured.metadata as any)?.payment_model || 'platform_collect');
      logAdminAction(req, 'escrow_release', `Escrow captured — PI: ${payment_intent_id}, trade: ${trade_id || 'n/a'}, gross: €${gross.toFixed(2)}, model: ${escrowPaymentModel}`, { affectedRecordId: trade_id || payment_intent_id, metadata: { payment_intent_id, trade_id, gross_eur: gross, payment_model: escrowPaymentModel } });
      await (req.app.locals.supabase as any)?.from('escrow_settlements').update({ status: 'settled', settled_at: new Date().toISOString(), uaiu_fee_eur: uaiu_fee, seller_net_eur: seller_net, stripe_charge_id: captured.latest_charge }).eq('payment_intent_id', payment_intent_id);
      if (escrowPaymentModel === 'destination_charge' && (captured.metadata as any)?.seller_profile_id) {
        const escrowSellerLookup = await db.execute(sql`
          SELECT exchange_account_email FROM seller_profiles
          WHERE id = ${(captured.metadata as any).seller_profile_id} LIMIT 1
        `).catch(() => ({ rows: [] } as any));
        const escrowSellerEmail = (escrowSellerLookup as any).rows?.[0]?.exchange_account_email || '';
        if (escrowSellerEmail) {
          sendSellerDestinationPayoutEmail({ sellerEmail: escrowSellerEmail, tradeId: trade_id, payoutAmountEur: seller_net, chargeId: String(captured.latest_charge || '') }).catch(() => {});
        }
      }
      try {
        const { sendExchangeEmail } = await import('./email-service');
        await sendExchangeEmail(`Trade ${trade_id} — Settlement Confirmed`, { 'Gross': `€${gross.toLocaleString()}`, 'UAIU Fee (0.75%)': `€${uaiu_fee.toFixed(2)}`, 'Net Settled': `€${seller_net.toFixed(2)}`, 'Settlement Model': escrowPaymentModel, 'Stripe Charge': captured.latest_charge as string });
      } catch (emailError) { console.error('Settlement email error:', emailError); }
      if (trade_id) {
        const tradeRow = await db.execute(sql`
          SELECT seller_registry_name, seller_registry_serial, vintage_year
          FROM exchange_trades WHERE trade_id = ${trade_id} LIMIT 1
        `).catch(() => ({ rows: [] } as any));
        const trow = (tradeRow as any).rows?.[0];
        const escrowSellerLookup2 = await db.execute(sql`
          SELECT exchange_account_email FROM seller_profiles
          WHERE id = ${(captured.metadata as any)?.seller_profile_id || ''} LIMIT 1
        `).catch(() => ({ rows: [] } as any));
        const escrowSellerEmail2 = (escrowSellerLookup2 as any).rows?.[0]?.exchange_account_email || 'seller@uaiu.live';
        sendRetirementUploadRequest({
          tradeId: trade_id,
          sellerEmail: escrowSellerEmail2,
          volumeTonnes: gross / Math.max(1, seller_net / (gross - uaiu_fee)),
          standard: String((captured.metadata as any)?.standard || 'Carbon Credit'),
          registrySerial: trow?.seller_registry_serial || '',
          registryName: trow?.seller_registry_name || '',
          vintageYear: trow?.vintage_year || undefined,
        }).catch(() => {});
      }
      res.json({ success: true, status: 'settled', gross_eur: gross, uaiu_fee_eur: uaiu_fee, seller_net_eur: seller_net, payment_model: escrowPaymentModel, stripe_charge_id: captured.latest_charge, message: `Trade ${trade_id} settled. €${gross.toLocaleString()} captured.` });
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
      if (!apiKey) return res.json({ reply: 'AI service is temporarily unavailable. Please try again later.' });
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

  const predictionCacheMap = new Map<string, { data: any; ts: number }>();
  const PREDICTION_CACHE_TTL = 6 * 60 * 60 * 1000;

  app.post('/api/ai/price-prediction', async (req, res) => {
    try {
      const { current_price, registry, vintage, volume, standard } = req.body;
      const cacheKey = JSON.stringify({ current_price, registry, vintage, volume, standard });
      const cached = predictionCacheMap.get(cacheKey);
      if (cached && Date.now() - cached.ts < PREDICTION_CACHE_TTL) {
        return res.json({ prediction: cached.data, cached: true });
      }
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        return res.status(503).json({ error: 'AI service temporarily unavailable. Please try again.' });
      }
      const listingContext = [
        registry ? `Registry: ${registry}` : null,
        vintage ? `Vintage: ${vintage}` : null,
        volume ? `Volume: ${volume} tonnes` : null,
        standard ? `Standard: ${standard}` : null,
      ].filter(Boolean).join('. ');
      const Anthropic = (await import('@anthropic-ai/sdk')).default;
      const client = new Anthropic({ apiKey });
      const msg = await client.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 800,
        messages: [{ role: 'user', content: `You are a carbon market price analyst. Current UAIU Caribbean Premium Index: €${current_price}/tonne. Date: ${new Date().toDateString()}.${listingContext ? ' Listing context: ' + listingContext + '.' : ''} Analyze and forecast. Respond ONLY with JSON no markdown: {"forecast_7d":number,"forecast_30d":number,"direction":"bullish"|"bearish"|"neutral","confidence":number,"rationale":"2-3 sentences","range_7d":{"low":number,"high":number},"range_30d":{"low":number,"high":number},"key_drivers":["5 specific market factors"]}` }],
      });
      const text = (msg.content.find((b: any) => b.type === 'text') as any)?.text || '{}';
      const prediction = JSON.parse(text.replace(/```json|```/g, '').trim());
      predictionCacheMap.set(cacheKey, { data: prediction, ts: Date.now() });
      if (predictionCacheMap.size > 50) {
        const entries = Array.from(predictionCacheMap.entries());
        const oldest = entries.sort((a, b) => a[1].ts - b[1].ts)[0];
        if (oldest) predictionCacheMap.delete(oldest[0]);
      }
      res.json({ prediction });
    } catch (e: any) {
      console.error('Prediction error:', e);
      res.status(500).json({ error: 'AI service temporarily unavailable. Please try again.' });
    }
  });

  app.post('/api/ai/due-diligence', async (req, res) => {
    try {
      const { listing, market_price } = req.body;
      if (!listing) return res.status(400).json({ error: 'No listing provided' });
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        return res.status(503).json({ error: 'AI service temporarily unavailable. Please try again.' });
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
      res.status(500).json({ error: 'AI service temporarily unavailable. Please try again.' });
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

  // ── Sitemap & Robots SEO ──────────────────────────────────────────────────
  app.get('/sitemap.xml', (_req, res) => {
    const now = new Date().toISOString().split('T')[0];
    const pages = [
      { path: '/', priority: '1.0', freq: 'weekly' },
      { path: '/x', priority: '0.9', freq: 'weekly' },
      { path: '/blog', priority: '0.8', freq: 'weekly' },
      { path: '/navigator', priority: '0.8', freq: 'weekly' },
      { path: '/navigator/intake', priority: '0.6', freq: 'monthly' },
      { path: '/navigator/projects', priority: '0.6', freq: 'monthly' },
      { path: '/security', priority: '0.5', freq: 'monthly' },
      { path: '/status', priority: '0.5', freq: 'weekly' },
      { path: '/legal', priority: '0.5', freq: 'monthly' },
    ];
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map(p => `  <url>
    <loc>https://uaiu.live${p.path}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>${p.freq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`).join('\n')}
</urlset>`;
    res.set('Content-Type', 'application/xml');
    res.send(xml);
  });

  // ── Navigator routes ───────────────────────────────────────────────────────
  registerNavigatorRoutes(app);

  // ── Ops monitoring routes ──────────────────────────────────────────────────
  registerOpsRoutes(app);

  // ── Autonomous marketplace routes ─────────────────────────────────────────
  registerAutonomousMarketplaceRoutes(app);

  // ── FIX 3: Start cron watchdog for stuck escrow trades ──────────────────────
  startCronJobs(app);

  // Socket.IO is now attached to the HTTP server passed in from runApp
  // No need to return the server
}
