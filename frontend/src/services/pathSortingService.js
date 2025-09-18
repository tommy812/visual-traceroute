import graphOptimizationService from './graphOptimizationService';

/**
 * PathSortingService
 * 
 * Coordinates path sorting using various strategies. Integrates with GraphOptimizationService
 * for advanced algorithms while providing simple sorting methods for basic cases.
 */

class PathSortingService {
  constructor(optimizationService = graphOptimizationService) {
    this.optimizationService = optimizationService;
  }
  sortByHopCount(paths) {
    if (!Array.isArray(paths) || paths.length === 0) {
      return [];
    }

    return [...paths].sort((a, b) => {
      const aHopCount = this.getPathHopCount(a);
      const bHopCount = this.getPathHopCount(b);
      return aHopCount - bHopCount;
    });
  }

  // Multi-criteria sorting: hop count, RTT, success rate
  sortByDisplayOptimization(paths) {
    if (!Array.isArray(paths) || paths.length === 0) {
      return [];
    }

    return [...paths].sort((a, b) => {
      // Primary: Sort by hop count
      const aHopCount = this.getPathHopCount(a);
      const bHopCount = this.getPathHopCount(b);
      if (aHopCount !== bHopCount) {
        return aHopCount - bHopCount;
      }

      // Secondary: Sort by success (destination reached)
      const aSuccess = this.pathReachesDestination(a);
      const bSuccess = this.pathReachesDestination(b);
      if (aSuccess !== bSuccess) {
        return bSuccess ? 1 : -1; // Successful paths first
      }

      // Tertiary: Sort by average RTT
      const aRtt = this.getPathAverageRtt(a);
      const bRtt = this.getPathAverageRtt(b);
      if (aRtt !== null && bRtt !== null) {
        return aRtt - bRtt;
      }

      // Quaternary: Sort by path completeness (fewer timeouts)
      const aTimeouts = this.getPathTimeoutCount(a);
      const bTimeouts = this.getPathTimeoutCount(b);
      return aTimeouts - bTimeouts;
    });
  }

  // Sorts by protocol preference (TCP, ICMP, UDP, etc.)
  sortByProtocolPriority(paths, protocolPriority = ['TCP', 'ICMP', 'UDP']) {
    if (!Array.isArray(paths) || paths.length === 0) {
      return [];
    }

    return [...paths].sort((a, b) => {
      const aProtocol = this.normalizeProtocol(a.protocol);
      const bProtocol = this.normalizeProtocol(b.protocol);

      const aPriority = protocolPriority.indexOf(aProtocol);
      const bPriority = protocolPriority.indexOf(bProtocol);

      // If both protocols are in priority list, sort by priority order
      if (aPriority !== -1 && bPriority !== -1) {
        return aPriority - bPriority;
      }

      // If only one is in priority list, prioritize it
      if (aPriority !== -1) return -1;
      if (bPriority !== -1) return 1;

      // If neither is in priority list, sort alphabetically
      return aProtocol.localeCompare(bProtocol);
    });
  }

  /**
   * Get the hop count for a path
   * @param {Object} path - Path object
   * @returns {number} Number of hops
   */
  getPathHopCount(path) {
    if (!path) return 0;
    
    // Handle different path formats
    if (path.hops && Array.isArray(path.hops)) {
      return path.hops.length;
    }
    
    if (path.path && Array.isArray(path.path)) {
      return path.path.length;
    }

    return 0;
  }

  /**
   * Check if a path reaches its destination
   * @param {Object} path - Path object
   * @returns {boolean} True if path reaches destination
   */
  pathReachesDestination(path) {
    if (!path) return false;

    const hops = path.hops || path.path || [];
    if (hops.length === 0) return false;

    // Check if the last hop is not a timeout
    const lastHop = hops[hops.length - 1];
    return lastHop && !lastHop.is_timeout && lastHop.ip;
  }

  /**
   * Get the average RTT for a path
   * @param {Object} path - Path object
   * @returns {number|null} Average RTT in milliseconds, or null if unavailable
   */
  getPathAverageRtt(path) {
    if (!path) return null;

    // Use pre-calculated average if available
    if (path.avg_rtt_ms != null) {
      return Number(path.avg_rtt_ms);
    }

    if (path.avg_rtt != null) {
      return Number(path.avg_rtt);
    }

    // Calculate from hop data
    const hops = path.hops || path.path || [];
    const validRtts = hops
      .filter(hop => hop && hop.rtt_ms != null && !hop.is_timeout)
      .map(hop => Number(hop.rtt_ms))
      .filter(rtt => !isNaN(rtt) && rtt > 0);

    if (validRtts.length === 0) return null;

    return validRtts.reduce((sum, rtt) => sum + rtt, 0) / validRtts.length;
  }

  /**
   * Get the number of timeout hops in a path
   * @param {Object} path - Path object
   * @returns {number} Number of timeout hops
   */
  getPathTimeoutCount(path) {
    if (!path) return 0;

    const hops = path.hops || path.path || [];
    return hops.filter(hop => hop && hop.is_timeout).length;
  }

  /**
   * Normalize protocol name for comparison
   * @param {string} protocol - Protocol name
   * @returns {string} Normalized protocol name
   */
  normalizeProtocol(protocol) {
    if (!protocol || typeof protocol !== 'string') return 'UNKNOWN';
    
    const normalized = protocol.trim().toUpperCase();
    
    // Handle common protocol variations
    if (normalized.includes('TCP')) return 'TCP';
    if (normalized.includes('ICMP')) return 'ICMP';
    if (normalized.includes('UDP')) return 'UDP';
    if (normalized.includes('CLASSIC')) return 'CLASSIC';
    
    return normalized;
  }

  // Main sorting method that adapts to graph configuration
  sortForGraphDisplay(paths, options = {}) {
    const {
      primarySort = 'advanced',
      protocolPriority = ['TCP', 'ICMP', 'UDP', 'CLASSIC'],
      preserveProtocolGroups = false,
      // Graph configuration for advanced sorting
      aggregationMode = 'none',
      aggregationScope = 'per-destination',
      networkHierarchy = 'none',
      showPrimaryOnly = false,
      destinationCount = 1
    } = options;

    if (!Array.isArray(paths) || paths.length === 0) {
      return [];
    }

    let sortedPaths;

    switch (primarySort) {
      case 'hopCount':
        sortedPaths = this.sortByHopCount(paths);
        break;
      case 'optimized':
        sortedPaths = this.sortByDisplayOptimization(paths);
        break;
      case 'protocol':
        sortedPaths = this.sortByProtocolPriority(paths, protocolPriority);
        break;
      case 'advanced':
        // Use the advanced optimization service
        sortedPaths = this.optimizationService.sortPathsForOptimalClarity(paths, {
          aggregationMode,
          aggregationScope,
          networkHierarchy,
          showPrimaryOnly,
          destinationCount
        });
        break;
      default:
        sortedPaths = this.sortByHopCount(paths);
    }

    // If preserveProtocolGroups is true, sort within protocol groups
    if (preserveProtocolGroups && primarySort !== 'advanced') {
      const grouped = this.groupPathsByProtocol(sortedPaths);
      sortedPaths = [];
      
      // Sort protocol groups by priority
      const sortedGroups = Object.keys(grouped).sort((a, b) => {
        const aPriority = protocolPriority.indexOf(this.normalizeProtocol(a));
        const bPriority = protocolPriority.indexOf(this.normalizeProtocol(b));
        
        if (aPriority !== -1 && bPriority !== -1) {
          return aPriority - bPriority;
        }
        if (aPriority !== -1) return -1;
        if (bPriority !== -1) return 1;
        return a.localeCompare(b);
      });

      // Add sorted paths from each group
      sortedGroups.forEach(protocol => {
        sortedPaths.push(...this.sortByHopCount(grouped[protocol]));
      });
    }

    return sortedPaths;
  }

  // Legacy method - use sortForGraphDisplay with advanced primarySort instead
  sortForOptimalClarity(paths, config = {}) {
    return this.optimizationService.sortPathsForOptimalClarity(paths, config);
  }

  groupPathsByProtocol(paths) {
    if (!Array.isArray(paths)) return {};

    return paths.reduce((groups, path) => {
      const protocol = this.normalizeProtocol(path.protocol);
      if (!groups[protocol]) {
        groups[protocol] = [];
      }
      groups[protocol].push(path);
      return groups;
    }, {});
  }
}

const pathSortingService = new PathSortingService();
export default pathSortingService;
