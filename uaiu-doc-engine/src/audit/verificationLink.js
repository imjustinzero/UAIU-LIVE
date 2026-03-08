async function generateVerificationRecord(_trade, pack) {
  return { publicVerificationUrl: `https://example.invalid/verify/${encodeURIComponent(pack.sha256Hash)}` };
}

module.exports = { generateVerificationRecord };
