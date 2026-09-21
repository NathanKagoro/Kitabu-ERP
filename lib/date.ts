/**
 * Tanzania is UTC+3 all year -- there is no daylight saving -- so the business
 * day is computed against a fixed offset rather than the device timezone. A
 * phone with a wrong timezone should not silently file this morning's sales
 * under yesterday.
 */
const TZ_OFFSET_MINUTES = 3 * 60;

/** The business day (YYYY-MM-DD) a timestamp belongs to. */
export function businessDay(at: Date | string | number = new Date()): string {
  const date = toDate(at);
  const shifted = new Date(date.getTime() + TZ_OFFSET_MINUTES * 60_000);
  return shifted.toISOString().slice(0, 10);
}

/** Inclusive start / exclusive end of a business day, as ISO instants. */
export function dayBounds(day: string): { start: string; end: string } {
  const start = new Date(`${day}T00:00:00.000+03:00`);
  const end = new Date(start.getTime() + 24 * 60 * 60_000);
  return { start: start.toISOString(), end: end.toISOString() };
}

export function addDays(day: string, delta: number): string {
  const date = new Date(`${day}T12:00:00.000+03:00`);
  date.setUTCDate(date.getUTCDate() + delta);
  return businessDay(date);
}

/** The last `count` business days, oldest first, ending today. */
export function recentDays(count: number, today: string = businessDay()): string[] {
  return Array.from({ length: count }, (_, i) => addDays(today, i - (count - 1)));
}

export function daysBetween(from: string, to: string): number {
  const a = new Date(`${from}T12:00:00.000+03:00`).getTime();
  const b = new Date(`${to}T12:00:00.000+03:00`).getTime();
  return Math.round((b - a) / (24 * 60 * 60_000));
}

export function nowIso(): string {
  return new Date().toISOString();
}

function toDate(at: Date | string | number): Date {
  return at instanceof Date ? at : new Date(at);
}
