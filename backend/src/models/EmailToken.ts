import mongoose, { Schema, Document } from 'mongoose';

export interface IEmailToken extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  type: 'verify_email' | 'reset_password';
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
}

const EmailTokenSchema = new Schema<IEmailToken>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['verify_email', 'reset_password'],
      required: true,
    },
    tokenHash: {
      type: String,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 }, // TTL index
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

export const EmailToken = mongoose.model<IEmailToken>('EmailToken', EmailTokenSchema);
