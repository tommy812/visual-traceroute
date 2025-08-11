import { useMemo } from 'react';

export const useGraphData = (pathData, filters) => {
  const {
    minRTT,
    maxRTT,
    minUsagePercent,
    selectedPathTypes,
    showPrimaryOnly,           // NOTE: missing comma was causing a parse error
    selectedProtocol
  } = filters;

  const filteredData = useMemo(() => {
    if (!pathData || Object.keys(pathData).length === 0) return {};

    const numericMinRTT = minRTT ? parseFloat(minRTT) : null;
    const numericMaxRTT = maxRTT ? parseFloat(maxRTT) : null;
    const numericMinUsage = minUsagePercent ? parseFloat(minUsagePercent) : null;

    const normalize = (v) => (typeof v === 'string' ? v.trim().toUpperCase() : null);
    const selProto = normalize(selectedProtocol);

    const matchesProtocol = (p) => {
      if (!selProto) return true;
      if (!p) return false;

      // path-level protocol
      const pathProto = normalize(p.protocol);
      if (pathProto && pathProto === selProto) return true;

      // hop-level protocol (your paths use 'path', keep 'hops' as fallback)
      const hops = Array.isArray(p.path) ? p.path : (Array.isArray(p.hops) ? p.hops : []);
      return hops.some(h => normalize(h?.protocol) === selProto);
    };

    const result = {};

    Object.entries(pathData).forEach(([destination, destinationData]) => {
      const out = {};

      // Primary
      if (destinationData.primary_path && selectedPathTypes.includes('PRIMARY')) {
        const p = destinationData.primary_path;
        let ok = true;

        if (selectedProtocol && !matchesProtocol(p)) ok = false;
        if (ok && numericMinRTT !== null && p.avg_rtt < numericMinRTT) ok = false;
        if (ok && numericMaxRTT !== null && p.avg_rtt > numericMaxRTT) ok = false;
        if (ok && numericMinUsage !== null && p.percent < numericMinUsage) ok = false;

        if (ok) out.primary_path = p;
      }

      // Alternatives
      if (Array.isArray(destinationData.alternatives) && selectedPathTypes.includes('ALTERNATIVE')) {
        const alts = destinationData.alternatives.filter(a => {
          if (selectedProtocol && !matchesProtocol(a)) return false;
          if (numericMinRTT !== null && a.avg_rtt < numericMinRTT) return false;
          if (numericMaxRTT !== null && a.avg_rtt > numericMaxRTT) return false;
          if (numericMinUsage !== null && a.percent < numericMinUsage) return false;
          return true;
        });
        if (alts.length) out.alternatives = alts;
      }

      if (showPrimaryOnly) {
        delete out.alternatives;
      }

      if (out.primary_path || (out.alternatives && out.alternatives.length)) {
        // Preserve metadata you use in tooltips
        if (destinationData.total_traces != null) out.total_traces = destinationData.total_traces;
        result[destination] = out;
      }
    });

    return result;
  }, [
    pathData,
    minRTT,
    maxRTT,
    minUsagePercent,
    selectedPathTypes,
    showPrimaryOnly,
    selectedProtocol
  ]);

  return { filteredData };
};