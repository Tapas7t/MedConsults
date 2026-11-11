import { fromZonedTime, toZonedTime, formatInTimeZone } from 'date-fns-tz';

/**
 * Validates if a timezone string is a recognized IANA timezone identifier
 */
export function isValidIanaTimeZone(timeZone: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone });
    return true;
  } catch {
    return false;
  }
}

/**
 * Converts a clinic-local date ("YYYY-MM-DD") and time ("HH:mm") into a UTC JavaScript Date.
 * Handles DST shifts automatically.
 */
export function parseLocalToUtc(dateStr: string, timeStr: string, timeZone: string): Date {
  // Combine to "YYYY-MM-DDTHH:mm:00"
  const localDateTimeStr = `${dateStr}T${timeStr}:00`;
  return fromZonedTime(localDateTimeStr, timeZone);
}

/**
 * Formats a UTC Date into clinic-local representation.
 */
export function formatUtcToLocal(utcDate: Date, timeZone: string, formatPattern = 'yyyy-MM-dd HH:mm'): string {
  return formatInTimeZone(utcDate, timeZone, formatPattern);
}

/**
 * Gets day of week (0 = Sunday, 1 = Monday, ... 6 = Saturday) in the target clinic timezone.
 */
export function getDayOfWeekInTimeZone(date: Date, timeZone: string): number {
  const zoned = toZonedTime(date, timeZone);
  return zoned.getDay();
}

/**
 * Formats a Date to "YYYY-MM-DD" in the specified timezone.
 */
export function getDateStringInTimeZone(date: Date, timeZone: string): string {
  return formatInTimeZone(date, timeZone, 'yyyy-MM-dd');
}
