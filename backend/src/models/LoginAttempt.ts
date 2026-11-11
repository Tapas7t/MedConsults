import mongoose, { Schema, Document } from 'mongoose';

export interface ILoginAttempt extends Document {
  _id: mongoose.Types.ObjectId;
  email: string;
  ip: string;
  count: number;
  lockedUntil: Date | null;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const LoginAttemptSchema = new Schema<ILoginAttempt>(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    ip: {
      type: String,
      required: true,
    },
    count: {
      type: Number,
      default: 1,
    },
    lockedUntil: {
      type: Date,
      default: null,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 }, // TTL index to auto-clean old attempts
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for querying attempt by email + ip
LoginAttemptSchema.index({ email: 1, ip: 1 });

export const LoginAttempt = mongoose.model<ILoginAttempt>('LoginAttempt', LoginAttemptSchema);
