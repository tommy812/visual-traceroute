import { useState, useCallback, useEffect, useMemo } from 'react';
import dataRepository from '../services/dataRepository';

export const useNetworkData = (selectedDestinations, dateRange, selectedProtocols) => {
  const [pathData, setPathData] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastFetchParams, setLastFetchParams] = useState(null);

  // Memoize the fetch parameters to prevent unnecessary API calls
  const fetchParams = useMemo(() => {
    if (selectedDestinations.length === 0) return null;
    
    // Convert destination objects to strings for API
    // Prefer numeric destination IDs for backend aggregation; fallback to address if id missing
    const destinationStrings = selectedDestinations.map(dest => {
      if (typeof dest === 'string') return dest; // legacy string
      if (dest && dest.id != null) return String(dest.id); // numeric id
      return dest?.address; // fallback
    }).filter(Boolean);
    
    const params = {
      destinations: destinationStrings,
      start_date: dateRange.start?.toISOString(),
      end_date: dateRange.end?.toISOString(),
    };
    
    // Only include defined parameters
    return Object.fromEntries(
      Object.entries(params).filter(([_, value]) => value !== undefined)
    );
  }, [selectedDestinations, dateRange.start, dateRange.end]);

  // Check if we need to fetch new data
  const shouldFetch = useMemo(() => {
    if (!fetchParams) return false;
    
    // Compare with last fetch parameters
    if (!lastFetchParams) return true;
    
    return JSON.stringify(fetchParams) !== JSON.stringify(lastFetchParams);
  }, [fetchParams, lastFetchParams]);

     const loadNetworkData = useCallback(async () => {
    if (!shouldFetch) return;

    try {
      // 1) Cache-first
      const cached = dataRepository.getCachedNetworkData(fetchParams);
      const hadCached = cached && Object.keys(cached).length > 0;
      if (hadCached) {
        setPathData(cached);
        setLoading(false);  // do not block UI
      } else {
        setLoading(true);
        setError(null);
      }

      // 2) Background refresh (aggregated API)
      const fresh = await dataRepository.fetchAndCacheAggregated(fetchParams);
      setPathData(fresh);
      setLastFetchParams(fetchParams);

      // 3) Keep last-30-days warm
      const destinationStrings = Array.isArray(fetchParams.destinations) ? fetchParams.destinations : [];
      dataRepository.prefetchLast30Days(destinationStrings);
    } catch (err) {
      if (!pathData || Object.keys(pathData).length === 0) {
        setError(err.message || 'Failed to load network data');
      }
    } finally {
      setLoading(false);
    }
  }, [fetchParams, shouldFetch]);

  // Auto-fetch when parameters change
  useEffect(() => {
    loadNetworkData();
  }, [loadNetworkData]);

  // Memoize the return value to prevent unnecessary re-renders
  const result = useMemo(() => ({
    pathData,
    loading,
    error,
    loadNetworkData
  }), [pathData, loading, error, loadNetworkData]);

  return result;
}; 