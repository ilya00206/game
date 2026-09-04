/**
 * Timezone aware day arithmetic.
 *
 * All daily mechanics (streak, daily bonus, quests, activity charts) are keyed
 * by the *local* day of the user, never by UTC. A "day key" is the calendar
 * date rendered in the user's timezone as `YYYY-MM-DD`.
 */

const dayKeyFormatterCache = new Map<string, Intl.DateTimeFormat>();
const partsFormatterCache = new Map<string, Intl.DateTimeFormat>();

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function getDayKeyFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = dayKeyFormatterCache.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    dayKeyFormatterCache.set(timeZone, formatter);
  }
  return formatter;
}

function getPartsFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = partsFormatterCache.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    partsFormatterCache.set(timeZone, formatter);
  }
  return formatter;
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** Calendar date in the given timezone, formatted as `YYYY-MM-DD`. */
export function getDayKey(date: Date, timeZone: string): string {
  return getDayKeyFormatter(timeZone).format(date);
}

export interface LocalParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

export function getLocalParts(date: Date, timeZone: string): LocalParts {
  const parts = getPartsFormatter(timeZone).formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes): number => {
    const found = parts.find((part) => part.type === type);
    return found ? Number(found.value) : 0;
  };
  return {
    year: read('year'),
    month: read('month'),
    day: read('day'),
    hour: read('hour'),
    minute: read('minute'),
    second: read('second'),
  };
}

/** Number of whole calendar days between two day keys (`b - a`). */
export function daysBetweenDayKeys(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / MS_PER_DAY);
}

export function shiftDayKey(dayKey: string, deltaDays: number): string {
  const shifted = new Date(Date.parse(`${dayKey}T00:00:00Z`) + deltaDays * MS_PER_DAY);
  return shifted.toISOString().slice(0, 10);
}

/** Offset of `timeZone` from UTC at the given instant, in milliseconds. */
export function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
  const parts = getLocalParts(date, timeZone);
  const wallClockAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return wallClockAsUtc - (date.getTime() - date.getMilliseconds());
}

/** The UTC instant matching 00:00 local time of `dayKey`. */
export function dayKeyToUtcStart(dayKey: string, timeZone: string): Date {
  const midnightAsUtc = Date.parse(`${dayKey}T00:00:00Z`);
  // Two passes so that days starting on a DST transition resolve correctly.
  let instant = midnightAsUtc - getTimeZoneOffsetMs(new Date(midnightAsUtc), timeZone);
  instant = midnightAsUtc - getTimeZoneOffsetMs(new Date(instant), timeZone);
  return new Date(instant);
}

/** The UTC instant matching 00:00 local time of the day that contains `date`. */
export function startOfLocalDayUtc(date: Date, timeZone: string): Date {
  return dayKeyToUtcStart(getDayKey(date, timeZone), timeZone);
}

/** The UTC instant matching the *next* local midnight after `date`. */
export function endOfLocalDayUtc(date: Date, timeZone: string): Date {
  return dayKeyToUtcStart(shiftDayKey(getDayKey(date, timeZone), 1), timeZone);
}

/** ISO-8601 week key (`YYYY-Www`) of the local day, used for weekly quests. */
export function getWeekKey(date: Date, timeZone: string): string {
  const dayKey = getDayKey(date, timeZone);
  const local = new Date(`${dayKey}T00:00:00Z`);
  const dayOfWeek = (local.getUTCDay() + 6) % 7; // Monday = 0
  const thursday = new Date(local.getTime() + (3 - dayOfWeek) * MS_PER_DAY);
  const isoYear = thursday.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(isoYear, 0, 4));
  const firstDayOfWeek = (firstThursday.getUTCDay() + 6) % 7;
  const week1Monday = new Date(firstThursday.getTime() - firstDayOfWeek * MS_PER_DAY);
  const weekNumber = Math.round((thursday.getTime() - week1Monday.getTime()) / (7 * MS_PER_DAY)) + 1;
  return `${isoYear}-W${String(weekNumber).padStart(2, '0')}`;
}

/** End of the current local ISO week as a UTC instant (next Monday 00:00 local). */
export function endOfLocalWeekUtc(date: Date, timeZone: string): Date {
  const dayKey = getDayKey(date, timeZone);
  const dayOfWeek = (new Date(`${dayKey}T00:00:00Z`).getUTCDay() + 6) % 7;
  return dayKeyToUtcStart(shiftDayKey(dayKey, 7 - dayOfWeek), timeZone);
}

/** Last `count` day keys ending with the local day of `date` (oldest first). */
export function recentDayKeys(date: Date, timeZone: string, count: number): string[] {
  const today = getDayKey(date, timeZone);
  const keys: string[] = [];
  for (let offset = count - 1; offset >= 0; offset -= 1) {
    keys.push(shiftDayKey(today, -offset));
  }
  return keys;
}

/** Day keys of the current local ISO week (Monday..Sunday). */
export function currentWeekDayKeys(date: Date, timeZone: string): string[] {
  const today = getDayKey(date, timeZone);
  const dayOfWeek = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7;
  const monday = shiftDayKey(today, -dayOfWeek);
  return Array.from({ length: 7 }, (_, index) => shiftDayKey(monday, index));
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY);
}
