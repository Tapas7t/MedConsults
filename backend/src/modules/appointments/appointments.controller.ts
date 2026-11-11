import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { Appointment } from '../../models/Appointment.js';
import { DoctorProfile } from '../../models/DoctorProfile.js';
import { User } from '../../models/User.js';
import { Dependent } from '../../models/Dependent.js';
import { Block } from '../../models/Block.js';
import { encryptData, decryptData } from '../../utils/encryption.js';
import { scheduleAppointmentNotifications, cancelPendingAppointmentNotifications } from '../../services/notification.service.js';
import { env } from '../../config/env.js';

export async function bookAppointment(req: Request, res: Response, next: NextFunction): Promise<void> {
  const mongoSession = await mongoose.startSession();
  try {
    const { doctorId, startAt, patientType, dependentId, patientName, phone, reason } = req.body;
    const userId = req.user!.id;

    if (!mongoose.Types.ObjectId.isValid(doctorId)) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Doctor not found' } });
      return;
    }

    const doctor = await DoctorProfile.findOne({
      _id: doctorId,
      status: 'approved',
      isDeleted: false,
    });

    if (!doctor) {
      res.status(404).json({
        success: false,
        error: { code: 'DOCTOR_NOT_FOUND', message: 'Doctor not found or not currently accepting bookings' },
      });
      return;
    }

    const start = new Date(startAt);
    const slotMinutes = doctor.slotMinutes || 30;
    const end = new Date(start.getTime() + slotMinutes * 60 * 1000);
    const now = new Date();

    // Check lead time (min notice)
    const minLeadTime = new Date(now.getTime() + (doctor.leadTimeMin || 60) * 60 * 1000);
    if (start < minLeadTime) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_REQUEST', message: 'Slot is within the minimum booking notice period' },
      });
      return;
    }

    // Check horizon (max advance days)
    const maxHorizonTime = new Date(now.getTime() + (doctor.horizonDays || 30) * 24 * 60 * 60 * 1000);
    if (start > maxHorizonTime) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_REQUEST', message: 'Slot is beyond the allowed booking window' },
      });
      return;
    }

    // Abuse prevention: max active upcoming bookings per patient per doctor
    const activeUpcomingCount = await Appointment.countDocuments({
      doctorId: doctor._id,
      bookedByUserId: userId,
      status: { $in: ['pending', 'confirmed'] },
      startAt: { $gte: now },
      isDeleted: false,
    });

    const maxBookings = env.DEFAULT_BOOKING_LIMIT_PER_DOCTOR;
    if (activeUpcomingCount >= maxBookings) {
      res.status(400).json({
        success: false,
        error: {
          code: 'BOOKING_LIMIT_REACHED',
          message: `You may only hold up to ${maxBookings} upcoming appointments with this doctor at one time`,
        },
      });
      return;
    }

    // Check if patient already holds an overlapping active appointment
    const patientOverlap = await Appointment.findOne({
      bookedByUserId: userId,
      status: { $in: ['pending', 'confirmed', 'arrived'] },
      isDeleted: false,
      startAt: { $lt: end },
      endAt: { $gt: start },
    });

    if (patientOverlap) {
      res.status(409).json({
        success: false,
        error: {
          code: 'PATIENT_OVERLAP',
          message: 'You already have another active appointment scheduled at this time',
        },
      });
      return;
    }

    // Check overlap with doctor manual blocks
    const blockOverlap = await Block.findOne({
      doctorId: doctor._id,
      startAt: { $lt: end },
      endAt: { $gt: start },
    });

    if (blockOverlap) {
      res.status(409).json({
        success: false,
        error: { code: 'SLOT_TAKEN', message: 'This slot is unavailable due to doctor schedule block' },
      });
      return;
    }

    // Resolve patient name
    let resolvedName = patientName;
    let resolvedDependentId: mongoose.Types.ObjectId | undefined = undefined;

    if (patientType === 'self') {
      const user = await User.findById(userId);
      resolvedName = patientName || user?.email.split('@')[0] || 'Patient';
    } else if (patientType === 'dependent' && dependentId) {
      const dep = await Dependent.findOne({ _id: dependentId, patientUserId: userId, isDeleted: false });
      if (!dep) {
        res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Dependent not found' } });
        return;
      }
      resolvedName = dep.name;
      resolvedDependentId = dep._id;
    }

    const reasonEnc = reason ? encryptData(reason) : undefined;
    const initialStatus = doctor.autoConfirm ? 'confirmed' : 'pending';

    let createdAppointment: any;

    // Run inside MongoDB transaction
    const executeInsert = async () => {
      // Direct overlap check inside transaction session
      const existingOverlap = await Appointment.findOne({
        doctorId: doctor._id,
        status: { $in: ['pending', 'confirmed', 'arrived'] },
        isDeleted: false,
        startAt: { $lt: end },
        endAt: { $gt: start },
      }).session(mongoSession);

      if (existingOverlap) {
        const err = new Error('Slot taken') as any;
        err.statusCode = 409;
        err.code = 'SLOT_TAKEN';
        throw err;
      }

      const [newApp] = await Appointment.create(
        [
          {
            doctorId: doctor._id,
            bookedByUserId: new mongoose.Types.ObjectId(userId),
            patientRef: {
              type: patientType,
              name: resolvedName,
              dependentId: resolvedDependentId,
              phone,
            },
            startAt: start,
            endAt: end,
            source: 'online',
            status: initialStatus,
            reasonEnc,
            statusHistory: [
              {
                status: initialStatus,
                changedBy: new mongoose.Types.ObjectId(userId),
                at: new Date(),
                reason: 'Online booking created',
              },
            ],
          },
        ],
        { session: mongoSession }
      );
      createdAppointment = newApp;
    };

    try {
      mongoSession.startTransaction();
      await executeInsert();
      await mongoSession.commitTransaction();
    } catch (txnError: any) {
      await mongoSession.abortTransaction();
      // If replica set is not available in local test env, execute without transaction
      if (txnError.message?.includes('Transaction numbers are only allowed on a replica set member or mongos')) {
        const fallbackApp = await Appointment.create({
          doctorId: doctor._id,
          bookedByUserId: new mongoose.Types.ObjectId(userId),
          patientRef: {
            type: patientType,
            name: resolvedName,
            dependentId: resolvedDependentId,
            phone,
          },
          startAt: start,
          endAt: end,
          source: 'online',
          status: initialStatus,
          reasonEnc,
          statusHistory: [
            {
              status: initialStatus,
              changedBy: new mongoose.Types.ObjectId(userId),
              at: new Date(),
              reason: 'Online booking created',
            },
          ],
        });
        createdAppointment = fallbackApp;
      } else {
        throw txnError;
      }
    } finally {
      mongoSession.endSession();
    }

    // Schedule background reminders and confirmation notifications
    const patientUser = (await User.findById(userId))!;
    await scheduleAppointmentNotifications({
      appointment: createdAppointment,
      doctor,
      patientUser,
    });

    res.status(201).json({
      success: true,
      data: createdAppointment,
    });
  } catch (error: any) {
    if (error.code === 11000) {
      res.status(409).json({
        success: false,
        error: {
          code: 'SLOT_TAKEN',
          message: 'This slot was just booked by another patient. Please choose another slot.',
        },
      });
      return;
    }
    next(error);
  }
}

export async function getMyAppointments(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;
    const userRole = req.user!.role;
    const { status, page = 1, limit = 20 } = req.query as any;

    let query: Record<string, any> = { isDeleted: false };

    if (userRole === 'doctor') {
      const doctorProfile = await DoctorProfile.findOne({ userId, isDeleted: false });
      if (!doctorProfile) {
        res.status(200).json({ success: true, data: [], pagination: { total: 0, page: 1, limit: 20, totalPages: 1 } });
        return;
      }
      query.doctorId = doctorProfile._id;
    } else {
      query.bookedByUserId = userId;
    }

    if (status) {
      query.status = status;
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [appointments, total] = await Promise.all([
      Appointment.find(query)
        .populate('doctorId', 'name specialty clinic photoUrl fee slug')
        .sort({ startAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Appointment.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      data: appointments,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)) || 1,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function getAppointmentById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = req.params.id as string;
    const userId = req.user!.id;
    const userRole = req.user!.role;

    if (!mongoose.Types.ObjectId.isValid(id!)) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Appointment not found' } });
      return;
    }

    const appointment = await Appointment.findOne({ _id: id, isDeleted: false }).populate(
      'doctorId',
      'name specialty clinic photoUrl fee slug userId'
    );

    if (!appointment) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Appointment not found' } });
      return;
    }

    const doctorProfile = appointment.doctorId as any;
    const isBooker = appointment.bookedByUserId.toString() === userId;
    const isTreatingDoctor = doctorProfile?.userId?.toString() === userId;
    const isAdmin = userRole === 'admin';

    // Strict ownership assertion: 404 NOT_FOUND on any other user (prevent IDOR)
    if (!isBooker && !isTreatingDoctor && !isAdmin) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Appointment not found' } });
      return;
    }

    const appObj = appointment.toObject() as any;

    // PRD: "Admins cannot read notes or visit reasons."
    if (isAdmin) {
      delete appObj.reasonEnc;
      delete appObj.notesEnc;
    } else {
      // Decrypt reason for booker or treating doctor
      if (appObj.reasonEnc) {
        try {
          appObj.reason = decryptData(appObj.reasonEnc);
        } catch {
          appObj.reason = '[Encrypted data unavailable]';
        }
      }

      // Decrypt notes for treating doctor or patient
      if (appObj.notesEnc) {
        try {
          appObj.notes = decryptData(appObj.notesEnc);
        } catch {
          appObj.notes = '[Encrypted clinical note]';
        }
      }
    }

    res.status(200).json({
      success: true,
      data: appObj,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateAppointmentStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = req.params.id as string;
    const { status: targetStatus, reason } = req.body;
    const userId = req.user!.id;
    const userRole = req.user!.role;

    const appointment = await Appointment.findOne({ _id: id, isDeleted: false });
    if (!appointment) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Appointment not found' } });
      return;
    }

    const doctorProfile = await DoctorProfile.findById(appointment.doctorId);
    const isBooker = appointment.bookedByUserId.toString() === userId;
    const isTreatingDoctor = doctorProfile?.userId.toString() === userId;
    const isAdmin = userRole === 'admin';

    if (!isBooker && !isTreatingDoctor && !isAdmin) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Appointment not found' } });
      return;
    }

    // Role-restricted state machine validation
    if (targetStatus === 'cancelled') {
      if (isBooker && !isTreatingDoctor && !isAdmin) {
        // Patient cancellation window check
        const cancelWindowHours = doctorProfile?.cancelWindowHours ?? 4;
        const cutoffTime = new Date(appointment.startAt.getTime() - cancelWindowHours * 60 * 60 * 1000);
        if (new Date() > cutoffTime) {
          res.status(400).json({
            success: false,
            error: {
              code: 'OUTSIDE_CANCEL_WINDOW',
              message: `Cancellations online are only permitted up to ${cancelWindowHours} hours before the appointment. Please call the clinic directly.`,
            },
          });
          return;
        }
      }
      // Cancel pending notifications
      await cancelPendingAppointmentNotifications(appointment._id);
    } else if (['confirmed', 'arrived', 'completed', 'no_show'].includes(targetStatus)) {
      if (!isTreatingDoctor && !isAdmin) {
        res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Only the clinic or doctor can update appointment progress' },
        });
        return;
      }

      if (targetStatus === 'no_show' && new Date() < appointment.startAt) {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_REQUEST', message: 'Cannot mark no-show before the scheduled start time' },
        });
        return;
      }
    }

    appointment.status = targetStatus;
    appointment.statusHistory.push({
      status: targetStatus,
      changedBy: new mongoose.Types.ObjectId(userId),
      at: new Date(),
      reason: reason || `Status changed to ${targetStatus}`,
    });

    await appointment.save();

    res.status(200).json({
      success: true,
      data: appointment,
    });
  } catch (error) {
    next(error);
  }
}

export async function rescheduleAppointment(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = req.params.id as string;
    const { newStartAt, reason } = req.body;
    const userId = req.user!.id;
    const userRole = req.user!.role;

    const appointment = await Appointment.findOne({ _id: id, isDeleted: false });
    if (!appointment) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Appointment not found' } });
      return;
    }

    const doctor = await DoctorProfile.findById(appointment.doctorId);
    if (!doctor) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Doctor profile not found' } });
      return;
    }

    const isBooker = appointment.bookedByUserId.toString() === userId;
    const isTreatingDoctor = doctor.userId.toString() === userId;
    const isAdmin = userRole === 'admin';

    if (!isBooker && !isTreatingDoctor && !isAdmin) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Appointment not found' } });
      return;
    }

    // Cancellation window check for patient reschedule
    if (isBooker && !isTreatingDoctor && !isAdmin) {
      const cancelWindowHours = doctor.cancelWindowHours ?? 4;
      const cutoffTime = new Date(appointment.startAt.getTime() - cancelWindowHours * 60 * 60 * 1000);
      if (new Date() > cutoffTime) {
        res.status(400).json({
          success: false,
          error: {
            code: 'OUTSIDE_CANCEL_WINDOW',
            message: `Rescheduling online is only permitted up to ${cancelWindowHours} hours before the appointment. Please contact the clinic.`,
          },
        });
        return;
      }
    }

    const newStart = new Date(newStartAt);
    const slotMinutes = doctor.slotMinutes || 30;
    const newEnd = new Date(newStart.getTime() + slotMinutes * 60 * 1000);

    // Overlap check for new slot
    const slotOverlap = await Appointment.findOne({
      doctorId: doctor._id,
      _id: { $ne: appointment._id },
      status: { $in: ['pending', 'confirmed', 'arrived'] },
      isDeleted: false,
      startAt: { $lt: newEnd },
      endAt: { $gt: newStart },
    });

    if (slotOverlap) {
      res.status(409).json({
        success: false,
        error: { code: 'SLOT_TAKEN', message: 'The requested new slot is not available' },
      });
      return;
    }

    // Free the old slot and link to new appointment
    appointment.status = 'rescheduled';
    appointment.statusHistory.push({
      status: 'rescheduled',
      changedBy: new mongoose.Types.ObjectId(userId),
      at: new Date(),
      reason: reason || 'Appointment rescheduled to new time',
    });
    await appointment.save();

    await cancelPendingAppointmentNotifications(appointment._id);

    // Create the new appointment
    const newAppointment = await Appointment.create({
      doctorId: doctor._id,
      bookedByUserId: appointment.bookedByUserId,
      patientRef: appointment.patientRef,
      startAt: newStart,
      endAt: newEnd,
      source: appointment.source,
      status: 'confirmed',
      reasonEnc: appointment.reasonEnc,
      rescheduledFrom: appointment._id,
      statusHistory: [
        {
          status: 'confirmed',
          changedBy: new mongoose.Types.ObjectId(userId),
          at: new Date(),
          reason: `Rescheduled from appointment ${appointment._id}`,
        },
      ],
    });

    // Schedule notifications for new appointment
    const patientUser = (await User.findById(appointment.bookedByUserId))!;
    await scheduleAppointmentNotifications({
      appointment: newAppointment,
      doctor,
      patientUser,
    });

    res.status(200).json({
      success: true,
      data: newAppointment,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateAppointmentNotes(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = req.params.id as string;
    const { notes } = req.body;
    const userId = req.user!.id;

    const appointment = await Appointment.findOne({ _id: id, isDeleted: false });
    if (!appointment) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Appointment not found' } });
      return;
    }

    const doctorProfile = await DoctorProfile.findById(appointment.doctorId);
    if (!doctorProfile || doctorProfile.userId.toString() !== userId) {
      // Only the treating doctor can write consultation notes
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Appointment not found' } });
      return;
    }

    // Encrypt doctor consultation notes at rest using AES-256-GCM with keyVersion prefix
    appointment.notesEnc = encryptData(notes);
    await appointment.save();

    res.status(200).json({
      success: true,
      data: {
        message: 'Consultation notes saved securely',
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function downloadCalendarIcs(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = req.params.id as string;
    const userId = req.user!.id;

    const appointment = await Appointment.findOne({ _id: id, isDeleted: false }).populate(
      'doctorId',
      'name clinic specialty'
    );

    if (!appointment) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Appointment not found' } });
      return;
    }

    const doctor = appointment.doctorId as any;
    const isBooker = appointment.bookedByUserId.toString() === userId;
    const isTreatingDoctor = doctor?.userId?.toString() === userId;

    if (!isBooker && !isTreatingDoctor && req.user!.role !== 'admin') {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Appointment not found' } });
      return;
    }

    const formatIcsDate = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Medconsults//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${appointment._id}@medconsults.com`,
      `DTSTAMP:${formatIcsDate(new Date())}`,
      `DTSTART:${formatIcsDate(appointment.startAt)}`,
      `DTEND:${formatIcsDate(appointment.endAt)}`,
      `SUMMARY:Consultation with ${doctor.name} (${doctor.specialty})`,
      `DESCRIPTION:In-clinic consultation for ${appointment.patientRef.name}. Pay at clinic.`,
      `LOCATION:${doctor.clinic.name}, ${doctor.clinic.address}, ${doctor.clinic.city}`,
      'STATUS:CONFIRMED',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="appointment-${appointment._id}.ics"`);
    res.send(icsContent);
  } catch (error) {
    next(error);
  }
}
