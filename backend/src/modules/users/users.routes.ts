import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth.js';
import { validate } from '../../middleware/validate.js';
import {
  getMe,
  updateMe,
  getDependents,
  createDependent,
  updateDependent,
  deleteDependent,
  exportUserData,
} from './users.controller.js';
import {
  updateMeSchema,
  createDependentSchema,
  updateDependentSchema,
} from './users.validation.js';

const router = Router();

// All user routes require authentication
router.use(requireAuth);

router.get('/me', getMe);
router.patch('/me', validate({ body: updateMeSchema }), updateMe);
router.get('/me/export', exportUserData);

// Dependents (Family members)
router.get('/me/dependents', getDependents);
router.post('/me/dependents', validate({ body: createDependentSchema }), createDependent);
router.patch('/me/dependents/:id', validate({ body: updateDependentSchema }), updateDependent);
router.delete('/me/dependents/:id', deleteDependent);

export default router;
