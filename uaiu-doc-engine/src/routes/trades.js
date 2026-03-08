const express = require('express');
const { PrismaClient } = require('@prisma/client');
const auth = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');

const router = express.Router();
const prisma = new PrismaClient();

router.get('/:tradeId', auth, requireRole('UAIU_STAFF', 'UAIU_COMPLIANCE', 'PARTICIPANT'), async (req, res, next) => {
  try {
    const trade = await prisma.trade.findUnique({ where: { tradeId: req.params.tradeId }, include: { documents: true, auditPack: true } });
    if (!trade) return res.status(404).json({ error: { message: 'Trade not found' } });
    return res.json(trade);
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
