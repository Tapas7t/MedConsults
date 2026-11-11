import { z } from 'zod';

export const getDoctorsQuerySchema = z.object({
  q: z.string().optional(),
  specialty: z.string().optional(),
  city: z.string().optional(),
  type: z.enum(['doctor', 'dentist']).optional(),
  minFee: z.string().transform(Number).optional(),
  maxFee: z.string().transform(Number).optional(),
  page: z.string().transform(Number).default('1'),
  limit: z.string().transform(Number).default('10'),
});

export const getSlotsQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'from date must be YYYY-MM-DD'),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'to date must be YYYY-MM-DD').optional(),
});
