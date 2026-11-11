import { Router } from 'express';
import authRouter from './modules/auth/auth.routes.js';
import usersRouter from './modules/users/users.routes.js';
import doctorsRouter from './modules/doctors/doctors.routes.js';
import doctorProfileRouter from './modules/doctorProfile/doctorProfile.routes.js';
import appointmentsRouter from './modules/appointments/appointments.routes.js';
import patientsRouter from './modules/patients/patients.routes.js';
import adminRouter from './modules/admin/admin.routes.js';

const apiRouter = Router();

apiRouter.use('/auth', authRouter);
apiRouter.use('/users', usersRouter);
apiRouter.use('/doctors', doctorsRouter);
apiRouter.use('/doctor', doctorProfileRouter);
apiRouter.use('/doctor/patients', patientsRouter);
apiRouter.use('/appointments', appointmentsRouter);
apiRouter.use('/admin', adminRouter);

export default apiRouter;
