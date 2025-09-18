/**
 * ProtocolFilteringService
 * 
 * Detects when network protocols are filtered at network edges by analyzing
 * traceroute behavior patterns across different protocols.
 */

class ProtocolFilteringService {
  analyzeProtocolFiltering(destinationData, destinationAddress) {
    if (!destinationData || typeof destinationData !== 'object') {
      return { hasFiltering: false, filteredProtocols: [], reachingProtocols: [] };
    }

    const protocolAnalysis = {};
    const reachingProtocols = [];
    const filteredProtocols = [];

    // Analyze each protocol group
    Object.entries(destinationData).forEach(([protocol, protocolData]) => {
      if (protocol === 'primary_path' || protocol === 'alternatives' || protocol === 'total_traces') {
        return; // Skip non-protocol fields
      }

      const analysis = this.analyzeProtocolBehavior(protocolData, destinationAddress, protocol);
      protocolAnalysis[protocol] = analysis;

      if (analysis.reachesDestination) {
        reachingProtocols.push(protocol);
      } else if (analysis.isFilteredAtEdge) {
        filteredProtocols.push(protocol);
      }
    });

    return {
      hasFiltering: filteredProtocols.length > 0,
      filteredProtocols,
      reachingProtocols,
      protocolAnalysis
    };
  }

  analyzeProtocolBehavior(protocolData, destinationAddress, protocol) {
    if (!protocolData) {
      return { reachesDestination: false, isFilteredAtEdge: false };
    }

    // Get all paths for this protocol (primary + alternatives)
    const paths = [];
    if (protocolData.primary_path) {
      paths.push(protocolData.primary_path);
    }
    if (Array.isArray(protocolData.alternatives)) {
      paths.push(...protocolData.alternatives);
    }

    if (paths.length === 0) {
      return { reachesDestination: false, isFilteredAtEdge: false };
    }

    // Analyze each path
    let anyReachesDestination = false;
    let hasNonTimeoutFinalHop = false;

    paths.forEach(path => {
      const pathAnalysis = this.analyzePathBehavior(path, destinationAddress);
      if (pathAnalysis.reachesDestination) {
        anyReachesDestination = true;
      }
      if (pathAnalysis.hasNonTimeoutFinalHop) {
        hasNonTimeoutFinalHop = true;
      }
    });

    // Protocol is filtered at edge if:
    // - It doesn't reach the destination
    // - But the last hop is not a timeout (indicating response from edge router)
    const isFilteredAtEdge = !anyReachesDestination && hasNonTimeoutFinalHop;

    return {
      reachesDestination: anyReachesDestination,
      isFilteredAtEdge,
      hasNonTimeoutFinalHop,
      totalPaths: paths.length
    };
  }

  analyzePathBehavior(path, destinationAddress) {
    if (!path || !Array.isArray(path.path)) {
      return { reachesDestination: false, hasNonTimeoutFinalHop: false };
    }

    const hops = path.path;
    if (hops.length === 0) {
      return { reachesDestination: false, hasNonTimeoutFinalHop: false };
    }

    // Find the last hop that's not a timeout
    let lastNonTimeoutHop = null;
    for (let i = hops.length - 1; i >= 0; i--) {
      const hop = hops[i];
      if (hop && !hop.is_timeout && hop.ip) {
        lastNonTimeoutHop = hop;
        break;
      }
    }

    // Check if destination is reached
    const reachesDestination = lastNonTimeoutHop && 
      this.normalizeIp(lastNonTimeoutHop.ip) === this.normalizeIp(destinationAddress);

    // Check if final hop is not a timeout
    const finalHop = hops[hops.length - 1];
    const hasNonTimeoutFinalHop = finalHop && !finalHop.is_timeout && finalHop.ip;

    return {
      reachesDestination,
      hasNonTimeoutFinalHop,
      lastNonTimeoutHop,
      finalHop
    };
  }

  // Main detection method for edge filtering
  detectEdgeFilteringForHop(hopData, destinationAddress) {
    if (!Array.isArray(hopData) || hopData.length === 0) {
      return { isEdgeFiltered: false, filteredProtocol: null, reachingProtocols: [] };
    }


    // Group by protocol
    const protocolGroups = {};
    hopData.forEach(hop => {
      const protocol = hop.protocol || 'UNKNOWN';
      
      if (!protocolGroups[protocol]) {
        protocolGroups[protocol] = {
          protocol,
          hops: []
        };
      }
      protocolGroups[protocol].hops.push(hop);
    });

    // Analyze each protocol group
    const relevantGroups = Object.values(protocolGroups);

    if (relevantGroups.length < 2) {
      return { isEdgeFiltered: false, filteredProtocol: null, reachingProtocols: [] };
    }

    const reachingProtocols = [];
    const nonReachingProtocols = [];

    relevantGroups.forEach(group => {
      // Check if any hop in this protocol group reaches the destination
      const reachesDestination = group.hops.some(hop => hop.destinationReached);
      
      // Check if this protocol has any non-timeout hops (indicating it got responses)
      const hasNonTimeoutHop = group.hops.some(hop => !hop.is_timeout && hop.ip);

      if (reachesDestination) {
        reachingProtocols.push(group.protocol);
      } else if (hasNonTimeoutHop) {
        // Protocol doesn't reach destination but has non-timeout hops
        // This could indicate filtering at the edge
        nonReachingProtocols.push(group.protocol);
      }
    });


    // Edge filtering detected if:
    // - Some protocols reach the destination
    // - Other protocols don't reach but have non-timeout responses
    const isEdgeFiltered = reachingProtocols.length > 0 && nonReachingProtocols.length > 0;
    const filteredProtocol = isEdgeFiltered ? nonReachingProtocols[0] : null;


    return {
      isEdgeFiltered,
      filteredProtocol,
      filteredProtocols: nonReachingProtocols,
      reachingProtocols,
      message: isEdgeFiltered ? 
        `${filteredProtocol} filtered at edge (likely policy)` : 
        null
    };
  }

  normalizeIp(ip) {
    if (!ip || typeof ip !== 'string') return '';
    return ip.trim().toLowerCase();
  }

  isCommonlyFilteredProtocol(protocol) {
    const commonlyFiltered = ['UDP', 'CLASSIC', 'TRACEROUTE'];
    return commonlyFiltered.includes(protocol?.toUpperCase());
  }
}

const protocolFilteringService = new ProtocolFilteringService();
export default protocolFilteringService;
