const Anthropic = require('@anthropic-ai/sdk');
const { prepareTemplate } = require('./templateEngine');
const { getSystemPrompt } = require('./systemPrompt');
const {
  DocumentGenerationError,
  MissingFieldError,
  ExceptionFlagError,
} = require('../utils/errors');

const logger = require('../utils/logger');

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

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
  const start = Date.now();
  const triggerEvent = inferTriggerEvent(docType, isDraft);
  const { html: preparedHtml } = await prepareTemplate(deal, docType, isDraft);
  const systemPrompt = getSystemPrompt(triggerEvent, isDraft);

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 8000,
    temperature: 0,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: `Complete the final document assembly for the following pre-populated ${docType} document for Trade ${deal.tradeId || deal.trade_id}. Return complete HTML only.\n\n${preparedHtml}`,
      },
    ],
  });

  const assembledHtml = Array.isArray(response.content)
    ? response.content.map((item) => item.text || '').join('')
    : String(response.content || '');

  if (assembledHtml.startsWith('GENERATION_ERROR:')) {
    throw new DocumentGenerationError(assembledHtml, docType, deal.tradeId || deal.trade_id);
  }
  if (assembledHtml.startsWith('MISSING_FIELD:')) {
    const fields = assembledHtml.replace('MISSING_FIELD:', '').split(',').map((f) => f.trim()).filter(Boolean);
    throw new MissingFieldError(fields);
  }
  if (assembledHtml.startsWith('EXCEPTION_FLAG:')) {
    throw new ExceptionFlagError(assembledHtml.replace('EXCEPTION_FLAG:', '').trim(), 'UAIU_COMPLIANCE');
  }

  const tradeId = deal.tradeId || deal.trade_id;
  const expectedDesignation = isDraft ? 'DRAFT — NOT FOR EXECUTION' : 'FINAL';

  if (!assembledHtml.startsWith('<') || !assembledHtml.endsWith('>')) {
    throw new DocumentGenerationError('AI assembly output is not valid HTML', docType, tradeId);
  }
  if (/{{\s*.+?\s*}}/.test(assembledHtml)) {
    throw new DocumentGenerationError('AI output contains unresolved template variables', docType, tradeId);
  }
  if (!assembledHtml.includes(tradeId)) {
    throw new DocumentGenerationError('AI output missing Trade ID', docType, tradeId);
  }
  if (!assembledHtml.includes(expectedDesignation)) {
    throw new DocumentGenerationError('AI output missing FINAL/DRAFT designation', docType, tradeId);
  }

  const usage = response.usage || {};
  logger.info({
    event: 'document_assembly_complete',
    tradeId,
    docType,
    triggerEvent,
    model: 'claude-sonnet-4-20250514',
    inputTokens: usage.input_tokens || 0,
    outputTokens: usage.output_tokens || 0,
    latencyMs: Date.now() - start,
    status: 'SUCCESS',
  });

  return {
    html: assembledHtml,
    tokensUsed: {
      input: usage.input_tokens || 0,
      output: usage.output_tokens || 0,
    },
  };
}

module.exports = {
  assembleDocument,
};
