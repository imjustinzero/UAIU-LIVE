const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const transitions = {
  trade_confirmation_draft: { next: ['trade_confirmation_final'] },
  trade_confirmation_final: { next: ['seller_certificate', 'buyer_certificate'] },
  seller_certificate: { next: ['escrow_instructions'] },
  buyer_certificate: { next: ['registry_checklist'] },
  registry_checklist: { next: ['audit_pack_cover'] },
  audit_pack_cover: { next: ['audit_pack'] },
  closing_summary: { next: [] },
};

function mapTriggerToDocType(trigger) {
  return {
    trade_confirmation_draft: 'DOC_02',
    trade_confirmation_final: 'DOC_02',
    seller_certificate: 'DOC_04',
    buyer_certificate: 'DOC_05',
    escrow_instructions: 'DOC_03',
    registry_checklist: 'DOC_12',
    audit_pack_cover: 'AUDIT_PACK_COVER',
    dispute_notice: 'DOC_08',
    closing_summary: 'CLOSING_SUMMARY',
  }[trigger] || null;
}

async function advanceWorkflow({ tradeId, triggerEvent }) {
  const transition = transitions[triggerEvent];
  if (!transition) return;

  const { addDocumentJob, addAuditPackJob } = require('../queues/documentQueue');

  for (const next of transition.next) {
    if (next === 'audit_pack') {
      await addAuditPackJob({ tradeId });
      continue;
    }

    await addDocumentJob({
      tradeId,
      triggerEvent: next,
      docType: mapTriggerToDocType(next),
      isDraft: next === 'trade_confirmation_draft',
    });
  }

  if (triggerEvent === 'closing_summary') {
    await prisma.trade.update({ where: { tradeId }, data: { status: 'CLOSED' } }).catch(() => undefined);
  }
}

async function onDocumentSigned(documentId) {
  const document = await prisma.document.findUnique({ where: { id: documentId }, include: { trade: true } });
  if (!document || !document.trade) return;
  await advanceWorkflow({ tradeId: document.trade.tradeId, triggerEvent: document.triggerEvent });
}

module.exports = { advanceWorkflow, mapTriggerToDocType, onDocumentSigned };
