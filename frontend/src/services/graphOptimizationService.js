/**
 * GraphOptimizationService
 * 
 * Handles path ordering for different graph visualization modes to improve clarity.
 * Uses various algorithms including graph centrality, topology-aware sorting, and
 * edge crossing minimization techniques.
 * 
 * References:
 * - Brandes, U. (2001). A faster algorithm for betweenness centrality. Journal of Mathematical Sociology
 * - Sugiyama, K., Tagawa, S., & Toda, M. (1981). Methods for visual understanding of hierarchical system structures
 */

class GraphOptimizationService {
  getOptimalStrategy(config) {
    const {
      aggregationMode = 'none',
      aggregationScope = 'per-destination',
      networkHierarchy = 'none',
      showPrimaryOnly = false,
      destinationCount = 1
    } = config;

    // Strategy selection based on configuration
    if (networkHierarchy !== 'none') {
      return this.getHierarchyStrategy(networkHierarchy, aggregationMode);
    }

    if (aggregationMode === 'shared-ips') {
      return this.getSharedIpStrategy(aggregationScope, destinationCount);
    }

    if (aggregationMode === 'asn') {
      return 'asn-topology-aware';
    }

    if (aggregationMode === 'prefix') {
      return 'prefix-aggregation-optimized';
    }

    return showPrimaryOnly ? 'simple-hop-count' : 'multi-path-optimized';
  }

  getHierarchyStrategy(hierarchy, aggregationMode) {
    switch (hierarchy) {
      case 'subnet':
        return aggregationMode === 'shared-ips' ? 'subnet-shared-optimized' : 'subnet-topology';
      case 'isp-pop':
        return 'isp-pop-optimized';
      case 'isp':
        return 'isp-level-optimized';
      case 'asn':
        return 'asn-hierarchy-optimized';
      default:
        return 'topology-aware';
    }
  }

  getSharedIpStrategy(scope, destinationCount) {
    if (scope === 'cross-destination' && destinationCount > 1) {
      return 'cross-destination-fanout-minimized';
    }
    return destinationCount > 3 ? 'multi-destination-optimized' : 'shared-ip-connection-aware';
  }

  // Simple hop count sorting for basic cases
  sortBySimpleHopCount(paths) {
    return [...paths].sort((a, b) => {
      const aHops = this.getPathLength(a);
      const bHops = this.getPathLength(b);
      return aHops - bHops;
    });
  }

  // Multi-path optimization considering shared nodes and divergence points
  sortByMultiPathOptimized(paths) {
    if (!Array.isArray(paths) || paths.length <= 1) return paths;

    // Calculate path metrics
    const pathMetrics = paths.map(path => ({
      path,
      hopCount: this.getPathLength(path),
      sharedNodeCount: this.calculateSharedNodes(path, paths),
      divergencePoint: this.findDivergencePoint(path, paths),
      successScore: this.calculateSuccessScore(path)
    }));

    // Sort by multiple criteria
    return pathMetrics.sort((a, b) => {
      // Primary: Success score (successful paths first)
      if (a.successScore !== b.successScore) {
        return b.successScore - a.successScore;
      }

      // Secondary: Shared nodes (paths with more shared infrastructure first)
      if (a.sharedNodeCount !== b.sharedNodeCount) {
        return b.sharedNodeCount - a.sharedNodeCount;
      }

      // Tertiary: Early divergence (paths that diverge later first)
      if (a.divergencePoint !== b.divergencePoint) {
        return b.divergencePoint - a.divergencePoint;
      }

      // Quaternary: Hop count
      return a.hopCount - b.hopCount;
    }).map(metric => metric.path);
  }

  // Groups paths with shared infrastructure to minimize visual complexity
  sortBySharedIpConnectionAware(paths, aggregationScope = 'per-destination') {
    if (!Array.isArray(paths) || paths.length <= 1) return paths;

    // Build connection graph
    const connectionGraph = this.buildConnectionGraph(paths);
    
    // Calculate connection scores
    const pathScores = paths.map(path => ({
      path,
      connectionScore: this.calculateConnectionScore(path, connectionGraph),
      centralityScore: this.calculateCentralityScore(path, paths),
      hopCount: this.getPathLength(path)
    }));

    // Sort by connection awareness
    return pathScores.sort((a, b) => {
      // Primary: Connection score (high connectivity first for shared-ip clarity)
      if (a.connectionScore !== b.connectionScore) {
        return b.connectionScore - a.connectionScore;
      }

      // Secondary: Centrality (paths through central nodes first)
      if (a.centralityScore !== b.centralityScore) {
        return b.centralityScore - a.centralityScore;
      }

      // Tertiary: Hop count
      return a.hopCount - b.hopCount;
    }).map(score => score.path);
  }

  // Reduces edge crossings for multiple destinations sharing infrastructure
  sortByCrossDestinationFanoutMinimized(paths) {
    if (!Array.isArray(paths) || paths.length <= 1) return paths;

    // Group paths by destination
    const pathsByDestination = this.groupPathsByDestination(paths);
    
    // Calculate fanout metrics for each destination group
    const destinationMetrics = Object.entries(pathsByDestination).map(([destination, destPaths]) => ({
      destination,
      paths: destPaths,
      fanoutScore: this.calculateFanoutScore(destPaths, paths),
      sharedInfrastructure: this.calculateSharedInfrastructure(destPaths, paths)
    }));

    // Sort destinations by fanout optimization
    destinationMetrics.sort((a, b) => {
      // Primary: Shared infrastructure (destinations with more shared nodes first)
      if (a.sharedInfrastructure !== b.sharedInfrastructure) {
        return b.sharedInfrastructure - a.sharedInfrastructure;
      }

      // Secondary: Fanout score (lower fanout first to minimize crossings)
      return a.fanoutScore - b.fanoutScore;
    });

    // Within each destination, sort paths for optimal ordering
    const sortedPaths = [];
    destinationMetrics.forEach(({ paths: destPaths }) => {
      const sortedDestPaths = this.sortByMultiPathOptimized(destPaths);
      sortedPaths.push(...sortedDestPaths);
    });

    return sortedPaths;
  }

  // Groups paths by ASN relationships respecting internet topology
  sortByAsnTopologyAware(paths) {
    if (!Array.isArray(paths) || paths.length <= 1) return paths;

    // Extract ASN information from paths
    const pathsWithAsn = paths.map(path => ({
      path,
      asnSequence: this.extractAsnSequence(path),
      tierClassification: this.classifyAsnTiers(path),
      geographicSpan: this.calculateGeographicSpan(path)
    }));

    // Sort by ASN topology principles
    return pathsWithAsn.sort((a, b) => {
      // Primary: Tier classification (Tier 1 ISPs first)
      if (a.tierClassification !== b.tierClassification) {
        return a.tierClassification - b.tierClassification;
      }

      // Secondary: Geographic span (shorter geographic distance first)
      if (a.geographicSpan !== b.geographicSpan) {
        return a.geographicSpan - b.geographicSpan;
      }

      // Tertiary: ASN diversity (fewer ASNs in path first)
      const aAsnCount = new Set(a.asnSequence).size;
      const bAsnCount = new Set(b.asnSequence).size;
      if (aAsnCount !== bAsnCount) {
        return aAsnCount - bAsnCount;
      }

      // Quaternary: Hop count
      return this.getPathLength(a.path) - this.getPathLength(b.path);
    }).map(item => item.path);
  }

  // Optimizes IPv6 prefix hierarchies for cleaner aggregation display
  sortByPrefixAggregationOptimized(paths) {
    if (!Array.isArray(paths) || paths.length <= 1) return paths;

    const pathsWithPrefixes = paths.map(path => ({
      path,
      prefixDiversity: this.calculatePrefixDiversity(path),
      hierarchyDepth: this.calculateHierarchyDepth(path),
      aggregationPotential: this.calculateAggregationPotential(path, paths)
    }));

    return pathsWithPrefixes.sort((a, b) => {
      // Primary: Aggregation potential (paths with high aggregation potential first)
      if (a.aggregationPotential !== b.aggregationPotential) {
        return b.aggregationPotential - a.aggregationPotential;
      }

      // Secondary: Hierarchy depth (consistent prefix levels first)
      if (a.hierarchyDepth !== b.hierarchyDepth) {
        return a.hierarchyDepth - b.hierarchyDepth;
      }

      // Tertiary: Prefix diversity (fewer unique prefixes first)
      if (a.prefixDiversity !== b.prefixDiversity) {
        return a.prefixDiversity - b.prefixDiversity;
      }

      // Quaternary: Hop count
      return this.getPathLength(a.path) - this.getPathLength(b.path);
    }).map(item => item.path);
  }

  // Combines subnet topology with shared IP optimization
  sortBySubnetSharedOptimized(paths) {
    // Combine subnet topology awareness with shared IP optimization
    const subnetGrouped = this.groupPathsBySubnet(paths);
    const sortedPaths = [];

    // Sort subnet groups by shared infrastructure
    const sortedSubnets = Object.entries(subnetGrouped)
      .sort(([, aPaths], [, bPaths]) => {
        const aShared = this.calculateSharedInfrastructure(aPaths, paths);
        const bShared = this.calculateSharedInfrastructure(bPaths, paths);
        return bShared - aShared;
      });

    // Within each subnet, optimize for shared connections
    sortedSubnets.forEach(([, subnetPaths]) => {
      const optimized = this.sortBySharedIpConnectionAware(subnetPaths);
      sortedPaths.push(...optimized);
    });

    return sortedPaths;
  }

  // Main sorting dispatcher that selects appropriate strategy
  sortPathsForOptimalClarity(paths, config = {}) {
    if (!Array.isArray(paths) || paths.length === 0) {
      return [];
    }

    const strategy = this.getOptimalStrategy(config);

    switch (strategy) {
      case 'simple-hop-count':
        return this.sortBySimpleHopCount(paths);
      case 'multi-path-optimized':
        return this.sortByMultiPathOptimized(paths);
      case 'shared-ip-connection-aware':
        return this.sortBySharedIpConnectionAware(paths, config.aggregationScope);
      case 'cross-destination-fanout-minimized':
        return this.sortByCrossDestinationFanoutMinimized(paths);
      case 'asn-topology-aware':
        return this.sortByAsnTopologyAware(paths);
      case 'prefix-aggregation-optimized':
        return this.sortByPrefixAggregationOptimized(paths);
      case 'subnet-shared-optimized':
        return this.sortBySubnetSharedOptimized(paths);
      default:
        console.warn(`Unknown sorting strategy: ${strategy}, falling back to multi-path-optimized`);
        return this.sortByMultiPathOptimized(paths);
    }
  }

  // Helper methods
  getPathLength(path) {
    if (!path) return 0;
    return (path.hops || path.path || []).length;
  }

  calculateSharedNodes(path, allPaths) {
    const pathIps = this.extractIpsFromPath(path);
    const otherPaths = allPaths.filter(p => p !== path);
    
    let sharedCount = 0;
    pathIps.forEach(ip => {
      const isShared = otherPaths.some(otherPath => 
        this.extractIpsFromPath(otherPath).includes(ip)
      );
      if (isShared) sharedCount++;
    });
    
    return sharedCount;
  }

  findDivergencePoint(path, allPaths) {
    const pathIps = this.extractIpsFromPath(path);
    const otherPaths = allPaths.filter(p => p !== path);
    
    for (let i = 0; i < pathIps.length; i++) {
      const ip = pathIps[i];
      const hasCommonAtPosition = otherPaths.some(otherPath => {
        const otherIps = this.extractIpsFromPath(otherPath);
        return otherIps[i] === ip;
      });
      
      if (!hasCommonAtPosition) {
        return i;
      }
    }
    
    return pathIps.length;
  }

  calculateSuccessScore(path) {
    const hops = path.hops || path.path || [];
    if (hops.length === 0) return 0;
    
    const lastHop = hops[hops.length - 1];
    const reachesDestination = lastHop && !lastHop.is_timeout && lastHop.ip;
    const timeoutCount = hops.filter(hop => hop && hop.is_timeout).length;
    
    let score = reachesDestination ? 100 : 0;
    score -= timeoutCount * 10; // Penalty for timeouts
    score += hops.filter(hop => hop && hop.rtt_ms && hop.rtt_ms < 50).length * 5; // Bonus for fast hops
    
    return Math.max(0, score);
  }

  buildConnectionGraph(paths) {
    const connections = new Map();
    
    paths.forEach(path => {
      const ips = this.extractIpsFromPath(path);
      for (let i = 0; i < ips.length - 1; i++) {
        const from = ips[i];
        const to = ips[i + 1];
        const key = `${from}->${to}`;
        
        connections.set(key, (connections.get(key) || 0) + 1);
      }
    });
    
    return connections;
  }

  calculateConnectionScore(path, connectionGraph) {
    const ips = this.extractIpsFromPath(path);
    let score = 0;
    
    for (let i = 0; i < ips.length - 1; i++) {
      const from = ips[i];
      const to = ips[i + 1];
      const key = `${from}->${to}`;
      score += connectionGraph.get(key) || 0;
    }
    
    return score;
  }

  calculateCentralityScore(path, allPaths) {
    const pathIps = this.extractIpsFromPath(path);
    const allIps = allPaths.flatMap(p => this.extractIpsFromPath(p));
    const ipCounts = new Map();
    
    allIps.forEach(ip => {
      ipCounts.set(ip, (ipCounts.get(ip) || 0) + 1);
    });
    
    return pathIps.reduce((score, ip) => score + (ipCounts.get(ip) || 0), 0);
  }

  groupPathsByDestination(paths) {
    return paths.reduce((groups, path) => {
      const destination = path.destination || 'unknown';
      if (!groups[destination]) {
        groups[destination] = [];
      }
      groups[destination].push(path);
      return groups;
    }, {});
  }

  calculateFanoutScore(destPaths, allPaths) {
    // Calculate how much this destination's paths "fan out" from shared infrastructure
    const sharedNodes = new Set();
    destPaths.forEach(path => {
      this.extractIpsFromPath(path).forEach(ip => {
        const usageCount = allPaths.filter(p => 
          this.extractIpsFromPath(p).includes(ip)
        ).length;
        if (usageCount > 1) {
          sharedNodes.add(ip);
        }
      });
    });
    
    return destPaths.length / Math.max(1, sharedNodes.size);
  }

  calculateSharedInfrastructure(destPaths, allPaths) {
    const sharedCount = destPaths.reduce((count, path) => 
      count + this.calculateSharedNodes(path, allPaths), 0
    );
    return sharedCount / Math.max(1, destPaths.length);
  }

  extractIpsFromPath(path) {
    const hops = path.hops || path.path || [];
    return hops
      .filter(hop => hop && hop.ip && !hop.is_timeout)
      .map(hop => hop.ip);
  }

  extractAsnSequence(path) {
    const hops = path.hops || path.path || [];
    return hops
      .filter(hop => hop && hop.asn)
      .map(hop => hop.asn);
  }

  classifyAsnTiers(path) {
    // Simplified tier classification based on ASN patterns
    const asns = this.extractAsnSequence(path);
    if (asns.length === 0) return 3;
    
    // Tier 1 ASNs (simplified list of major providers)
    const tier1Asns = new Set(['7018', '3320', '3257', '6830', '2914', '5511', '1239', '6453', '6762', '1273']);
    const hasTier1 = asns.some(asn => tier1Asns.has(String(asn)));
    
    return hasTier1 ? 1 : 2; // Simplified: either Tier 1 or Tier 2+
  }

  calculateGeographicSpan(path) {
    // Simplified geographic span calculation
    // In a real implementation, this would use IP geolocation data
    const hops = path.hops || path.path || [];
    return hops.length; // Simplified: assume hop count correlates with geographic span
  }

  calculatePrefixDiversity(path) {
    const ips = this.extractIpsFromPath(path);
    const prefixes = new Set(ips.map(ip => ip.split(':').slice(0, 4).join(':')));
    return prefixes.size;
  }

  calculateHierarchyDepth(path) {
    const ips = this.extractIpsFromPath(path);
    if (ips.length === 0) return 0;
    
    // Calculate average hierarchy depth based on IPv6 prefix structure
    const depths = ips.map(ip => ip.split(':').filter(segment => segment !== '').length);
    return depths.reduce((sum, depth) => sum + depth, 0) / depths.length;
  }

  calculateAggregationPotential(path, allPaths) {
    const pathIps = this.extractIpsFromPath(path);
    const otherPaths = allPaths.filter(p => p !== path);
    
    let potential = 0;
    pathIps.forEach(ip => {
      const prefix = ip.split(':').slice(0, 3).join(':');
      const prefixMatches = otherPaths.filter(otherPath =>
        this.extractIpsFromPath(otherPath).some(otherIp =>
          otherIp.startsWith(prefix)
        )
      ).length;
      potential += prefixMatches;
    });
    
    return potential;
  }

  groupPathsBySubnet(paths) {
    return paths.reduce((groups, path) => {
      const ips = this.extractIpsFromPath(path);
      const subnet = ips.length > 0 ? ips[0].split(':').slice(0, 4).join(':') : 'unknown';
      
      if (!groups[subnet]) {
        groups[subnet] = [];
      }
      groups[subnet].push(path);
      return groups;
    }, {});
  }
}

const graphOptimizationService = new GraphOptimizationService();
export default graphOptimizationService;
