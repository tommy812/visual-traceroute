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
    const destinationStrings = selectedDestinations.map(dest => 
      typeof dest === 'string' ? dest : dest.address
    );
    
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
      setLoading(true);
      setError(null);

      // 1) Try cache-first render for instant UI if available
      const cached = dataRepository.getCachedNetworkData(fetchParams);
      if (cached && Object.keys(cached).length > 0) {
        setPathData(cached);
      }

      // 2) Fetch and cache from backend (stale-while-revalidate)
      const fresh = await dataRepository.fetchAndCacheNetworkData(fetchParams);
      setPathData(fresh);
      setLastFetchParams(fetchParams);

      // 3) Background prefetch for last 30 days (per requirement)
      //    This does not affect current render.
      const destinationStrings = Array.isArray(fetchParams.destinations) ? fetchParams.destinations : [];
      dataRepository.prefetchLast30Days(destinationStrings);
    } catch (err) {
      console.error('Error loading network data:', err);
      setError(err.message || 'Failed to load network data');
      setPathData({});
      setLastFetchParams(fetchParams);
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