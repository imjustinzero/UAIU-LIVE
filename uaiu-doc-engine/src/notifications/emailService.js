const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: String(process.env.SMTP_SECURE) === 'true',
  auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
});

function getDocLabel(docType) {
  const map = {
    DOC_02: 'Trade Confirmation',
    DOC_03: 'Escrow Addendum',
    DOC_04: 'Seller Certificate',
    DOC_05: 'Buyer Certificate',
    DOC_08: 'Dispute Notice',
    DOC_12: 'Registry Checklist',
    AUDIT_PACK_COVER: 'Audit Pack Cover',
    CLOSING_SUMMARY: 'Closing Summary',
  };
  return map[docType] || docType;
}

async function sendEmail({ to, subject, text, html }) {
  return transporter.sendMail({ from: process.env.SMTP_FROM, to, subject, text, html });
}

async function sendSigningRequest(signer, document, trade, signingUrl) {
  const expiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toUTCString();
  const docLabel = getDocLabel(document.docType);
  const subject = `[Action Required] Sign Now — UAIU Trade ${trade.tradeId} ${docLabel}`;

  const html = `
  <div style="font-family:Arial,sans-serif;background:#f5f7fb;padding:24px;">
    <div style="max-width:680px;margin:0 auto;background:#fff;border-radius:10px;overflow:hidden;border:1px solid #dde3ef;">
      <div style="background:#0b1f45;color:#d4a62a;padding:16px 20px;font-weight:700;">UAIU Holdings Corp | UAIU.LIVE/X</div>
      <div style="padding:22px;color:#1e293b;">
        <h2 style="margin-top:0;color:#0b1f45;">You have a document ready for your electronic signature.</h2>
        <p><strong>Who:</strong> ${signer.name} as ${signer.role}</p>
        <p><strong>Document:</strong> ${docLabel}</p>
        <p><strong>Trade:</strong> ${trade.tradeId}</p>
        <p><strong>Project:</strong> ${trade.projectName} | <strong>Registry:</strong> ${trade.registry}</p>
        <p><strong>Expires:</strong> ${expiry}</p>
        <p style="margin:24px 0;"><a href="${signingUrl}" style="display:inline-block;background:#0b1f45;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:700;">Review & Sign Document</a></p>
        <p style="font-size:13px;color:#6b7280;">This link is unique to you. Do not forward it. It expires in 7 days.</p>
        <p style="font-size:13px;color:#6b7280;">If you did not expect this request, contact documents@uaiu.live immediately.</p>
      </div>
    </div>
  </div>`;

  return sendEmail({
    to: signer.email,
    subject,
    text: `You have a document ready for signature. Trade ${trade.tradeId}, document ${docLabel}. Sign here: ${signingUrl}. Expires: ${expiry}.`,
    html,
  });
}

module.exports = { sendEmail, sendSigningRequest, getDocLabel };
