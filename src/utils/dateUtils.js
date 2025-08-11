/**
 * Format date for display
 */
export const formatDate = (date) => {
  if (!date) return '';
  return new Intl.DateTimeFormat('en-GB', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
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
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  return { start: startOfDay, end: now };
};

/**
 * Get yesterday range (00:00 to 23:59)
 */
export const getYesterdayRange = () => {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const startOfDay = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 0, 0, 0, 0);
  const endOfDay = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59, 999);
  return { start: startOfDay, end: endOfDay };
};

/**
 * Get current week range (Monday 00:00 to current time)
 */
export const getCurrentWeekRange = () => {
  const now = new Date();
  const currentDay = now.getDay();
  const daysFromMonday = currentDay === 0 ? 6 : currentDay - 1;
  const monday = new Date(now.getTime() - daysFromMonday * 24 * 60 * 60 * 1000);
  const startOfMonday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate(), 0, 0, 0, 0);
  return { start: startOfMonday, end: now };
};

/**
 * Get last week range (Monday 00:00 to Sunday 23:59)
 *  * Returns an object with start and end dates
 * Start is at 00:00 of the last week's Monday, end is at 23:59:59.999 of the last week's Sunday
 * @returns {Object} { start: Date, end: Date }   
 *  
 */
export const getLastWeekRange = () => {
  const now = new Date();
  const currentDay = now.getDay();
  const daysFromMonday = currentDay === 0 ? 6 : currentDay - 1;
  const lastWeekMonday = new Date(now.getTime() - (daysFromMonday + 7) * 24 * 60 * 60 * 1000);
  const lastWeekSunday = new Date(lastWeekMonday.getTime() + 6 * 24 * 60 * 60 * 1000);
  const startOfMonday = new Date(lastWeekMonday.getFullYear(), lastWeekMonday.getMonth(), lastWeekMonday.getDate(), 0, 0, 0, 0);
  const endOfSunday = new Date(lastWeekSunday.getFullYear(), lastWeekSunday.getMonth(), lastWeekSunday.getDate(), 23, 59, 59, 999);
  return { start: startOfMonday, end: endOfSunday };
};

/**
 * Get last 30 days range
 * Returns an object with start and end dates
 * Start is at 00:00 of the day 30 days ago, end is now
 * @returns {Object} { start: Date, end: Date } 
 */
export const getLast30DaysRange = () => {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const startOfDay = new Date(thirtyDaysAgo.getFullYear(), thirtyDaysAgo.getMonth(), thirtyDaysAgo.getDate(), 0, 0, 0, 0);
  return { start: startOfDay, end: now };
};


/**
 * Get period from date range
 * Returns 'current-day', 'last-day', 'current-week', 'last-week', '
 * last-30-days' or null if no match
 * @param {Date} start - Start date of the range
 * @param {Date} end - End date of the range
 * @param {Date} now - Current date (default: now)
 * @param {number} tolMs - Tolerance in milliseconds for matching (default:
 *  60 seconds)
 */

export function getPeriodFromRange(start, end, now = new Date(), tolMs = 60_000) {
  if (!start || !end) return null;

  const isSameWithin = (a, b) => Math.abs(a - b) <= tolMs;

  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  const endOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

  const startTs = start.getTime();
  const endTs = end.getTime();
  const nowTs = now.getTime();

  // Current Day
  const sodToday = startOfDay(now);
  if (startTs === sodToday.getTime() && isSameWithin(endTs, nowTs)) {
    return 'current-day';
  }

  // Last Day (yesterday)
  const y = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (startTs === startOfDay(y).getTime() && endTs === endOfDay(y).getTime()) {
    return 'last-day';
  }

  // Current Week (Mon 00:00 -> now)
  const day = now.getDay();
  const daysFromMonday = day === 0 ? 6 : day - 1;
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysFromMonday);
  const startOfMonday = startOfDay(monday);
  if (startTs === startOfMonday.getTime() && isSameWithin(endTs, nowTs)) {
    return 'current-week';
  }

  // Last Week (Mon 00:00 -> Sun 23:59:59.999)
  const lastWeekMonday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (daysFromMonday + 7));
  const lastWeekSunday = new Date(lastWeekMonday.getFullYear(), lastWeekMonday.getMonth(), lastWeekMonday.getDate() + 6);
  if (startTs === startOfDay(lastWeekMonday).getTime() && endTs === endOfDay(lastWeekSunday).getTime()) {
    return 'last-week';
  }

  // Last 30 days (start exact, end ~ now)
  const thirtyDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
  if (startTs === startOfDay(thirtyDaysAgo).getTime() && isSameWithin(endTs, nowTs)) {
    return 'last-30-days';
  }

  return null;
}