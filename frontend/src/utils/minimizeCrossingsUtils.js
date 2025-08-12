export function minimizeCrossings({ ipLevelMap, ipToHopDetails, filteredData, expandedPrefixes }) {
  // Group nodes by level
  const levelGroups = new Map();
  ipLevelMap.forEach((level, ip) => {
    if (!levelGroups.has(level)) levelGroups.set(level, []);
    levelGroups.get(level).push(ip);
  });

  const optimizedPositions = new Map();
  const maxLevel = Math.max(...Array.from(ipLevelMap.values()));
  const destinations = Object.keys(filteredData).sort();

  destinations.forEach((dest, index) => {
    optimizedPositions.set(`dest:${dest}`, index);
  });

  for (let level = maxLevel; level >= 1; level--) {
    const currentLevelIPs = levelGroups.get(level) || [];
    if (currentLevelIPs.length === 0) continue;

    const ipWithPositions = currentLevelIPs.map(ip => {
      const hopDetails = ipToHopDetails.get(ip);
      let totalScore = 0;
      let connectionCount = 0;

      if (level === maxLevel) {
        destinations.forEach((dest, destIndex) => {
          const connectsToDestination = hopDetails.some(detail => detail.destination === dest);
          if (connectsToDestination) { totalScore += destIndex; connectionCount += 1; }
        });
      } else {
        const nextLevelIPs = levelGroups.get(level + 1) || [];
        nextLevelIPs.forEach(nextIP => {
          const connects = hopDetails.some(detail => {
            const destPaths = filteredData[detail.destination];
            if (destPaths.includePrimary !== false) {
              const pathHops = destPaths.primary_path.path;
              const currentIndex = pathHops.findIndex(hop => hop.ip === ip);
              const nextIndex = pathHops.findIndex(hop => hop.ip === nextIP);
              if (currentIndex >= 0 && nextIndex === currentIndex + 1) return true;
            }
            return (destPaths.alternatives || []).some(altPath => {
              const pathHops = altPath.path;
              const currentIndex = pathHops.findIndex(hop => hop.ip === ip);
              const nextIndex = pathHops.findIndex(hop => hop.ip === nextIP);
              return currentIndex >= 0 && nextIndex === currentIndex + 1;
            });
          });

          if (connects) {
            const nextIPPosition = optimizedPositions.get(`ip:${nextIP}`) || 0;
            totalScore += nextIPPosition;
            connectionCount += 1;
          }
        });
      }

      return {
        ip,
        averagePosition: connectionCount > 0 ? totalScore / connectionCount : currentLevelIPs.length / 2,
        connectionCount
      };
    });

    ipWithPositions.sort((a, b) => a.averagePosition - b.averagePosition);
    ipWithPositions.forEach((item, index) => optimizedPositions.set(`ip:${item.ip}`, index));
  }

  return optimizedPositions;
}