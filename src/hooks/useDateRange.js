import { useState, useCallback } from 'react';
import { getPeriodFromRange } from '../utils/dateUtils';
import React from 'react';

export const useDateRange = () => {
  // Initialize with current day
  const [dateRange, setDateRange] = useState(() => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    return { start: startOfDay, end: now };
  });
  const [currentPeriod, setCurrentPeriod] = React.useState(null);

  React.useEffect(() => {
    setCurrentPeriod(getPeriodFromRange(dateRange.start, dateRange.end));
  }, [dateRange.start, dateRange.end]);

  // Handle quick access to predefined date ranges
  const handleQuickAccess = useCallback((period, customDates = {}) => {
    const now = new Date();
    let startDate, endDate;

    switch (period) {
      case 'current-day':
        // From 00:00 today until current time (local timezone)
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        endDate = now;
        break;

      case 'last-day':
        // From 00:00 to 23:59 of yesterday (local timezone)
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        startDate = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 0, 0, 0, 0);
        endDate = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59, 999);
        break;

      case 'current-week':
        // From Monday 00:00 of current week until current time (local timezone)
        const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
        const daysFromMonday = currentDay === 0 ? 6 : currentDay - 1; // Days since last Monday
        const monday = new Date(now.getTime() - daysFromMonday * 24 * 60 * 60 * 1000);
        startDate = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate(), 0, 0, 0, 0);
        endDate = now;
        break;

      case 'last-week':
        // From Monday 00:00 to Sunday 23:59 of last week (local timezone)
        const currentDayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
        const daysFromLastMonday = currentDayOfWeek === 0 ? 13 : currentDayOfWeek + 6; // Days since last Monday
        const lastWeekMonday = new Date(now.getTime() - daysFromLastMonday * 24 * 60 * 60 * 1000);
        const lastWeekSunday = new Date(lastWeekMonday.getTime() + 6 * 24 * 60 * 60 * 1000);
        startDate = new Date(lastWeekMonday.getFullYear(), lastWeekMonday.getMonth(), lastWeekMonday.getDate(), 0, 0, 0, 0);
        endDate = new Date(lastWeekSunday.getFullYear(), lastWeekSunday.getMonth(), lastWeekSunday.getDate(), 23, 59, 59, 999);
        break;

      case 'last-30-days':
        // From 30 days ago until current time (local timezone)
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        startDate = new Date(thirtyDaysAgo.getFullYear(), thirtyDaysAgo.getMonth(), thirtyDaysAgo.getDate(), 0, 0, 0, 0);
        endDate = now;
        break;

      case 'custom':
        // Handle custom date inputs
        startDate = customDates.start || dateRange.start;
        endDate = customDates.end || dateRange.end;
        break;

      default:
        return;
    }

    setDateRange({ start: startDate, end: endDate });
  }, [dateRange.start, dateRange.end]);

  const resetToCurrentDay = useCallback(() => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    setDateRange({ start: startOfDay, end: now });
  }, []);

  return {
    dateRange,
    setDateRange,
    handleQuickAccess,
    resetToCurrentDay,
    currentPeriod
  };
}; 