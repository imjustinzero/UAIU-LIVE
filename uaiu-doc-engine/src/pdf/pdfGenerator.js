async function generatePDF(_html, tradeId, docType, _isDraft) {
  const base = `${tradeId}/${docType}/${Date.now()}.pdf`;
  return {
    s3Key: base,
    presignedUrl: `https://example.invalid/${base}`,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  };
}

module.exports = { generatePDF };
