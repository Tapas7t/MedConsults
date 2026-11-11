import { parseLocalToUtc, getDayOfWeekInTimeZone } from './time.js';
import { IAvailability } from '../models/Availability.js';
import { IDoctorProfile } from '../models/DoctorProfile.js';
import { IAppointment } from '../models/Appointment.js';
import { IBlock } from '../models/Block.js';

export interface GeneratedSlot {
  startAt: string; // ISO string UTC
  endAt: string;   // ISO string UTC
  localDate: string; // "YYYY-MM-DD"
  localTime: string; // "HH:mm"
  isAvailable: boolean;
}

// Convert "HH:mm" to minutes since midnight
function timeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

// Convert minutes since midnight back to "HH:mm"
function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

export function generateDoctorSlots(params: {
  doctor: IDoctorProfile;
  availability: IAvailability | null;
  appointments: IAppointment[];
  blocks: IBlock[];
  dateStrings: string[]; // List of "YYYY-MM-DD" local dates to compute
}): GeneratedSlot[] {
  const { doctor, availability, appointments, blocks, dateStrings } = params;
  const timeZone = doctor.clinic.timezone || 'Asia/Kolkata';
  const slotMinutes = doctor.slotMinutes || 30;
  const leadTimeMin = doctor.leadTimeMin || 60;
  const horizonDays = doctor.horizonDays || 30;

  const now = new Date();
  const minBookableTime = new Date(now.getTime() + leadTimeMin * 60 * 1000);
  const maxBookableTime = new Date(now.getTime() + horizonDays * 24 * 60 * 60 * 1000);

  const slots: GeneratedSlot[] = [];

  for (const dateStr of dateStrings) {
    // Determine working ranges and breaks for this day
    let workingRanges: { start: string; end: string }[] = [];
    let breakRanges: { start: string; end: string }[] = [];

    // Check exceptions first
    const exception = availability?.exceptions?.find((e) => e.date === dateStr);
    if (exception) {
      if (exception.closed) {
        continue; // Clinic is explicitly closed on this date
      }
      workingRanges = exception.ranges || [];
    } else if (availability) {
      // Find day of week in the clinic timezone
      const sampleUtc = parseLocalToUtc(dateStr, '12:00', timeZone);
      const dayOfWeek = getDayOfWeekInTimeZone(sampleUtc, timeZone);
      const daySchedule = availability.weekly.find((w) => w.day === dayOfWeek);
      if (daySchedule) {
        workingRanges = daySchedule.ranges || [];
        breakRanges = daySchedule.breaks || [];
      }
    }

    if (workingRanges.length === 0) {
      continue;
    }

    // Break ranges in minutes for fast intersection checks
    const breaksInMinutes = breakRanges.map((b) => ({
      start: timeToMinutes(b.start),
      end: timeToMinutes(b.end),
    }));

    for (const range of workingRanges) {
      const rangeStartMin = timeToMinutes(range.start);
      const rangeEndMin = timeToMinutes(range.end);

      let currentSlotStartMin = rangeStartMin;

      while (currentSlotStartMin + slotMinutes <= rangeEndMin) {
        const currentSlotEndMin = currentSlotStartMin + slotMinutes;

        // Check if overlaps any scheduled break
        const overlapsBreak = breaksInMinutes.some(
          (b) => currentSlotStartMin < b.end && currentSlotEndMin > b.start
        );

        if (!overlapsBreak) {
          const slotStartLocal = minutesToTime(currentSlotStartMin);
          const slotEndLocal = minutesToTime(currentSlotEndMin);

          const slotStartUtc = parseLocalToUtc(dateStr, slotStartLocal, timeZone);
          const slotEndUtc = parseLocalToUtc(dateStr, slotEndLocal, timeZone);

          // Lead time & horizon checks
          if (slotStartUtc >= minBookableTime && slotStartUtc <= maxBookableTime) {
            // Check overlap with active appointments (pending, confirmed, arrived)
            const hasAppointmentConflict = appointments.some((app) => {
              return slotStartUtc < app.endAt && slotEndUtc > app.startAt;
            });

            // Check overlap with manual blocks
            const hasBlockConflict = blocks.some((b) => {
              return slotStartUtc < b.endAt && slotEndUtc > b.startAt;
            });

            if (!hasAppointmentConflict && !hasBlockConflict) {
              slots.push({
                startAt: slotStartUtc.toISOString(),
                endAt: slotEndUtc.toISOString(),
                localDate: dateStr,
                localTime: slotStartLocal,
                isAvailable: true,
              });
            }
          }
        }

        currentSlotStartMin += slotMinutes;
      }
    }
  }

  return slots;
}
