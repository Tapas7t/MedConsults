import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { Session } from '../models/Session.js';

const REFRESH_EXPIRY_DAYS = 7;
const BCRYPT_ROUNDS = 10;

export interface SessionResult {
  sessionId: string;
  secret: string;
  refreshToken: string; // "sessionId.secret"
  userId: string;
}

/**
 * Creates a new session with a random secret and assigns or inherits a familyId.
 */
export async function createSession(
  userId: mongoose.Types.ObjectId | string,
  userAgent?: string,
  ipAddress?: string,
  existingFamilyId?: string
): Promise<SessionResult> {
  const sessionId = crypto.randomUUID();
  const secret = crypto.randomBytes(32).toString('hex');
  const familyId = existingFamilyId || crypto.randomUUID();

  const secretHash = await bcrypt.hash(secret, BCRYPT_ROUNDS);
  const expiresAt = new Date(Date.now() + REFRESH_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  await Session.create({
    userId: new mongoose.Types.ObjectId(userId),
    sessionId,
    secretHash,
    familyId,
    userAgent,
    ipAddress,
    expiresAt,
  });

  return {
    sessionId,
    secret,
    refreshToken: `${sessionId}.${secret}`,
    userId: userId.toString(),
  };
}

/**
 * Rotates a refresh session.
 * If secret comparison fails, triggers family revocation (reuse detection).
 */
export async function rotateSession(
  rawRefreshToken: string,
  userAgent?: string,
  ipAddress?: string
): Promise<SessionResult> {
  if (!rawRefreshToken || !rawRefreshToken.includes('.')) {
    const err = new Error('Invalid refresh token format') as any;
    err.statusCode = 401;
    err.code = 'INVALID_REFRESH_TOKEN';
    throw err;
  }

  const [sessionId, secret] = rawRefreshToken.split('.');
  if (!sessionId || !secret) {
    const err = new Error('Invalid refresh token') as any;
    err.statusCode = 401;
    err.code = 'INVALID_REFRESH_TOKEN';
    throw err;
  }

  const existingSession = await Session.findOne({ sessionId });
  if (!existingSession) {
    const err = new Error('Session not found or expired') as any;
    err.statusCode = 401;
    err.code = 'SESSION_EXPIRED';
    throw err;
  }

  // Validate secret with bcrypt
  const isMatch = await bcrypt.compare(secret, existingSession.secretHash);
  if (!isMatch) {
    // SECURITY CRITICAL: Potential token reuse / theft attack!
    // Revoke ALL sessions belonging to this family immediately.
    await Session.deleteMany({ familyId: existingSession.familyId });
    const err = new Error('Token reuse detected. All sessions in this family have been revoked.') as any;
    err.statusCode = 401;
    err.code = 'SESSION_REUSE_REVOKED';
    throw err;
  }

  // Delete current session
  await Session.deleteOne({ _id: existingSession._id });

  // Issue rotated session within the same family
  return createSession(existingSession.userId, userAgent, ipAddress, existingSession.familyId);
}

/**
 * Revokes an individual session.
 */
export async function revokeSession(sessionId: string): Promise<void> {
  await Session.deleteOne({ sessionId });
}

/**
 * Revokes all sessions belonging to a user.
 */
export async function revokeAllUserSessions(userId: string): Promise<void> {
  await Session.deleteMany({ userId: new mongoose.Types.ObjectId(userId) });
}
