const { PrismaClient } = require('@prisma/client');
const { generateSignToken } = require('./signatureTokens');
const { sendSigningRequest } = require('../notifications/emailService');
const { SignatureError } = require('../utils/errors');

const prisma = new PrismaClient();

function getSignersForDocument(document, trade) {
  const uaiuSigner = {
    email: process.env.UAIU_COMPLIANCE_EMAIL,
    name: 'UAIU Compliance',
    role: 'uaiu',
  };

  if (document.docType === 'DOC_02') {
    return [
      { email: trade.sellerEmail, name: trade.sellerSignatoryName, role: 'seller', order: 1 },
      { email: trade.buyerEmail, name: trade.buyerSignatoryName, role: 'buyer', order: 2 },
      { ...uaiuSigner, order: 3 },
    ];
  }
  if (document.docType === 'DOC_04') {
    return [
      { email: trade.sellerEmail, name: trade.sellerSignatoryName, role: 'seller', order: 1 },
      { ...uaiuSigner, order: 2 },
    ];
  }
  if (document.docType === 'DOC_05') {
    return [{ email: trade.buyerEmail, name: trade.buyerSignatoryName, role: 'buyer', order: 1 }];
  }
  if (document.docType === 'DOC_08') {
    return [{ email: process.env.UAIU_COMPLIANCE_EMAIL, name: 'UAIU Compliance', role: 'uaiu_compliance', order: 1 }];
  }
  if (document.docType === 'DOC_12') {
    return [{ email: trade.sellerEmail, name: trade.sellerSignatoryName, role: 'seller', order: 1 }];
  }

  return [{ ...uaiuSigner, order: 1 }];
}

async function sendForSignature(document, trade) {
  if (!document?.id || !trade?.tradeId) {
    throw new SignatureError('sendForSignature requires document and trade objects');
  }

  const signers = getSignersForDocument(document, trade).sort((a, b) => a.order - b.order);
  const firstSigner = signers[0];

  const existing = await prisma.signatureRequest.findFirst({
    where: { documentId: document.id, routingOrder: firstSigner.order, signerEmail: firstSigner.email, status: { in: ['PENDING', 'VIEWED', 'SIGNED'] } },
  });
  const generated = existing ? null : await generateSignToken(document.id, firstSigner.email, firstSigner.role);
  const signatureRequest = existing || generated.signatureRequest;
  const signingUrl = existing ? `${process.env.BASE_URL}/sign/${existing.token}` : generated.signingUrl;
  await prisma.signatureRequest.update({
    where: { id: signatureRequest.id },
    data: { signerName: firstSigner.name, routingOrder: firstSigner.order },
  });

  await sendSigningRequest(firstSigner, document, trade, signingUrl);

  await prisma.document.update({
    where: { id: document.id },
    data: {
      status: 'SENT',
      signatureRequestId: signatureRequest.id,
      signatureRequestUrl: signingUrl,
    },
  });

  return { signingRequests: [signatureRequest.id] };
}

module.exports = { sendForSignature };
