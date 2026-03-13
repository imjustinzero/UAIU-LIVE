import type { Express, Request } from "express";
import rateLimit from "express-rate-limit";
import { sql } from "drizzle-orm";
import { db } from "./db";
import { storage } from "./storage";
import { requireAdminHeader, requireExchangeAuth, safeError } from "./exchange-auth";
import { createHash } from "crypto";
import {
  createConnectAccount,
  createOnboardingLink,
  getConnectAccountStatus,
  createTransfer,
  getBaseUrl,
} from "./stripe-connect";

async function logAdminAction(req: any, type: string, message: string): Promise<void> {
  try {
    const adminKey = String(req.headers['x-admin-key'] || '');
    const userId = adminKey
      ? createHash('sha256').update(adminKey).digest('hex').slice(0, 16)
      : 'unknown';
    await storage.addActionLog({ userId, userName: 'admin', type, message });
  } catch (_) {}
}

type RuleEval = {
  decision: "approved" | "manual_review" | "rejected";
  reason: string;
  ruleHits: string[];
  priority: number;
  riskScore: number;
};

function reqIp(req: Request): string {
  return String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "");
}

function approvedStandard(input: string): boolean {
  const value = (input || "").toUpperCase();
  return [
    "EU ETS",
    "EU ETS — EUROPEAN UNION ALLOWANCES",
    "VCS",
    "VCS — VERIFIED CARBON STANDARD",
    "GOLD STANDARD",
    "GOLD STD",
    "CORSIA",
    "CORSIA — AVIATION OFFSETS",
    "BLUE CARBON / VCS",
  ].includes(value);
}

function evaluateListingRules(input: {
  kybStatus?: string | null;
  registrySerial?: string | null;
  volumeTonnes?: number | null;
  askingPricePerTonne?: number | null;
  standard?: string | null;
  inventoryVerified?: boolean;
  riskScore?: number | null;
}): RuleEval {
  const hits: string[] = [];
  let risk = Number(input.riskScore || 0);
  let priority = 100;

  if (input.kybStatus !== "verified") {
    hits.push("kyb_not_verified");
    risk += 35;
    priority = 10;
  }

  if (!input.registrySerial || input.registrySerial.trim().length < 6) {
    hits.push("registry_serial_missing_or_short");
    risk += 20;
    priority = Math.min(priority, 20);
  }

  if (!input.volumeTonnes || input.volumeTonnes <= 0) {
    hits.push("invalid_volume");
    risk += 50;
    priority = 1;
  }

  if (!input.askingPricePerTonne || input.askingPricePerTonne <= 0) {
    hits.push("invalid_price");
    risk += 50;
    priority = 1;
  }

  if (!approvedStandard(String(input.standard || ""))) {
    hits.push("unsupported_standard");
    risk += 30;
    priority = Math.min(priority, 15);
  }

  if (!input.inventoryVerified) {
    hits.push("inventory_not_verified");
    risk += 15;
    priority = Math.min(priority, 25);
  }

  if (hits.includes("invalid_volume") || hits.includes("invalid_price")) {
    return {
      decision: "rejected",
      reason: "Listing rejected by rules engine.",
      ruleHits: hits,
      priority,
      riskScore: risk,
    };
  }

  if (risk >= 40) {
    return {
      decision: "manual_review",
      reason: "Listing queued for manual review.",
      ruleHits: hits,
      priority,
      riskScore: risk,
    };
  }

  return {
    decision: "approved",
    reason: "Listing auto-approved by rules engine.",
    ruleHits: hits.length ? hits : ["auto_pass"],
    priority,
    riskScore: risk,
  };
}

async function raiseException(entityType: string, entityId: string, code: string, message: string, detail: any = {}, severity = "medium") {
  await db.execute(sql`
    INSERT INTO exchange_exception_queue (entity_type, entity_id, severity, status, code, message, detail)
    VALUES (${entityType}, ${entityId}, ${severity}, 'open', ${code}, ${message}, ${JSON.stringify(detail)}::jsonb)
  `);
}

export function registerAutonomousMarketplaceRoutes(app: Express) {
  const sellerOnboardLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many onboarding attempts. Please try again later." },
  });

  // Seller onboarding profile + KYB/KYC bootstrap
  app.post("/api/seller/onboard/automatic", requireExchangeAuth, sellerOnboardLimiter, async (req, res) => {
    try {
      const email = String((req as any).exchangeEmail || "").toLowerCase();
      const {
        legalEntityName,
        tradingName,
        sellerType,
        country,
        registryName,
        registryAccountId,
        website,
        taxId,
        payoutMethod,
        payoutReference,
      } = req.body || {};

      if (!legalEntityName || !registryName || !registryAccountId) {
        return res.status(400).json({ error: "legalEntityName, registryName, and registryAccountId are required." });
      }

      const account = await storage.getExchangeAccountByEmail(email);
      if (!account) return res.status(404).json({ error: "Exchange account not found." });
      if (account.kycStatus !== 'verified') {
        return res.status(403).json({ error: 'KYC verification required.' });
      }

      const result = await db.execute(sql`
        INSERT INTO seller_profiles (
          exchange_account_email,
          legal_entity_name,
          trading_name,
          seller_type,
          country,
          registry_name,
          registry_account_id,
          website,
          tax_id,
          payout_method,
          payout_reference,
          onboarding_status,
          kyb_status,
          kyc_status,
          updated_at
        )
        VALUES (
          ${email},
          ${legalEntityName},
          ${tradingName || null},
          ${sellerType || 'corporate'},
          ${country || null},
          ${registryName},
          ${registryAccountId},
          ${website || null},
          ${taxId || null},
          ${payoutMethod || 'bank_transfer'},
          ${payoutReference || null},
          'pending_kyb',
          CASE WHEN ${account.kycStatus || 'not_started'} = 'verified' THEN 'verified' ELSE 'pending' END,
          ${account.kycStatus || 'not_started'},
          NOW()
        )
        ON CONFLICT (exchange_account_email)
        DO UPDATE SET
          legal_entity_name = EXCLUDED.legal_entity_name,
          trading_name = EXCLUDED.trading_name,
          seller_type = EXCLUDED.seller_type,
          country = EXCLUDED.country,
          registry_name = EXCLUDED.registry_name,
          registry_account_id = EXCLUDED.registry_account_id,
          website = EXCLUDED.website,
          tax_id = EXCLUDED.tax_id,
          payout_method = EXCLUDED.payout_method,
          payout_reference = EXCLUDED.payout_reference,
          updated_at = NOW()
        RETURNING *
      `);

      return res.json({
        success: true,
        sellerProfile: (result as any).rows?.[0] || null,
        nextStep: "Upload / verify KYB documents and inventory.",
      });
    } catch (e: any) {
      return res.status(500).json({ error: safeError(e) });
    }
  });

  // Admin KYB decision
  app.patch("/api/admin/seller/kyb/:sellerProfileId", requireAdminHeader, async (req, res) => {
    try {
      const { sellerProfileId } = req.params;
      const { kybStatus, riskScore = 0, autoApproved = false, note } = req.body || {};

      if (!["verified", "rejected", "pending"].includes(String(kybStatus))) {
        return res.status(400).json({ error: "kybStatus must be verified, rejected, or pending." });
      }

      await db.execute(sql`
        UPDATE seller_profiles
        SET
          kyb_status = ${kybStatus},
          onboarding_status = CASE
            WHEN ${kybStatus} = 'verified' THEN 'active'
            WHEN ${kybStatus} = 'rejected' THEN 'blocked'
            ELSE 'pending_kyb'
          END,
          risk_score = ${Number(riskScore)},
          auto_approved = ${Boolean(autoApproved)},
          last_reviewed_at = NOW(),
          updated_at = NOW()
        WHERE id = ${sellerProfileId}
      `);
      logAdminAction(req, 'kyb_update', `Seller ${sellerProfileId} KYB set to ${kybStatus}${note ? ` — ${note}` : ''}`).catch(() => {});

      if (String(kybStatus) === "rejected") {
        await raiseException("seller_profile", sellerProfileId, "kyb_rejected", note || "Seller KYB rejected.", { sellerProfileId }, "high");
      }

      return res.json({ success: true });
    } catch (e: any) {
      return res.status(500).json({ error: safeError(e) });
    }
  });

  // Seller inventory / registry verification record
  app.post("/api/seller/inventory/verify", requireExchangeAuth, async (req, res) => {
    try {
      const email = String((req as any).exchangeEmail || "").toLowerCase();
      const {
        listingSubmissionId,
        registrySerial,
        standard,
        requestedVolumeTonnes,
        verifiedVolumeTonnes,
        verificationMethod = "manual_plus_rules",
        evidence = {},
      } = req.body || {};

      if (!registrySerial || !standard || !requestedVolumeTonnes) {
        return res.status(400).json({ error: "registrySerial, standard, and requestedVolumeTonnes are required." });
      }

      const sellerProfile = await db.execute(sql`
        SELECT * FROM seller_profiles WHERE exchange_account_email = ${email} LIMIT 1
      `);
      const seller = (sellerProfile as any).rows?.[0];
      if (!seller) return res.status(404).json({ error: "Seller profile not found." });

      const kycCheckAcct = await storage.getExchangeAccountByEmail(email);
      if (!kycCheckAcct || kycCheckAcct.kycStatus !== 'verified') {
        return res.status(403).json({ error: 'KYC verification required.' });
      }

      const verificationStatus =
        String(verifiedVolumeTonnes || requestedVolumeTonnes) > "0" && String(registrySerial).trim().length >= 6
          ? "verified"
          : "pending";

      const insert = await db.execute(sql`
        INSERT INTO seller_inventory_verifications (
          seller_profile_id,
          listing_submission_id,
          registry_serial,
          standard,
          requested_volume_tonnes,
          verified_volume_tonnes,
          verification_status,
          verification_method,
          evidence_json,
          verified_at
        )
        VALUES (
          ${seller.id},
          ${listingSubmissionId || null},
          ${registrySerial},
          ${standard},
          ${Number(requestedVolumeTonnes)},
          ${Number(verifiedVolumeTonnes || requestedVolumeTonnes)},
          ${verificationStatus},
          ${verificationMethod},
          ${JSON.stringify(evidence)}::jsonb,
          CASE WHEN ${verificationStatus} = 'verified' THEN NOW() ELSE NULL END
        )
        RETURNING *
      `);

      return res.json({ success: true, verification: (insert as any).rows?.[0] || null });
    } catch (e: any) {
      return res.status(500).json({ error: safeError(e) });
    }
  });

  // Seller listing auto-submit -> applies rules and either auto-approves or queues
  app.post("/api/seller/listing/auto-submit", requireExchangeAuth, async (req, res) => {
    try {
      const email = String((req as any).exchangeEmail || "").toLowerCase();
      const {
        orgName,
        contactName,
        standard,
        creditType,
        volumeTonnes,
        askingPricePerTonne,
        projectOrigin,
        registrySerial,
        registryName,
        vintageYear,
      } = req.body || {};

      if (!orgName || !contactName || !standard || !creditType || !volumeTonnes || !askingPricePerTonne || !projectOrigin) {
        return res.status(400).json({ error: "Missing required listing fields." });
      }

      const LISTING_ALLOWED_REGISTRIES = ['Verra', 'Gold Standard', 'EU ETS', 'ACR', 'CAR', 'other'];
      const parsedVolume = parseFloat(String(volumeTonnes));
      if (isNaN(parsedVolume) || parsedVolume <= 0) {
        return res.status(400).json({ error: "volume_tonnes must be a positive number." });
      }
      if (String(standard).trim().length === 0) {
        return res.status(400).json({ error: "standard must be a non-empty string." });
      }
      if (registryName !== undefined && !LISTING_ALLOWED_REGISTRIES.includes(String(registryName))) {
        return res.status(400).json({ error: `registry_name must be one of: ${LISTING_ALLOWED_REGISTRIES.join(', ')}.` });
      }
      if (vintageYear !== undefined) {
        const currentYear = new Date().getFullYear();
        const vy = parseInt(String(vintageYear));
        if (isNaN(vy) || vy < 2010 || vy > currentYear) {
          return res.status(400).json({ error: `vintage_year must be an integer between 2010 and ${currentYear}.` });
        }
      }

      const sellerProfileResult = await db.execute(sql`
        SELECT * FROM seller_profiles WHERE exchange_account_email = ${email} LIMIT 1
      `);
      const seller = (sellerProfileResult as any).rows?.[0];
      if (!seller) return res.status(404).json({ error: "Seller profile not found." });

      const kycCheckAcct = await storage.getExchangeAccountByEmail(email);
      if (!kycCheckAcct || kycCheckAcct.kycStatus !== 'verified') {
        return res.status(403).json({ error: 'KYC verification required.' });
      }

      const listing = await storage.createExchangeCreditListing({
        orgName,
        contactName,
        email,
        standard,
        creditType,
        volumeTonnes: String(volumeTonnes),
        askingPricePerTonne: String(askingPricePerTonne),
        projectOrigin,
        registrySerial: registrySerial || null,
      });

      const verificationResult = await db.execute(sql`
        SELECT *
        FROM seller_inventory_verifications
        WHERE seller_profile_id = ${seller.id}
          AND registry_serial = ${registrySerial || ""}
        ORDER BY created_at DESC
        LIMIT 1
      `);
      const inventory = (verificationResult as any).rows?.[0];

      const rules = evaluateListingRules({
        kybStatus: seller.kyb_status,
        registrySerial,
        volumeTonnes: Number(volumeTonnes),
        askingPricePerTonne: Number(askingPricePerTonne),
        standard,
        inventoryVerified: inventory?.verification_status === "verified",
        riskScore: seller.risk_score,
      });

      await db.execute(sql`
        INSERT INTO exchange_listing_review_queue (
          listing_submission_id,
          seller_profile_id,
          decision,
          reason,
          rule_hits,
          auto_decision,
          priority,
          decided_at
        )
        VALUES (
          ${listing.id},
          ${seller.id},
          ${rules.decision === "approved" ? "approved" : rules.decision === "rejected" ? "rejected" : "pending"},
          ${rules.reason},
          ${JSON.stringify(rules.ruleHits)}::jsonb,
          ${rules.decision !== "manual_review"},
          ${rules.priority},
          CASE WHEN ${rules.decision} != 'manual_review' THEN NOW() ELSE NULL END
        )
      `);

      await db.execute(sql`
        UPDATE seller_profiles
        SET risk_score = ${rules.riskScore}, updated_at = NOW()
        WHERE id = ${seller.id}
      `);

      if (rules.decision === "approved") {
        const approved = await storage.approveCreditListing(listing.id);
        return res.json({
          success: true,
          mode: "auto_approved",
          listing,
          approvedListing: approved,
          ruleHits: rules.ruleHits,
        });
      }

      if (rules.decision === "rejected") {
        await storage.rejectCreditListing(listing.id);
        await raiseException("listing_submission", listing.id, "listing_auto_rejected", rules.reason, { ruleHits: rules.ruleHits }, "high");
        return res.status(422).json({
          success: false,
          mode: "rejected",
          listing,
          reason: rules.reason,
          ruleHits: rules.ruleHits,
        });
      }

      return res.json({
        success: true,
        mode: "manual_review",
        listing,
        reason: rules.reason,
        ruleHits: rules.ruleHits,
      });
    } catch (e: any) {
      return res.status(500).json({ error: safeError(e) });
    }
  });

  // RFQ auto-match
  app.post("/api/exchange/rfq/auto-match", requireExchangeAuth, async (req, res) => {
    try {
      const buyerEmail = String((req as any).exchangeEmail || "").toLowerCase();
      const { rfqId, maxPriceSlippagePct = 8 } = req.body || {};
      if (!rfqId) return res.status(400).json({ error: "rfqId required." });

      const kycCheckAcct = await storage.getExchangeAccountByEmail(buyerEmail);
      if (!kycCheckAcct || kycCheckAcct.kycStatus !== 'verified') {
        return res.status(403).json({ error: 'KYC verification required.' });
      }

      const rfqResult = await db.execute(sql`
        SELECT * FROM exchange_rfqs WHERE id = ${rfqId} LIMIT 1
      `);
      const rfq = (rfqResult as any).rows?.[0];
      if (!rfq) return res.status(404).json({ error: "RFQ not found." });
      if (String(rfq.email).toLowerCase() !== buyerEmail) {
        return res.status(403).json({ error: "You can only auto-match your own RFQ." });
      }

      if (rfq.expires_at && new Date(rfq.expires_at) < new Date()) {
        return res.status(409).json({ error: "RFQ has expired." });
      }
      if (rfq.status && rfq.status !== 'active') {
        return res.status(409).json({ error: `RFQ is not available for matching (status: ${rfq.status}).` });
      }

      const targetPrice = Number(rfq.target_price || 0);
      const maxPrice = targetPrice > 0 ? targetPrice * (1 + Number(maxPriceSlippagePct) / 100) : null;

      const candidatesResult = await db.execute(sql`
        SELECT
          el.*,
          sp.id AS seller_profile_id,
          sp.exchange_account_email AS seller_email,
          sp.kyb_status,
          sp.onboarding_status,
          sp.risk_score
        FROM exchange_listings el
        JOIN exchange_credit_listings ecl
          ON ecl.org_name = split_part(el.name, ' — ', 2)
        JOIN seller_profiles sp
          ON sp.exchange_account_email = ecl.email
        WHERE el.status = 'active'
          AND el.standard = ${rfq.standard}
          AND sp.kyb_status = 'verified'
          AND sp.onboarding_status = 'active'
          ${" "}
        ORDER BY el.price_per_tonne ASC, sp.risk_score ASC, el.created_at DESC
        LIMIT 10
      `);

      const candidates = (candidatesResult as any).rows || [];
      const viable = candidates.find((c: any) => maxPrice == null || Number(c.price_per_tonne) <= maxPrice);

      if (!viable) {
        await raiseException("rfq", rfqId, "rfq_no_match", "No viable seller listing found for RFQ.", { rfqId, standard: rfq.standard }, "medium");
        return res.status(404).json({ error: "No viable listing found." });
      }

      const confidence = Math.max(
        60,
        100
          - Math.min(25, viable.risk_score || 0)
          - (targetPrice > 0 ? Math.min(15, Math.round(((Number(viable.price_per_tonne) - targetPrice) / targetPrice) * 100)) : 0)
      );

      const claimResult = await db.execute(sql`
        UPDATE exchange_rfqs
        SET status = 'accepted'
        WHERE id = ${rfqId} AND status = 'active'
        RETURNING id
      `);
      if (!((claimResult as any).rows?.length)) {
        return res.status(409).json({ error: "RFQ has already been accepted or is no longer available." });
      }

      const matchResult = await db.execute(sql`
        INSERT INTO exchange_rfq_matches (
          rfq_id,
          listing_id,
          seller_profile_id,
          buyer_email,
          seller_email,
          standard,
          matched_volume_tonnes,
          matched_price_per_tonne,
          status,
          negotiation_summary,
          confidence
        )
        VALUES (
          ${rfqId},
          ${viable.id},
          ${viable.seller_profile_id},
          ${buyerEmail},
          ${viable.seller_email},
          ${rfq.standard},
          ${Math.min(Number(rfq.volume_tonnes), 999999999)},
          ${Number(viable.price_per_tonne)},
          'proposed',
          ${`Auto-match proposed from active listing ${viable.name}.`},
          ${confidence}
        )
        RETURNING *
      `);

      return res.json({
        success: true,
        match: (matchResult as any).rows?.[0] || null,
        listing: viable,
      });
    } catch (e: any) {
      return res.status(500).json({ error: safeError(e) });
    }
  });

  // Settlement run -> creates payout release workflow row
  app.post("/api/exchange/settlement/run/:tradeId", requireAdminHeader, async (req, res) => {
    try {
      const { tradeId } = req.params;
      const trade = await storage.getExchangeTradeByTradeId(tradeId);
      if (!trade) return res.status(404).json({ error: "Trade not found." });
      if (trade.status !== "completed" && trade.status !== "retired") {
        return res.status(400).json({ error: "Trade is not settlement-ready." });
      }

      const listingSeller = await db.execute(sql`
        SELECT
          sp.id AS seller_profile_id,
          sp.exchange_account_email AS seller_email,
          sp.payout_method,
          sp.payout_reference
        FROM seller_profiles sp
        JOIN exchange_credit_listings ecl
          ON ecl.email = sp.exchange_account_email
        WHERE ecl.standard = ${trade.standard}
        ORDER BY ecl.created_at DESC
        LIMIT 1
      `);
      const seller = (listingSeller as any).rows?.[0];
      if (!seller) {
        await raiseException("trade", tradeId, "seller_profile_missing", "Could not resolve seller for settlement.", { tradeId, standard: trade.standard }, "high");
        return res.status(422).json({ error: "Seller payout target not found." });
      }

      const fee = Number(trade.feeEur || 0);
      const gross = Number(trade.grossEur || 0);
      const sellerNet = Math.max(0, gross - fee);

      const existingPayoutResult = await db.execute(sql`
        SELECT * FROM seller_payouts WHERE trade_id = ${tradeId} ORDER BY created_at DESC LIMIT 1
      `);
      const existingPayoutRow = (existingPayoutResult as any).rows?.[0];

      const payout = existingPayoutRow
        ? { rows: [existingPayoutRow] }
        : await db.execute(sql`
          INSERT INTO seller_payouts (
            trade_id,
            seller_profile_id,
            seller_email,
            gross_eur,
            fee_eur,
            seller_net_eur,
            payout_status,
            payout_provider,
            payout_reference,
            settlement_method
          )
          VALUES (
            ${tradeId},
            ${seller.seller_profile_id},
            ${seller.seller_email},
            ${gross},
            ${fee},
            ${sellerNet},
            'pending_release',
            'workflow_only',
            ${seller.payout_reference || null},
            'platform_collect'
          )
          RETURNING *
        `);

      const payoutRow = (payout as any).rows?.[0];

      await db.execute(sql`
        INSERT INTO exchange_settlement_runs (
          trade_id,
          payout_id,
          seller_email,
          buyer_email,
          gross_eur,
          fee_eur,
          seller_net_eur,
          settlement_status,
          detail,
          settled_at
        )
        VALUES (
          ${tradeId},
          ${payoutRow?.id || null},
          ${seller.seller_email},
          ${trade.accountEmail},
          ${gross},
          ${fee},
          ${sellerNet},
          'prepared',
          ${JSON.stringify({ payoutMethod: seller.payout_method || "bank_transfer" })}::jsonb,
          NOW()
        )
      `);

      logAdminAction(req, 'settlement_run', `Settlement run for trade ${tradeId} — seller: ${seller.seller_email}, net: €${sellerNet.toFixed(2)}`).catch(() => {});

      return res.json({
        success: true,
        tradeId,
        sellerEmail: seller.seller_email,
        sellerNetEur: sellerNet,
        payout: payoutRow || null,
      });
    } catch (e: any) {
      return res.status(500).json({ error: safeError(e) });
    }
  });

  // Stripe Connect — start or resume onboarding
  app.post("/api/seller/connect/onboard", requireExchangeAuth, async (req, res) => {
    try {
      const email = String((req as any).exchangeEmail || "").toLowerCase();
      const baseUrl = getBaseUrl(req);

      const kycCheckAcct = await storage.getExchangeAccountByEmail(email);
      if (!kycCheckAcct || kycCheckAcct.kycStatus !== 'verified') {
        return res.status(403).json({ error: 'KYC verification required.' });
      }

      const profileResult = await db.execute(sql`
        SELECT * FROM seller_profiles WHERE exchange_account_email = ${email} LIMIT 1
      `);
      const profile = (profileResult as any).rows?.[0];
      if (!profile) {
        return res.status(404).json({ error: "Seller profile not found. Complete seller onboarding first." });
      }

      let connectAccountId = profile.stripe_connect_account_id;

      if (!connectAccountId) {
        const country = profile.country || "US";
        connectAccountId = await createConnectAccount(email, country);
        await db.execute(sql`
          UPDATE seller_profiles
          SET stripe_connect_account_id = ${connectAccountId}, updated_at = NOW()
          WHERE id = ${profile.id}
        `);
      }

      const onboardingUrl = await createOnboardingLink(connectAccountId, baseUrl);
      return res.json({ success: true, onboardingUrl, connectAccountId });
    } catch (e: any) {
      return res.status(500).json({ error: safeError(e) });
    }
  });

  // Stripe Connect — get current account status
  app.get("/api/seller/connect/status", requireExchangeAuth, async (req, res) => {
    try {
      const email = String((req as any).exchangeEmail || "").toLowerCase();

      const profileResult = await db.execute(sql`
        SELECT sp.*,
          (SELECT json_agg(p ORDER BY p.created_at DESC)
           FROM seller_payouts p WHERE p.seller_email = ${email}
          ) AS payout_history
        FROM seller_profiles sp
        WHERE sp.exchange_account_email = ${email}
        LIMIT 1
      `);
      const profile = (profileResult as any).rows?.[0];
      if (!profile) {
        return res.json({ hasProfile: false });
      }

      let connectStatus = null;
      if (profile.stripe_connect_account_id) {
        try {
          connectStatus = await getConnectAccountStatus(profile.stripe_connect_account_id);
          if (connectStatus.ready && !profile.connect_onboarding_complete) {
            await db.execute(sql`
              UPDATE seller_profiles
              SET connect_onboarding_complete = true,
                  connect_details_submitted = true,
                  updated_at = NOW()
              WHERE id = ${profile.id}
            `);
            profile.connect_onboarding_complete = true;
          }
        } catch {
          connectStatus = { error: "Could not retrieve Stripe account status." };
        }
      }

      return res.json({
        hasProfile: true,
        sellerProfileId: profile.id,
        onboardingStatus: profile.onboarding_status,
        connectAccountId: profile.stripe_connect_account_id || null,
        connectOnboardingComplete: profile.connect_onboarding_complete,
        connectDetailsSubmitted: profile.connect_details_submitted,
        connectStatus,
        payoutHistory: profile.payout_history || [],
      });
    } catch (e: any) {
      return res.status(500).json({ error: safeError(e) });
    }
  });

  // Stripe Connect — refresh onboarding link for incomplete accounts
  app.post("/api/seller/connect/refresh-link", requireExchangeAuth, async (req, res) => {
    try {
      const email = String((req as any).exchangeEmail || "").toLowerCase();
      const baseUrl = getBaseUrl(req);

      const kycCheckAcct = await storage.getExchangeAccountByEmail(email);
      if (!kycCheckAcct || kycCheckAcct.kycStatus !== 'verified') {
        return res.status(403).json({ error: 'KYC verification required.' });
      }

      const profileResult = await db.execute(sql`
        SELECT * FROM seller_profiles WHERE exchange_account_email = ${email} LIMIT 1
      `);
      const profile = (profileResult as any).rows?.[0];
      if (!profile?.stripe_connect_account_id) {
        return res.status(404).json({ error: "No Connect account found. Start onboarding first." });
      }
      const onboardingUrl = await createOnboardingLink(profile.stripe_connect_account_id, baseUrl);
      return res.json({ success: true, onboardingUrl });
    } catch (e: any) {
      return res.status(500).json({ error: safeError(e) });
    }
  });

  // Release payout — routes through Stripe Connect transfer when account is ready
  app.post("/api/exchange/payout/release/:tradeId", requireAdminHeader, async (req, res) => {
    try {
      const { tradeId } = req.params;
      const payoutResult = await db.execute(sql`
        SELECT sp.*, prof.stripe_connect_account_id, prof.connect_onboarding_complete
        FROM seller_payouts sp
        LEFT JOIN seller_profiles prof ON prof.id = sp.seller_profile_id
        WHERE sp.trade_id = ${tradeId}
        ORDER BY sp.created_at DESC LIMIT 1
      `);
      const payout = (payoutResult as any).rows?.[0];
      if (!payout) return res.status(404).json({ error: "Payout not found." });
      if (payout.payout_status === "paid" || payout.payout_status === "released") {
        return res.json({ success: true, alreadyReleased: true, payout });
      }
      logAdminAction(req, 'payout_release', `Payout release initiated — trade: ${tradeId}, seller: ${payout.seller_email || 'n/a'}, net: €${payout.seller_net_eur || '?'}`).catch(() => {});

      // ── Destination charge: funds already with seller — no transfer needed
      if (payout.settlement_method === 'destination_charge') {
        await db.execute(sql`
          UPDATE seller_payouts
          SET payout_status = 'paid',
              payout_provider = 'stripe_destination',
              released_at = COALESCE(released_at, NOW()),
              stripe_transfer_id = COALESCE(stripe_transfer_id, payout_reference),
              updated_at = NOW()
          WHERE id = ${payout.id}
        `);
        await db.execute(sql`
          UPDATE exchange_settlement_runs
          SET settlement_status = 'released', settled_at = NOW()
          WHERE trade_id = ${tradeId}
        `);
        return res.json({
          success: true,
          method: 'stripe_destination',
          tradeId,
          payoutId: payout.id,
          sellerNet: payout.seller_net_eur,
          transferId: payout.stripe_transfer_id || payout.payout_reference || null,
        });
      }

      const connectAccountId: string | null = payout.stripe_connect_account_id || null;
      const connectReady: boolean = payout.connect_onboarding_complete === true;

      // ── Path A: Stripe Connect transfer ─────────────────────────────────
      if (connectAccountId && connectReady) {
        try {
          const transfer = await createTransfer(
            Number(payout.seller_net_eur),
            connectAccountId,
            tradeId,
            String(payout.seller_email)
          );
          await db.execute(sql`
            UPDATE seller_payouts
            SET payout_status = 'paid',
                payout_provider = 'stripe_connect',
                payout_reference = ${transfer.id},
                stripe_transfer_id = ${transfer.id},
                connect_account_id = ${connectAccountId},
                released_at = NOW()
            WHERE id = ${payout.id}
          `);
          await db.execute(sql`
            UPDATE exchange_settlement_runs
            SET settlement_status = 'released', settled_at = NOW()
            WHERE trade_id = ${tradeId}
          `);
          return res.json({
            success: true,
            method: "stripe_connect",
            transferId: transfer.id,
            tradeId,
            payoutId: payout.id,
            sellerNet: payout.seller_net_eur,
          });
        } catch (transferErr: any) {
          const errMsg = transferErr?.message || "Transfer failed";
          await db.execute(sql`
            UPDATE seller_payouts
            SET payout_status = 'failed',
                failure_reason = ${errMsg},
                updated_at = NOW()
            WHERE id = ${payout.id}
          `);
          await raiseException("trade", tradeId, "transfer_failed", `Stripe transfer failed: ${errMsg}`, { tradeId, payoutId: payout.id, connectAccountId }, "high");
          return res.status(502).json({ error: "Stripe transfer failed. Added to exception queue.", detail: errMsg });
        }
      }

      // ── Path B: No connect account or onboarding incomplete — queue exception
      const reason = !connectAccountId
        ? "No Stripe Connect account linked. Seller must complete payout onboarding."
        : "Stripe Connect onboarding incomplete. Seller must finish verification.";

      await db.execute(sql`
        UPDATE seller_payouts
        SET payout_status = 'pending_connect',
            failure_reason = ${reason}
        WHERE id = ${payout.id}
      `);
      await raiseException(
        "trade",
        tradeId,
        "connect_account_incomplete",
        reason,
        { tradeId, sellerEmail: payout.seller_email, connectAccountId },
        "medium"
      );
      return res.status(422).json({
        error: reason,
        action: "Seller must complete Stripe Connect onboarding at /x/seller before payout can be released.",
      });
    } catch (e: any) {
      return res.status(500).json({ error: safeError(e) });
    }
  });

  // Admin autonomy queue
  app.get("/api/admin/autonomous-marketplace/queue", requireAdminHeader, async (_req, res) => {
    try {
      const [reviewQueue, exceptions, payouts, matches, sellerProfiles] = await Promise.all([
        db.execute(sql`SELECT * FROM exchange_listing_review_queue ORDER BY decision ASC, priority ASC, created_at DESC LIMIT 100`),
        db.execute(sql`SELECT * FROM exchange_exception_queue WHERE status = 'open' ORDER BY severity ASC, created_at DESC LIMIT 100`),
        db.execute(sql`
          SELECT sp.*, prof.stripe_connect_account_id, prof.connect_onboarding_complete, prof.legal_entity_name
          FROM seller_payouts sp
          LEFT JOIN seller_profiles prof ON prof.id = sp.seller_profile_id
          ORDER BY sp.created_at DESC LIMIT 100
        `),
        db.execute(sql`SELECT * FROM exchange_rfq_matches ORDER BY created_at DESC LIMIT 100`),
        db.execute(sql`
          SELECT id, exchange_account_email, legal_entity_name, onboarding_status,
                 kyb_status, stripe_connect_account_id, connect_onboarding_complete,
                 connect_details_submitted, created_at, updated_at
          FROM seller_profiles ORDER BY created_at DESC LIMIT 100
        `),
      ]);

      return res.json({
        reviewQueue: (reviewQueue as any).rows || [],
        exceptions: (exceptions as any).rows || [],
        payouts: (payouts as any).rows || [],
        rfqMatches: (matches as any).rows || [],
        sellerProfiles: (sellerProfiles as any).rows || [],
      });
    } catch (e: any) {
      return res.status(500).json({ error: safeError(e) });
    }
  });

  // Exception resolution
  app.post("/api/admin/exceptions/:id/resolve", requireAdminHeader, async (req, res) => {
    try {
      const { id } = req.params;
      const who = String(req.headers["x-admin-key"] ? "admin_key_holder" : "admin");
      await db.execute(sql`
        UPDATE exchange_exception_queue
        SET status = 'resolved', resolved_at = NOW(), resolved_by = ${who}
        WHERE id = ${id}
      `);
      logAdminAction(req, 'resolve_exception', `Exception ${id} resolved`).catch(() => {});
      return res.json({ success: true });
    } catch (e: any) {
      return res.status(500).json({ error: safeError(e) });
    }
  });

}
