import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth.js';
import { roleGuard } from '../../middleware/roleGuard.js';
import { getDoctorPatients, getDoctorPatientDetail } from './patients.controller.js';

const router = Router();

router.use(requireAuth, roleGuard(['doctor']));

router.get('/', getDoctorPatients);
router.get('/:id', getDoctorPatientDetail);

export default router;
