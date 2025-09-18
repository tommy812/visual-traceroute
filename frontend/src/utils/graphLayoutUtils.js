
/**
 * Graph Layout Utilities
 * 
 * Implements hierarchical graph layout algorithms for network visualisation.
 * Uses techniques for edge crossing minimization and node alignment.
 * 
 * References:
 * - Sugiyama, K., Tagawa, S., & Toda, M. (1981). Methods for visual understanding of hierarchical system structures
 * - Eades, P., & Wormald, N. C. (1994). Edge crossings in drawings of bipartite graphs
 */

export function computeAlignedLevels(filteredData) {
  // Build all considered paths as arrays of hop node keys (IPs or your node ids)
  const paths = [];

  Object.entries(filteredData || {}).forEach(([dest, destPaths]) => {
    // primary
    if (destPaths?.includePrimary !== false && destPaths?.primary_path?.path?.length) {
      const hops = destPaths.primary_path.path
        .filter(h => !!h && !h.is_timeout) // keep same criteria as your graph builder
        .map(h => h.ip)
        .filter(Boolean);
      if (hops.length) paths.push(hops);
    }
    // alternatives
    const alts = destPaths?.alternatives || destPaths?.alternative_paths || [];
    alts.forEach(alt => {
      if (!alt?.path?.length) return;
      const hops = alt.path
        .filter(h => !!h && !h.is_timeout)
        .map(h => h.ip)
        .filter(Boolean);
      if (hops.length) paths.push(hops);
    });
  });

  if (paths.length === 0) return new Map();

  const maxDepth = Math.max(...paths.map(p => p.length)); // global max
  // Map<nodeId, level>
  const ipLevelMap = new Map();

  paths.forEach(p => {
    const L = p.length;
    // shift so last hop sits at (maxDepth - 1)
    const shift = maxDepth - L;
    p.forEach((ip, i) => {
      const normalizedLevel = i + shift;
      const prev = ipLevelMap.get(ip);
      if (prev === undefined || normalizedLevel > prev) {
        ipLevelMap.set(ip, normalizedLevel);
      }
    });
  });

  return ipLevelMap; // 0..maxDepth-1, aligned on last hop
}

export function computeDestinationLanes(filteredData) {
  const destinations = Object.keys(filteredData || {});
  
  // If only one destination, use simple ordering
  if (destinations.length <= 1) {
    const laneByDest = new Map(destinations.map((d, i) => [d, i]));
    return { laneByDest, laneCount: destinations.length };
  }
  
  // For multiple destinations, order by network similarity to minimize crossings
  const destinationPaths = destinations.map(dest => {
    const destData = filteredData[dest];
    // Get the primary path or first available path
    const path = destData?.primary_path?.path || destData?.alternatives?.[0]?.path || [];
    return { dest, path };
  });
  
  // Sort destinations by path similarity to minimize crossings
  destinationPaths.sort((a, b) => {
    // Extract all IPs from both paths
    const aIps = a.path.map(h => h?.ip).filter(ip => ip && ip !== 'null');
    const bIps = b.path.map(h => h?.ip).filter(ip => ip && ip !== 'null');
    
    // Calculate similarity score based on common nodes
    const commonIps = aIps.filter(ip => bIps.includes(ip));
    const totalIps = new Set([...aIps, ...bIps]).size;
    const similarityScore = totalIps > 0 ? commonIps.length / totalIps : 0;
    
    // Higher similarity should come first (descending order)
    if (similarityScore !== 0) {
      return -similarityScore; // Negative for descending order
    }
    
    // If no common IPs, compare by first few hops
    for (let i = 0; i < Math.min(3, a.path.length, b.path.length); i++) {
      const aIp = a.path[i]?.ip || '';
      const bIp = b.path[i]?.ip || '';
      if (aIp !== bIp) {
        return aIp.localeCompare(bIp);
      }
    }
    
    // If still tied, sort by destination
    return a.dest.localeCompare(b.dest);
  });
  
  const orderedDestinations = destinationPaths.map(d => d.dest);
  const laneByDest = new Map(orderedDestinations.map((d, i) => [d, i]));
  return { laneByDest, laneCount: destinations.length };
}

// Weighted y-position per IP based on the lanes of destinations that traverse it.
// Returns Map<ip, yIndex> (not pixels; scale later).
export function computeLaneYByIp(filteredData) {
  const { laneByDest } = computeDestinationLanes(filteredData);
  const acc = new Map(); // ip -> { sum, count }
  Object.entries(filteredData || {}).forEach(([dest, destPaths]) => {
    const lane = laneByDest.get(dest) ?? 0;
    const take = (hops) => hops.filter(h => h?.ip && !h.is_timeout).forEach(h => {
      const ip = h.ip;
      const a = acc.get(ip) || { sum: 0, count: 0 };
      a.sum += lane; a.count += 1;
      acc.set(ip, a);
    });
    if (destPaths?.includePrimary !== false && destPaths?.primary_path?.path) take(destPaths.primary_path.path);
    (destPaths?.alternatives || []).forEach(alt => alt?.path && take(alt.path));
  });
  const res = new Map();
  acc.forEach((v, ip) => res.set(ip, v.sum / Math.max(1, v.count)));
  return res;
}

export function enforceMonotonicLevels(levelMap, data) {
  const ips = hops =>
    (Array.isArray(hops) ? hops : [])
      .filter(h => h && !h.is_timeout && h.ip)
      .map(h => h.ip);

  let changed = true, guard = 0;
  while (changed && guard < 6) {
    changed = false; guard += 1;
    Object.values(data || {}).forEach(dp => {
      if (dp?.includePrimary !== false && dp?.primary_path?.path) {
        const seq = ips(dp.primary_path.path);
        for (let i = 0; i < seq.length - 1; i++) {
          const a = seq[i], b = seq[i + 1];
          const la = levelMap.get(a) ?? 0, lb = levelMap.get(b) ?? 0;
          if (lb <= la) { levelMap.set(b, la + 1); changed = true; }
        }
      }
      (Array.isArray(dp?.alternatives) ? dp.alternatives : []).forEach(alt => {
        const seq = ips(alt?.path);
        for (let i = 0; i < seq.length - 1; i++) {
          const a = seq[i], b = seq[i + 1];
          const la = levelMap.get(a) ?? 0, lb = levelMap.get(b) ?? 0;
          if (lb <= la) { levelMap.set(b, la + 1); changed = true; }
        }
      });
    });
  }
  return levelMap;
}

export function lastRealHopIndex(hops) {
  if (!Array.isArray(hops)) return -1;
  for (let i = hops.length - 1; i >= 0; i--) {
    const h = hops[i];
    if (h && !h.is_timeout && h.ip) return i;
  }
  return -1;
}