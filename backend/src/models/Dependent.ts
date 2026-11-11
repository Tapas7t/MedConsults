import mongoose, { Schema, Document } from 'mongoose';

export interface IDependent extends Document {
  _id: mongoose.Types.ObjectId;
  patientUserId: mongoose.Types.ObjectId;
  name: string;
  dob: Date;
  relation: string; // 'Spouse' | 'Child' | 'Parent' | 'Other'
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const DependentSchema = new Schema<IDependent>(
  {
    patientUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    dob: {
      type: Date,
      required: true,
    },
    relation: {
      type: String,
      required: true,
      enum: ['Spouse', 'Child', 'Parent', 'Other', 'Sibling'],
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

DependentSchema.index({ patientUserId: 1, isDeleted: 1 });

export const Dependent = mongoose.model<IDependent>('Dependent', DependentSchema);
