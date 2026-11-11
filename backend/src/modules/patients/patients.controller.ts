import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { DoctorProfile } from '../../models/DoctorProfile.js';
import { Appointment } from '../../models/Appointment.js';
import { Dependent } from '../../models/Dependent.js';
import { decryptData } from '../../utils/encryption.js';

export async function getDoctorPatients(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const profile = await DoctorProfile.findOne({ userId: req.user!.id, isDeleted: false });
    if (!profile) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Doctor profile not found' } });
      return;
    }

    const { q } = req.query as { q?: string };

    // Aggregate appointments to build patient list for this doctor
    const matchStage: any = {
      doctorId: profile._id,
      isDeleted: false,
    };

    if (q) {
      matchStage['patientRef.name'] = { $regex: new RegExp(q, 'i') };
    }

    const patientAgg = await Appointment.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: {
            bookedByUserId: '$bookedByUserId',
            name: '$patientRef.name',
            type: '$patientRef.type',
          },
          totalVisits: { $sum: 1 },
          completedVisits: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] },
          },
          noShows: {
            $sum: { $cond: [{ $eq: ['$status', 'no_show'] }, 1, 0] },
          },
          lastVisit: { $max: '$startAt' },
          phone: { $first: '$patientRef.phone' },
        },
      },
      { $sort: { lastVisit: -1 } },
      { $limit: 100 },
    ]);

    const formatted = patientAgg.map((item, idx) => ({
      id: `${item._id.bookedByUserId}_${idx}`,
      userId: item._id.bookedByUserId,
      name: item._id.name,
      type: item._id.type,
      phone: item.phone || '',
      totalVisits: item.totalVisits,
      completedVisits: item.completedVisits,
      noShowCount: item.noShows,
      lastVisit: item.lastVisit,
    }));

    res.status(200).json({
      success: true,
      data: formatted,
    });
  } catch (error) {
    next(error);
  }
}

export async function getDoctorPatientDetail(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const profile = await DoctorProfile.findOne({ userId: req.user!.id, isDeleted: false });
    if (!profile) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Doctor profile not found' } });
      return;
    }

    const patientUserId = req.params.id as string;

    if (!mongoose.Types.ObjectId.isValid(patientUserId)) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Patient not found' } });
      return;
    }

    const [appointments, dependents] = await Promise.all([
      Appointment.find({
        doctorId: profile._id,
        bookedByUserId: new mongoose.Types.ObjectId(patientUserId),
        isDeleted: false,
      }).sort({ startAt: -1 }),
      Dependent.find({
        patientUserId: new mongoose.Types.ObjectId(patientUserId),
        isDeleted: false,
      }),
    ]);

    if (appointments.length === 0) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Patient has no records with this clinic' } });
      return;
    }

    const decryptedAppointments = appointments.map((app) => {
      const obj = app.toObject() as any;
      if (obj.notesEnc) {
        try {
          obj.notes = decryptData(obj.notesEnc);
        } catch {
          obj.notes = '';
        }
      }
      if (obj.reasonEnc) {
        try {
          obj.reason = decryptData(obj.reasonEnc);
        } catch {
          obj.reason = '';
        }
      }
      return obj;
    });

    res.status(200).json({
      success: true,
      data: {
        appointments: decryptedAppointments,
        dependents,
      },
    });
  } catch (error) {
    next(error);
  }
}
