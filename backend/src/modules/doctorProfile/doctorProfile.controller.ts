import { Request, Response, NextFunction } from 'express';
import { DoctorProfile } from '../../models/DoctorProfile.js';
import { Availability } from '../../models/Availability.js';
import { Block } from '../../models/Block.js';
import { Appointment } from '../../models/Appointment.js';
import { encryptData } from '../../utils/encryption.js';
import { parseLocalToUtc } from '../../utils/time.js';

export async function getDoctorProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    let profile = await DoctorProfile.findOne({ userId: req.user!.id, isDeleted: false });

    if (!profile) {
      res.status(404).json({
        success: false,
        error: { code: 'PROFILE_NOT_FOUND', message: 'Doctor profile not found' },
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: profile,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateDoctorProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const profile = await DoctorProfile.findOne({ userId: req.user!.id, isDeleted: false });
    if (!profile) {
      res.status(404).json({
        success: false,
        error: { code: 'PROFILE_NOT_FOUND', message: 'Doctor profile not found' },
      });
      return;
    }

    const {
      name,
      type,
      specialty,
      qualifications,
      licenceNo,
      experienceYears,
      languages,
      bio,
      photoUrl,
      clinic,
      fee,
      slotMinutes,
      leadTimeMin,
      horizonDays,
      cancelWindowHours,
      autoConfirm,
      listedInDirectory,
      slug,
    } = req.body;

    // Check slug uniqueness if updating slug
    if (slug && slug !== profile.slug) {
      const existingSlug = await DoctorProfile.findOne({ slug: slug.toLowerCase(), _id: { $ne: profile._id } });
      if (existingSlug) {
        res.status(409).json({
          success: false,
          error: { code: 'SLUG_TAKEN', message: 'This personal booking link slug is already taken' },
        });
        return;
      }
      profile.slug = slug.toLowerCase();
    }

    // PRD Section 4.2: Edits to licence number or specialty trigger re-review
    const isSensitiveChange =
      (licenceNo && licenceNo !== profile.licenceNo) ||
      (specialty && specialty !== profile.specialty);

    if (profile.status === 'approved' && isSensitiveChange) {
      profile.status = 'pending_approval';
    }

    if (name) profile.name = name;
    if (type) profile.type = type;
    if (specialty) profile.specialty = specialty;
    if (qualifications) profile.qualifications = qualifications;
    if (licenceNo) profile.licenceNo = licenceNo;
    if (experienceYears !== undefined) profile.experienceYears = experienceYears;
    if (languages) profile.languages = languages;
    if (bio !== undefined) profile.bio = bio;
    if (photoUrl !== undefined) profile.photoUrl = photoUrl;
    if (fee !== undefined) profile.fee = fee;
    if (slotMinutes !== undefined) profile.slotMinutes = slotMinutes;
    if (leadTimeMin !== undefined) profile.leadTimeMin = leadTimeMin;
    if (horizonDays !== undefined) profile.horizonDays = horizonDays;
    if (cancelWindowHours !== undefined) profile.cancelWindowHours = cancelWindowHours;
    if (autoConfirm !== undefined) profile.autoConfirm = autoConfirm;
    if (listedInDirectory !== undefined) profile.listedInDirectory = listedInDirectory;

    if (clinic) {
      Object.assign(profile.clinic, clinic);
    }

    await profile.save();

    res.status(200).json({
      success: true,
      data: profile,
    });
  } catch (error) {
    next(error);
  }
}

export async function submitForApproval(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const profile = await DoctorProfile.findOne({ userId: req.user!.id, isDeleted: false });
    if (!profile) {
      res.status(404).json({
        success: false,
        error: { code: 'PROFILE_NOT_FOUND', message: 'Doctor profile not found' },
      });
      return;
    }

    // Validate required onboarding fields before submission
    if (!profile.name || !profile.licenceNo || !profile.clinic?.name || !profile.clinic?.address) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INCOMPLETE_PROFILE',
          message: 'Please complete your clinic profile and licence details before submitting for approval',
        },
      });
      return;
    }

    profile.status = 'pending_approval';
    await profile.save();

    res.status(200).json({
      success: true,
      data: {
        status: profile.status,
        message: 'Your profile has been submitted for admin verification. You will be notified once reviewed.',
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function getAvailability(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const profile = await DoctorProfile.findOne({ userId: req.user!.id, isDeleted: false });
    if (!profile) {
      res.status(404).json({
        success: false,
        error: { code: 'PROFILE_NOT_FOUND', message: 'Doctor profile not found' },
      });
      return;
    }

    let availability = await Availability.findOne({ doctorId: profile._id });
    if (!availability) {
      availability = await Availability.create({ doctorId: profile._id });
    }

    res.status(200).json({
      success: true,
      data: availability,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateAvailability(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const profile = await DoctorProfile.findOne({ userId: req.user!.id, isDeleted: false });
    if (!profile) {
      res.status(404).json({
        success: false,
        error: { code: 'PROFILE_NOT_FOUND', message: 'Doctor profile not found' },
      });
      return;
    }

    const { weekly, exceptions } = req.body;

    const availability = await Availability.findOneAndUpdate(
      { doctorId: profile._id },
      { $set: { weekly, exceptions } },
      { new: true, upsert: true }
    );

    res.status(200).json({
      success: true,
      data: availability,
    });
  } catch (error) {
    next(error);
  }
}

export async function getBlocks(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const profile = await DoctorProfile.findOne({ userId: req.user!.id, isDeleted: false });
    if (!profile) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Profile not found' } });
      return;
    }

    const blocks = await Block.find({
      doctorId: profile._id,
      endAt: { $gte: new Date() },
    }).sort({ startAt: 1 });

    res.status(200).json({
      success: true,
      data: blocks,
    });
  } catch (error) {
    next(error);
  }
}

export async function createBlock(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const profile = await DoctorProfile.findOne({ userId: req.user!.id, isDeleted: false });
    if (!profile) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Profile not found' } });
      return;
    }

    const { startAt, endAt, reason, forceCancelConflicts } = req.body;
    const start = new Date(startAt);
    const end = new Date(endAt);

    if (start >= end) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_RANGE', message: 'startAt must be earlier than endAt' },
      });
      return;
    }

    // Check for conflicting active appointments per PRD acceptance criteria
    const conflictingAppointments = await Appointment.find({
      doctorId: profile._id,
      status: { $in: ['pending', 'confirmed', 'arrived'] },
      isDeleted: false,
      startAt: { $lt: end },
      endAt: { $gt: start },
    });

    if (conflictingAppointments.length > 0 && !forceCancelConflicts) {
      res.status(409).json({
        success: false,
        error: {
          code: 'BLOCK_CONFLICTS_EXIST',
          message: `There are ${conflictingAppointments.length} existing appointments in this time block. Confirm to cancel them or choose another time.`,
          conflicts: conflictingAppointments.map((c) => ({
            id: c._id,
            patientName: c.patientRef.name,
            startAt: c.startAt,
            endAt: c.endAt,
          })),
        },
      });
      return;
    }

    // If doctor confirmed cancellation of conflicts:
    if (conflictingAppointments.length > 0 && forceCancelConflicts) {
      for (const app of conflictingAppointments) {
        app.status = 'cancelled';
        app.statusHistory.push({
          status: 'cancelled',
          changedBy: profile.userId,
          at: new Date(),
          reason: `Cancelled due to doctor schedule block: ${reason || 'Doctor unavailable'}`,
        });
        await app.save();
      }
    }

    const block = await Block.create({
      doctorId: profile._id,
      startAt: start,
      endAt: end,
      reason: reason || 'Blocked time',
    });

    res.status(201).json({
      success: true,
      data: block,
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteBlock(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const profile = await DoctorProfile.findOne({ userId: req.user!.id, isDeleted: false });
    if (!profile) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Profile not found' } });
      return;
    }

    const id = req.params.id as string;
    const deleted = await Block.findOneAndDelete({ _id: id, doctorId: profile._id });

    if (!deleted) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Block not found' } });
      return;
    }

    res.status(200).json({
      success: true,
      data: { message: 'Schedule block removed' },
    });
  } catch (error) {
    next(error);
  }
}

export async function getDoctorAppointments(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const profile = await DoctorProfile.findOne({ userId: req.user!.id, isDeleted: false });
    if (!profile) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Profile not found' } });
      return;
    }

    const { date } = req.query as { date?: string };
    const query: Record<string, any> = {
      doctorId: profile._id,
      isDeleted: false,
    };

    if (date) {
      // Query specific clinic-local day
      const timeZone = profile.clinic.timezone || 'Asia/Kolkata';
      const dayStartUtc = parseLocalToUtc(date, '00:00', timeZone);
      const dayEndUtc = parseLocalToUtc(date, '23:59', timeZone);
      query.startAt = { $gte: dayStartUtc, $lte: dayEndUtc };
    }

    const appointments = await Appointment.find(query).sort({ startAt: 1 });

    res.status(200).json({
      success: true,
      data: appointments,
    });
  } catch (error) {
    next(error);
  }
}

export async function createWalkIn(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const profile = await DoctorProfile.findOne({ userId: req.user!.id, isDeleted: false });
    if (!profile) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Profile not found' } });
      return;
    }

    const { patientName, phone, startAt, slotMinutes = profile.slotMinutes || 30, reason } = req.body;
    const start = new Date(startAt);
    const end = new Date(start.getTime() + slotMinutes * 60 * 1000);

    // Overlap check against active appointments
    const overlap = await Appointment.findOne({
      doctorId: profile._id,
      status: { $in: ['pending', 'confirmed', 'arrived'] },
      isDeleted: false,
      startAt: { $lt: end },
      endAt: { $gt: start },
    });

    if (overlap) {
      res.status(409).json({
        success: false,
        error: { code: 'SLOT_TAKEN', message: 'Another appointment already occupies this slot' },
      });
      return;
    }

    const reasonEnc = reason ? encryptData(reason) : undefined;

    const appointment = await Appointment.create({
      doctorId: profile._id,
      bookedByUserId: profile.userId, // Walk-ins are recorded under the doctor's user
      patientRef: {
        type: 'walkin',
        name: patientName,
        phone,
      },
      startAt: start,
      endAt: end,
      source: 'walkin',
      status: 'confirmed',
      reasonEnc,
      statusHistory: [
        {
          status: 'confirmed',
          changedBy: profile.userId,
          at: new Date(),
          reason: 'Walk-in added by clinic',
        },
      ],
    });

    res.status(201).json({
      success: true,
      data: appointment,
    });
  } catch (error) {
    next(error);
  }
}
