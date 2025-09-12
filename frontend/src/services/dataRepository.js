import apiService from './api';
import dataTransformer from './dataTransformer';
import networkDataCache from './networkDataCache';
import { getLast30DaysRange } from '../utils/dateUtils';

// Split raw runs by destination address
function splitRunsByDestination(rawRuns) {
  const map = new Map();
  (Array.isArray(rawRuns) ? rawRuns : []).forEach(run => {
    const addr = run?.destinations?.address || run?.destination?.address || null;
    if (!addr) return;
    if (!map.has(addr)) map.set(addr, []);
    map.get(addr).push(run);
  });
  return map;
}

function toDate(value) {
  return value ? new Date(value) : null;
}

function transformAndValidate(rawRuns, opts = {}) {
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
    // Apply protocol filter (and other initial filters) before transforming
    const filteredRaw = dataTransformer.applyInitialFilters
      ? dataTransformer.applyInitialFilters(raw, {
          selectedProtocols: Array.isArray(opts.selectedProtocols) ? opts.selectedProtocols : []
        })
      : raw;
    return transformAndValidate(filteredRaw, opts);
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
    return transformAndValidate(rawRuns, opts);
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
        start_date: range.start.toISOString(),
        end_date: range.end.toISOString()
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