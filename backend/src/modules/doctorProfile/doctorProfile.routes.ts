import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth.js';
import { roleGuard } from '../../middleware/roleGuard.js';
import { validate } from '../../middleware/validate.js';
import {
  getDoctorProfile,
  updateDoctorProfile,
  submitForApproval,
  getAvailability,
  updateAvailability,
  getBlocks,
  createBlock,
  deleteBlock,
  getDoctorAppointments,
  createWalkIn,
} from './doctorProfile.controller.js';
import {
  updateDoctorProfileSchema,
  updateAvailabilitySchema,
  createBlockSchema,
  createWalkInSchema,
} from './doctorProfile.validation.js';

const router = Router();

// Doctor only routes
router.use(requireAuth, roleGuard(['doctor']));

router.get('/profile', getDoctorProfile);
router.patch('/profile', validate({ body: updateDoctorProfileSchema }), updateDoctorProfile);
router.post('/profile/submit', submitForApproval);

router.get('/availability', getAvailability);
router.put('/availability', validate({ body: updateAvailabilitySchema }), updateAvailability);

router.get('/blocks', getBlocks);
router.post('/blocks', validate({ body: createBlockSchema }), createBlock);
router.delete('/blocks/:id', deleteBlock);

router.get('/appointments', getDoctorAppointments);
router.post('/appointments/walkin', validate({ body: createWalkInSchema }), createWalkIn);

export default router;
