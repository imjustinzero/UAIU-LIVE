async function assemblePack(tradeId) {
  return { s3Key: `${tradeId}/audit-pack.zip`, documentCount: 0 };
}

module.exports = { assemblePack };
