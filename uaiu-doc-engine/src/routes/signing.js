const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { validateSignToken } = require('../signing/signatureTokens');
const { recordSignature } = require('../signing/signatureVerifier');
const { getSigningPageHTML } = require('../signing/signingPage');
const { getPresignedUrl } = require('../config/s3');
const { sendEmail } = require('../notifications/emailService');

const router = express.Router();
const prisma = new PrismaClient();

router.use(express.urlencoded({ extended: false }));

function renderMessagePage(title, body, color = '#0b1f45') {
  return `<!doctype html><html><body style="font-family:Arial;background:#f5f7fb;padding:30px"><div style="max-width:760px;margin:0 auto;background:#fff;padding:24px;border-radius:10px;border-top:6px solid ${color}"><h2 style="margin-top:0;color:${color}">${title}</h2><p>${body}</p><p><a href=\"mailto:documents@uaiu.live\">documents@uaiu.live</a></p></div></body></html>`;
}

function extractIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length) return fwd.split(',')[0].trim();
  return req.ip;
}

router.get('/sign/:token', async (req, res) => {
  try {
    const signatureRequest = await validateSignToken(req.params.token);

    if (signatureRequest.status === 'PENDING') {
      await prisma.signatureRequest.update({ where: { id: signatureRequest.id }, data: { status: 'VIEWED', ipAddress: extractIp(req), userAgent: req.headers['user-agent'] || '' } });
      signatureRequest.status = 'VIEWED';
    }

    const pdfUrl = await getPresignedUrl(signatureRequest.document.pdfS3Key, 3600);
    const html = getSigningPageHTML(signatureRequest, signatureRequest.document.trade, pdfUrl);
    return res.status(200).send(html);
  } catch (error) {
    return res.status(400).send(renderMessagePage('Signing Link Error', error.message, '#9a1b1b'));
  }
});

router.post('/sign/:token', async (req, res) => {
  const { action, fullName } = req.body;
  const consentGiven = req.body.consentGiven === 'true' || req.body.consentGiven === true || req.body.consentGiven === 'on';
  const ip = extractIp(req);
  const userAgent = req.headers['user-agent'] || '';

  try {
    const sigReq = await validateSignToken(req.params.token);
    const trade = sigReq.document.trade;

    if (action === 'sign') {
      if (!fullName || !String(fullName).trim()) return res.status(400).send(renderMessagePage('Validation Error', 'Full name is required.', '#9a1b1b'));
      if (!consentGiven) return res.status(400).send(renderMessagePage('Validation Error', 'Consent is required before signing.', '#9a1b1b'));

      await recordSignature(req.params.token, { ip, userAgent, consentGiven, fullName: String(fullName) });
      return res.status(200).send(renderMessagePage('Signature Completed', `You have successfully signed ${sigReq.document.docType} for Trade ${trade.tradeId}. A copy will be emailed to ${sigReq.signerEmail} upon completion. You may close this window.`, '#0b1f45'));
    }

    if (action === 'decline') {
      await prisma.signatureRequest.update({
        where: { id: sigReq.id },
        data: { status: 'DECLINED', ipAddress: ip, userAgent },
      });
      await prisma.document.update({ where: { id: sigReq.documentId }, data: { status: 'FAILED' } });

      await sendEmail({
        to: [process.env.UAIU_COMPLIANCE_EMAIL, trade.buyerEmail, trade.sellerEmail].filter(Boolean).join(','),
        subject: `[Declined] Signature request declined for ${trade.tradeId}`,
        text: `Signature request for ${sigReq.document.docType} on trade ${trade.tradeId} was declined by ${sigReq.signerEmail}.`,
      });

      return res.status(200).send(renderMessagePage('Signature Declined', `You have declined to sign ${sigReq.document.docType} for Trade ${trade.tradeId}. UAIU has been notified.`, '#9a1b1b'));
    }

    return res.status(400).send(renderMessagePage('Invalid Action', 'Unsupported signing action.', '#9a1b1b'));
  } catch (error) {
    return res.status(400).send(renderMessagePage('Signing Error', error.message, '#9a1b1b'));
  }
});

module.exports = router;
