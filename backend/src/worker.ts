import { NotificationJob } from './models/NotificationJob.js';
import { sendEmail, getBookingConfirmationHtml, getReminderEmailHtml } from './services/email.service.js';
import { formatUtcToLocal } from './utils/time.js';
import { logger } from './config/logger.js';
import { connectDB } from './config/db.js';

const LOCK_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes lock timeout to recover crashed workers
const MAX_ATTEMPTS = 5;

/**
 * Atomically claims the next pending or stalled job.
 * Guaranteed safe across multiple concurrent worker instances.
 */
export async function claimNextJob() {
  const now = new Date();
  const stalledTime = new Date(now.getTime() - LOCK_TIMEOUT_MS);

  return NotificationJob.findOneAndUpdate(
    {
      $or: [
        { status: 'pending', runAt: { $lte: now } },
        { status: 'processing', lockedAt: { $lte: stalledTime } }, // Stalled job recovery
      ],
    },
    {
      $set: {
        status: 'processing',
        lockedAt: now,
      },
      $inc: { attempts: 1 },
    },
    {
      sort: { runAt: 1 },
      new: true,
    }
  );
}

/**
 * Processes a claimed notification job.
 */
export async function processJob(job: any): Promise<void> {
  try {
    const { type, recipientEmail, payload } = job;
    const timezone = payload.timezone || 'Asia/Kolkata';
    const formattedTime = payload.startAt
      ? formatUtcToLocal(new Date(payload.startAt), timezone, 'EEEE, MMMM d, yyyy @ h:mm a (zzz)')
      : '';

    let subject = 'Medconsults Notification';
    let html = '';

    if (type === 'booking_confirmation' || type === 'booking_pending') {
      subject = `Appointment Confirmed: Dr. ${payload.doctorName}`;
      html = getBookingConfirmationHtml({
        patientName: payload.patientName,
        doctorName: payload.doctorName,
        clinicName: payload.clinicName,
        clinicAddress: payload.clinicAddress,
        formattedTime,
        mapUrl: payload.mapUrl,
        status: payload.status,
      });
    } else if (type === 'reminder_24h' || type === 'reminder_2h') {
      subject = `Appointment Reminder: Dr. ${payload.doctorName}`;
      html = getReminderEmailHtml({
        patientName: payload.patientName,
        doctorName: payload.doctorName,
        clinicName: payload.clinicName,
        clinicAddress: payload.clinicAddress,
        formattedTime,
        mapUrl: payload.mapUrl,
        hoursNotice: payload.hoursNotice || 24,
      });
    } else {
      subject = 'Medconsults Appointment Update';
      html = `<p>Your appointment status has been updated. Please check your dashboard.</p>`;
    }

    await sendEmail({
      to: recipientEmail,
      subject,
      html,
    });

    // Mark as sent
    await NotificationJob.updateOne(
      { _id: job._id },
      {
        $set: {
          status: 'sent',
          lockedAt: null,
        },
      }
    );
    logger.info(`[Worker] Successfully processed job ${job._id} (${job.type})`);
  } catch (error: any) {
    logger.error(`[Worker] Failed to process job ${job._id}:`, error);

    const isMaxAttempts = job.attempts >= MAX_ATTEMPTS;
    await NotificationJob.updateOne(
      { _id: job._id },
      {
        $set: {
          status: isMaxAttempts ? 'failed' : 'pending',
          lockedAt: null,
          lastError: error.message || 'Unknown error',
          // Backoff before retry
          runAt: new Date(Date.now() + Math.pow(2, job.attempts) * 30 * 1000),
        },
      }
    );
  }
}

/**
 * Runs a single worker polling loop iteration.
 */
export async function runWorkerIteration(): Promise<boolean> {
  const job = await claimNextJob();
  if (job) {
    await processJob(job);
    return true; // Had work
  }
  return false; // Idle
}

/**
 * Main worker background loop.
 */
export async function startWorkerLoop(pollIntervalMs = 5000) {
  logger.info('🚀 Starting Medconsults Background Notification Worker...');
  let running = true;

  process.on('SIGTERM', () => {
    logger.info('Worker received SIGTERM, stopping...');
    running = false;
  });
  process.on('SIGINT', () => {
    logger.info('Worker received SIGINT, stopping...');
    running = false;
  });

  while (running) {
    try {
      const hadWork = await runWorkerIteration();
      if (!hadWork) {
        // Sleep if no pending jobs
        await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
      }
    } catch (err) {
      logger.error('[Worker] Loop error:', err);
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }
  }
}

// If executed directly from CLI (e.g., `npm run worker`)
if (process.argv[1]?.endsWith('worker.ts') || process.argv[1]?.endsWith('worker.js')) {
  connectDB().then(() => {
    startWorkerLoop();
  });
}
