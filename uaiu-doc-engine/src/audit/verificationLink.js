const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function generateVerificationRecord(trade, auditPack) {
  const tradeId = trade.tradeId || trade.trade_id;
  const publicVerificationUrl = `${process.env.BASE_URL}/verify/${tradeId}`;

  await prisma.verificationRecord.upsert({
    where: { tradeId: trade.id },
    create: {
      tradeId: trade.id,
      tradeDate: trade.tradeDate,
      registry: trade.registry,
      creditType: trade.creditType,
      quantity: trade.quantity,
      vintage: trade.vintage,
      projectName: trade.projectName,
      closingStatus: trade.status,
      sha256Hash: auditPack.sha256Hash,
      timestamp: new Date(),
    },
    update: {
      sha256Hash: auditPack.sha256Hash,
      timestamp: new Date(),
      closingStatus: trade.status,
    },
  });

  return { publicVerificationUrl };
}

module.exports = { generateVerificationRecord };
