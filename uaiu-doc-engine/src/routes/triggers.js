const express = require('express');
const { triggerSchema } = require('../schema/dealObject');
const { addDocumentJob, addAuditPackJob } = require('../queues/documentQueue');
const { evaluateDeal } = require('../engine/rulesEngine');
const { ValidationError, ExceptionFlagError } = require('../utils/errors');

const router = express.Router();

router.post('/', async (req, res, next) => {
  try {
    const parsed = triggerSchema.safeParse(req.body);
    if (!parsed.success) {
      const fields = parsed.error.issues.map((issue) => issue.path.join('.'));
      throw new ValidationError('Invalid trigger payload', fields);
    }

    const { trigger_event: triggerEvent, deal } = parsed.data;
    const evaluation = await evaluateDeal(deal, triggerEvent);

    if (evaluation.status !== 'APPROVED') {
      throw new ExceptionFlagError(evaluation.reason, evaluation.escalateTo || 'UAIU_COMPLIANCE');
    }

    if (evaluation.documentType) {
      await addDocumentJob({ tradeId: deal.trade_id, docType: evaluation.documentType, isDraft: evaluation.isDraft, triggerEvent: triggerEvent });
    }

    if (triggerEvent === 'closing_summary') {
      await addAuditPackJob({ tradeId: deal.trade_id });
    }

    res.status(202).json({ status: 'accepted', evaluation });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
