import mongoose, { Schema, Document } from 'mongoose';

export type NotificationType =
  | 'booking_confirmation'
  | 'booking_pending'
  | 'status_changed'
  | 'reminder_24h'
  | 'reminder_2h'
  | 'doctor_approval'
  | 'cancellation';

export interface INotificationJob extends Document {
  _id: mongoose.Types.ObjectId;
  appointmentId?: mongoose.Types.ObjectId;
  recipientEmail: string;
  recipientName: string;
  type: NotificationType;
  channel: 'email';
  runAt: Date;
  status: 'pending' | 'processing' | 'sent' | 'failed' | 'cancelled';
  payload: Record<string, any>;
  attempts: number;
  lockedAt?: Date | null;
  lastError?: string;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationJobSchema = new Schema<INotificationJob>(
  {
    appointmentId: {
      type: Schema.Types.ObjectId,
      ref: 'Appointment',
      index: true,
    },
    recipientEmail: {
      type: String,
      required: true,
    },
    recipientName: {
      type: String,
      default: '',
    },
    type: {
      type: String,
      required: true,
      enum: [
        'booking_confirmation',
        'booking_pending',
        'status_changed',
        'reminder_24h',
        'reminder_2h',
        'doctor_approval',
        'cancellation',
      ],
    },
    channel: {
      type: String,
      enum: ['email'],
      default: 'email',
    },
    runAt: {
      type: Date,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'sent', 'failed', 'cancelled'],
      default: 'pending',
      index: true,
    },
    payload: {
      type: Schema.Types.Mixed,
      default: {},
    },
    attempts: {
      type: Number,
      default: 0,
    },
    lockedAt: {
      type: Date,
      default: null,
    },
    lastError: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Worker polling index: claimed atomically via status + runAt
NotificationJobSchema.index({ status: 1, runAt: 1 });

export const NotificationJob = mongoose.model<INotificationJob>('NotificationJob', NotificationJobSchema);
