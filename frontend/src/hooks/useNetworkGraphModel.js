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
    const selectedSet = new Set(selectedDestinations);
    const hasWindow = !!(dateRange && dateRange.start && dateRange.end);
    const startMs = hasWindow ? dateRange.start.getTime() : null;
    const endMs = hasWindow ? dateRange.end.getTime() : null;

    const filtered = {};
    Object.entries(filteredByHook).forEach(([destination, data]) => {
      if (!selectedSet.has(destination)) return;

      let includePrimary = false;
      if (data.primary_path) {
        includePrimary = true;
        if (hasWindow) {
          const ts = new Date(data.primary_path.timeStamp).valueOf();
          includePrimary = ts >= startMs && ts <= endMs;
        }
      }

      const alts = Array.isArray(data.alternatives) ? data.alternatives : [];
      const validAlts = hasWindow
        ? alts.filter(alt => {
            const ts = new Date(alt.timeStamp).valueOf();
            return ts >= startMs && ts <= endMs;
          })
        : alts;

      if (includePrimary || validAlts.length > 0) {
        filtered[destination] = {
          ...data,
          includePrimary,
          alternatives: validAlts
        };
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