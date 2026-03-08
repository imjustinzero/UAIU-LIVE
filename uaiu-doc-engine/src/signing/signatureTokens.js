const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const { ValidationError } = require('../utils/errors');

const prisma = new PrismaClient();

function inferSignerName(document, signerEmail, signerRole) {
  const trade = document.trade;
  if (signerRole === 'seller') return trade.sellerSignatoryName;
  if (signerRole === 'buyer') return trade.buyerSignatoryName;
  if (signerRole === 'uaiu' || signerRole === 'uaiu_compliance') return 'UAIU Compliance';
  if (signerEmail === trade.sellerEmail) return trade.sellerSignatoryName;
  if (signerEmail === trade.buyerEmail) return trade.buyerSignatoryName;
  return signerEmail;
}

function inferRoutingOrder(signerRole) {
  if (signerRole === 'seller') return 1;
  if (signerRole === 'buyer') return 2;
  if (signerRole === 'uaiu' || signerRole === 'uaiu_compliance') return 3;
  return 99;
}

async function generateSignToken(documentId, signerEmail, signerRole) {
  const token = crypto.randomBytes(48).toString('hex');
  const document = await prisma.document.findUnique({ where: { id: documentId }, include: { trade: true } });
  if (!document || !document.trade) throw new ValidationError('Document not found for signature token generation');

  const signatureRequest = await prisma.signatureRequest.create({
    data: {
      documentId,
      tradeId: document.trade.tradeId,
      signerEmail,
      signerRole,
      signerName: inferSignerName(document, signerEmail, signerRole),
      routingOrder: inferRoutingOrder(signerRole),
      token,
      tokenExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  return {
    token,
    signingUrl: `${process.env.BASE_URL}/sign/${token}`,
    signatureRequest,
  };
}

async function validateSignToken(token) {
  const signatureRequest = await prisma.signatureRequest.findUnique({
    where: { token },
    include: { document: { include: { trade: true } } },
  });

  if (!signatureRequest) throw new ValidationError('Invalid signing link');
  if (signatureRequest.tokenExpiresAt.getTime() < Date.now()) throw new ValidationError('Signing link has expired');
  if (signatureRequest.status === 'SIGNED') throw new ValidationError('Already signed');
  if (signatureRequest.status === 'DECLINED') throw new ValidationError('Previously declined');

  return signatureRequest;
}

module.exports = { generateSignToken, validateSignToken };
