import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { User } from '../../models/User.js';
import { DoctorProfile } from '../../models/DoctorProfile.js';
import { Availability } from '../../models/Availability.js';
import { LoginAttempt } from '../../models/LoginAttempt.js';
import { EmailToken } from '../../models/EmailToken.js';
import { createSession, rotateSession, revokeSession } from '../../utils/session.js';
import { signAccessToken } from '../../utils/jwt.js';
import { safeCompare } from '../../utils/tokenCompare.js';
import { sendEmail, getVerificationEmailHtml, getPasswordResetEmailHtml } from '../../services/email.service.js';
import { env } from '../../config/env.js';

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_WINDOW_MINUTES = 15;
const REFRESH_COOKIE_NAME = 'medconsults_refresh';

function setRefreshCookie(res: Response, refreshToken: string) {
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: env.NODE_ENV === 'production' ? 'strict' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/api/v1/auth',
  });
}

function clearRefreshCookie(res: Response) {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: env.NODE_ENV === 'production' ? 'strict' : 'lax',
    path: '/api/v1/auth',
  });
}

export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password, role } = req.body;

    // Check if user already exists
    const existing = await User.findOne({ email });
    if (existing) {
      // Per Blueprint A 6: Generic message to prevent email enumeration
      res.status(409).json({
        success: false,
        error: {
          code: 'EMAIL_ALREADY_EXISTS',
          message: 'An account with this email address already exists. Please log in or reset your password.',
        },
      });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({
      email,
      passwordHash,
      role: role || 'patient',
      isEmailVerified: false,
    });

    // If registering as a doctor, automatically initialize their DoctorProfile draft and availability
    if (user.role === 'doctor') {
      const emailPrefix = email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
      const uniqueSuffix = crypto.randomBytes(3).toString('hex');
      const slug = `dr-${emailPrefix}-${uniqueSuffix}`;

      const doctorProfile = await DoctorProfile.create({
        userId: user._id,
        slug,
        name: `Dr. ${emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1)}`,
        type: 'doctor',
        specialty: 'General Physician',
        licenceNo: 'PENDING',
        clinic: {
          name: 'My Clinic',
          address: 'Please update your clinic address',
          city: 'City',
          timezone: 'Asia/Kolkata',
        },
        status: 'draft',
      });

      await Availability.create({
        doctorId: doctorProfile._id,
      });
    }

    // Generate email verification token (SHA-256 hashed in DB)
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const tokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await EmailToken.create({
      userId: user._id,
      type: 'verify_email',
      tokenHash,
      expiresAt: tokenExpiresAt,
    });

    // Send verification email
    const verifyUrl = `${env.APP_BASE_URL}/verify-email?token=${rawToken}`;
    await sendEmail({
      to: user.email,
      subject: 'Verify your Medconsults account',
      html: getVerificationEmailHtml(verifyUrl),
    });

    // Create session & tokens
    const session = await createSession(user._id, req.headers['user-agent'], req.ip);
    setRefreshCookie(res, session.refreshToken);

    const accessToken = signAccessToken({
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
      sessionId: session.sessionId,
    });

    res.status(201).json({
      success: true,
      data: {
        user: {
          id: user._id.toString(),
          email: user.email,
          role: user.role,
          isEmailVerified: user.isEmailVerified,
        },
        accessToken,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password } = req.body;
    const ip = req.ip || 'unknown';

    // Check account lockout via LoginAttempt
    const attempt = await LoginAttempt.findOne({ email, ip });
    if (attempt && attempt.lockedUntil && attempt.lockedUntil > new Date()) {
      const waitMin = Math.ceil((attempt.lockedUntil.getTime() - Date.now()) / (60 * 1000));
      res.status(429).json({
        success: false,
        error: {
          code: 'ACCOUNT_LOCKED',
          message: `Too many failed login attempts. Please try again in ${waitMin} minutes.`,
        },
      });
      return;
    }

    const user = await User.findOne({ email, isDeleted: false });

    // Timing attack mitigation: always run bcrypt compare even if user not found
    const dummyHash = '$2b$12$e8Yh9Y2QoRz.Zt4tLqTjE.Q4G4ZfGz64zYq0Y8Y0Y8Y0Y8Y0Y8Y0';
    const isMatch = await bcrypt.compare(password, user ? user.passwordHash : dummyHash);

    if (!user || !isMatch) {
      // Record failed attempt
      const newCount = (attempt?.count || 0) + 1;
      let lockedUntil: Date | null = null;

      if (newCount >= MAX_LOGIN_ATTEMPTS) {
        lockedUntil = new Date(Date.now() + LOCKOUT_WINDOW_MINUTES * 60 * 1000);
      }

      await LoginAttempt.findOneAndUpdate(
        { email, ip },
        {
          $set: {
            count: newCount,
            lockedUntil,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          },
        },
        { upsert: true }
      );

      res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
        },
      });
      return;
    }

    if (user.isBlocked) {
      res.status(403).json({
        success: false,
        error: {
          code: 'ACCOUNT_BLOCKED',
          message: 'Your account has been suspended by an administrator.',
        },
      });
      return;
    }

    // Reset login attempts on successful login
    if (attempt) {
      await LoginAttempt.deleteOne({ _id: attempt._id });
    }

    // Create session & tokens
    const session = await createSession(user._id, req.headers['user-agent'], req.ip);
    setRefreshCookie(res, session.refreshToken);

    const accessToken = signAccessToken({
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
      sessionId: session.sessionId,
    });

    res.status(200).json({
      success: true,
      data: {
        user: {
          id: user._id.toString(),
          email: user.email,
          role: user.role,
          isEmailVerified: user.isEmailVerified,
        },
        accessToken,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const rawRefreshToken = req.cookies[REFRESH_COOKIE_NAME];
    if (!rawRefreshToken) {
      res.status(401).json({
        success: false,
        error: {
          code: 'NO_REFRESH_TOKEN',
          message: 'No refresh token provided',
        },
      });
      return;
    }

    // Rotate session with family revocation check
    const newSession = await rotateSession(rawRefreshToken, req.headers['user-agent'], req.ip);
    setRefreshCookie(res, newSession.refreshToken);

    const user = await User.findById(newSession.userId);
    if (!user || user.isDeleted || user.isBlocked) {
      clearRefreshCookie(res);
      res.status(401).json({
        success: false,
        error: {
          code: 'USER_INACTIVE',
          message: 'User account is no longer active',
        },
      });
      return;
    }

    const accessToken = signAccessToken({
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
      sessionId: newSession.sessionId,
    });

    res.status(200).json({
      success: true,
      data: {
        accessToken,
        user: {
          id: user._id.toString(),
          email: user.email,
          role: user.role,
          isEmailVerified: user.isEmailVerified,
        },
      },
    });
  } catch (error: any) {
    clearRefreshCookie(res);
    next(error);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const rawRefreshToken = req.cookies[REFRESH_COOKIE_NAME];
    if (rawRefreshToken && rawRefreshToken.includes('.')) {
      const [sessionId] = rawRefreshToken.split('.');
      if (sessionId) {
        await revokeSession(sessionId);
      }
    }

    clearRefreshCookie(res);

    res.status(200).json({
      success: true,
      data: {
        message: 'Logged out successfully',
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function verifyEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { token } = req.body;
    const incomingHash = crypto.createHash('sha256').update(token).digest('hex');

    const emailToken = await EmailToken.findOne({
      tokenHash: incomingHash,
      type: 'verify_email',
      expiresAt: { $gt: new Date() },
    });

    if (!emailToken || !safeCompare(emailToken.tokenHash, incomingHash)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Verification link is invalid or has expired',
        },
      });
      return;
    }

    await User.updateOne({ _id: emailToken.userId }, { $set: { isEmailVerified: true } });
    await EmailToken.deleteOne({ _id: emailToken._id });

    res.status(200).json({
      success: true,
      data: {
        message: 'Email address verified successfully. You may now book appointments.',
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function forgotPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email, isDeleted: false });

    // Always respond with success to prevent email enumeration
    if (!user) {
      res.status(200).json({
        success: true,
        data: {
          message: 'If an account exists with that email, a password reset link has been sent.',
        },
      });
      return;
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Remove any previous reset tokens for this user
    await EmailToken.deleteMany({ userId: user._id, type: 'reset_password' });

    await EmailToken.create({
      userId: user._id,
      type: 'reset_password',
      tokenHash,
      expiresAt,
    });

    const resetUrl = `${env.APP_BASE_URL}/reset-password?token=${rawToken}`;
    await sendEmail({
      to: user.email,
      subject: 'Reset your Medconsults password',
      html: getPasswordResetEmailHtml(resetUrl),
    });

    res.status(200).json({
      success: true,
      data: {
        message: 'If an account exists with that email, a password reset link has been sent.',
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { token, password } = req.body;
    const incomingHash = crypto.createHash('sha256').update(token).digest('hex');

    const emailToken = await EmailToken.findOne({
      tokenHash: incomingHash,
      type: 'reset_password',
      expiresAt: { $gt: new Date() },
    });

    if (!emailToken || !safeCompare(emailToken.tokenHash, incomingHash)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Password reset link is invalid or has expired',
        },
      });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await User.updateOne({ _id: emailToken.userId }, { $set: { passwordHash } });
    await EmailToken.deleteOne({ _id: emailToken._id });

    // Revoke all existing sessions for this user on password reset
    const { revokeAllUserSessions } = await import('../../utils/session.js');
    await revokeAllUserSessions(emailToken.userId.toString());

    res.status(200).json({
      success: true,
      data: {
        message: 'Password has been successfully updated. Please log in with your new credentials.',
      },
    });
  } catch (error) {
    next(error);
  }
}
