import { useMemo } from 'react';

export const useGraphData = (pathData, filters) => {
  const {
    minRTT,
    maxRTT,
    minUsagePercent,
    selectedPathTypes,
    showPrimaryOnly,
    selectedProtocols,
    hideTimeouts 
  } = filters;

  const filteredData = useMemo(() => {
    if (!pathData || Object.keys(pathData).length === 0) return {};
    
    let data = pathData;

    if (hideTimeouts && data && typeof data === 'object') {
      const cleaned = {};
      Object.entries(data).forEach(([dest, destObj]) => {
        if (!destObj || typeof destObj !== 'object') return;

        // Helper: does path contain any timeout hop?
        const hasTimeout = p => Array.isArray(p?.path) && p.path.some(h => h?.is_timeout);

        // Helper: clone path object (shallow) if kept
        const keepIfNoTimeout = (p) => (p && !hasTimeout(p)) ? p : null;

        const primary_path     = keepIfNoTimeout(destObj.primary_path);
        const fastest_path     = keepIfNoTimeout(destObj.fastest_path);
        const shortest_path    = keepIfNoTimeout(destObj.shortest_path);

        const alternatives = Array.isArray(destObj.alternatives)
          ? destObj.alternatives.filter(p => !hasTimeout(p))
          : [];

        // protocol_groups (if present)
        let protocol_groups = undefined;
        if (destObj.protocol_groups && typeof destObj.protocol_groups === 'object') {
          protocol_groups = {};
            Object.entries(destObj.protocol_groups).forEach(([proto, grp]) => {
              if (!grp || typeof grp !== 'object') return;
              const gPrimary  = keepIfNoTimeout(grp.primary_path);
              const gFastest  = keepIfNoTimeout(grp.fastest_path);
              const gShortest = keepIfNoTimeout(grp.shortest_path);
              const gAlts = Array.isArray(grp.alternatives)
                ? grp.alternatives.filter(p => !hasTimeout(p))
                : [];
              // Only keep group if something remains
              if (gPrimary || gFastest || gShortest || gAlts.length) {
                protocol_groups[proto] = {
                  ...grp,
                  primary_path: gPrimary,
                  fastest_path: gFastest,
                  shortest_path: gShortest,
                  alternatives: gAlts
                };
              }
            });
          // Drop empty protocol_groups object
          if (Object.keys(protocol_groups).length === 0) {
            protocol_groups = undefined;
          }
        }

        // If after filtering nothing remains for this destination, skip it
        const anyLeft = primary_path || fastest_path || shortest_path || (alternatives.length > 0) || protocol_groups;
        if (anyLeft) {
          cleaned[dest] = {
            ...destObj,
            primary_path,
            fastest_path,
            shortest_path,
            alternatives,
            protocol_groups
          };
        }
      });
      data = cleaned;
    }

    const numericMinRTT = minRTT ? parseFloat(minRTT) : null;
    const numericMaxRTT = maxRTT ? parseFloat(maxRTT) : null;
    const numericMinUsage = minUsagePercent ? parseFloat(minUsagePercent) : null;

    const normalize = v => (typeof v === 'string' ? v.trim().toUpperCase() : null);
    const selectedSet = new Set(
      (Array.isArray(selectedProtocols) ? selectedProtocols : [])
        .map(normalize)
        .filter(Boolean)
    );
    const singleProto = selectedSet.size === 1 ? [...selectedSet][0] : null;

    const matchesProtocol = (p) => {
      if (selectedSet.size === 0) return true;
      if (!p) return false;
      const pathProto = normalize(p.protocol);
      if (pathProto && selectedSet.has(pathProto)) return true;
      const hops = Array.isArray(p.path) ? p.path : (Array.isArray(p.hops) ? p.hops : []);
      return hops.some(h => {
        const hp = normalize(h?.protocol);
        return hp && selectedSet.has(hp);
      });
    };

  const result = {};

  // IMPORTANT: iterate over the possibly timeout-pruned 'data' (not raw pathData)
  Object.entries(data).forEach(([destination, destinationData]) => {
      let groups = destinationData?.protocol_groups || null;

      if (groups && selectedSet.size > 1) {
        groups = Object.fromEntries(
          Object.entries(groups).filter(([k]) => selectedSet.has(normalize(k)))
        );
        if (Object.keys(groups).length === 0) groups = null;
      }

      let group = null;
      if (singleProto && groups) {
        group = groups[singleProto] ?? null;
        if (!group) {
          const k = Object.keys(groups).find(key => normalize(key) === singleProto);
            if (k) group = groups[k];
        }
      }

      const useLegacyProtoMatch = Boolean(selectedSet.size > 0 && (!groups || !group));
      const source = group || destinationData;
      const out = {};

      if (source.primary_path && selectedPathTypes.includes('PRIMARY')) {
        const p = source.primary_path;
        let ok = true;
        if (useLegacyProtoMatch && !matchesProtocol(p)) ok = false;
        if (numericMinRTT !== null && p.avg_rtt < numericMinRTT) ok = false;
        if (numericMaxRTT !== null && p.avg_rtt > numericMaxRTT) ok = false;
        if (numericMinUsage !== null && p.percent < numericMinUsage) ok = false;
        if (ok) out.primary_path = p;
      }

      if (selectedPathTypes.includes('ALTERNATIVE')) {
        let sourceAlternatives = Array.isArray(source.alternatives) ? source.alternatives : [];
        if (useLegacyProtoMatch) {
          sourceAlternatives = sourceAlternatives.filter(matchesProtocol);
        }
        if (selectedSet.size !== 1 && groups) {
          const makeSig = pp =>
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

      if (showPrimaryOnly) delete out.alternatives;
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
    selectedProtocols,
    hideTimeouts
  ]);

  return { filteredData };
};