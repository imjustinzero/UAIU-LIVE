const fs = require('fs/promises');
const path = require('path');
const { DocumentGenerationError } = require('../utils/errors');

const docTemplateMap = {
  DOC_02: 'doc02_trade_confirmation.js',
  DOC_03: 'doc03_escrow_addendum.js',
  DOC_04: 'doc04_seller_certificate.js',
  DOC_05: 'doc05_buyer_certificate.js',
  DOC_08: 'doc08_dispute_notice.js',
  DOC_12: 'doc12_registry_checklist.js',
  AUDIT_PACK_COVER: 'audit_pack_cover.html',
  CLOSING_SUMMARY: 'closing_summary.html',
};

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  const yyyy = date.getUTCFullYear();
  return `${mm}/${dd}/${yyyy}`;
}

function formatCurrency(value) {
  return Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function toArrayString(value) {
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'string') return value;
  return '';
}

async function loadTemplate(docType) {
  const templateFile = docTemplateMap[docType];
  if (!templateFile) throw new DocumentGenerationError(`Unsupported docType ${docType}`, docType);

  const templatePath = path.resolve(__dirname, '..', 'documents', 'templates', templateFile);

  if (templateFile.endsWith('.js')) {
    const templateModule = require(templatePath);
    if (typeof templateModule === 'function') return templateModule();
    if (typeof templateModule.template === 'string') return templateModule.template;
    if (typeof templateModule.default === 'function') return templateModule.default();
    if (typeof templateModule.default === 'string') return templateModule.default;
    throw new DocumentGenerationError(`Template module ${templateFile} did not return HTML string`, docType);
  }

  return fs.readFile(templatePath, 'utf8');
}

function withDraftWatermark(html) {
  const watermarkCss = `<style>
  @media print {
    body::before {
      content: 'DRAFT — NOT FOR EXECUTION';
      position: fixed;
      top: 45%;
      left: -10%;
      width: 120%;
      text-align: center;
      font-size: 96px;
      color: rgba(180, 0, 0, 0.18);
      transform: rotate(-45deg);
      z-index: 9999;
      pointer-events: none;
      font-weight: 700;
      letter-spacing: 3px;
    }
  }
  </style>`;

  if (html.includes('</head>')) return html.replace('</head>', `${watermarkCss}</head>`);
  return `${watermarkCss}${html}`;
}

async function prepareTemplate(deal, docType, isDraft) {
  const templateHtml = await loadTemplate(docType);
  const docRef = `${docType}-${deal.tradeId || deal.trade_id}-${Date.now()}`;
  const timestamp = new Date().toISOString();
  const draftLabel = isDraft ? 'DRAFT — NOT FOR EXECUTION' : 'FINAL';

  const variableMap = {
    trade_id: deal.tradeId || deal.trade_id,
    document_ref_number: docRef,
    generation_timestamp: timestamp,
    is_draft_label: draftLabel,
    listing_id: deal.listingId || deal.listing_id,
    trade_date: formatDate(deal.tradeDate || deal.trade_date),
    listing_date: formatDate(deal.listingDate || deal.listing_date),
    buyer_entity_name: deal.buyerEntityName || deal.buyer_entity_name,
    seller_entity_name: deal.sellerEntityName || deal.seller_entity_name,
    buyer_email: deal.buyerEmail || deal.buyer_email,
    seller_email: deal.sellerEmail || deal.seller_email,
    buyer_signatory_name: deal.buyerSignatoryName || deal.buyer_signatory_name,
    seller_signatory_name: deal.sellerSignatoryName || deal.seller_signatory_name,
    buyer_signatory_title: deal.buyerSignatoryTitle || deal.buyer_signatory_title,
    seller_signatory_title: deal.sellerSignatoryTitle || deal.seller_signatory_title,
    buyer_kyc_ref: deal.buyerKycRef || deal.buyer_kyc_ref,
    seller_kyc_ref: deal.sellerKycRef || deal.seller_kyc_ref,
    buyer_jurisdiction: deal.buyerJurisdiction || deal.buyer_jurisdiction,
    seller_jurisdiction: deal.sellerJurisdiction || deal.seller_jurisdiction,
    registry: deal.registry,
    registry_status: deal.registryStatus || deal.registry_status,
    registry_account_buyer: deal.registryAccountBuyer || deal.registry_account_buyer,
    registry_account_seller: deal.registryAccountSeller || deal.registry_account_seller,
    project_name: deal.projectName || deal.project_name,
    project_country: deal.projectCountry || deal.project_country,
    methodology: deal.methodology,
    credit_type: deal.creditType || deal.credit_type,
    vintage: deal.vintage,
    quantity: Number(deal.quantity || 0).toLocaleString('en-US'),
    serial_numbers: deal.serialNumbers || deal.serial_numbers,
    currency: deal.currency || 'USD',
    price_per_credit: formatCurrency(deal.pricePerCredit || deal.price_per_credit),
    total_trade_price: formatCurrency(deal.totalTradePrice || deal.total_trade_price),
    settlement_date: formatDate(deal.settlementDate || deal.settlement_date),
    delivery_deadline: formatDate(deal.deliveryDeadline || deal.delivery_deadline),
    delivery_type: deal.deliveryType || deal.delivery_type,
    intended_use: toArrayString(deal.intendedUse || deal.intended_use),
    payment_terms: deal.paymentTerms || deal.payment_terms,
    escrow_required: String(deal.escrowRequired ?? deal.escrow_required),
    escrow_path: deal.escrowPath || deal.escrow_path || '',
    escrow_release_conditions: deal.escrowReleaseConditions || deal.escrow_release_conditions || '',
    pending_disputes: deal.pendingDisputes || deal.pending_disputes || 'none',
    special_terms: deal.specialTerms || deal.special_terms || 'none',
  };

  let substitutedHtml = templateHtml.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (match, key) => {
    return Object.prototype.hasOwnProperty.call(variableMap, key) ? String(variableMap[key] ?? '') : match;
  });

  const unresolved = [...new Set((substitutedHtml.match(/{{\s*([a-zA-Z0-9_]+)\s*}}/g) || []).map((m) => m.replace(/[{}\s]/g, '')))];
  if (unresolved.length) {
    throw new DocumentGenerationError(`Missing template variables: ${unresolved.join(', ')}`, docType, variableMap.trade_id);
  }

  if (isDraft) substitutedHtml = withDraftWatermark(substitutedHtml);

  if (/{{\s*.+?\s*}}/.test(substitutedHtml)) throw new DocumentGenerationError('Unresolved template variables after substitution', docType, variableMap.trade_id);
  if (/\[[A-Z0-9_\s-]+\]/.test(substitutedHtml)) throw new DocumentGenerationError('Bracket placeholder content remains in generated document', docType, variableMap.trade_id);
  if (!substitutedHtml.includes(String(variableMap.trade_id))) throw new DocumentGenerationError('Trade ID not present in generated document', docType, variableMap.trade_id);
  if (!substitutedHtml.includes(variableMap.generation_timestamp)) throw new DocumentGenerationError('Generation timestamp not present in generated document', docType, variableMap.trade_id);
  if (!substitutedHtml.includes(draftLabel)) throw new DocumentGenerationError('Expected FINAL/DRAFT designation missing', docType, variableMap.trade_id);

  return {
    html: substitutedHtml,
    metadata: {
      docRef,
      timestamp,
    },
  };
}

module.exports = {
  prepareTemplate,
};
