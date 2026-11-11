import mongoose, { Schema, Document } from 'mongoose';

export interface IClinic {
  name: string;
  address: string;
  area: string;
  city: string;
  postalCode: string;
  geo?: {
    type: 'Point';
    coordinates: [number, number]; // [longitude, latitude]
  };
  mapUrl?: string;
  notes?: string;
  phone?: string;
  timezone: string; // IANA timezone, e.g. "Asia/Kolkata"
  photos?: string[];
}

export interface IDoctorProfile extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  slug: string;
  name: string;
  type: 'doctor' | 'dentist';
  specialty: string;
  qualifications: string[];
  licenceNo: string;
  experienceYears: number;
  languages: string[];
  bio?: string;
  photoUrl?: string;
  clinic: IClinic;
  fee: number; // In currency units (display only, pay at clinic)
  slotMinutes: number; // 15, 20, 30, 45, 60
  leadTimeMin: number; // Minimum notice before appointment (minutes)
  horizonDays: number; // Max booking horizon in the future (days)
  cancelWindowHours: number; // Min hours before appointment to cancel
  autoConfirm: boolean; // Auto confirm or manual doctor review
  listedInDirectory: boolean; // Discoverable in public directory
  status: 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'suspended';
  rejectionReason?: string;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const DoctorProfileSchema = new Schema<IDoctorProfile>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ['doctor', 'dentist'],
      default: 'doctor',
      required: true,
    },
    specialty: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    qualifications: {
      type: [String],
      default: [],
    },
    licenceNo: {
      type: String,
      required: true,
      trim: true,
    },
    experienceYears: {
      type: Number,
      default: 0,
      min: 0,
    },
    languages: {
      type: [String],
      default: ['English'],
    },
    bio: {
      type: String,
      default: '',
    },
    photoUrl: {
      type: String,
      default: '',
    },
    clinic: {
      name: { type: String, required: true },
      address: { type: String, required: true },
      area: { type: String, default: '' },
      city: { type: String, required: true, index: true },
      postalCode: { type: String, default: '' },
      geo: {
        type: {
          type: String,
          enum: ['Point'],
          default: 'Point',
        },
        coordinates: {
          type: [Number],
          default: [0, 0],
        },
      },
      mapUrl: { type: String, default: '' },
      notes: { type: String, default: '' },
      phone: { type: String, default: '' },
      timezone: { type: String, required: true, default: 'Asia/Kolkata' },
      photos: { type: [String], default: [] },
    },
    fee: {
      type: Number,
      default: 500,
      min: 0,
    },
    slotMinutes: {
      type: Number,
      default: 30,
      enum: [10, 15, 20, 30, 45, 60],
    },
    leadTimeMin: {
      type: Number,
      default: 60,
      min: 0,
    },
    horizonDays: {
      type: Number,
      default: 30,
      min: 1,
      max: 90,
    },
    cancelWindowHours: {
      type: Number,
      default: 4,
      min: 0,
    },
    autoConfirm: {
      type: Boolean,
      default: true,
    },
    listedInDirectory: {
      type: Boolean,
      default: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['draft', 'pending_approval', 'approved', 'rejected', 'suspended'],
      default: 'draft',
      index: true,
    },
    rejectionReason: {
      type: String,
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

// Indexes per PRD Section 6
DoctorProfileSchema.index({
  name: 'text',
  specialty: 'text',
  'clinic.area': 'text',
  'clinic.city': 'text',
  bio: 'text',
});

DoctorProfileSchema.index({ status: 1, specialty: 1, 'clinic.city': 1 });
DoctorProfileSchema.index({ 'clinic.geo': '2dsphere' });

export const DoctorProfile = mongoose.model<IDoctorProfile>('DoctorProfile', DoctorProfileSchema);
