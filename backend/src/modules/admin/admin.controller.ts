import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { DoctorProfile } from '../../models/DoctorProfile.js';
import { User } from '../../models/User.js';
import { Appointment } from '../../models/Appointment.js';
import { AuditLog } from '../../models/AuditLog.js';
import { sendEmail } from '../../services/email.service.js';

export async function getAdminDoctors(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { status, page = 1, limit = 20 } = req.query as any;
    const query: Record<string, any> = { isDeleted: false };

    if (status) {
      query.status = status;
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [doctors, total] = await Promise.all([
      DoctorProfile.find(query).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
      DoctorProfile.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      data: doctors,
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

export async function updateDoctorStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = req.params.id as string;
    const { status, rejectionReason } = req.body;
    const adminId = req.user!.id;

    const doctor = await DoctorProfile.findById(id);
    if (!doctor) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Doctor profile not found' } });
      return;
    }

    const previousStatus = doctor.status;
    doctor.status = status;
    if (rejectionReason) doctor.rejectionReason = rejectionReason;
    await doctor.save();

    // Record audit log per PRD Section 4.9
    await AuditLog.create({
      actorId: new mongoose.Types.ObjectId(adminId),
      action: 'UPDATE_DOCTOR_STATUS',
      entity: 'DoctorProfile',
      entityId: doctor._id.toString(),
      meta: {
        from: previousStatus,
        to: status,
        rejectionReason,
      },
    });

    // Notify doctor via email
    const doctorUser = await User.findById(doctor.userId);
    if (doctorUser) {
      await sendEmail({
        to: doctorUser.email,
        subject: `Medconsults Profile Status: ${status.replace('_', ' ').toUpperCase()}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #0E7C86;">Doctor Profile Review Status</h2>
            <p>Hello <strong>${doctor.name}</strong>,</p>
            <p>Your Medconsults profile has been updated to <strong>${status.toUpperCase()}</strong>.</p>
            ${rejectionReason ? `<p style="color: #D64545;"><strong>Feedback / Reason:</strong> ${rejectionReason}</p>` : ''}
            <p>You can manage your schedule and clinic settings from your dashboard.</p>
          </div>
        `,
      });
    }

    res.status(200).json({
      success: true,
      data: doctor,
    });
  } catch (error) {
    next(error);
  }
}

export async function getAdminUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { q, role, page = 1, limit = 20 } = req.query as any;
    const query: Record<string, any> = { isDeleted: false };

    if (role) {
      query.role = role;
    }

    if (q) {
      query.email = { $regex: new RegExp(q, 'i') };
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [users, total] = await Promise.all([
      User.find(query).select('-passwordHash').sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
      User.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      data: users,
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

export async function blockUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = req.params.id as string;
    const { isBlocked, reason } = req.body;
    const adminId = req.user!.id;

    const user = await User.findById(id);
    if (!user) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
      return;
    }

    user.isBlocked = isBlocked;
    await user.save();

    await AuditLog.create({
      actorId: new mongoose.Types.ObjectId(adminId),
      action: isBlocked ? 'BLOCK_USER' : 'UNBLOCK_USER',
      entity: 'User',
      entityId: user._id.toString(),
      meta: { reason },
    });

    res.status(200).json({
      success: true,
      data: {
        message: `User ${isBlocked ? 'blocked' : 'unblocked'} successfully`,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function getAdminStats(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [totalDoctors, pendingDoctors, totalPatients, totalAppointments, appointmentsThisWeek] =
      await Promise.all([
        DoctorProfile.countDocuments({ status: 'approved', isDeleted: false }),
        DoctorProfile.countDocuments({ status: 'pending_approval', isDeleted: false }),
        User.countDocuments({ role: 'patient', isDeleted: false }),
        Appointment.countDocuments({ isDeleted: false }),
        Appointment.countDocuments({ createdAt: { $gte: oneWeekAgo }, isDeleted: false }),
      ]);

    res.status(200).json({
      success: true,
      data: {
        totalDoctors,
        pendingDoctors,
        totalPatients,
        totalAppointments,
        appointmentsThisWeek,
      },
    });
  } catch (error) {
    next(error);
  }
}
