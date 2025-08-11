import { useMemo } from 'react';

export const useGraphData = (pathData, filters) => {
  const {
    minRTT,
    maxRTT,
    minUsagePercent,
    selectedPathTypes,
    showPrimaryOnly
  } = filters;

  // Filter data based on current filters
  const filteredData = useMemo(() => {
    if (!pathData || Object.keys(pathData).length === 0) {
      return {};
    }

    const filtered = {};

    Object.entries(pathData).forEach(([destination, destinationData]) => {
      const filteredData = {};

      // Filter primary path
      if (destinationData.primary_path && selectedPathTypes.includes('PRIMARY')) {
        const primaryPath = destinationData.primary_path;
        let includePrimary = true;

        // Apply RTT filters
        if (minRTT && primaryPath.avg_rtt < parseFloat(minRTT)) {
          includePrimary = false;
        }
        if (maxRTT && primaryPath.avg_rtt > parseFloat(maxRTT)) {
          includePrimary = false;
        }

        // Apply usage percent filter
        if (minUsagePercent && primaryPath.percent < parseFloat(minUsagePercent)) {
          includePrimary = false;
        }

        if (includePrimary) {
          filteredData.primary_path = primaryPath;
        }
      }

      // Filter alternative paths
      if (destinationData.alternatives && selectedPathTypes.includes('ALTERNATIVE')) {
        const validAlternatives = destinationData.alternatives.filter(altPath => {
          let isValid = true;

          // Apply RTT filters
          if (minRTT && altPath.avg_rtt < parseFloat(minRTT)) {
            isValid = false;
          }
          if (maxRTT && altPath.avg_rtt > parseFloat(maxRTT)) {
            isValid = false;
          }

          // Apply usage percent filter
          if (minUsagePercent && altPath.percent < parseFloat(minUsagePercent)) {
            isValid = false;
          }

          return isValid;
        });

        if (validAlternatives.length > 0) {
          filteredData.alternatives = validAlternatives;
        }
      }

      // Apply show primary only filter
      if (showPrimaryOnly) {
        delete filteredData.alternatives;
      }

      // Only include destination if it has valid data
      const includePrimary = filteredData.primary_path;
      const validAlternatives = filteredData.alternatives || [];

      if (includePrimary || validAlternatives.length > 0) {
        filteredData.alternatives = validAlternatives;
        filteredData.includePrimary = includePrimary;
        filtered[destination] = filteredData;
      }
    });

    return filtered;
  }, [pathData, minRTT, maxRTT, minUsagePercent, selectedPathTypes, showPrimaryOnly]);

  return {
    filteredData
  };
}; 