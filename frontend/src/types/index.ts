export type UserRole = 'patient' | 'doctor' | 'admin';

export interface User {
  id: string;
  email: string;
  name: string;
  phone: string;
  role: UserRole;
  isEmailVerified: boolean;
  isBlocked: boolean;
  createdAt: string;
}

export interface Clinic {
  name: string;
  address: string;
  area: string;
  city: string;
  postalCode: string;
  geo?: {
    type: 'Point';
    coordinates: [number, number]; // [lng, lat]
  };
  mapUrl?: string;
  notes?: string;
  phone: string;
  timezone: string;
  photos?: string[];
}

export type DoctorStatus = 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'suspended';

export interface DoctorProfile {
  id: string;
  userId: string;
  slug: string;
  type: 'doctor' | 'dentist';
  specialty: string;
  qualifications: string[];
  licenceNo: string;
  experienceYears: number;
  languages: string[];
  bio?: string;
  photoUrl?: string;
  clinic: Clinic;
  fee: number;
  slotMinutes: number;
  leadTimeMin: number;
  horizonDays: number;
  cancelWindowHours: number;
  autoConfirm: boolean;
  listedInDirectory: boolean;
  status: DoctorStatus;
  rejectionReason?: string;
  user?: {
    name: string;
    email: string;
    phone: string;
  };
}

export type AppointmentStatus =
  | 'pending'
  | 'confirmed'
  | 'arrived'
  | 'completed'
  | 'cancelled_by_patient'
  | 'cancelled_by_doctor'
  | 'cancelled_by_admin'
  | 'no_show';

export interface Dependent {
  id: string;
  name: string;
  dob: string;
  relation: 'spouse' | 'child' | 'parent' | 'sibling' | 'other';
}

export interface Appointment {
  id: string;
  doctorId: string;
  bookedByUserId: string;
  patientRef: {
    type: 'self' | 'dependent' | 'walkin';
    name: string;
    phone?: string;
    dependentId?: string;
  };
  startAt: string;
  endAt: string;
  source: 'online' | 'walkin';
  status: AppointmentStatus;
  notes?: string;
  doctor?: DoctorProfile;
  doctorUser?: {
    name: string;
    email: string;
  };
  bookedByUser?: {
    name: string;
    email: string;
    phone: string;
  };
  statusHistory?: Array<{
    status: AppointmentStatus;
    changedAt: string;
    changedBy: string;
    reason?: string;
  }>;
}

export interface Slot {
  startAt: string;
  endAt: string;
  available: boolean;
}

export interface WeeklyScheduleDay {
  day: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
  ranges: Array<{ start: string; end: string }>;
  breaks: Array<{ start: string; end: string }>;
}

export interface AvailabilitySchedule {
  id?: string;
  doctorId: string;
  weekly: WeeklyScheduleDay[];
  exceptions?: Array<{
    date: string;
    closed: boolean;
    ranges?: Array<{ start: string; end: string }>;
  }>;
}

export interface ScheduleBlock {
  id: string;
  doctorId: string;
  startAt: string;
  endAt: string;
  reason?: string;
}

