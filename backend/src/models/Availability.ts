import mongoose, { Schema, Document } from 'mongoose';

export interface ITimeRange {
  start: string; // "HH:mm" in 24h format, e.g. "09:00"
  end: string;   // "HH:mm" in 24h format, e.g. "13:00"
}

export interface IWeeklySchedule {
  day: number; // 0 = Sunday, 1 = Monday, ... 6 = Saturday
  ranges: ITimeRange[];
  breaks: ITimeRange[];
}

export interface IAvailabilityException {
  date: string; // "YYYY-MM-DD"
  ranges: ITimeRange[];
  closed: boolean;
  reason?: string;
}

export interface IAvailability extends Document {
  _id: mongoose.Types.ObjectId;
  doctorId: mongoose.Types.ObjectId;
  weekly: IWeeklySchedule[];
  exceptions: IAvailabilityException[];
  createdAt: Date;
  updatedAt: Date;
}

const TimeRangeSchema = new Schema<ITimeRange>(
  {
    start: { type: String, required: true },
    end: { type: String, required: true },
  },
  { _id: false }
);

const WeeklyScheduleSchema = new Schema<IWeeklySchedule>(
  {
    day: { type: Number, required: true, min: 0, max: 6 },
    ranges: { type: [TimeRangeSchema], default: [] },
    breaks: { type: [TimeRangeSchema], default: [] },
  },
  { _id: false }
);

const AvailabilityExceptionSchema = new Schema<IAvailabilityException>(
  {
    date: { type: String, required: true },
    ranges: { type: [TimeRangeSchema], default: [] },
    closed: { type: Boolean, default: false },
    reason: { type: String, default: '' },
  },
  { _id: false }
);

const AvailabilitySchema = new Schema<IAvailability>(
  {
    doctorId: {
      type: Schema.Types.ObjectId,
      ref: 'DoctorProfile',
      required: true,
      unique: true,
      index: true,
    },
    weekly: {
      type: [WeeklyScheduleSchema],
      default: [
        // Default standard clinic week: Mon-Fri 09:00 - 17:00, lunch 13:00 - 14:00
        { day: 1, ranges: [{ start: '09:00', end: '17:00' }], breaks: [{ start: '13:00', end: '14:00' }] },
        { day: 2, ranges: [{ start: '09:00', end: '17:00' }], breaks: [{ start: '13:00', end: '14:00' }] },
        { day: 3, ranges: [{ start: '09:00', end: '17:00' }], breaks: [{ start: '13:00', end: '14:00' }] },
        { day: 4, ranges: [{ start: '09:00', end: '17:00' }], breaks: [{ start: '13:00', end: '14:00' }] },
        { day: 5, ranges: [{ start: '09:00', end: '17:00' }], breaks: [{ start: '13:00', end: '14:00' }] },
        { day: 6, ranges: [{ start: '09:00', end: '13:00' }], breaks: [] },
        { day: 0, ranges: [], breaks: [] },
      ],
    },
    exceptions: {
      type: [AvailabilityExceptionSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

export const Availability = mongoose.model<IAvailability>('Availability', AvailabilitySchema);
