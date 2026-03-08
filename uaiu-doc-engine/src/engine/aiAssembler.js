const { prepareTemplate } = require('./templateEngine');
const { getSystemPrompt } = require('./systemPrompt');
const { anthropicClient, model } = require('../config/anthropic');
const { DocumentGenerationError, MissingFieldError, ExceptionFlagError } = require('../utils/errors');
const logger = require('../utils/logger');

function inferTriggerEvent(docType, isDraft) {
  if (docType === 'DOC_02') return isDraft ? 'trade_confirmation_draft' : 'trade_confirmation_final';
  if (docType === 'DOC_03') return 'escrow_instructions';
  if (docType === 'DOC_04') return 'seller_certificate';
  if (docType === 'DOC_05') return 'buyer_certificate';
  if (docType === 'DOC_08') return 'dispute_notice';
  if (docType === 'DOC_12') return 'registry_checklist';
  if (docType === 'AUDIT_PACK_COVER') return 'audit_pack_cover';
  if (docType === 'CLOSING_SUMMARY') return 'closing_summary';
  return 'listing_validation';
}

async function assembleDocument(deal, docType, isDraft) {
  const startedAt = Date.now();
  const tradeId = deal.tradeId || deal.trade_id;
  const triggerEvent = inferTriggerEvent(docType, isDraft);

  const { html: preparedHtml } = await prepareTemplate(deal, docType, isDraft);
  const systemPrompt = getSystemPrompt(triggerEvent, isDraft);

  const response = await anthropicClient.messages.create({
    model,
    max_tokens: 8000,
    temperature: 0,
    system: systemPrompt,
    messages: [{
      role: 'user',
      content: `Complete the final document assembly for the following pre-populated ${docType} document for Trade ${tradeId}. Return complete HTML only.\n\n${preparedHtml}`,
    }],
  });

  const text = (response.content || []).map((c) => c.text || '').join('');

  if (text.startsWith('GENERATION_ERROR:')) throw new DocumentGenerationError(text, docType, tradeId);
  if (text.startsWith('MISSING_FIELD:')) throw new MissingFieldError(text.replace('MISSING_FIELD:', '').split(',').map((v) => v.trim()).filter(Boolean));
  if (text.startsWith('EXCEPTION_FLAG:')) throw new ExceptionFlagError(text.replace('EXCEPTION_FLAG:', '').trim(), 'UAIU_COMPLIANCE');

  const expectedDesignation = isDraft ? 'DRAFT — NOT FOR EXECUTION' : 'FINAL';
  if (!text.startsWith('<') || !text.endsWith('>')) throw new DocumentGenerationError('Assembler response must be complete HTML', docType, tradeId);
  if (/{{\s*.+?\s*}}/.test(text)) throw new DocumentGenerationError('Unsubstituted variable found in assembled HTML', docType, tradeId);
  if (!text.includes(tradeId)) throw new DocumentGenerationError('Trade ID missing from assembled HTML', docType, tradeId);
  if (!text.includes(expectedDesignation)) throw new DocumentGenerationError('Document designation missing from assembled HTML', docType, tradeId);

  const usage = response.usage || {};
  logger.info({
    event: 'document_assembly',
    tradeId,
    docType,
    triggerEvent,
    model,
    inputTokens: usage.input_tokens || 0,
    outputTokens: usage.output_tokens || 0,
    latencyMs: Date.now() - startedAt,
    status: 'SUCCESS',
  });

  return { html: text, tokensUsed: { input: usage.input_tokens || 0, output: usage.output_tokens || 0 } };
}

module.exports = { assembleDocument };
