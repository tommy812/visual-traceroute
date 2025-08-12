import { useMemo } from 'react';

export const useGraphData = (pathData, filters) => {
  const {
    minRTT,
    maxRTT,
    minUsagePercent,
    selectedPathTypes,
    showPrimaryOnly,
    selectedProtocol
  } = filters;

  const filteredData = useMemo(() => {
    if (!pathData || Object.keys(pathData).length === 0) return {};

    const numericMinRTT = minRTT ? parseFloat(minRTT) : null;
    const numericMaxRTT = maxRTT ? parseFloat(maxRTT) : null;
    const numericMinUsage = minUsagePercent ? parseFloat(minUsagePercent) : null;

    // Dynamic normalization: uppercase only
    const normalize = (v) => (typeof v === 'string' ? v.trim().toUpperCase() : null);
    const selProto = normalize(selectedProtocol);

    // Legacy protocol match (used only if protocol_groups missing or key not found)
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
      const groups = destinationData?.protocol_groups || null;

      // Prefer per-protocol group via normalized key; if not direct hit, scan keys case-insensitively
      let group = null;
      if (selProto && groups) {
        group = groups[selProto] ?? null;
        if (!group) {
          const k = Object.keys(groups).find(key => normalize(key) === selProto);
          if (k) group = groups[k];
        }
      }

      // Use legacy match only when a protocol is selected but no group found
      const useLegacyProtoMatch = Boolean(selProto && (!groups || !group));

      const source = group || destinationData;
      const out = {};

      // PRIMARY
      if (source.primary_path && selectedPathTypes.includes('PRIMARY')) {
        const p = source.primary_path;
        let ok = true;

        if (useLegacyProtoMatch && !matchesProtocol(p)) ok = false;
        if (numericMinRTT !== null && p.avg_rtt < numericMinRTT) ok = false;
        if (numericMaxRTT !== null && p.avg_rtt > numericMaxRTT) ok = false;
        if (numericMinUsage !== null && p.percent < numericMinUsage) ok = false;

        if (ok) out.primary_path = p;
      }

      // ALTERNATIVES
      if (selectedPathTypes.includes('ALTERNATIVE')) {
        let sourceAlternatives = Array.isArray(source.alternatives) ? source.alternatives : [];

        // Legacy proto filter only if no protocol_groups match
        if (useLegacyProtoMatch) {
          sourceAlternatives = sourceAlternatives.filter(matchesProtocol);
        }

        // When “All Protocols”, include each protocol group's primary as extra alternatives (dedup by hop signature)
        if (!selProto && groups) {
          const makeSig = (pp) =>
            Array.isArray(pp?.path)
              ? pp.path.map(h => `${h?.ip ?? 'timeout'}`).join('>')
              : '';

          const protoPrimaries = Object.values(groups)
            .map(g => g?.primary_path)
            .filter(Boolean);

          const seen = new Set(sourceAlternatives.map(makeSig));
          if (out.primary_path) {
            const s = makeSig(out.primary_path);
            if (s) seen.add(s);
          }

          const extraPrimaries = protoPrimaries.filter(pp => {
            const s = makeSig(pp);
            if (!s || seen.has(s)) return false;
            seen.add(s);
            return true;
          });

          sourceAlternatives = [...sourceAlternatives, ...extraPrimaries];
        }

        const alts = sourceAlternatives.filter(a => {
          if (numericMinRTT !== null && a.avg_rtt < numericMinRTT) return false;
          if (numericMaxRTT !== null && a.avg_rtt > numericMaxRTT) return false;
          if (numericMinUsage !== null && a.percent < numericMinUsage) return false;
          return true;
        });

        if (alts.length) out.alternatives = alts;
      }

      if (showPrimaryOnly) {
        delete out.alternatives; // hides extra protocol primaries in "All Protocols" mode
      }

      if (out.primary_path || (out.alternatives && out.alternatives.length)) {
        out.total_traces = destinationData.total_traces ?? group?.total_traces ?? null;
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