import { Request, Response, NextFunction } from 'express';
import { User } from '../../models/User.js';
import { Dependent } from '../../models/Dependent.js';
import { Appointment } from '../../models/Appointment.js';
import { DoctorProfile } from '../../models/DoctorProfile.js';
import { assertOwnership } from '../../utils/ownershipCheck.js';

export async function getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await User.findById(req.user!.id).select('-passwordHash');
    let doctorProfile = null;
    if (user?.role === 'doctor') {
      doctorProfile = await DoctorProfile.findOne({ userId: user._id, isDeleted: false });
    }

    res.status(200).json({
      success: true,
      data: {
        user,
        doctorProfile,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function updateMe(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, phone } = req.body;
    const updates: Record<string, any> = {};

    if (email) {
      const existing = await User.findOne({ email, _id: { $ne: req.user!.id } });
      if (existing) {
        res.status(409).json({
          success: false,
          error: {
            code: 'EMAIL_ALREADY_EXISTS',
            message: 'Email address is already in use',
          },
        });
        return;
      }
      updates.email = email;
      updates.isEmailVerified = false;
    }

    if (phone !== undefined) {
      updates.phone = phone;
    }

    const updatedUser = await User.findByIdAndUpdate(req.user!.id, { $set: updates }, { new: true }).select(
      '-passwordHash'
    );

    res.status(200).json({
      success: true,
      data: {
        user: updatedUser,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function getDependents(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const dependents = await Dependent.find({
      patientUserId: req.user!.id,
      isDeleted: false,
    }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: dependents,
    });
  } catch (error) {
    next(error);
  }
}

export async function createDependent(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { name, dob, relation } = req.body;

    const dependent = await Dependent.create({
      patientUserId: req.user!.id,
      name,
      dob: new Date(dob),
      relation,
    });

    res.status(201).json({
      success: true,
      data: dependent,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateDependent(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = req.params.id as string;
    // Ownership check throws 404 if not found or not owned by req.user
    const dependent = await assertOwnership(Dependent, id, req.user!.id, 'patientUserId');

    const { name, dob, relation } = req.body;
    if (name) dependent.name = name;
    if (dob) dependent.dob = new Date(dob);
    if (relation) dependent.relation = relation;

    await dependent.save();

    res.status(200).json({
      success: true,
      data: dependent,
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteDependent(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = req.params.id as string;
    const dependent = await assertOwnership(Dependent, id, req.user!.id, 'patientUserId');

    dependent.isDeleted = true;
    await dependent.save();

    res.status(200).json({
      success: true,
      data: {
        message: 'Family member removed successfully',
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function exportUserData(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await User.findById(req.user!.id).select('-passwordHash');
    const dependents = await Dependent.find({ patientUserId: req.user!.id });
    const appointments = await Appointment.find({ bookedByUserId: req.user!.id }).select('-notesEnc -reasonEnc');

    res.status(200).json({
      success: true,
      data: {
        user,
        dependents,
        appointments,
        exportedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
}
