const crypto = require('crypto');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const { GetObjectCommand } = require('@aws-sdk/client-s3');
const { PrismaClient } = require('@prisma/client');
const { validateSignToken, generateSignToken } = require('./signatureTokens');
const { sendSigningRequest } = require('../notifications/emailService');
const { s3, bucket, putObject, getPresignedUrl } = require('../config/s3');
const { ValidationError } = require('../utils/errors');

const prisma = new PrismaClient();

function getSignersForDocument(document, trade) {
  const uaiuSigner = { email: process.env.UAIU_COMPLIANCE_EMAIL, name: 'UAIU Compliance', role: 'uaiu' };
  if (document.docType === 'DOC_02') return [{ email: trade.sellerEmail, name: trade.sellerSignatoryName, role: 'seller', order: 1 }, { email: trade.buyerEmail, name: trade.buyerSignatoryName, role: 'buyer', order: 2 }, { ...uaiuSigner, order: 3 }];
  if (document.docType === 'DOC_04') return [{ email: trade.sellerEmail, name: trade.sellerSignatoryName, role: 'seller', order: 1 }, { ...uaiuSigner, order: 2 }];
  if (document.docType === 'DOC_05') return [{ email: trade.buyerEmail, name: trade.buyerSignatoryName, role: 'buyer', order: 1 }];
  if (document.docType === 'DOC_08') return [{ email: process.env.UAIU_COMPLIANCE_EMAIL, name: 'UAIU Compliance', role: 'uaiu_compliance', order: 1 }];
  if (document.docType === 'DOC_12') return [{ email: trade.sellerEmail, name: trade.sellerSignatoryName, role: 'seller', order: 1 }];
  return [{ ...uaiuSigner, order: 1 }];
}

async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

function signaturePayload(token, email, signedAt, documentId) {
  return `${token}:${email}:${signedAt.getTime()}:${documentId}`;
}

async function appendSignatureToPDF(document, signatureRequest, hash, fullName) {
  const originalResponse = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: document.pdfS3Key }));
  const unsignedPdfBuffer = await streamToBuffer(originalResponse.Body);
  const unsignedHash = crypto.createHash('sha256').update(unsignedPdfBuffer).digest('hex');

  const pdfDoc = await PDFDocument.load(unsignedPdfBuffer);
  const page = pdfDoc.addPage([612, 792]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const navy = rgb(0.05, 0.12, 0.28);
  const gold = rgb(0.78, 0.62, 0.2);

  page.drawRectangle({ x: 0, y: 744, width: 612, height: 48, color: navy });
  page.drawText('UAIU ELECTRONIC SIGNATURE MANIFEST', { x: 28, y: 760, size: 14, font: boldFont, color: gold });

  const signatures = await prisma.signatureRequest.findMany({ where: { documentId: document.id }, orderBy: { routingOrder: 'asc' } });
  const finalizedAt = new Date().toISOString();
  let y = 718;
  const lines = [
    `Trade ID: ${signatureRequest.tradeId}`,
    `Document: ${document.docType} | Ref: ${document.id}`,
    `Finalized: ${finalizedAt} UTC`,
    '',
    'SIGNATURE RECORD:',
    'name | role | email | signedAt | ip | signatureHash',
    ...signatures.map((s) => `${s.signerName} | ${s.signerRole} | ${s.signerEmail} | ${s.signedAt ? s.signedAt.toISOString() : 'PENDING'} | ${s.ipAddress || ''} | ${s.signatureHash || ''}`),
    '',
    'DOCUMENT INTEGRITY:',
    `SHA-256 Hash of unsigned document: ${unsignedHash}`,
  ];

  for (const line of lines) {
    page.drawText(line.slice(0, 150), { x: 28, y, size: 9, font: line.includes('SIGNATURE RECORD') || line.includes('DOCUMENT INTEGRITY') ? boldFont : font, color: rgb(0, 0, 0) });
    y -= 14;
  }

  page.drawText('LEGAL BASIS:', { x: 28, y: y - 6, size: 10, font: boldFont, color: navy });
  y -= 20;
  page.drawText('Electronic signatures recorded pursuant to 15 U.S.C. § 7001 (E-SIGN Act) and applicable state UETA provisions.', { x: 28, y, size: 9, font, color: rgb(0, 0, 0) });
  y -= 14;
  page.drawText('This manifest constitutes the official signature record for UAIU Holdings Corp audit purposes.', { x: 28, y, size: 9, font, color: rgb(0, 0, 0) });
  y -= 28;
  page.drawText(`Most recent signer: ${fullName} (${signatureRequest.signerRole})`, { x: 28, y, size: 9, font: boldFont, color: navy });
  y -= 14;
  page.drawText(`IP: ${signatureRequest.ipAddress || ''} | Signed At: ${signatureRequest.signedAt?.toISOString() || ''} | Signature Hash: ${hash}`, { x: 28, y, size: 8, font, color: rgb(0.2, 0.2, 0.2) });

  const output = await pdfDoc.save();
  const signedHash = crypto.createHash('sha256').update(output).digest('hex');
  page.drawText(`SHA-256 Hash of signed document: ${signedHash}`, { x: 28, y: 86, size: 9, font: boldFont, color: rgb(0, 0, 0) });

  const finalOutput = await pdfDoc.save();
  await putObject({ key: document.pdfS3Key, body: Buffer.from(finalOutput), contentType: 'application/pdf' });
  const refreshedUrl = await getPresignedUrl(document.pdfS3Key, 24 * 3600);
  await prisma.document.update({
    where: { id: document.id },
    data: {
      pdfPresignedUrl: refreshedUrl,
      presignedUrlExpiresAt: new Date(Date.now() + 24 * 3600 * 1000),
    },
  });

  return {
    unsignedHash,
    signedHash: crypto.createHash('sha256').update(finalOutput).digest('hex'),
  };
}

async function maybeSendNextSigner(document, trade, completedOrder) {
  const allSigners = getSignersForDocument(document, trade).sort((a, b) => a.order - b.order);
  const nextSigner = allSigners.find((s) => s.order === completedOrder + 1);
  if (!nextSigner) return;

  const existing = await prisma.signatureRequest.findFirst({
    where: {
      documentId: document.id,
      routingOrder: nextSigner.order,
      signerEmail: nextSigner.email,
      status: { in: ['PENDING', 'VIEWED', 'SIGNED'] },
    },
  });
  if (existing) return;

  const { signingUrl, signatureRequest } = await generateSignToken(document.id, nextSigner.email, nextSigner.role);
  await prisma.signatureRequest.update({
    where: { id: signatureRequest.id },
    data: { signerName: nextSigner.name, routingOrder: nextSigner.order },
  });
  await sendSigningRequest(nextSigner, document, trade, signingUrl);
}

async function recordSignature(token, signerData) {
  const { ip, userAgent, consentGiven, fullName } = signerData;
  const sigReq = await validateSignToken(token);
  if (consentGiven !== true) throw new ValidationError('Consent required');
  if (!fullName || fullName.trim().split(/\s+/).length < 2) throw new ValidationError('Full legal name required');

  const signedAt = new Date();
  const payload = signaturePayload(token, sigReq.signerEmail, signedAt, sigReq.documentId);
  const hash = crypto.createHash('sha256').update(payload).digest('hex');

  const updatedReq = await prisma.signatureRequest.update({
    where: { id: sigReq.id },
    data: {
      status: 'SIGNED',
      signedAt,
      signatureHash: hash,
      ipAddress: ip,
      userAgent,
      consentRecorded: true,
      consentTimestamp: signedAt,
      consentIp: ip,
      signerName: fullName.trim(),
    },
    include: { document: { include: { trade: true } } },
  });

  const role = updatedReq.signerRole === 'uaiu_compliance' ? 'uaiu' : updatedReq.signerRole;
  const docUpdate = {};
  if (role === 'buyer') docUpdate.buyerSigned = true;
  if (role === 'seller') docUpdate.sellerSigned = true;
  if (role === 'uaiu') docUpdate.uaiuSigned = true;
  await prisma.document.update({ where: { id: updatedReq.documentId }, data: docUpdate });

  await appendSignatureToPDF(updatedReq.document, updatedReq, hash, fullName.trim());

  const signers = await prisma.signatureRequest.findMany({ where: { documentId: updatedReq.documentId }, orderBy: { routingOrder: 'asc' } });
  const requiredCount = getSignersForDocument(updatedReq.document, updatedReq.document.trade).length;
  const signedCount = signers.filter((s) => s.status === 'SIGNED').length;

  if (signedCount >= requiredCount) {
    await prisma.document.update({ where: { id: updatedReq.documentId }, data: { status: 'SIGNED', signedAt } });
    const workflowManager = require('../engine/workflowManager');
    await workflowManager.onDocumentSigned(updatedReq.document.id);
  } else {
    await maybeSendNextSigner(updatedReq.document, updatedReq.document.trade, updatedReq.routingOrder);
    await prisma.document.update({ where: { id: updatedReq.documentId }, data: { status: 'PARTIALLY_SIGNED' } });
  }

  return { signatureHash: hash, signedAt, documentId: updatedReq.documentId };
}

async function verifyDocumentIntegrity(documentId) {
  const requests = await prisma.signatureRequest.findMany({ where: { documentId }, orderBy: { routingOrder: 'asc' } });
  const signatures = requests.map((req) => {
    if (!req.signedAt || !req.signatureHash) {
      return { signerEmail: req.signerEmail, signerRole: req.signerRole, valid: false, reason: 'not-signed' };
    }
    const recomputed = crypto.createHash('sha256').update(signaturePayload(req.token, req.signerEmail, req.signedAt, req.documentId)).digest('hex');
    return {
      signerEmail: req.signerEmail,
      signerRole: req.signerRole,
      signedAt: req.signedAt,
      signatureHash: req.signatureHash,
      recomputedHash: recomputed,
      valid: recomputed === req.signatureHash,
    };
  });

  return {
    valid: signatures.every((s) => s.valid),
    signatures,
    verifiedAt: new Date().toISOString(),
  };
}

module.exports = { recordSignature, verifyDocumentIntegrity };
