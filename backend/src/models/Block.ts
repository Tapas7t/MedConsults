import mongoose, { Schema, Document } from 'mongoose';

export interface IBlock extends Document {
  _id: mongoose.Types.ObjectId;
  doctorId: mongoose.Types.ObjectId;
  startAt: Date; // UTC
  endAt: Date;   // UTC
  reason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const BlockSchema = new Schema<IBlock>(
  {
    doctorId: {
      type: Schema.Types.ObjectId,
      ref: 'DoctorProfile',
      required: true,
      index: true,
    },
    startAt: {
      type: Date,
      required: true,
    },
    endAt: {
      type: Date,
      required: true,
    },
    reason: {
      type: String,
      default: 'Blocked time',
    },
  },
  {
    timestamps: true,
  }
);

BlockSchema.index({ doctorId: 1, startAt: 1 });

export const Block = mongoose.model<IBlock>('Block', BlockSchema);
