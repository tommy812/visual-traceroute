/**
 * Responsible for analyzing network paths and identifying relationships
 * Single Responsibility: Path analysis and classification
 */
export class PathAnalyzer {
  identifyPrimaryAndAlternatives(paths) {
    if (!paths || paths.length === 0) {
      return { primary: [], alternatives: [] };
    }

    // Sort paths by hop count (shorter paths are typically more direct/primary)
    const sortedPaths = [...paths].sort((a, b) => {
      const aHopCount = a.hops ? a.hops.length : 0;
      const bHopCount = b.hops ? b.hops.length : 0;
      return aHopCount - bHopCount;
    });

    // The shortest path is considered primary
    const primary = [sortedPaths[0]];
    const alternatives = sortedPaths.slice(1);

    return { primary, alternatives };
  }

  calculatePathAverageRtt(path) {
    if (!path.hops || path.hops.length === 0) {
      return null;
    }

    const validRtts = path.hops
      .filter(hop => hop.rtt_ms && hop.rtt_ms > 0)
      .map(hop => hop.rtt_ms);

    if (validRtts.length === 0) {
      return null;
    }

    return validRtts.reduce((sum, rtt) => sum + rtt, 0) / validRtts.length;
  }

  getPathSignature(path) {
    if (!path.hops) {
      return '';
    }
    
    // Create a signature based on IP addresses (excluding timeouts)
    return path.hops
      .filter(hop => hop.ip_address && !hop.is_timeout)
      .map(hop => hop.ip_address)
      .join('->');
  }

  findCommonPrefix(paths) {
    if (!paths || paths.length === 0) {
      return [];
    }

    if (paths.length === 1) {
      return paths[0].hops || [];
    }

    const shortestPath = paths.reduce((shortest, current) => {
      return (current.hops?.length || 0) < (shortest.hops?.length || 0) ? current : shortest;
    });

    if (!shortestPath.hops) {
      return [];
    }

    const commonHops = [];
    
    for (let i = 0; i < shortestPath.hops.length; i++) {
      const hop = shortestPath.hops[i];
      const isCommon = paths.every(path => 
        path.hops && 
        path.hops[i] && 
        path.hops[i].ip_address === hop.ip_address
      );
      
      if (isCommon) {
        commonHops.push(hop);
      } else {
        break;
      }
    }

    return commonHops;
  }
}

const pathAnalyzerInstance = new PathAnalyzer();
export default pathAnalyzerInstance;
