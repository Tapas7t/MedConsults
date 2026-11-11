import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import { slotsLimiter } from '../../middleware/rateLimiter.js';
import {
  getDoctorsDirectory,
  getDoctorBySlug,
  getDoctorSlots,
} from './doctors.controller.js';
import {
  getDoctorsQuerySchema,
  getSlotsQuerySchema,
} from './doctors.validation.js';

const router = Router();

router.get('/', validate({ query: getDoctorsQuerySchema }), getDoctorsDirectory);
router.get('/by-slug/:slug', getDoctorBySlug);
router.get('/:id/slots', slotsLimiter, validate({ query: getSlotsQuerySchema }), getDoctorSlots);

export default router;
