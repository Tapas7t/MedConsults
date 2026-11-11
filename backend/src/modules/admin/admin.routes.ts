import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth.js';
import { roleGuard } from '../../middleware/roleGuard.js';
import { validate } from '../../middleware/validate.js';
import {
  getAdminDoctors,
  updateDoctorStatus,
  getAdminUsers,
  blockUser,
  getAdminStats,
} from './admin.controller.js';
import {
  updateDoctorStatusSchema,
  blockUserSchema,
} from './admin.validation.js';

const router = Router();

// Admin only routes
router.use(requireAuth, roleGuard(['admin']));

router.get('/doctors', getAdminDoctors);
router.patch('/doctors/:id/status', validate({ body: updateDoctorStatusSchema }), updateDoctorStatus);

router.get('/users', getAdminUsers);
router.patch('/users/:id/block', validate({ body: blockUserSchema }), blockUser);

router.get('/stats', getAdminStats);

export default router;
