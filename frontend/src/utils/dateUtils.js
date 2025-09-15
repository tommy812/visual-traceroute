import { DateTime } from 'luxon';

const LONDON = 'Europe/London';

// Convert JS Date to Luxon in Europe/London
const toLondon = (d) => DateTime.fromJSDate(d).setZone(LONDON);
const nowLondon = () => DateTime.now().setZone(LONDON);

export const formatDate = (date) => {
  if (!date) return '';
  const dt = date instanceof Date ? toLondon(date) : DateTime.fromISO(String(date), { zone: LONDON });
  return dt.toFormat('dd LLL yyyy, HH:mm');
};

/**
 * Format date range for display
 */
export const formatDateRange = (start, end) => {
  if (!start || !end) return '';
  
  const startFormatted = formatDate(start);
  const endFormatted = formatDate(end);
  
  return `${startFormatted} - ${endFormatted}`;
};

/**
 * Get current day range (00:00 to current time)
 */
export const getCurrentDayRange = () => {
  const now = nowLondon();
  const start = now.startOf('day');
  return { start: start.toJSDate(), end: now.toJSDate() };
};

/**
 * Get yesterday range (00:00 to 23:59)
 */
export const getYesterdayRange = () => {
  const y = nowLondon().minus({ days: 1 });
  const start = y.startOf('day');
  const end = y.endOf('day');
  return { start: start.toJSDate(), end: end.toJSDate() };
};

/**
 * Get current week range (Monday 00:00 to current time)
 */
export const getCurrentWeekRange = () => {
  const now = nowLondon();
  // Luxon weekNumber defaults to ISO weeks (Mon-Sun). Use startOf('week').
  const start = now.startOf('week');
  return { start: start.toJSDate(), end: now.toJSDate() };
};

/**
 * Get last week range (Monday 00:00 to Sunday 23:59)
 *  * Returns an object with start and end dates
 * Start is at 00:00 of the last week's Monday, end is at 23:59:59.999 of the last week's Sunday
 * @returns {Object} { start: Date, end: Date }   
 *  
 */
export const getLastWeekRange = () => {
  const now = nowLondon();
  const lastWeekStart = now.startOf('week').minus({ weeks: 1 });
  const lastWeekEnd = lastWeekStart.endOf('week');
  return { start: lastWeekStart.toJSDate(), end: lastWeekEnd.toJSDate() };
};

/**
 * Get last 30 days range
 * Returns an object with start and end dates
 * Start is at 00:00 of the day 30 days ago, end is now
 * @returns {Object} { start: Date, end: Date } 
 */
export const getLast30DaysRange = () => {
  const now = nowLondon();
  const start = now.minus({ days: 30 }).startOf('day');
  return { start: start.toJSDate(), end: now.toJSDate() };
};

export function toLocalInputValue(date) {
  if (!date) return '';
  const dt = toLondon(date);
  return dt.toFormat("yyyy-LL-dd'T'HH:mm");
}

export function fromLocalInputValue(value) {
  if (!value) return null;
  // value like '2025-09-15T12:34'
  const dt = DateTime.fromFormat(value, "yyyy-LL-dd'T'HH:mm", { zone: LONDON });
  return dt.toJSDate();
}

// Tolerant period detection to avoid “double-click” selection
export function getPeriodFromRange(start, end, now = new Date(), tolMs = 60_000) {
  if (!start || !end) return null;

  const isSameWithin = (a, b) => Math.abs(a - b) <= tolMs;
  const nowDt = nowLondon();
  const startDt = toLondon(start);
  const endDt = toLondon(end);

  if (startDt.equals(nowDt.startOf('day')) && isSameWithin(endDt.toMillis(), nowDt.toMillis())) return 'current-day';

  const y = nowDt.minus({ days: 1 });
  if (startDt.equals(y.startOf('day')) && endDt.equals(y.endOf('day'))) return 'last-day';

  const weekStart = nowDt.startOf('week');
  if (startDt.equals(weekStart) && isSameWithin(endDt.toMillis(), nowDt.toMillis())) return 'current-week';

  const lastWeekStart = weekStart.minus({ weeks: 1 });
  const lastWeekEnd = lastWeekStart.endOf('week');
  if (startDt.equals(lastWeekStart) && endDt.equals(lastWeekEnd)) return 'last-week';

  const thirtyStart = nowDt.minus({ days: 30 }).startOf('day');
  if (startDt.equals(thirtyStart) && isSameWithin(endDt.toMillis(), nowDt.toMillis())) return 'last-30-days';

  return null;
}

// Serialize JS Date to ISO string representing the same wall time in Europe/London
export function toLondonISO(date) {
  if (!date) return '';
  return toLondon(date).toISO();
}

// Parse ISO string and treat it in Europe/London
export function fromLondonISO(iso) {
  if (!iso) return null;
  return DateTime.fromISO(String(iso), { zone: LONDON }).toJSDate();
}