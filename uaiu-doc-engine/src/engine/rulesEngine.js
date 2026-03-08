
const triggerRouting = {
  listing_validation: { documentType: null },
  trade_confirmation_draft: { documentType: 'DOC_02', isDraft: true },
  trade_confirmation_final: { documentType: 'DOC_02', isDraft: false },
  seller_certificate: { documentType: 'DOC_04', isDraft: false },
  buyer_certificate: { documentType: 'DOC_05', isDraft: false },
  escrow_instructions: { documentType: 'DOC_03', isDraft: false },
  registry_checklist: { documentType: 'DOC_12', isDraft: false },
  audit_pack_cover: { documentType: 'AUDIT_PACK_COVER', isDraft: false },
  dispute_notice: { documentType: 'DOC_08', isDraft: false },
  closing_summary: { documentType: 'CLOSING_SUMMARY', isDraft: false },
};

function getValue(deal, camel, snake) {
  if (deal[camel] !== undefined) return deal[camel];
  if (snake && deal[snake] !== undefined) return deal[snake];
  return undefined;
}

async function evaluateDeal(deal, triggerEvent) {
  const route = triggerRouting[triggerEvent];
  if (!route) {
    return { status: 'BLOCKED', reason: `Unsupported trigger event: ${triggerEvent}`, escalateTo: 'ENGINEERING' };
  }

  const threshold = Number(process.env.EXCEPTION_TRADE_THRESHOLD || 500000);
  const sanctionsStatus = String(getValue(deal, 'sanctionsStatus', 'sanctions_status') || '').toUpperCase();
  const buyerKycStatus = String(getValue(deal, 'buyerKycStatus', 'buyer_kyc_status') || '').toUpperCase();
  const sellerKycStatus = String(getValue(deal, 'sellerKycStatus', 'seller_kyc_status') || '').toUpperCase();
  const serialNumbers = String(getValue(deal, 'serialNumbers', 'serial_numbers') || '').trim().toUpperCase();
  const registryStatus = String(getValue(deal, 'registryStatus', 'registry_status') || '').toUpperCase();
  const specialTerms = getValue(deal, 'specialTerms', 'special_terms');
  const escrowRequired = Boolean(getValue(deal, 'escrowRequired', 'escrow_required'));
  const escrowPath = String(getValue(deal, 'escrowPath', 'escrow_path') || '').toUpperCase();
  const totalTradePrice = Number(getValue(deal, 'totalTradePrice', 'total_trade_price') || 0);
  const deliveryType = String(getValue(deal, 'deliveryType', 'delivery_type') || '').toUpperCase();
  const pendingDisputes = getValue(deal, 'pendingDisputes', 'pending_disputes');

  const flags = {
    sanctions: sanctionsStatus !== 'CLEAR',
    buyerKyc: buyerKycStatus !== 'CLEAR',
    sellerKyc: sellerKycStatus !== 'CLEAR',
    serialNumbers: !serialNumbers || serialNumbers === 'MISSING' || serialNumbers === 'UNVERIFIED' || serialNumbers === 'NULL',
    registryStatus: ['SUSPENDED', 'DISPUTED', 'FLAGGED'].includes(registryStatus),
    specialTerms: specialTerms !== null && specialTerms !== undefined && String(specialTerms).trim().toLowerCase() !== 'none',
    escrowPath: escrowRequired && escrowPath === 'OFF_PLATFORM',
    tradeSize: totalTradePrice > threshold,
    deliveryType: ['FORWARD', 'STRUCTURED'].includes(deliveryType),
    pendingDisputes: pendingDisputes !== null && pendingDisputes !== undefined && String(pendingDisputes).trim().toLowerCase() !== 'none',
    enhancedDueDiligence: buyerKycStatus === 'ENHANCED_DUE_DILIGENCE' || sellerKycStatus === 'ENHANCED_DUE_DILIGENCE',
  };

  if (flags.sanctions) {
    return { status: 'BLOCKED', reason: 'Sanctions screening did not clear.', escalateTo: 'UAIU_COMPLIANCE', fields: ['sanctionsStatus'] };
  }
  if (buyerKycStatus === 'FAILED' || sellerKycStatus === 'FAILED') {
    return { status: 'BLOCKED', reason: 'KYC failure detected for one or more counterparties.', escalateTo: 'UAIU_COMPLIANCE', fields: ['buyerKycStatus', 'sellerKycStatus'] };
  }
  if (flags.serialNumbers) {
    return { status: 'BLOCKED', reason: 'Serial numbers are missing or unverified.', escalateTo: 'UAIU_OPERATIONS', fields: ['serialNumbers'] };
  }
  if (flags.pendingDisputes || registryStatus === 'DISPUTED') {
    return { status: 'BLOCKED', reason: 'Pending disputes on registry prevent document generation.', escalateTo: 'UAIU_COMPLIANCE', fields: ['pendingDisputes', 'registryStatus'] };
  }

  const exceptionReasons = [];
  if (flags.tradeSize) exceptionReasons.push(`Trade size exceeds threshold ${threshold}.`);
  if (flags.specialTerms) exceptionReasons.push('Special terms present and require legal/compliance review.');
  if (flags.deliveryType) exceptionReasons.push(`Delivery type ${deliveryType} requires exception workflow.`);
  if (flags.enhancedDueDiligence) exceptionReasons.push('Enhanced due diligence status present for counterparty KYC.');
  if (flags.registryStatus) exceptionReasons.push(`Registry status flagged as ${registryStatus}.`);
  if (flags.escrowPath) exceptionReasons.push('Escrow path is off-platform.');

  const baseResult = {
    documentType: route.documentType,
    isDraft: Boolean(route.isDraft),
    triggeredBy: triggerEvent,
  };

  if (exceptionReasons.length > 0) {
    return {
      status: 'APPROVED',
      dealMode: 'EXCEPTION',
      ...baseResult,
      exceptionReasons,
    };
  }

  return {
    status: 'APPROVED',
    dealMode: 'STANDARD',
    ...baseResult,
  };
}

module.exports = {
  evaluateDeal,
  triggerRouting,
};
