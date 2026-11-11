import mongoose from 'mongoose';
import { NotificationJob } from '../models/NotificationJob.js';
import { IAppointment } from '../models/Appointment.js';
import { IDoctorProfile } from '../models/DoctorProfile.js';
import { IUser } from '../models/User.js';

export async function scheduleAppointmentNotifications(params: {
  appointment: IAppointment;
  doctor: IDoctorProfile;
  patientUser: IUser;
}): Promise<void> {
  const { appointment, doctor, patientUser } = params;
  const startAt = new Date(appointment.startAt);

  // 1. Immediate confirmation job
  await NotificationJob.create({
    appointmentId: appointment._id,
    recipientEmail: patientUser.email,
    recipientName: appointment.patientRef.name,
    type: appointment.status === 'confirmed' ? 'booking_confirmation' : 'booking_pending',
    channel: 'email',
    runAt: new Date(),
    payload: {
      patientName: appointment.patientRef.name,
      doctorName: doctor.name,
      clinicName: doctor.clinic.name,
      clinicAddress: doctor.clinic.address,
      mapUrl: doctor.clinic.mapUrl,
      startAt: appointment.startAt.toISOString(),
      timezone: doctor.clinic.timezone,
      status: appointment.status,
    },
  });

  // 2. Reminder 24h before (if appointment is at least 24h in the future)
  const reminder24hTime = new Date(startAt.getTime() - 24 * 60 * 60 * 1000);
  if (reminder24hTime > new Date()) {
    await NotificationJob.create({
      appointmentId: appointment._id,
      recipientEmail: patientUser.email,
      recipientName: appointment.patientRef.name,
      type: 'reminder_24h',
      channel: 'email',
      runAt: reminder24hTime,
      payload: {
        patientName: appointment.patientRef.name,
        doctorName: doctor.name,
        clinicName: doctor.clinic.name,
        clinicAddress: doctor.clinic.address,
        mapUrl: doctor.clinic.mapUrl,
        startAt: appointment.startAt.toISOString(),
        timezone: doctor.clinic.timezone,
        hoursNotice: 24,
      },
    });
  }

  // 3. Reminder 2h before (if appointment is at least 2h in the future)
  const reminder2hTime = new Date(startAt.getTime() - 2 * 60 * 60 * 1000);
  if (reminder2hTime > new Date()) {
    await NotificationJob.create({
      appointmentId: appointment._id,
      recipientEmail: patientUser.email,
      recipientName: appointment.patientRef.name,
      type: 'reminder_2h',
      channel: 'email',
      runAt: reminder2hTime,
      payload: {
        patientName: appointment.patientRef.name,
        doctorName: doctor.name,
        clinicName: doctor.clinic.name,
        clinicAddress: doctor.clinic.address,
        mapUrl: doctor.clinic.mapUrl,
        startAt: appointment.startAt.toISOString(),
        timezone: doctor.clinic.timezone,
        hoursNotice: 2,
      },
    });
  }
}

/**
 * Cancels pending notification jobs for an appointment upon reschedule or cancellation.
 */
export async function cancelPendingAppointmentNotifications(appointmentId: mongoose.Types.ObjectId | string): Promise<void> {
  await NotificationJob.updateMany(
    {
      appointmentId: new mongoose.Types.ObjectId(appointmentId),
      status: 'pending',
    },
    {
      $set: { status: 'cancelled' },
    }
  );
}
