const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { triggerSchema } = require('../schema/dealObject');
const { evaluateDeal } = require('../engine/rulesEngine');
const { addDocumentJob } = require('../queues/documentQueue');
const { ValidationError } = require('../utils/errors');
const auth = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');

const router = express.Router();
const prisma = new PrismaClient();

function toTradeData(deal, result) {
  return {
    tradeId: deal.trade_id,
    status: result.status === 'APPROVED' ? 'LISTING_VALIDATED' : 'FAILED',
    dealMode: result.dealMode || 'EXCEPTION',
    tradeDate: new Date(deal.trade_date),
    listingId: deal.listing_id,
    listingDate: new Date(deal.listing_date),
    buyerEntityName: deal.buyer_entity_name,
    sellerEntityName: deal.seller_entity_name,
    buyerEmail: deal.buyer_email,
    sellerEmail: deal.seller_email,
    buyerSignatoryName: deal.buyer_signatory_name,
    sellerSignatoryName: deal.seller_signatory_name,
    buyerSignatoryTitle: deal.buyer_signatory_title,
    sellerSignatoryTitle: deal.seller_signatory_title,
    buyerKycRef: deal.buyer_kyc_ref,
    sellerKycRef: deal.seller_kyc_ref,
    buyerJurisdiction: deal.buyer_jurisdiction,
    sellerJurisdiction: deal.seller_jurisdiction,
    registry: deal.registry,
    registryStatus: deal.registry_status,
    registryAccountBuyer: deal.registry_account_buyer,
    registryAccountSeller: deal.registry_account_seller,
    projectName: deal.project_name,
    projectCountry: deal.project_country,
    creditType: deal.credit_type,
    methodology: deal.methodology,
    quantity: deal.quantity,
    vintage: deal.vintage,
    serialNumbers: deal.serial_numbers,
    currency: deal.currency,
    pricePerCredit: deal.price_per_credit,
    totalTradePrice: deal.total_trade_price,
    settlementDate: new Date(deal.settlement_date),
    deliveryDeadline: new Date(deal.delivery_deadline),
    deliveryType: deal.delivery_type,
    intendedUse: JSON.stringify(deal.intended_use),
    paymentTerms: deal.payment_terms,
    escrowRequired: deal.escrow_required,
    escrowPath: deal.escrow_path,
    escrowReleaseConditions: deal.escrow_release_conditions,
    pendingDisputes: deal.pending_disputes,
    specialTerms: deal.special_terms,
    exceptionReason: result.exceptionReasons ? result.exceptionReasons.join(' | ') : null,
    brokeredBy: deal.brokered_by,
    brokerFeePercent: deal.broker_fee_percent,
    buyerKycStatus: deal.buyer_kyc_status,
    sellerKycStatus: deal.seller_kyc_status,
    sanctionsStatus: deal.sanctions_status,
    complianceNotes: deal.compliance_notes,
    governingLaw: deal.governing_law,
  };
}

router.post('/', auth, requireRole('UAIU_STAFF', 'UAIU_COMPLIANCE'), async (req, res, next) => {
  try {
    const parsed = triggerSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError('Trigger payload validation failed', parsed.error.issues.map((i) => i.path.join('.')));
    }

    const { trigger_event: triggerEvent, deal } = parsed.data;
    const evaluation = await evaluateDeal(deal, triggerEvent);

    if (evaluation.status === 'BLOCKED') {
      return res.status(422).json(evaluation);
    }

    const tradeData = toTradeData(deal, evaluation);
    await prisma.trade.upsert({ where: { tradeId: deal.trade_id }, create: tradeData, update: tradeData });

    if (evaluation.documentType) {
      await addDocumentJob({
        tradeId: deal.trade_id,
        triggerEvent,
        docType: evaluation.documentType,
        isDraft: Boolean(evaluation.isDraft),
      });
    }

    return res.status(202).json({ accepted: true, evaluation });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
