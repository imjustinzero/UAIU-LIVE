const { z } = require('zod');

const CURRENT_YEAR = new Date().getUTCFullYear();

const triggerEvents = [
  'listing_validation',
  'trade_confirmation_draft',
  'trade_confirmation_final',
  'seller_certificate',
  'buyer_certificate',
  'escrow_instructions',
  'registry_checklist',
  'audit_pack_cover',
  'dispute_notice',
  'closing_summary',
];

const dealObjectSchema = z
  .object({
    trade_id: z.string().regex(/^UAIU-\d{4}-\d{5}$/, 'trade_id must match UAIU-YYYY-NNNNN format'),
    listing_id: z.string().min(3).max(100),
    trade_date: z.string().datetime(),
    listing_date: z.string().datetime(),

    buyer_entity_name: z.string().min(2).max(255),
    seller_entity_name: z.string().min(2).max(255),
    buyer_email: z.string().email(),
    seller_email: z.string().email(),

    buyer_signatory_name: z.string().min(2).max(255),
    seller_signatory_name: z.string().min(2).max(255),
    buyer_signatory_title: z.string().min(2).max(255),
    seller_signatory_title: z.string().min(2).max(255),

    buyer_kyc_ref: z.string().min(3).max(100),
    seller_kyc_ref: z.string().min(3).max(100),
    buyer_kyc_status: z.enum(['CLEAR', 'PENDING', 'FAILED', 'ENHANCED_DUE_DILIGENCE']),
    seller_kyc_status: z.enum(['CLEAR', 'PENDING', 'FAILED', 'ENHANCED_DUE_DILIGENCE']),
    sanctions_status: z.enum(['CLEAR', 'FLAGGED', 'PENDING_REVIEW']),

    buyer_jurisdiction: z.string().min(2).max(100),
    seller_jurisdiction: z.string().min(2).max(100),

    registry: z.string().min(2).max(100),
    registry_status: z.enum(['CLEAR', 'SUSPENDED', 'DISPUTED', 'FLAGGED']),
    registry_account_buyer: z.string().min(2).max(255),
    registry_account_seller: z.string().min(2).max(255),

    project_name: z.string().min(2).max(255),
    project_country: z.string().min(2).max(100),
    methodology: z.string().min(2).max(255),
    credit_type: z.string().min(2).max(100),

    vintage: z.string().regex(/^\d{4}$/),
    quantity: z.number().positive(),
    serial_numbers: z.string().min(1),

    currency: z.string().length(3).default('USD'),
    price_per_credit: z.number().positive(),
    total_trade_price: z.number().positive(),

    settlement_date: z.string().datetime(),
    delivery_deadline: z.string().datetime(),
    delivery_type: z.enum(['SPOT', 'FORWARD', 'STRUCTURED']),
    intended_use: z.array(z.string().min(1)).min(1),
    payment_terms: z.string().min(2),

    escrow_required: z.boolean(),
    escrow_path: z.enum(['ON_PLATFORM', 'OFF_PLATFORM']).nullable().optional(),
    escrow_release_conditions: z.string().nullable().optional(),

    pending_disputes: z.string().nullable().optional(),
    special_terms: z.string().nullable().optional().default('none'),
    brokered_by: z.string().nullable().optional(),
    broker_fee_percent: z.number().min(0).max(100).nullable().optional(),
    compliance_notes: z.string().nullable().optional(),
    governing_law: z.string().min(2),
  })
  .superRefine((deal, ctx) => {
    if (deal.escrow_required === true && !deal.escrow_release_conditions) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['escrow_release_conditions'],
        message: 'escrow_release_conditions is required when escrow_required is true',
      });
    }

    if (deal.special_terms && deal.special_terms.trim().toLowerCase() !== 'none') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['special_terms'],
        message: 'special_terms requires legal review before document generation',
      });
    }

    if (deal.delivery_type === 'FORWARD' || deal.delivery_type === 'STRUCTURED') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['delivery_type'],
        message: 'delivery_type FORWARD or STRUCTURED requires escalation',
      });
    }

    const serial = (deal.serial_numbers || '').trim().toUpperCase();
    if (!serial || serial === 'MISSING' || serial === 'UNVERIFIED' || serial === 'NULL') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['serial_numbers'],
        message: 'serial_numbers cannot be null, empty, MISSING, or UNVERIFIED',
      });
    }

    const expected = deal.quantity * deal.price_per_credit;
    if (Math.abs(expected - deal.total_trade_price) > 0.01) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['total_trade_price'],
        message: 'total_trade_price must equal quantity * price_per_credit (±0.01)',
      });
    }

    const settlement = new Date(deal.settlement_date).getTime();
    const deadline = new Date(deal.delivery_deadline).getTime();
    if (!(settlement < deadline)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['settlement_date'],
        message: 'settlement_date must be before delivery_deadline',
      });
    }

    const vintageYear = Number(deal.vintage);
    if (Number.isNaN(vintageYear) || vintageYear < 2000 || vintageYear > CURRENT_YEAR) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['vintage'],
        message: `vintage must be a 4-digit year between 2000 and ${CURRENT_YEAR}`,
      });
    }
  });

const listingValidationSchema = dealObjectSchema.pick({
  trade_id: true,
  listing_id: true,
  buyer_entity_name: true,
  seller_entity_name: true,
  sanctions_status: true,
  buyer_kyc_status: true,
  seller_kyc_status: true,
  serial_numbers: true,
  registry_status: true,
  pending_disputes: true,
  special_terms: true,
  delivery_type: true,
  quantity: true,
  price_per_credit: true,
  total_trade_price: true,
  escrow_required: true,
  escrow_path: true,
  escrow_release_conditions: true,
});

const triggerSchema = z.object({
  trigger_event: z.enum(triggerEvents),
  deal: dealObjectSchema,
});

module.exports = {
  dealObjectSchema,
  listingValidationSchema,
  triggerSchema,
  triggerEvents,
};
