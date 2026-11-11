import { z } from 'zod';

export const updateDoctorProfileSchema = z.object({
  name: z.string().min(2).optional(),
  type: z.enum(['doctor', 'dentist']).optional(),
  specialty: z.string().min(2).optional(),
  qualifications: z.array(z.string()).optional(),
  licenceNo: z.string().min(3).optional(),
  experienceYears: z.number().min(0).optional(),
  languages: z.array(z.string()).optional(),
  bio: z.string().optional(),
  photoUrl: z.string().optional(),
  clinic: z
    .object({
      name: z.string().min(2).optional(),
      address: z.string().min(5).optional(),
      area: z.string().optional(),
      city: z.string().min(2).optional(),
      postalCode: z.string().optional(),
      mapUrl: z.string().optional(),
      notes: z.string().optional(),
      phone: z.string().optional(),
      timezone: z.string().optional(),
    })
    .optional(),
  fee: z.number().min(0).optional(),
  slotMinutes: z.union([z.literal(10), z.literal(15), z.literal(20), z.literal(30), z.literal(45), z.literal(60)]).optional(),
  leadTimeMin: z.number().min(0).optional(),
  horizonDays: z.number().min(1).max(90).optional(),
  cancelWindowHours: z.number().min(0).optional(),
  autoConfirm: z.boolean().optional(),
  listedInDirectory: z.boolean().optional(),
  slug: z
    .string()
    .min(3)
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens')
    .optional(),
});

export const updateAvailabilitySchema = z.object({
  weekly: z.array(
    z.object({
      day: z.number().min(0).max(6),
      ranges: z.array(
        z.object({
          start: z.string().regex(/^\d{2}:\d{2}$/),
          end: z.string().regex(/^\d{2}:\d{2}$/),
        })
      ),
      breaks: z.array(
        z.object({
          start: z.string().regex(/^\d{2}:\d{2}$/),
          end: z.string().regex(/^\d{2}:\d{2}$/),
        })
      ),
    })
  ),
  exceptions: z.array(
    z.object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      ranges: z.array(
        z.object({
          start: z.string().regex(/^\d{2}:\d{2}$/),
          end: z.string().regex(/^\d{2}:\d{2}$/),
        })
      ),
      closed: z.boolean(),
      reason: z.string().optional(),
    })
  ),
});

export const createBlockSchema = z.object({
  startAt: z.string().datetime({ message: 'startAt must be an ISO UTC string' }),
  endAt: z.string().datetime({ message: 'endAt must be an ISO UTC string' }),
  reason: z.string().optional(),
  forceCancelConflicts: z.boolean().optional().default(false),
});

export const createWalkInSchema = z.object({
  patientName: z.string().min(2, 'Patient name is required'),
  phone: z.string().optional(),
  startAt: z.string().datetime({ message: 'startAt must be an ISO UTC string' }),
  slotMinutes: z.number().optional(),
  reason: z.string().optional(),
});
