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
 */
export const getLast30DaysRange = () => {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const startOfDay = new Date(thirtyDaysAgo.getFullYear(), thirtyDaysAgo.getMonth(), thirtyDaysAgo.getDate(), 0, 0, 0, 0);
  return { start: startOfDay, end: now };
}; 