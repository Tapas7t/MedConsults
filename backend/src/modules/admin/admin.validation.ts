import { z } from 'zod';

export const updateDoctorStatusSchema = z.object({
  status: z.enum(['approved', 'rejected', 'suspended']),
  rejectionReason: z.string().optional(),
});

export const blockUserSchema = z.object({
  isBlocked: z.boolean(),
  reason: z.string().optional(),
});
