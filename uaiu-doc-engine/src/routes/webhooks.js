const express = require('express');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();

function verifyHelloSign(req) {
  const secret = process.env.HELLOSIGN_WEBHOOK_SECRET || '';
  const signature = String(req.headers['x-dropbox-signature'] || '');
  const digest = crypto.createHmac('sha256', secret).update(JSON.stringify(req.body)).digest('hex');
  return digest.length > 0 && digest === signature;
}

async function mapSignerProgress(document, body) {
  const signatures = body?.signature_request?.signatures || [];
  const buyer = signatures.find((s) => s.signer_email_address === document.trade.buyerEmail);
  const seller = signatures.find((s) => s.signer_email_address === document.trade.sellerEmail);
  const uaiu = signatures.find((s) => s.signer_email_address === process.env.UAIU_COMPLIANCE_EMAIL);

  return {
    buyerSigned: Boolean(buyer?.status_code === 'signed'),
    sellerSigned: Boolean(seller?.status_code === 'signed'),
    uaiuSigned: Boolean(uaiu?.status_code === 'signed'),
  };
}

router.post('/hellosign', async (req, res, next) => {
  try {
    if (!verifyHelloSign(req)) return res.status(401).json({ error: { message: 'Invalid webhook signature' } });

    const eventType = req.body?.event?.event_type;
    const signatureRequestId = req.body?.signature_request?.signature_request_id;
    if (!signatureRequestId) return res.json({ ok: true });

    const documents = await prisma.document.findMany({
      where: { signatureRequestId },
      include: { trade: true },
    });

    for (const document of documents) {
      const signedState = await mapSignerProgress(document, req.body);
      const allSigned = signedState.buyerSigned && signedState.sellerSigned && signedState.uaiuSigned;
      const status = allSigned || eventType === 'signature_request_all_signed'
        ? 'SIGNED'
        : (signedState.buyerSigned || signedState.sellerSigned || signedState.uaiuSigned ? 'PARTIALLY_SIGNED' : 'SENT');

      await prisma.document.update({
        where: { id: document.id },
        data: {
          status,
          ...signedState,
          signedAt: status === 'SIGNED' ? new Date() : null,
        },
      });
    }

    return res.json({ ok: true });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
