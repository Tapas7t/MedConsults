import { z } from 'zod';

export const bookAppointmentSchema = z.object({
  doctorId: z.string().min(1, 'Doctor ID is required'),
  startAt: z.string().datetime({ message: 'startAt must be a valid ISO UTC date string' }),
  patientType: z.enum(['self', 'dependent']),
  dependentId: z.string().optional(),
  patientName: z.string().min(2).optional(),
  phone: z.string().optional(),
  reason: z.string().max(500, 'Reason is too long').optional(),
});

export const updateStatusSchema = z.object({
  status: z.enum(['pending', 'confirmed', 'arrived', 'completed', 'cancelled', 'no_show']),
  reason: z.string().max(500).optional(),
});

export const rescheduleSchema = z.object({
  newStartAt: z.string().datetime({ message: 'newStartAt must be a valid ISO UTC date string' }),
  reason: z.string().max(500).optional(),
});

export const updateNotesSchema = z.object({
  notes: z.string().max(5000, 'Notes are too long'),
});
