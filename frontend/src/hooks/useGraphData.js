import { useMemo } from 'react';

export const useGraphData = (pathData, filters) => {
  const {
    minRTT,
    maxRTT,
    minUsagePercent,
    selectedPathTypes,
    showPrimaryOnly,
    selectedProtocols,
  hideTimeouts,
  showReachedOnly
  } = filters;

  const filteredData = useMemo(() => {
    if (!pathData || Object.keys(pathData).length === 0) return {};

    // Helpers
    const parseNum = (v) => (v === '' || v === null || v === undefined ? null : parseFloat(v));
    // Only hide paths that end in a timeout (last hop is timed out)
    const endsWithTimeout = (p) => {
      const hops = Array.isArray(p?.path) ? p.path : [];
      if (hops.length === 0) return false;
      const last = hops[hops.length - 1];
      return !!(last && last.is_timeout);
    };
  // Define success leniently: a path is successful if its last hop is not a timeout
  const isSuccessful = (p) => !endsWithTimeout(p);
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

      // 2) Apply user filters (timeouts, protocol, RTT, usage)
      let filteredCandidates = candidates.filter(p => {
        if (hideTimeouts && endsWithTimeout(p)) return false;
  if (showReachedOnly && !isSuccessful(p)) return false;
        if (!matchesProtocol(p)) return false;
        if (numericMinRTT !== null && typeof p.avg_rtt === 'number' && p.avg_rtt < numericMinRTT) return false;
        if (numericMaxRTT !== null && typeof p.avg_rtt === 'number' && p.avg_rtt > numericMaxRTT) return false;
        if (numericMinUsage !== null && typeof p.percent === 'number' && p.percent < numericMinUsage) return false;
        return true;
      });

      // 2.5) Deduplicate by (protocol + hour bucket + path signature)
      const protocolOf = (p) => {
        const pp = normalize(p?.protocol);
        if (pp) return pp;
        const hops = Array.isArray(p?.path) ? p.path : [];
        for (const h of hops) {
          const hp = normalize(h?.protocol);
          if (hp) return hp;
        }
        return 'UNKNOWN';
      };
      const signatureOf = (p) => {
        const hops = Array.isArray(p?.path) ? p.path : [];
        return hops.map(h => (h && !h.is_timeout && h.ip) ? h.ip : 'timeout').join('>');
      };
      const parseHourBucket = (ts) => {
        if (!ts) return 'unknown';
        // Try Date parse
        const d = new Date(ts);
        if (!isNaN(d.getTime())) {
          const y = d.getUTCFullYear();
          const m = String(d.getUTCMonth() + 1).padStart(2, '0');
          const day = String(d.getUTCDate()).padStart(2, '0');
          const h = String(d.getUTCHours()).padStart(2, '0');
          return `${y}-${m}-${day}T${h}Z`;
        }
        // Fallback for formats like DD/MM/YYYY, HH:MM:SS
        const m2 = String(ts).match(/^(\d{2})\/(\d{2})\/(\d{4}),\s*(\d{2}):(\d{2}):(\d{2})/);
        if (m2) {
          const dd = m2[1], mm = m2[2], yyyy = m2[3], HH = m2[4];
          return `${yyyy}-${mm}-${dd}T${HH}`; // naive local hour bucket
        }
        // Last resort: trim to hour if present
        return String(ts).slice(0, 13);
      };
      const hourBucketOf = (p) => {
        // Prefer earliest timestamp in the list (sorted) to ensure deterministic bucketing
        if (Array.isArray(p?.timestamps) && p.timestamps.length) {
          let best = null;
          for (const t of p.timestamps) {
            const d = new Date(t);
            if (isNaN(d.getTime())) continue;
            if (!best || d < best) best = d;
          }
          if (best) {
            // floor to hour UTC
            const y = best.getUTCFullYear();
            const m = String(best.getUTCMonth() + 1).padStart(2, '0');
            const day = String(best.getUTCDate()).padStart(2, '0');
            const h = String(best.getUTCHours()).padStart(2, '0');
            return `${y}-${m}-${day}T${h}Z`;
          }
          // Fallback: parse first entry leniently
          return parseHourBucket(p.timestamps[0]);
        }
        const ts = p?.timeStamp || p?.timestamp || null;
        return parseHourBucket(ts);
      };
      const isBetter = (a, b) => {
        if (!a) return true;
        const ap = a?.percent ?? -1, bp = b?.percent ?? -1;
        if (bp !== ap) return bp > ap;
        const ac = a?.count ?? -1, bc = b?.count ?? -1;
        if (bc !== ac) return bc > ac;
        const ar = a?.avg_rtt ?? Number.POSITIVE_INFINITY, br = b?.avg_rtt ?? Number.POSITIVE_INFINITY;
        if (br !== ar) return br < ar;
        // Prefer primary source as a final tiebreaker
        const as = a?._source || '', bs = b?._source || '';
        const apref = as.includes('primary') ? 1 : 0;
        const bpref = bs.includes('primary') ? 1 : 0;
        return bpref > apref;
      };
      const dedup = new Map();
      for (const p of filteredCandidates) {
        const key = `${protocolOf(p)}|${hourBucketOf(p)}|${signatureOf(p)}`;
        const existing = dedup.get(key);
        if (!existing || isBetter(existing, p)) dedup.set(key, p);
      }
      filteredCandidates = Array.from(dedup.values());

  if (filteredCandidates.length === 0) return; // nothing to show for this destination

  // 4) Do not expand by count; render one visual path per logical candidate
  let instanceCounter = 1;
  const tagSingle = (p) => ({ ...p, _instanceId: String(instanceCounter++) });

      // 3) Compute dynamic primary from de-duplicated candidates
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

      // 5) Split into primary vs alternatives based on user selection
      const wantPrimary = selectedPathTypes.includes('PRIMARY') || showPrimaryOnly;
      const wantAlternative = selectedPathTypes.includes('ALTERNATIVE') && !showPrimaryOnly;
      const out = {};

      if (wantPrimary && primary) out.primary_path = primary;

      if (wantAlternative) {
        const altInstances = [];
        // Exclude primary by key to avoid reference mismatch
        const keyOf = (p) => `${protocolOf(p)}|${hourBucketOf(p)}|${signatureOf(p)}`;
        const primaryKey = primary ? keyOf(primary) : null;
        filteredCandidates.forEach(p => {
          if (primaryKey && keyOf(p) === primaryKey) return;
          altInstances.push(tagSingle(p));
        });
        if (altInstances.length) out.alternatives = altInstances;
      }

      if (out.primary_path || (out.alternatives && out.alternatives.length)) {
        out.total_traces = destObj.total_traces ?? null;
        result[destination] = out;
      }
    });

    return result;
  }, [pathData, minRTT, maxRTT, minUsagePercent, selectedPathTypes, showPrimaryOnly, selectedProtocols, hideTimeouts, showReachedOnly]);

  return { filteredData };
};