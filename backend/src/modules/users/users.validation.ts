import { z } from 'zod';

export const updateMeSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().min(8, 'Phone number must be at least 8 digits').optional(),
});

export const createDependentSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').trim(),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date of birth must be in YYYY-MM-DD format'),
  relation: z.enum(['Spouse', 'Child', 'Parent', 'Other', 'Sibling']),
});

export const updateDependentSchema = z.object({
  name: z.string().min(2).trim().optional(),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  relation: z.enum(['Spouse', 'Child', 'Parent', 'Other', 'Sibling']).optional(),
});
