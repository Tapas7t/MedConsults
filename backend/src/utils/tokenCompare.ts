import crypto from 'crypto';

/**
 * Timing-safe comparison of two strings to prevent timing attacks.
 * Uses crypto.timingSafeEqual on equal-length SHA256 hashes if lengths differ or directly if identical.
 */
export function safeCompare(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') {
    return false;
  }

  // To prevent length disclosure, hash both strings with SHA-256 first
  const hashA = crypto.createHash('sha256').update(a).digest();
  const hashB = crypto.createHash('sha256').update(b).digest();

  return crypto.timingSafeEqual(hashA, hashB);
}
