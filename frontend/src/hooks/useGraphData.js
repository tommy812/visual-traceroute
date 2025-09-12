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

    // Helpers
    const parseNum = (v) => (v === '' || v === null || v === undefined ? null : parseFloat(v));
    const hasTimeout = (p) => Array.isArray(p?.path) && p.path.some(h => h?.is_timeout);
    const normalize = v => (typeof v === 'string' ? v.trim().toUpperCase() : null);

    const numericMinRTT = parseNum(minRTT);
    const numericMaxRTT = parseNum(maxRTT);
    const numericMinUsage = parseNum(minUsagePercent);

    const selectedProtoSet = new Set(
      (Array.isArray(selectedProtocols) ? selectedProtocols : [])
        .map(normalize)
        .filter(Boolean)
    );

    const matchesProtocol = (p) => {
      if (selectedProtoSet.size === 0) return true;
      if (!p) return false;
      const pathProto = normalize(p.protocol);
      if (pathProto && selectedProtoSet.has(pathProto)) return true;
      const hops = Array.isArray(p.path) ? p.path : (Array.isArray(p.hops) ? p.hops : []);
      return hops.some(h => {
        const hp = normalize(h?.protocol);
        return hp && selectedProtoSet.has(hp);
      });
    };

    // For each destination, collect ALL candidate paths, then filter, then compute primary dynamically
    const result = {};

    Object.entries(pathData).forEach(([destination, destObj]) => {
      if (!destObj || typeof destObj !== 'object') return;

      // 1) Collect candidates: primary, fastest, shortest, alternatives, and from protocol_groups
      const candidates = [];

      const pushIf = (p, sourceTag) => {
        if (!p || !Array.isArray(p.path)) return;
        candidates.push({ ...p, _source: sourceTag });
      };

      pushIf(destObj.primary_path, 'primary');
      pushIf(destObj.fastest_path, 'fastest');
      pushIf(destObj.shortest_path, 'shortest');
      if (Array.isArray(destObj.alternatives)) destObj.alternatives.forEach((a, i) => pushIf(a, `alt:${i}`));

      if (destObj.protocol_groups && typeof destObj.protocol_groups === 'object') {
        Object.entries(destObj.protocol_groups).forEach(([protoName, grp]) => {
          if (!grp || typeof grp !== 'object') return;
          pushIf(grp.primary_path, `grp:${protoName}:primary`);
          pushIf(grp.fastest_path, `grp:${protoName}:fastest`);
          pushIf(grp.shortest_path, `grp:${protoName}:shortest`);
          if (Array.isArray(grp.alternatives)) grp.alternatives.forEach((a, i) => pushIf(a, `grp:${protoName}:alt:${i}`));
        });
      }

      // 2) Apply user filters (timeouts, protocol, RTT, usage) — keep duplicates
      let filteredCandidates = candidates.filter(p => {
        if (hideTimeouts && hasTimeout(p)) return false;
        if (!matchesProtocol(p)) return false;
        if (numericMinRTT !== null && typeof p.avg_rtt === 'number' && p.avg_rtt < numericMinRTT) return false;
        if (numericMaxRTT !== null && typeof p.avg_rtt === 'number' && p.avg_rtt > numericMaxRTT) return false;
        if (numericMinUsage !== null && typeof p.percent === 'number' && p.percent < numericMinUsage) return false;
        return true;
      });

      if (filteredCandidates.length === 0) return; // nothing to show for this destination

      // 3) Compute dynamic primary from remaining candidates
      const primary = filteredCandidates.reduce((best, p) => {
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

      // 4) Expand paths by their count so each trace is drawn (when filters allow)
      let instanceCounter = 1;
      const dupCount = (p) => {
        const c = (typeof p?.count === 'number' && p.count > 0) ? Math.floor(p.count) : 1;
        return Math.max(1, c);
      };
      const expand = (p, n) => Array.from({ length: n }, () => ({ ...p, _instanceId: String(instanceCounter++) }));

      // 5) Split into primary vs alternatives based on user selection
      const wantPrimary = selectedPathTypes.includes('PRIMARY') || showPrimaryOnly;
      const wantAlternative = selectedPathTypes.includes('ALTERNATIVE') && !showPrimaryOnly;
      const out = {};

      if (wantPrimary && primary) out.primary_path = primary;

      if (wantAlternative) {
        const altInstances = [];
        // Non-primary candidates: include full count
        filteredCandidates.forEach(p => {
          if (p === primary) return;
          altInstances.push(...expand(p, dupCount(p)));
        });
        // Primary: include remaining duplicates (all if PRIMARY not selected; count-1 if PRIMARY is selected)
        if (primary) {
          const pc = dupCount(primary);
          const extra = wantPrimary ? (pc - 1) : pc;
          if (extra > 0) altInstances.push(...expand(primary, extra));
        }
        if (altInstances.length) out.alternatives = altInstances;
      }

      if (out.primary_path || (out.alternatives && out.alternatives.length)) {
        out.total_traces = destObj.total_traces ?? null;
        result[destination] = out;
      }
    });

    return result;
  }, [pathData, minRTT, maxRTT, minUsagePercent, selectedPathTypes, showPrimaryOnly, selectedProtocols, hideTimeouts]);

  return { filteredData };
};