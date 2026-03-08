const crypto = require('crypto');

async function generateHash(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

module.exports = { generateHash };
