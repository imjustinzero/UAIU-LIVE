const puppeteer = require('puppeteer');
const { putObject, getPresignedUrl } = require('../config/s3');

async function generatePDF(html, tradeId, docType, isDraft) {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' } });

    const key = `documents/${tradeId}/${docType}-${Date.now()}${isDraft ? '-draft' : ''}.pdf`;
    await putObject({ key, body: pdfBuffer, contentType: 'application/pdf' });
    const presignedUrl = await getPresignedUrl(key, 60 * 60 * 24);
    return { s3Key: key, presignedUrl, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) };
  } finally {
    await browser.close();
  }
}

module.exports = { generatePDF };
