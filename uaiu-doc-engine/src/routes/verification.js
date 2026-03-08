const express = require('express');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();

router.get('/:tradeId', async (req, res, next) => {
  try {
    const trade = await prisma.trade.findUnique({ where: { tradeId: req.params.tradeId }, include: { auditPack: true } });
    if (!trade) return res.status(404).json({ error: { message: 'Trade not found' } });

    const verification = await prisma.verificationRecord.findUnique({ where: { tradeId: trade.id } });
    if (!verification) return res.status(404).json({ error: { message: 'Verification record not found' } });

    const expectedHash = req.query.sha256;
    const hashMatch = expectedHash ? verification.sha256Hash === String(expectedHash) : undefined;

    return res.json({
      tradeId: req.params.tradeId,
      hashMatch,
      verification,
      auditPack: trade.auditPack ? {
        status: trade.auditPack.status,
        documentCount: trade.auditPack.documentCount,
        assembledAt: trade.auditPack.assembledAt,
        publicVerificationUrl: trade.auditPack.publicVerificationUrl,
      } : null,
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
