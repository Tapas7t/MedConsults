import { Router } from 'express';
import { requireAuth, requireVerifiedEmail } from '../../middleware/requireAuth.js';
import { validate } from '../../middleware/validate.js';
import { bookingLimiter } from '../../middleware/rateLimiter.js';
import {
  bookAppointment,
  getMyAppointments,
  getAppointmentById,
  updateAppointmentStatus,
  rescheduleAppointment,
  updateAppointmentNotes,
  downloadCalendarIcs,
} from './appointments.controller.js';
import {
  bookAppointmentSchema,
  updateStatusSchema,
  rescheduleSchema,
  updateNotesSchema,
} from './appointments.validation.js';

const router = Router();

router.use(requireAuth);

router.post('/', bookingLimiter, requireVerifiedEmail, validate({ body: bookAppointmentSchema }), bookAppointment);
router.get('/', getMyAppointments);
router.get('/:id', getAppointmentById);
router.patch('/:id/status', validate({ body: updateStatusSchema }), updateAppointmentStatus);
router.post('/:id/reschedule', validate({ body: rescheduleSchema }), rescheduleAppointment);
router.put('/:id/notes', validate({ body: updateNotesSchema }), updateAppointmentNotes);
router.get('/:id/calendar.ics', downloadCalendarIcs);

export default router;
