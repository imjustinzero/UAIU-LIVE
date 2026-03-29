const path = require('path');
const fs = require('fs');

const { listingValidationSchema } = require('../src/schema/dealObject');
const { prepareTemplate } = require('../src/engine/templateEngine');

if (typeof listingValidationSchema.safeParse !== 'function') {
  throw new Error('listingValidationSchema did not initialize correctly');
}

const templateDir = path.join(__dirname, '..', 'src', 'documents', 'templates');
const expectedTemplates = [
  'doc02_trade_confirmation.js',
  'doc03_escrow_addendum.js',
  'doc04_seller_certificate.js',
  'doc05_buyer_certificate.js',
  'doc08_dispute_notice.js',
  'doc12_registry_checklist.js',
  'audit_pack_cover.html',
  'closing_summary.html',
];

for (const file of expectedTemplates) {
  if (!fs.existsSync(path.join(templateDir, file))) {
    throw new Error(`Missing template file: ${file}`);
  }
}

const deal = {
  trade_id: 'UAIU-2026-00001',
  listing_id: 'LST-1001',
  trade_date: new Date().toISOString(),
  listing_date: new Date().toISOString(),
  buyer_entity_name: 'Buyer Co',
  seller_entity_name: 'Seller Co',
  buyer_email: 'buyer@example.com',
  seller_email: 'seller@example.com',
  buyer_signatory_name: 'Jane Buyer',
  seller_signatory_name: 'John Seller',
  buyer_signatory_title: 'Director',
  seller_signatory_title: 'Director',
  buyer_kyc_ref: 'KYC-B-1',
  seller_kyc_ref: 'KYC-S-1',
  buyer_jurisdiction: 'US',
  seller_jurisdiction: 'US',
  registry: 'Verra',
  registry_status: 'CLEAR',
  registry_account_buyer: 'acc-buyer',
  registry_account_seller: 'acc-seller',
  project_name: 'Project A',
  project_country: 'US',
  methodology: 'VM0001',
  credit_type: 'VCU',
  vintage: String(new Date().getUTCFullYear()),
  quantity: 100,
  serial_numbers: 'SERIAL-ABC',
  currency: 'USD',
  price_per_credit: 10,
  total_trade_price: 1000,
  settlement_date: new Date().toISOString(),
  delivery_deadline: new Date(Date.now() + 86400000).toISOString(),
  delivery_type: 'SPOT',
  intended_use: ['retirement'],
  payment_terms: 'Net 30',
  escrow_required: false,
  governing_law: 'New York',
};

(async () => {
  for (const docType of ['DOC_02', 'DOC_03', 'DOC_04', 'DOC_05', 'DOC_08', 'DOC_12', 'AUDIT_PACK_COVER', 'CLOSING_SUMMARY']) {
    await prepareTemplate(deal, docType, false);
  }
  console.log('smoke-check-ok');
})();
