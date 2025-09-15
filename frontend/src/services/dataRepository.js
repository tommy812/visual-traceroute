import apiService from './api';
import dataTransformer from './dataTransformer';
import networkDataCache from './networkDataCache';
import { getLast30DaysRange, toLondonISO } from '../utils/dateUtils';

// Split raw runs by destination id (string) when available; fallback to address
function splitRunsByDestination(rawRuns) {
  const map = new Map();
  (Array.isArray(rawRuns) ? rawRuns : []).forEach(run => {
    const key = (run?.destination_id != null)
      ? String(run.destination_id)
      : (run?.destinations?.address || run?.destination?.address || null);
    if (!key) return;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(run);
  });
  return map;
}

function toDate(value) {
  return value ? new Date(value) : null;
}

function transformWithMode(rawRuns, opts = {}) {
  // When explicitly requested, return per-run (no aggregation) view
  if (opts.transformMode === 'per-run') {
    return dataTransformer.transformWithNoAggregation(rawRuns, opts);
  }
  // Default aggregated destination view
  const transformed = dataTransformer.transformNetworkData(rawRuns, opts);
  // If available in your transformer, keep validation step:
  const validated = dataTransformer.validateTransformedData
    ? dataTransformer.validateTransformedData(transformed)
    : transformed;
  return validated;
}

const dataRepository = {
  // Try building data from cache for requested range
  getCachedNetworkData: ({ destinations = [], start_date, end_date }, opts = {}) => {
    const start = toDate(start_date);
    const end = toDate(end_date);
    const raw = networkDataCache.getRunsInRange(destinations, start, end);
    if (!raw.length) return null;
    // Optional capability checks: if a view requires ASN but cache lacks it, skip cache
    if (opts.requireASN) {
      const hasAnyAsn = raw.some(run => Array.isArray(run?.hops) && run.hops.some(h => h && (h.asn !== undefined && h.asn !== null)));
      if (!hasAnyAsn) return null;
    }
    // Apply protocol filter (and other initial filters) before transforming
    const filteredRaw = dataTransformer.applyInitialFilters
      ? dataTransformer.applyInitialFilters(raw, {
          selectedProtocols: Array.isArray(opts.selectedProtocols) ? opts.selectedProtocols : []
        })
      : raw;
    return transformWithMode(filteredRaw, opts);
  },

  // Fetch from API, cache raw, return transformed
  fetchAndCacheNetworkData: async (params, opts = {}) => {
    const { destinations = [], start_date, end_date } = params || {};
    const res = await apiService.getNetworkData(params);
    const rawRuns = Array.isArray(res?.data) ? res.data : [];
    // Cache raw runs per destination
    const byDest = splitRunsByDestination(rawRuns);
    networkDataCache.addRunsByDestination(byDest);
    // If asked range equals last 30 days, mark coverage
    const last30 = getLast30DaysRange();
    const sameStart = start_date && new Date(start_date).valueOf() === last30.start.valueOf();
    const sameEnd = end_date && new Date(end_date).valueOf() === last30.end.valueOf();
    if (sameStart && sameEnd) {
      networkDataCache.markCoverageLast30Days(destinations);
    }
    return transformWithMode(rawRuns, opts);
  },
  
  fetchAndCacheAggregated: async (params) => {
    const aggregated = await apiService.getAggregatedPaths({
      destinations: params.destinations,
      protocols: params.selectedProtocols,
      start_date: params.start_date,
      end_date: params.end_date
    });
    return aggregated; // already aggregated shape
  },

  // Background prefetch for the last 30 days; no-op if already covered
  prefetchLast30Days: async (destinations = []) => {
    if (!destinations.length) return;
    if (networkDataCache.hasLast30DaysCoverage(destinations)) return;

    const range = getLast30DaysRange();
    try {
      const res = await apiService.getNetworkData({
        destinations,
        start_date: toLondonISO(range.start),
        end_date: toLondonISO(range.end)
      });
      const rawRuns = Array.isArray(res?.data) ? res.data : [];
      const byDest = splitRunsByDestination(rawRuns);
      networkDataCache.addRunsByDestination(byDest);
      networkDataCache.markCoverageLast30Days(destinations);
    } catch (e) {
      // Silent background failure; keep UX unaffected
      console.warn('Prefetch last 30 days failed:', e);
    }
  }
};

// Helper exports for cache decisions
dataRepository.hasCoverageLast30Days = (destinations = []) => {
  return networkDataCache.hasLast30DaysCoverage(destinations);
};

dataRepository.isRangeWithinLast30Days = ({ start_date, end_date }) => {
  if (!start_date || !end_date) return false;
  const last30 = getLast30DaysRange();
  const start = new Date(start_date).valueOf();
  const end = new Date(end_date).valueOf();
  return start >= last30.start.valueOf() && end <= last30.end.valueOf();
};

export default dataRepository;