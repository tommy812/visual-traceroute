import { useMemo } from 'react';

export const useGraphData = (pathData, filters) => {
  const {
    minRTT,
    maxRTT,
    minUsagePercent,
    selectedPathTypes,
    showPrimaryOnly,
    selectedProtocols,
  hideReachedOnly,
  showReachedOnly,
  dateRange
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
      if (!destObj || typeof destObj !== 'object') {
        return;
      }
      const isPerRun = destObj.per_run === true;

      // 1) Collect candidates: primary, fastest, shortest, alternatives, and from protocol_groups
      const candidates = [];

      const pushIf = (p, sourceTag) => {
        if (!p) {
          return;
        }
        
        // Handle both raw data (path) and aggregated data (hops)
        const pathArray = Array.isArray(p.path) ? p.path : (Array.isArray(p.hops) ? p.hops : null);
        if (!pathArray) {
          return;
        }
        
        // Normalize the structure - ensure aggregated data has 'path' field for compatibility
        // Add fallback values for missing fields in aggregated data
        // Use a timestamp within the current date range for aggregated data
        const getFallbackTimestamp = () => {
          if (dateRange?.start && dateRange?.end) {
            // Use the middle of the date range for aggregated data
            const startMs = dateRange.start.getTime();
            const endMs = dateRange.end.getTime();
            const middleMs = startMs + (endMs - startMs) / 2;
            return new Date(middleMs).toISOString();
          }
          return new Date().toISOString();
        };
        
        const normalizedPath = {
          ...p,
          path: pathArray,
          _source: sourceTag,
          timeStamp: p.timeStamp || p.timestamp || getFallbackTimestamp(), // Fallback timestamp within date range
          percent: p.percent !== null && p.percent !== undefined ? p.percent : 50, // Fallback percent
          avg_rtt: p.avg_rtt !== null && p.avg_rtt !== undefined ? p.avg_rtt : 100 // Fallback RTT
        };
        
        candidates.push(normalizedPath);
      };

      pushIf(destObj.primary_path, 'primary');
      pushIf(destObj.fastest_path, 'fastest');
      pushIf(destObj.shortest_path, 'shortest');
      if (Array.isArray(destObj.alternatives)) destObj.alternatives.forEach((a, i) => pushIf(a, `alt:${i}`));

      // When viewing per-run data, protocol_groups mirrors the same runs and would
      // double-count candidates. Skip adding from protocol_groups in that case.
      if (!isPerRun && destObj.protocol_groups && typeof destObj.protocol_groups === 'object') {
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
        if (hideReachedOnly && isSuccessful(p)) {
          return false;
        }
        if (showReachedOnly && !isSuccessful(p)) {
          return false;
        }
        if (!matchesProtocol(p)) {
          return false;
        }
        if (numericMinRTT !== null && typeof p.avg_rtt === 'number' && p.avg_rtt < numericMinRTT) {
          return false;
        }
        if (numericMaxRTT !== null && typeof p.avg_rtt === 'number' && p.avg_rtt > numericMaxRTT) {
          return false;
        }
        if (numericMinUsage !== null && typeof p.percent === 'number' && p.percent < numericMinUsage) {
          return false;
        }
        return true;
      });
      

  // 2.4) Per-run dedup: the same run can appear twice (direct alternative + protocol_groups)
  // Use (run_id + timestamp) to ensure a single visual candidate per run
  if (isPerRun) {
      const byRun = new Map();
      for (const p of filteredCandidates) {
        const key = `${p?.run_id ?? ''}|${p?.timeStamp ?? ''}`;
        if (!byRun.has(key)) byRun.set(key, p);
      }
      filteredCandidates = Array.from(byRun.values());
  }

  // 2.5) Aggregated-data dedup: by (protocol + hour bucket + path signature)
  if (!isPerRun) {
      
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
  }

  if (filteredCandidates.length === 0) {
    return; // nothing to show for this destination
  }

  // 4) Do not expand by count; render one visual path per logical candidate
  let instanceCounter = 1;
  const tagSingle = (p) => ({ ...p, _instanceId: String(instanceCounter++) });

      // 3) Compute candidate selectors on the frontend so they reflect current filters
      const safeAvg = (p) => (typeof p?.avg_rtt === 'number' ? p.avg_rtt : Number.POSITIVE_INFINITY);
      const safePercent = (p) => (typeof p?.percent === 'number' ? p.percent : (typeof p?.count === 'number' ? p.count : 0));
      const hopCount = (p) => (Array.isArray(p?.path) ? p.path.length : (p?.hop_count ?? Infinity));

      const mostUsed = filteredCandidates.reduce((best, p) => {
        if (!best) return p;
        const bp = safePercent(best), pp = safePercent(p);
        if (pp !== bp) return pp > bp ? p : best;
        const bc = best?.count ?? -1, pc = p?.count ?? -1;
        if (pc !== bc) return pc > bc ? p : best;
        return safeAvg(p) < safeAvg(best) ? p : best;
      }, null);

      const fastest = filteredCandidates.reduce((best, p) => {
        if (!best) return p;
        const ba = safeAvg(best), pa = safeAvg(p);
        if (pa !== ba) return pa < ba ? p : best;
        return safePercent(p) > safePercent(best) ? p : best;
      }, null);

      const shortest = filteredCandidates.reduce((best, p) => {
        if (!best) return p;
        const bl = hopCount(best), pl = hopCount(p);
        if (pl !== bl) return pl < bl ? p : best;
        return safeAvg(p) < safeAvg(best) ? p : best;
      }, null);

      // Helper to create stable keys for candidates (used for de-dup / equality)
      const keyOf = (p) => {
        if (isPerRun) return `${p?.run_id ?? ''}|${p?.timeStamp ?? ''}`;
        const protocolOf = (p2) => {
          const pp = normalize(p2?.protocol);
          if (pp) return pp;
          const hops = Array.isArray(p2?.path) ? p2.path : [];
          for (const h of hops) {
            const hp = normalize(h?.protocol);
            if (hp) return hp;
          }
          return 'UNKNOWN';
        };
        const signatureOf = (p2) => {
          const hops = Array.isArray(p2?.path) ? p2.path : [];
          return hops.map(h => (h && !h.is_timeout && h.ip) ? h.ip : 'timeout').join('>');
        };
        const hourBucketOf = (p2) => {
          if (Array.isArray(p2?.timestamps) && p2.timestamps.length) {
            let best = null;
            for (const t of p2.timestamps) {
              const d = new Date(t);
              if (isNaN(d.getTime())) continue;
              if (!best || d < best) best = d;
            }
            if (best) {
              const y = best.getUTCFullYear();
              const m = String(best.getUTCMonth() + 1).padStart(2, '0');
              const day = String(best.getUTCDate()).padStart(2, '0');
              const h = String(best.getUTCHours()).padStart(2, '0');
              return `${y}-${m}-${day}T${h}Z`;
            }
            return String(p2.timestamps[0]).slice(0, 13);
          }
          const ts = p2?.timeStamp || p2?.timestamp || null;
          const d = new Date(ts);
          if (!isNaN(d.getTime())) {
            const y = d.getUTCFullYear();
            const m = String(d.getUTCMonth() + 1).padStart(2, '0');
            const day = String(d.getUTCDate()).padStart(2, '0');
            const h = String(d.getUTCHours()).padStart(2, '0');
            return `${y}-${m}-${day}T${h}Z`;
          }
          return String(ts).slice(0, 13);
        };
        return `${protocolOf(p)}|${hourBucketOf(p)}|${signatureOf(p)}`;
      };

      // Map user selection to desired candidates. Handle both legacy and new selectors:
      // Legacy: PRIMARY, ALTERNATIVE
      // New: MOST_USED, LEAST_USED, FASTEST, SLOWEST, FEWEST_HOPS, MOST_HOPS, ALTERNATIVE
      const wantMostUsed = selectedPathTypes.includes('MOST_USED') || selectedPathTypes.includes('PRIMARY') || showPrimaryOnly;
      const wantLeastUsed = selectedPathTypes.includes('LEAST_USED');
      const wantFastest = selectedPathTypes.includes('FASTEST');
      const wantSlowest = selectedPathTypes.includes('SLOWEST');
      const wantFewest = selectedPathTypes.includes('FEWEST_HOPS');
      const wantMostHops = selectedPathTypes.includes('MOST_HOPS');
      const wantAlternative = selectedPathTypes.includes('ALTERNATIVE');

      const out = {};

      // If no path-type options are selected, show all filteredCandidates as alternatives (no single primary)
      if (!selectedPathTypes || selectedPathTypes.length === 0) {
        out.alternatives = filteredCandidates.map(tagSingle);
      } else {
        // Collect requested candidate(s). Some selectors produce single candidates (e.g. MOST_USED),
        // include them (deduped) as primary if exactly one selector requested, otherwise place them in alternatives.
        const requested = [];
        if (wantMostUsed && mostUsed) requested.push(mostUsed);
        if (wantLeastUsed && mostUsed) {
          // least used: pick the candidate with smallest percent/count
          const least = filteredCandidates.reduce((best, p) => {
            if (!best) return p;
            const bp = safePercent(best), pp = safePercent(p);
            if (pp !== bp) return pp < bp ? p : best;
            const bc = best?.count ?? -1, pc = p?.count ?? -1;
            return pc < bc ? p : best;
          }, null);
          if (least) requested.push(least);
        }
        if (wantFastest && fastest) requested.push(fastest);
        if (wantSlowest && fastest) {
          // slowest: max avg_rtt
          const slow = filteredCandidates.reduce((best, p) => {
            if (!best) return p;
            return safeAvg(p) > safeAvg(best) ? p : best;
          }, null);
          if (slow) requested.push(slow);
        }
        if (wantFewest && shortest) requested.push(shortest);
        if (wantMostHops && shortest) {
          const mosth = filteredCandidates.reduce((best, p) => {
            if (!best) return p;
            return hopCount(p) > hopCount(best) ? p : best;
          }, null);
          if (mosth) requested.push(mosth);
        }

        // Deduplicate requested candidates and decide primary vs alternatives.
        const includedKeys = new Set();
        const altInstances = [];
        const keys = requested.map(keyOf).filter(Boolean);
        // If exactly one unique requested candidate, make it the primary. Otherwise all requested go into alternatives.
        const uniqueRequested = requested.filter((r, i) => keys.indexOf(keyOf(r)) === i);
        if (uniqueRequested.length === 1) {
          out.primary_path = tagSingle(uniqueRequested[0]);
          includedKeys.add(keyOf(uniqueRequested[0]));
        } else {
          uniqueRequested.forEach(r => { includedKeys.add(keyOf(r)); altInstances.push(tagSingle(r)); });
        }

        // If ALTERNATIVE box checked, include all remaining filteredCandidates not yet included
        if (wantAlternative) {
          filteredCandidates.forEach(p => {
            const k = keyOf(p);
            if (!k || includedKeys.has(k)) return;
            includedKeys.add(k);
            altInstances.push(tagSingle(p));
          });
        }

        if (altInstances.length) out.alternatives = altInstances;
      }

      
      if (out.primary_path || (out.alternatives && out.alternatives.length)) {
        out.total_traces = destObj.total_traces ?? null;
        out.destination_id = destObj.destination_id; // Preserve destination_id in the result
        result[destination] = out;
      }
    });

    return result;
  }, [pathData, minRTT, maxRTT, minUsagePercent, selectedPathTypes, showPrimaryOnly, selectedProtocols, hideReachedOnly, showReachedOnly, dateRange.start, dateRange.end]);

  return { filteredData };
};