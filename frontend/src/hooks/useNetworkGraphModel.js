import { useMemo } from 'react';
import { buildGraph } from '../utils/graphBuilder';

export function useNetworkGraphModel({
  filteredByHook,
  selectedDestinations,
  dateRange,
  showPrimaryOnly,
  showPrefixAggregation,
  expandedPrefixes,
  aggregationMode = 'none',
  aggregationScope = 'per-destination',
  networkHierarchy = 'none',
  expandedAsnGroups = new Set()
}) {
  const filteredData = useMemo(() => {
    if (!filteredByHook || !selectedDestinations || selectedDestinations.length === 0) return {};
    
    // Handle both raw data (match by destination key) and aggregated data (match by destination_id)
    const selectedSet = new Set(selectedDestinations);
    
    // Only create selectedIdSet from actual numeric IDs, not IPv6 addresses
    const selectedIdSet = new Set(selectedDestinations.map(d => {
      if (typeof d === 'number') return d;
      if (typeof d === 'string') {
        // Only try to parse if it looks like a number (not an IPv6 address)
        if (/^\d+$/.test(d.trim())) {
          const parsed = parseInt(d, 10);
          return isNaN(parsed) ? null : parsed;
        }
        return null; // Skip IPv6 addresses
      }
      if (d && d.id != null) return d.id;
      return null;
    }).filter(id => id !== null));
    
    
    const hasWindow = !!(dateRange && dateRange.start && dateRange.end);
    const startMs = hasWindow ? dateRange.start.getTime() : null;
    const endMs = hasWindow ? dateRange.end.getTime() : null;

    const filtered = {};
    Object.entries(filteredByHook).forEach(([destination, data]) => {
      // Try both matching strategies: by destination key (raw data) or by destination_id (aggregated data)
      const destId = data.destination_id;
      const matchesByKey = selectedSet.has(destination);
      const matchesById = destId !== null && destId !== undefined && selectedIdSet.has(destId);
      
      
      if (!matchesByKey && !matchesById) return;

      // Gather currently displayed candidates from hook output
      const basePrimary = data.primary_path ? [data.primary_path] : [];
      const baseAlts = Array.isArray(data.alternatives) ? data.alternatives : [];
      let survivors = [...basePrimary, ...baseAlts];

      // Apply date window to the survivors
      if (hasWindow) {
        survivors = survivors.filter(p => {
          const ts = new Date(p.timeStamp).valueOf();
          return ts >= startMs && ts <= endMs;
        });
      }

      if (survivors.length === 0) return;

      // Compute dynamic primary among survivors
      const pickPrimary = (arr) => arr.reduce((best, p) => {
        if (!best) return p;
        const bp = best?.percent ?? -1, pp = p?.percent ?? -1;
        const bc = best?.count ?? -1, pc = p?.count ?? -1;
        const br = best?.avg_rtt ?? Number.POSITIVE_INFINITY, pr = p?.avg_rtt ?? Number.POSITIVE_INFINITY;
        if (pp > bp) return p;
        if (pp < bp) return best;
        if (pc > bc) return p;
        if (pc < bc) return best;
        return pr < br ? p : best;
      }, null);

      const newPrimary = pickPrimary(survivors);

      // Respect user's path type selection from hook output
      const wantsPrimaryDisplay = Boolean(data.primary_path); // hook only includes this if PRIMARY is selected
      const wantsAltDisplay = Array.isArray(data.alternatives) && data.alternatives.length > 0; // ALTERNATIVE selected

      const out = {};
      if (wantsPrimaryDisplay && newPrimary) out.primary_path = newPrimary;

      if (wantsAltDisplay) {
        const others = survivors.filter(p => p !== newPrimary);
        if (others.length) out.alternatives = others;
      }

      if (out.primary_path || (out.alternatives && out.alternatives.length)) {
        out.total_traces = data.total_traces ?? null;
        filtered[destination] = out;
      }
    });
    return filtered;
  }, [filteredByHook, selectedDestinations, dateRange]);

  const { graph, nodeDetails, pathMapping } = useMemo(() => {
    return buildGraph({
      filteredData,
      selectedDestinations,
      showPrimaryOnly,
      showPrefixAggregation,
      expandedPrefixes,
      aggregationMode,
      aggregationScope,
      networkHierarchy,
      expandedAsnGroups
    });
  }, [filteredData, selectedDestinations, showPrimaryOnly, showPrefixAggregation, expandedPrefixes, aggregationMode, aggregationScope, networkHierarchy, expandedAsnGroups]);

  return { graph, nodeDetails, pathMapping };
}