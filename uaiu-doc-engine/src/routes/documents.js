const express = require('express');
const { PrismaClient } = require('@prisma/client');
const auth = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');
const { sendForSignature } = require('../signing/signatureRouter');
const { getPresignedUrl } = require('../config/s3');

const router = express.Router();
const prisma = new PrismaClient();

router.get('/:tradeId', auth, requireRole('UAIU_STAFF', 'UAIU_COMPLIANCE', 'PARTICIPANT'), async (req, res, next) => {
  try {
    const trade = await prisma.trade.findUnique({ where: { tradeId: req.params.tradeId } });
    if (!trade) return res.status(404).json({ error: { message: 'Trade not found' } });

    const docs = await prisma.document.findMany({ where: { tradeId: trade.id }, orderBy: { createdAt: 'desc' } });
    return res.json({ tradeId: req.params.tradeId, documents: docs });
  } catch (error) {
    return next(error);
  }
});

router.post('/:documentId/send-for-signature', auth, requireRole('UAIU_STAFF', 'UAIU_COMPLIANCE'), async (req, res, next) => {
  try {
    const document = await prisma.document.findUnique({ where: { id: req.params.documentId }, include: { trade: true } });
    if (!document || !document.trade) return res.status(404).json({ error: { message: 'Document not found' } });
    const result = await sendForSignature(document, document.trade);
    return res.status(202).json({ accepted: true, result });
  } catch (error) {
    return next(error);
  }
});

router.post('/:documentId/refresh-url', auth, requireRole('UAIU_STAFF', 'UAIU_COMPLIANCE', 'PARTICIPANT'), async (req, res, next) => {
  try {
    const document = await prisma.document.findUnique({ where: { id: req.params.documentId } });
    if (!document || !document.pdfS3Key) return res.status(404).json({ error: { message: 'Document not found or PDF unavailable' } });

    const url = await getPresignedUrl(document.pdfS3Key, 3600);
    const updated = await prisma.document.update({
      where: { id: document.id },
      data: { pdfPresignedUrl: url, presignedUrlExpiresAt: new Date(Date.now() + 3600 * 1000) },
    });

    return res.json({ document: updated });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
