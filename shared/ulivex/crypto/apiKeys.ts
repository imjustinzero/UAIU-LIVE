import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';

function getKey(): Buffer {
  const keyHex = process.env.ENCRYPTION_KEY;
  if (!keyHex) {
    throw new Error('ENCRYPTION_KEY is required');
  }

  const key = Buffer.from(keyHex, 'hex');
  if (key.byteLength !== 32) {
    throw new Error('ENCRYPTION_KEY must be 32 bytes (64 hex characters)');
  }

  return key;
}

export function encryptApiKey(plaintext: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [iv, tag, encrypted].map((part) => part.toString('hex')).join(':');
}

export function decryptApiKey(stored: string): string {
  const [ivHex, tagHex, encryptedHex] = stored.split(':');
  if (!ivHex || !tagHex || !encryptedHex) {
    throw new Error('Invalid encrypted key format');
  }

  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const encrypted = Buffer.from(encryptedHex, 'hex');

  const decipher = createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(tag);

  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}
