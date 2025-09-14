import { useState, useCallback } from 'react';
import {
  getPeriodFromRange,
  getCurrentDayRange,
  getYesterdayRange,
  getCurrentWeekRange,
  getLastWeekRange,
  getLast30DaysRange
} from '../utils/dateUtils';
import React from 'react';

export const useDateRange = () => {
  // Initialize with current day
  const [dateRange, setDateRange] = useState(() => {
    return getCurrentDayRange();
  });
  const [currentPeriod, setCurrentPeriod] = React.useState(null);

  React.useEffect(() => {
    setCurrentPeriod(getPeriodFromRange(dateRange.start, dateRange.end));
  }, [dateRange.start, dateRange.end]);

  // Handle quick access to predefined date ranges
  const handleQuickAccess = useCallback((period, customDates = {}) => {
    let range;
    switch (period) {
      case 'current-day':
        range = getCurrentDayRange();
        break;
      case 'last-day':
        range = getYesterdayRange();
        break;
      case 'current-week':
        range = getCurrentWeekRange();
        break;
      case 'last-week':
        range = getLastWeekRange();
        break;
      case 'last-30-days':
        range = getLast30DaysRange();
        break;
      case 'custom':
        range = {
          start: customDates.start || dateRange.start,
          end: customDates.end || dateRange.end
        };
        break;
      default:
        return;
    }

    setDateRange({ start: range.start, end: range.end });
    setCurrentPeriod(period === 'custom'
      ? getPeriodFromRange(range.start, range.end)
      : period);
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