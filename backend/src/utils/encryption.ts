import crypto from 'crypto';
import { env } from '../config/env.js';

const ALGORITHM = 'aes-256-gcm';
const CURRENT_VERSION = 'v1';

// Supported key versions mapping for future rotation
const KEY_REGISTRY: Record<string, Buffer> = {
  v1: Buffer.from(env.NOTE_ENCRYPTION_KEY_V1, 'hex'),
};

/**
 * Encrypt sensitive plain text using AES-256-GCM with keyVersion prefix.
 * Format: keyVersion:iv:authTag:ciphertext (hex-encoded)
 */
export function encryptData(plainText: string, version = CURRENT_VERSION): string {
  if (!plainText) return '';
  const key = KEY_REGISTRY[version];
  if (!key) {
    throw new Error(`Encryption key for version ${version} not configured`);
  }

  const iv = crypto.randomBytes(12); // Standard 96-bit IV for GCM
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  return `${version}:${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypt data formatted as keyVersion:iv:authTag:ciphertext.
 */
export function decryptData(cipherTextWithMeta: string): string {
  if (!cipherTextWithMeta) return '';
  const parts = cipherTextWithMeta.split(':');
  if (parts.length !== 4) {
    throw new Error('Malformed encrypted payload format');
  }

  const [version, ivHex, tagHex, encryptedHex] = parts;
  if (!version || !ivHex || !tagHex || !encryptedHex) {
    throw new Error('Missing component in encrypted payload');
  }

  const key = KEY_REGISTRY[version];
  if (!key) {
    throw new Error(`No key configured for decryption version ${version}`);
  }

  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(tagHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
