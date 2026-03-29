import { createSign, generateKeyPairSync } from 'crypto';
import fs from 'fs';

const PRIV = '.gateway-private.pem';
const PUB = '.gateway-public.pem';

export function ensureKeys() {
  if (!fs.existsSync(PRIV) || !fs.existsSync(PUB)) {
    const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    fs.writeFileSync(PRIV, privateKey.export({ type: 'pkcs1', format: 'pem' }));
    fs.writeFileSync(PUB, publicKey.export({ type: 'pkcs1', format: 'pem' }));
  }
}

export function signReading(reading: any) {
  ensureKeys();
  const signer = createSign('RSA-SHA256');
  signer.update(JSON.stringify(reading));
  signer.end();
  return signer.sign(fs.readFileSync(PRIV), 'base64');
}
