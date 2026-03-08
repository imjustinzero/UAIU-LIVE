const { PrismaClient } = require('@prisma/client');
const { putObject } = require('../config/s3');

const prisma = new PrismaClient();

async function assemblePack(tradeId) {
  const trade = await prisma.trade.findUnique({ where: { tradeId }, include: { documents: true } });
  if (!trade) throw new Error(`Trade ${tradeId} not found`);

  const payload = {
    tradeId,
    generatedAt: new Date().toISOString(),
    documents: trade.documents.map((d) => ({ docType: d.docType, status: d.status, s3Key: d.pdfS3Key, signedAt: d.signedAt })),
  };

  const buffer = Buffer.from(JSON.stringify(payload));
  const s3Key = `audit-packs/${tradeId}/audit-pack-${Date.now()}.json`;
  await putObject({ key: s3Key, body: buffer, contentType: 'application/json' });
  return { s3Key, documentCount: trade.documents.length };
}

module.exports = { assemblePack };
