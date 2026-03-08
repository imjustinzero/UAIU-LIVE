const crypto = require('crypto');
const { GetObjectCommand } = require('@aws-sdk/client-s3');
const { s3, bucket } = require('../config/s3');

async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

async function generateHash(s3Key) {
  const response = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: s3Key }));
  const content = await streamToBuffer(response.Body);
  return crypto.createHash('sha256').update(content).digest('hex');
}

module.exports = { generateHash };
