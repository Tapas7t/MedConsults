import nodemailer, { Transporter } from 'nodemailer';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

let transporter: Transporter;

export async function initEmailTransporter(): Promise<Transporter> {
  if (transporter) return transporter;

  if (env.NODE_ENV === 'production' && env.SMTP_USER && env.SMTP_PASS) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      },
    });
  } else {
    // Development fallback: ethereal email or test transporter
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      auth: {
        user: 'medconsults.dev@ethereal.email',
        pass: 'devpassword123',
      },
    });
  }

  return transporter;
}

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail(options: SendEmailOptions): Promise<void> {
  try {
    const mailer = await initEmailTransporter();
    const info = await mailer.sendMail({
      from: env.EMAIL_FROM,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text || options.subject,
    });

    logger.info(`📧 Email sent to ${options.to} [Subject: ${options.subject}] (ID: ${info.messageId})`);
  } catch (err: any) {
    // Log error without exposing sensitive recipient details if configured
    logger.error('Failed to send email:', { error: err.message, to: options.to, subject: options.subject });
    // In dev, don't crash if smtp fails
    if (env.NODE_ENV === 'production') {
      throw err;
    }
  }
}

// ── Email Templates (Generic subjects, no health diagnoses or clinical notes) ──

export function getVerificationEmailHtml(verifyUrl: string): string {
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1F2D3D;">
      <h2 style="color: #0E7C86;">Verify your email for Medconsults</h2>
      <p>Thank you for signing up. Please click the button below to verify your email address:</p>
      <div style="margin: 25px 0;">
        <a href="${verifyUrl}" style="background-color: #0E7C86; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
          Verify Email
        </a>
      </div>
      <p style="color: #5B6B7B; font-size: 14px;">If the button does not work, copy and paste this link into your browser:</p>
      <p style="color: #5B6B7B; font-size: 13px; word-break: break-all;">${verifyUrl}</p>
      <hr style="border: none; border-top: 1px solid #E6F6F7; margin: 30px 0;" />
      <p style="color: #5B6B7B; font-size: 12px;">This link will expire in 24 hours.</p>
    </div>
  `;
}

export function getPasswordResetEmailHtml(resetUrl: string): string {
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1F2D3D;">
      <h2 style="color: #0E7C86;">Reset your Medconsults password</h2>
      <p>We received a request to reset your password. Click the button below to choose a new password:</p>
      <div style="margin: 25px 0;">
        <a href="${resetUrl}" style="background-color: #0E7C86; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
          Reset Password
        </a>
      </div>
      <p style="color: #5B6B7B; font-size: 14px;">If you did not make this request, you can safely ignore this email.</p>
      <p style="color: #5B6B7B; font-size: 13px; word-break: break-all;">${resetUrl}</p>
      <hr style="border: none; border-top: 1px solid #E6F6F7; margin: 30px 0;" />
      <p style="color: #5B6B7B; font-size: 12px;">This link will expire in 1 hour.</p>
    </div>
  `;
}

export function getBookingConfirmationHtml(params: {
  patientName: string;
  doctorName: string;
  clinicName: string;
  clinicAddress: string;
  formattedTime: string;
  mapUrl?: string;
  status: string;
}): string {
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1F2D3D;">
      <h2 style="color: #0E7C86;">Appointment Confirmation</h2>
      <p>Hello <strong>${params.patientName}</strong>,</p>
      <p>Your appointment with <strong>${params.doctorName}</strong> has been received (Status: <strong>${params.status.toUpperCase()}</strong>).</p>
      
      <div style="background-color: #F5FAFB; border-left: 4px solid #0E7C86; padding: 15px; margin: 20px 0; border-radius: 4px;">
        <p style="margin: 5px 0;"><strong>Date & Time:</strong> ${params.formattedTime}</p>
        <p style="margin: 5px 0;"><strong>Clinic:</strong> ${params.clinicName}</p>
        <p style="margin: 5px 0;"><strong>Address:</strong> ${params.clinicAddress}</p>
        ${params.mapUrl ? `<p style="margin: 5px 0;"><a href="${params.mapUrl}" style="color: #0E7C86;">Get Directions on Google Maps</a></p>` : ''}
      </div>

      <p style="color: #5B6B7B; font-size: 14px;">Payment is collected at the clinic. Please arrive 10 minutes prior to your scheduled time.</p>
    </div>
  `;
}

export function getReminderEmailHtml(params: {
  patientName: string;
  doctorName: string;
  clinicName: string;
  clinicAddress: string;
  formattedTime: string;
  mapUrl?: string;
  hoursNotice: number;
}): string {
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1F2D3D;">
      <h2 style="color: #0E7C86;">Appointment Reminder (${params.hoursNotice}h Notice)</h2>
      <p>Hello <strong>${params.patientName}</strong>,</p>
      <p>This is a reminder for your upcoming appointment with <strong>${params.doctorName}</strong>.</p>
      
      <div style="background-color: #F5FAFB; border-left: 4px solid #2F80ED; padding: 15px; margin: 20px 0; border-radius: 4px;">
        <p style="margin: 5px 0;"><strong>Scheduled For:</strong> ${params.formattedTime}</p>
        <p style="margin: 5px 0;"><strong>Clinic:</strong> ${params.clinicName}</p>
        <p style="margin: 5px 0;"><strong>Address:</strong> ${params.clinicAddress}</p>
        ${params.mapUrl ? `<p style="margin: 5px 0;"><a href="${params.mapUrl}" style="color: #0E7C86;">Get Directions on Map</a></p>` : ''}
      </div>

      <p style="color: #5B6B7B; font-size: 14px;">If you need to reschedule or cancel, please do so from your dashboard before the cancellation window closes.</p>
    </div>
  `;
}
