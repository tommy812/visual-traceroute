import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import dataRepository from '../services/dataRepository';
import { toLondonISO } from '../utils/dateUtils';

// dataMode: 'auto' | 'aggregated' | 'per-run'
export const useNetworkData = (selectedDestinations, dateRange, selectedProtocols, dataMode = 'auto') => {
  const [pathData, setPathData] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastFetchParams, setLastFetchParams] = useState(null);
  // Guard against race conditions: only latest request may update state
  const requestIdRef = useRef(0);

  // Memoize the fetch parameters to prevent unnecessary API calls.
  // NOTE: intentionally omit `selectedProtocols` from these params so toggling
  // protocols in the UI doesn't trigger a backend fetch. Protocol filtering is
  // applied client-side against already-fetched path data.
  const fetchParams = useMemo(() => {
    if (selectedDestinations.length === 0) return null;
    
    // Convert destination objects to strings for API
    // Prefer numeric destination IDs for backend aggregation; fallback to address if id missing
    const destinationStrings = selectedDestinations.map(dest => {
      if (typeof dest === 'number') return String(dest);       // numeric id
      if (typeof dest === 'string') return dest;               // already string id/address
      if (dest && dest.id != null) return String(dest.id);     // object with id
      return dest?.address;                                    // fallback address
    }).filter(Boolean);

    const params = {
      destinations: destinationStrings,
      start_date: dateRange.start ? toLondonISO(dateRange.start) : undefined,
      end_date: dateRange.end ? toLondonISO(dateRange.end) : undefined
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

    const reqId = ++requestIdRef.current;
    try {
      // Always show loading spinner at the start
      setLoading(true);
      setError(null);

      // Force per-run mode to use local aggregation instead of database aggregation
      // The frontend DataTransformer handles aggregation much better than database
      const resolvedMode = 'per-run';

      // 1) Cache-first according to mode
      let hadCached = false;
      if (resolvedMode === 'per-run') {
        const cachedPerRun = dataRepository.getCachedNetworkData(fetchParams, {
          selectedProtocols: fetchParams.selectedProtocols,
          transformMode: 'per-run'
        });
        hadCached = cachedPerRun && Object.keys(cachedPerRun).length > 0;
        if (hadCached && reqId === requestIdRef.current) setPathData(cachedPerRun);
      } else {
        const cachedAgg = dataRepository.getCachedNetworkData(fetchParams, { selectedProtocols: fetchParams.selectedProtocols });
        hadCached = cachedAgg && Object.keys(cachedAgg).length > 0;
        if (hadCached && reqId === requestIdRef.current) setPathData(cachedAgg);
      }

      // 2) Fetch fresh for selected mode  
      if (resolvedMode === 'per-run') {
        const freshPerRun = await dataRepository.fetchAndCacheNetworkData(
          fetchParams,
          { selectedProtocols: fetchParams.selectedProtocols, transformMode: 'per-run' }
        );
        if (reqId === requestIdRef.current) setPathData(freshPerRun);
      } else {
        // aggregated
        let needFresh = true;
        if (hadCached) {
          const within30 = dataRepository.isRangeWithinLast30Days(fetchParams);
          const covered = dataRepository.hasCoverageLast30Days(fetchParams.destinations);
          if (within30 && covered) needFresh = false;
        }
        if (needFresh) {
          const freshAgg = await dataRepository.fetchAndCacheAggregated(fetchParams);
          if (reqId === requestIdRef.current) setPathData(freshAgg);
        }
      }

      if (reqId === requestIdRef.current) setLastFetchParams(fetchParams);

      // 3) Keep last-30-days warm (only useful for per-run and within last 30 days)
      const destinationStrings = Array.isArray(fetchParams.destinations) ? fetchParams.destinations : [];
      const within30 = dataRepository.isRangeWithinLast30Days(fetchParams);
      const covered = dataRepository.hasCoverageLast30Days(destinationStrings);
      if (resolvedMode === 'per-run' && within30 && !covered) {
        dataRepository.prefetchLast30Days(destinationStrings);
      }
    } catch (err) {
      // Only surface error if still the latest request
      if (reqId === requestIdRef.current) setError(err.message || 'Failed to load network data');
    } finally {
      if (reqId === requestIdRef.current) setLoading(false);
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

// Optional helper: fetch per-run (no aggregation) data on demand
export async function fetchPerRunNetworkData(selectedDestinations, dateRange, selectedProtocols) {
  if (!Array.isArray(selectedDestinations) || selectedDestinations.length === 0) return {};
  const destinationStrings = selectedDestinations.map(dest => {
    if (typeof dest === 'string') return dest;
    if (dest && dest.id != null) return String(dest.id);
    return dest?.address;
  }).filter(Boolean);
  const params = {
    destinations: destinationStrings,
  start_date: dateRange.start ? toLondonISO(dateRange.start) : undefined,
  end_date: dateRange.end ? toLondonISO(dateRange.end) : undefined
  };
  const opts = {
    selectedProtocols: Array.isArray(selectedProtocols) ? selectedProtocols : [],
    transformMode: 'per-run'
  };
  return await dataRepository.fetchAndCacheNetworkData(params, opts);
  
}