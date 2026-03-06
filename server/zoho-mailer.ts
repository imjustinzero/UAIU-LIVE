import nodemailer from 'nodemailer';

export interface ZohoAttachment {
  filename: string;
  content: Buffer;
  contentType: string;
}

export function isZohoConfigured(): boolean {
  return !!(process.env.ZOHO_SMTP_USER && process.env.ZOHO_SMTP_PASS);
}

function createTransporter() {
  return nodemailer.createTransport({
    host: 'smtp.zoho.com',
    port: 465,
    secure: true,
    auth: {
      user: process.env.ZOHO_SMTP_USER,
      pass: process.env.ZOHO_SMTP_PASS,
    },
  });
}

export async function sendZohoEmail(
  to: string,
  subject: string,
  html: string,
  attachments?: ZohoAttachment[]
): Promise<boolean> {
  try {
    const transporter = createTransporter();
    await transporter.sendMail({
      from: `UAIU Exchange <${process.env.ZOHO_SMTP_USER}>`,
      to,
      subject,
      html,
      attachments: attachments?.map(a => ({
        filename: a.filename,
        content: a.content,
        contentType: a.contentType,
      })),
    });
    return true;
  } catch (error) {
    console.error('❌ Zoho SMTP error:', error);
    return false;
  }
}
