import mongoose, { Schema, Document } from 'mongoose';

export type AppointmentStatus =
  | 'pending'
  | 'confirmed'
  | 'arrived'
  | 'completed'
  | 'cancelled'
  | 'no_show'
  | 'rescheduled';

export interface IStatusHistoryItem {
  status: AppointmentStatus;
  changedBy: mongoose.Types.ObjectId;
  at: Date;
  reason?: string;
}

export interface IPatientRef {
  type: 'self' | 'dependent' | 'walkin';
  name: string;
  dependentId?: mongoose.Types.ObjectId;
  phone?: string;
}

export interface IAppointment extends Document {
  _id: mongoose.Types.ObjectId;
  doctorId: mongoose.Types.ObjectId;
  bookedByUserId: mongoose.Types.ObjectId;
  patientRef: IPatientRef;
  startAt: Date; // UTC
  endAt: Date;   // UTC
  source: 'online' | 'walkin';
  status: AppointmentStatus;
  reasonEnc?: string; // Encrypted reason
  notesEnc?: string;  // Encrypted doctor-only notes
  statusHistory: IStatusHistoryItem[];
  rescheduledFrom?: mongoose.Types.ObjectId;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const PatientRefSchema = new Schema<IPatientRef>(
  {
    type: {
      type: String,
      enum: ['self', 'dependent', 'walkin'],
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    dependentId: {
      type: Schema.Types.ObjectId,
      ref: 'Dependent',
    },
    phone: {
      type: String,
      trim: true,
    },
  },
  { _id: false }
);

const StatusHistoryItemSchema = new Schema<IStatusHistoryItem>(
  {
    status: {
      type: String,
      required: true,
    },
    changedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    at: {
      type: Date,
      default: Date.now,
    },
    reason: {
      type: String,
      default: '',
    },
  },
  { _id: false }
);

const AppointmentSchema = new Schema<IAppointment>(
  {
    doctorId: {
      type: Schema.Types.ObjectId,
      ref: 'DoctorProfile',
      required: true,
      index: true,
    },
    bookedByUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    patientRef: {
      type: PatientRefSchema,
      required: true,
    },
    startAt: {
      type: Date,
      required: true,
      index: true,
    },
    endAt: {
      type: Date,
      required: true,
    },
    source: {
      type: String,
      enum: ['online', 'walkin'],
      default: 'online',
    },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'arrived', 'completed', 'cancelled', 'no_show', 'rescheduled'],
      default: 'confirmed',
      index: true,
    },
    reasonEnc: {
      type: String,
    },
    notesEnc: {
      type: String,
    },
    statusHistory: {
      type: [StatusHistoryItemSchema],
      default: [],
    },
    rescheduledFrom: {
      type: Schema.Types.ObjectId,
      ref: 'Appointment',
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

// CRITICAL PRD REQUIREMENT: Unique partial index on (doctorId, startAt) on active statuses to enforce zero double-bookings at DB level
AppointmentSchema.index(
  { doctorId: 1, startAt: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: { $in: ['pending', 'confirmed', 'arrived'] },
      isDeleted: false,
    },
  }
);

// Patient query indexing
AppointmentSchema.index({ bookedByUserId: 1, startAt: 1 });
// Doctor dashboard day query indexing
AppointmentSchema.index({ doctorId: 1, startAt: 1, status: 1 });

export const Appointment = mongoose.model<IAppointment>('Appointment', AppointmentSchema);
