export function minimizeCrossings({ ipLevelMap, ipToHopDetails, filteredData, expandedPrefixes }) {
  // Group IPs by level (skip falsy keys)
  const levelGroups = new Map();
  if (ipLevelMap && typeof ipLevelMap.forEach === 'function') {
    ipLevelMap.forEach((level, ip) => {
      if (!ip) return;
      if (!levelGroups.has(level)) levelGroups.set(level, []);
      levelGroups.get(level).push(ip);
    });
  }

  const optimizedPositions = new Map();

  const levels = Array.from(levelGroups.keys());
  if (levels.length === 0) return optimizedPositions;

  const maxLevel = Math.max(...levels);

  // Destination ordering anchor (stable)
  const destinations = Object.keys(filteredData || {}).sort();
  destinations.forEach((dest, index) => {
    optimizedPositions.set(`dest:${dest}`, index);
  });

  // Helper: does ip directly connect to nextIp in any path within destPaths?
  const connectsInPaths = (destPaths, ip, nextIp) => {
    if (!destPaths) return false;
    const checkSeq = (hops) => {
      if (!Array.isArray(hops)) return false;
      const idxA = hops.findIndex(h => h && !h.is_timeout && h.ip === ip);
      if (idxA < 0) return false;
      // Only a direct next-hop counts
      const idxB = hops.findIndex((h, i) => i === idxA + 1 && h && !h.is_timeout && h.ip === nextIp);
      return idxB === idxA + 1;
    };

    // primary
    if (destPaths.includePrimary !== false && destPaths.primary_path && destPaths.primary_path.path) {
      if (checkSeq(destPaths.primary_path.path)) return true;
    }
    // alternatives
    const alts = Array.isArray(destPaths.alternatives) ? destPaths.alternatives : [];
    for (const alt of alts) {
      if (checkSeq(alt?.path)) return true;
    }
    return false;
  };

  // Process levels from bottom to top to get consistent ordering
  for (let level = maxLevel; level >= 1; level--) {
    const currentIPs = levelGroups.get(level) || [];
    if (currentIPs.length === 0) continue;

    const nextLevelIPs = levelGroups.get(level + 1) || [];

    const ipWithScores = currentIPs.map(ip => {
      const hopDetails = ipToHopDetails?.get(ip) || []; // GUARD
      let totalScore = 0;
      let count = 0;

      if (level === maxLevel) {
        // Near destinations: place by destination order that uses this IP
        destinations.forEach((dest, destIdx) => {
          // If any hop detail matches this destination, consider it used
          const usedByDest = Array.isArray(hopDetails) && hopDetails.some(h => h?.destination === dest);
          if (usedByDest) {
            totalScore += destIdx;
            count += 1;
          }
        });
      } else if (nextLevelIPs.length > 0) {
        // Pull toward average position of connected next-level IPs
        nextLevelIPs.forEach(nextIp => {
          // Check connection by reading paths in filteredData
          let connects = false;
          // Quick path: if both IPs appear in same destination’s paths adjacently
          for (const dest of destinations) {
            if (connectsInPaths(filteredData?.[dest], ip, nextIp)) {
              connects = true;
              break;
            }
          }
          if (connects) {
            const nextPos = optimizedPositions.get(`ip:${nextIp}`);
            // If nextPos not yet set, treat as 0 to avoid NaN
            totalScore += typeof nextPos === 'number' ? nextPos : 0;
            count += 1;
          }
        });
      }

      // Fallback: center within the group
      const averagePosition = count > 0 ? totalScore / count : currentIPs.length / 2;

      return { ip, averagePosition };
    });

    ipWithScores.sort((a, b) => a.averagePosition - b.averagePosition);

    // Assign compacted, stable positions within this level
    ipWithScores.forEach((item, idx) => {
      optimizedPositions.set(`ip:${item.ip}`, idx);
    });
  }

  return optimizedPositions;
}