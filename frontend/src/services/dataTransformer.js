class DataTransformer {
  /**
   * Transform raw database data into the format expected by the frontend
   * @param {Array} rawData - Array of trace runs with hops from the database
   * @param {Object} opts - Aggregation options
   * @returns {Object} - Transformed data in frontend format
   */
  transformNetworkData(rawData, opts = {}) {
  if (!rawData || typeof rawData !== 'object') return {};
  // If backend already supplied aggregated shape just return
  const firstVal = Object.values(rawData)[0];
  if (firstVal && firstVal.protocol_groups) return rawData;
  // fallback old behavior
  return this.transformWithDestinationAggregation(rawData, opts);
  }


  /**
   * Group trace runs by destination
   */
  groupByDestination(rawData) {
    return rawData.reduce((acc, traceRun) => {
      // New schema: destinations: { id, address }
      const addr = traceRun?.destinations?.address
        ?? traceRun?.destination          // fallback for old payloads
        ?? '(unknown)';

      const destKey = String(addr).trim().toLowerCase(); // normalize

      if (!acc[destKey]) acc[destKey] = [];
      acc[destKey].push(traceRun);
      return acc;
    }, {});
  }


  // Helper: pick most common non-null protocol from a list of paths
  getMostCommonProtocol(paths) {
    const freq = new Map();
    for (const p of paths || []) {
      const proto = p?.protocol ?? null;
      if (!proto) continue;
      freq.set(proto, (freq.get(proto) || 0) + 1);
    }
    let best = null, max = 0;
    freq.forEach((count, proto) => {
      if (count > max) { max = count; best = proto; }
    });
    return best;
  }


  /**
   * Aggregate hop data across multiple paths
   */
  aggregateHopData(pathGroup) {
    if (!Array.isArray(pathGroup) || pathGroup.length === 0) return [];

    const templatePath = pathGroup[0].path;

    return templatePath.map((templateHop, hopIndex) => {
      const allRtts = [];
      const asnCounts = new Map();
      pathGroup.forEach(p => {
        const hop = p.path[hopIndex];
        if (hop && Array.isArray(hop.rtt_ms)) {
          allRtts.push(...hop.rtt_ms);
        }
        if (hop && hop.asn != null) {
          const key = String(hop.asn);
          asnCounts.set(key, (asnCounts.get(key) || 0) + 1);
        }
      });

      // choose most common ASN at this index across grouped paths
      let commonAsn = null;
      if (asnCounts.size > 0) {
        const arr = [...asnCounts.entries()].sort((a, b) => {
          if (b[1] !== a[1]) return b[1] - a[1];
          const an = parseInt(a[0], 10), bn = parseInt(b[0], 10);
          if (Number.isFinite(an) && Number.isFinite(bn)) return an - bn;
          return String(a[0]).localeCompare(String(b[0]));
        });
        commonAsn = arr[0][0];
        const n = parseInt(commonAsn, 10);
        if (!Number.isNaN(n)) commonAsn = n;
      }

      return {
        hop_number: templateHop.hop_number,
        ip: templateHop.ip,
        hostname: templateHop.hostname,
        rtt_ms: allRtts.length > 0 ? allRtts : (templateHop.rtt_ms || []),
        is_timeout: templateHop.is_timeout,
        // preserve hop protocol so frontend can match by hop-level protocol
        protocol: templateHop.protocol ?? null,
        // carry aggregated ASN
        asn: (templateHop.asn != null ? templateHop.asn : commonAsn) ?? null
      };
    });
  }



  /**
   * Transform a destination's trace runs into the expected format
   */
  transformDestinationData(destination, traceRuns, opts = {}) {
    // Convert trace runs to path format
    const paths = traceRuns.map(traceRun => this.convertTraceRunToPath(traceRun));

    // Apply path-level filters if we have options
    const filteredPaths = opts.minRTT || opts.maxRTT ? 
      this.applyPathLevelFilters(paths, opts) : paths;

    // Group paths by similarity to identify primary vs alternatives
    const { primaryPath, alternatives } = this.identifyPrimaryAndAlternatives(filteredPaths);

    // Group by protocol
    const byProtocol = filteredPaths.reduce((acc, p) => {
      const key = this.normalizeProtocol(p.protocol) || 'UNKNOWN';
      (acc[key] ||= []).push(p);
      return acc;
    }, {});

    // Build protocol_groups: for each protocol, compute its own primary/alternatives
    const protocol_groups = {};
    Object.entries(byProtocol).forEach(([proto, groupPaths]) => {
      const { primaryPath: protoPrimary, alternatives: protoAlts } = this.identifyPrimaryAndAlternatives(groupPaths);

      // Ensure protocol is set on aggregated outputs
      if (protoPrimary && !protoPrimary.protocol) protoPrimary.protocol = proto;
      (protoAlts || []).forEach(a => { if (a && !a.protocol) a.protocol = proto; });

      protocol_groups[proto] = {
        primary_path: protoPrimary,
        alternatives: protoAlts,
        total_traces: groupPaths.length
      };
    });

    // Apply usage percent filter to final results if specified
    let finalPrimary = primaryPath;
    let finalAlternatives = alternatives;

    if (opts.minUsagePercent !== null) {
      const minUsage = parseFloat(opts.minUsagePercent);
      if (finalPrimary && finalPrimary.percent < minUsage) {
        finalPrimary = null;
      }
      finalAlternatives = (finalAlternatives || []).filter(a => a.percent >= minUsage);
    }

    // Calculate total traces
    const totalTraces = traceRuns.length;

    return {
      primary_path: finalPrimary,
      alternatives: finalAlternatives,
      total_traces: totalTraces,
      protocol_groups
    };
  }

  normalizeProtocol(value) {
    if (value == null) return null;
    const s = String(value).trim();
    return s ? s.toUpperCase() : null;
  }

  /**
   * Convert a single trace run to path format
   */
  convertTraceRunToPath(traceRun) {
    const pathProtocol = this.normalizeProtocol(
      traceRun?.traceroute_methods?.description ??
      traceRun?.traceroute_methods?.name ??
      traceRun?.probe_protocol ??
      traceRun?.protocol
    );

    const hops = Array.isArray(traceRun.hops) ? [...traceRun.hops].sort((a, b) => a.hop_number - b.hop_number) : [];

    const path = hops.map(hop => ({
      hop_number: hop.hop_number,
      ip: hop.ip || null,
      hostname: hop.hostname,
      rtt_ms: this.convertRttToArray(hop.rtt1, hop.rtt2, hop.rtt3),
      is_timeout: !hop.ip || hop.ip === 'null' || hop.ip === null,
      // keep hop-level protocol aligned with run protocol
  protocol: pathProtocol,
  // NEW: carry hop ASN from backend
  asn: hop.asn != null ? hop.asn : null
    }));

    const avgRtt = this.calculatePathAverageRtt(path);

    return {
      path,
      count: 1,
      percent: 0,
      avg_rtt: avgRtt,
      timeStamp: traceRun.timestamp || new Date().toISOString(),
  protocol: pathProtocol,
  // Preserve the exact source run id so the drawer can fetch its raw output
  run_id: traceRun?.id ?? null,
  // Also keep destination address for reference (if joined)
  destination_address: traceRun?.destinations?.address || null
    };
  }

  /**
   * Convert individual RTT values to array format
   */
  convertRttToArray(rtt1, rtt2, rtt3) {
    const rtts = [];
    if (rtt1 !== null && rtt1 !== undefined) rtts.push(rtt1);
    if (rtt2 !== null && rtt2 !== undefined) rtts.push(rtt2);
    if (rtt3 !== null && rtt3 !== undefined) rtts.push(rtt3);
    return rtts;
  }

  /**
   * Calculate average RTT for a path
   */
  calculatePathAverageRtt(path) {
    let totalRtt = 0;
    let count = 0;

    path.forEach(hop => {
      if (hop.rtt_ms && hop.rtt_ms.length > 0) {
        const hopAvg = hop.rtt_ms.reduce((sum, rtt) => sum + rtt, 0) / hop.rtt_ms.length;
        totalRtt += hopAvg;
        count++;
      }
    });

    return count > 0 ? Math.round((totalRtt / count) * 100) / 100 : 0;
  }

  /**
   * Get network prefix from IP address
   * @param {string} ip - The IP address
   * @param {number} prefixLength - CIDR prefix length (32, 48, 64, etc.)
   */
  getNetworkPrefix(ip, prefixLength = 24) {
    if (!ip || ip === 'null' || ip === null) {
      return 'timeout';
    }

    try {
      // Handle IPv4
      if (ip.includes('.')) {
        const parts = ip.split('.');
        if (prefixLength === 32) {
          // ISP allocation (/32 for IPv4 means /8 actually for ISP-level)
          return `${parts[0]}.0.0.0/8`;
        } else if (prefixLength === 24) {
          // Subnet level
          return `${parts[0]}.${parts[1]}.${parts[2]}.0/24`;
        } else if (prefixLength === 16) {
          // ISP POP level
          return `${parts[0]}.${parts[1]}.0.0/16`;
        }
      }

      // Handle IPv6
      if (ip.includes(':')) {
        const parts = ip.split(':');
        
        if (prefixLength === 32) {
          // ISP allocation level (/32)
          if (parts.length >= 2) {
            return `${parts[0]}:${parts[1]}::/32`;
          }
        } else if (prefixLength === 48) {
          // ISP POP level (/48)
          if (parts.length >= 3) {
            return `${parts[0]}:${parts[1]}:${parts[2]}::/48`;
          }
        } else if (prefixLength === 64) {
          // Subnet level (/64)
          if (parts.length >= 4) {
            return `${parts[0]}:${parts[1]}:${parts[2]}:${parts[3]}::/64`;
          }
        }
      }

      return ip; // Fallback to original IP
    } catch (error) {
      console.warn('Error extracting prefix from IP:', ip, error);
      return ip;
    }
  }

  /**
   * Group IPs by network prefix
   */
  groupByNetworkPrefix(ips, prefixLength = 24) {
    const prefixGroups = {};

    ips.forEach(ip => {
      const prefix = this.getNetworkPrefix(ip, prefixLength);
      if (!prefixGroups[prefix]) {
        prefixGroups[prefix] = [];
      }
      prefixGroups[prefix].push(ip);
    });

    return prefixGroups;
  }

  /**
   * Generate a unique identifier for timeout hops
   */
  generateTimeoutId(hopNumber, pathId) {
    return `timeout_${pathId}_${hopNumber}`;
  }

  /**
   * Identify primary path and alternatives based on path similarity
   */
  identifyPrimaryAndAlternatives(paths) {
    if (paths.length === 0) {
      return {
        primaryPath: {
          path: [],
          count: 0,
          percent: 0,
          avg_rtt: 0,
          timeStamp: new Date().toISOString()
        },
        alternatives: []
      };
    }

    // Group paths by their route signature (sequence of IPs, including timeouts)
    const pathGroups = this.groupPathsBySignature(paths);

    // Find the most common path as primary
    const sortedGroups = Object.entries(pathGroups)
      .sort(([, a], [, b]) => b.length - a.length);

    const primaryGroupPaths = sortedGroups[0] ? sortedGroups[0][1] : [paths[0]];
    const alternativeGroups = sortedGroups.slice(1);

    // Create primary path
    const primaryPath = this.aggregatePaths(primaryGroupPaths, paths.length);

    // Create alternative paths
    const alternatives = alternativeGroups.map(([signature, groupPaths]) =>
      this.aggregatePaths(groupPaths, paths.length)
    );

    return { primaryPath, alternatives };
  }

  /**
   * Group paths by their route signature (sequence of IPs, including timeouts)
   */
  groupPathsBySignature(paths) {
    return paths.reduce((acc, path) => {
      const signature = path.path.map(hop => hop.ip || `timeout_${hop.hop_number}`).join('->');
      if (!acc[signature]) {
        acc[signature] = [];
      }
      acc[signature].push(path);
      return acc;
    }, {});
  }

  /**
   * Aggregate multiple paths with the same signature
   */
  aggregatePaths(pathGroup, totalPaths) {
    if (pathGroup.length === 0) {
      return {
        path: [],
        count: 0,
        percent: 0,
        avg_rtt: 0,
        timeStamp: new Date().toISOString(),
        protocol: null,
        timestamps: []
      };
    }

    // Use the first path as template and aggregate data
    const count = pathGroup.length;
    const percent = Math.round((count / totalPaths) * 1000) / 10; // One decimal place

    // Calculate average RTT across all paths in group
    const avgRtt = pathGroup.reduce((sum, path) => sum + path.avg_rtt, 0) / pathGroup.length;

    // Use the most recent timestamp
    const timestamps = pathGroup
      .map(p => p.timeStamp)
      .filter(t => !!t && !Number.isNaN(new Date(t)))
      .sort((a, b) => new Date(a) - new Date(b));
    const latestTimestamp = timestamps.length > 0
      ? new Date(Math.max(...timestamps.map(t => new Date(t).valueOf()))).toISOString()
      : new Date().toISOString();

    // Aggregate hop data (average RTTs across same hops)
    const aggregatedPath = this.aggregateHopData(pathGroup);

    // compute aggregated path-level protocol
    const protocol =
      this.getMostCommonProtocol(pathGroup) ??
      (aggregatedPath[0]?.protocol ?? null);


    return {
      path: aggregatedPath,
      count: count,
      percent: percent,
      avg_rtt: Math.round(avgRtt * 100) / 100,
      timeStamp: latestTimestamp,
      protocol,
      timestamps
    };
  }


  /**
   * Validate and sanitize the transformed data
   */
  validateTransformedData(data) {
    const validated = {};

    Object.entries(data).forEach(([destination, destData]) => {
      if (destData && typeof destData === 'object') {
        validated[destination] = {
          primary_path: destData.primary_path || {
            path: [],
            count: 0,
            percent: 0,
            avg_rtt: 0,
            timeStamp: new Date().toISOString()
          },
          alternatives: Array.isArray(destData.alternatives) ? destData.alternatives : [],
          total_traces: destData.total_traces || 0
        };
      }
    });

    return validated;
  }
  /**
   * Apply initial filters to trace runs before aggregation
   */
  applyInitialFilters(rawData, { selectedProtocols = [], minRTT = null, maxRTT = null }) {
    let filtered = rawData;

    // Protocol filter
    if (selectedProtocols.length > 0) {
      const protoSet = new Set(selectedProtocols.map(p => String(p).trim().toUpperCase()));
      filtered = filtered.filter(run => {
        const runProto = this.normalizeProtocol(
          run?.traceroute_methods?.description ??
          run?.traceroute_methods?.name ??
          run?.probe_protocol ??
          run?.protocol
        );
        return runProto && protoSet.has(runProto);
      });
    }

    // RTT filters would need to be applied at path level after conversion
    // For now, just return protocol-filtered runs
    return filtered;
  }

  /**
   * Traditional destination-based aggregation (current behavior)
   */
  transformWithDestinationAggregation(filteredRuns, opts) {
    // Group data by destination
    const groupedByDestination = this.groupByDestination(filteredRuns);

    // Transform each destination's data
    const transformedData = {};

    Object.entries(groupedByDestination).forEach(([destination, traceRuns]) => {
      transformedData[destination] = this.transformDestinationData(destination, traceRuns, opts);
    });

    return transformedData;
  }

  /**
   * No aggregation - show individual trace runs
   */
  transformWithNoAggregation(filteredRuns, opts) {
    // Group by destination first
    const groupedByDestination = this.groupByDestination(filteredRuns);
    const transformedData = {};

    Object.entries(groupedByDestination).forEach(([destination, traceRuns]) => {
      // Convert each trace run to a path but don't aggregate them
      const paths = traceRuns.map(traceRun => this.convertTraceRunToPath(traceRun));
      
      // Apply RTT and usage filters at path level
      const filteredPaths = this.applyPathLevelFilters(paths, opts);

      // Instead of picking primary/alternatives, treat each path as individual
      transformedData[destination] = {
        primary_path: null, // No primary when no aggregation
        alternatives: filteredPaths, // All paths are alternatives
        total_traces: filteredPaths.length,
        protocol_groups: this.groupPathsByProtocol(filteredPaths)
      };
    });

    return transformedData;
  }

  /**
   * ASN-based aggregation
   */
  transformWithAsnAggregation(filteredRuns, opts) {
    // For ASN aggregation, we need to fetch ASN info for IPs
    // This is more complex and would require async calls to geolocation service
    // For now, implement a simplified version that groups by destination first
    
    if (opts.aggregationScope === 'cross-destination') {
      // TODO: Implement cross-destination ASN aggregation
      return this.transformWithDestinationAggregation(filteredRuns, opts);
    } else {
      // Per-destination ASN aggregation
      return this.transformWithDestinationAggregation(filteredRuns, opts);
    }
  }

  /**
   * Prefix-based aggregation
   */
  transformWithPrefixAggregation(filteredRuns, opts) {
    if (opts.aggregationScope === 'cross-destination') {
      // Cross-destination prefix aggregation
      // Group all runs by prefix instead of destination
      return this.transformWithCrossPrefixAggregation(filteredRuns, opts);
    } else {
      // Per-destination prefix aggregation (current behavior)
      return this.transformWithDestinationAggregation(filteredRuns, opts);
    }
  }

  /**
   * Apply filters at the path level (after trace runs are converted to paths)
   */
  applyPathLevelFilters(paths, { minRTT = null, maxRTT = null, minUsagePercent = null }) {
    let filtered = paths;

    if (minRTT !== null) {
      const minRttNum = parseFloat(minRTT);
      filtered = filtered.filter(p => p.avg_rtt >= minRttNum);
    }

    if (maxRTT !== null) {
      const maxRttNum = parseFloat(maxRTT);
      filtered = filtered.filter(p => p.avg_rtt <= maxRttNum);
    }

    // Usage percent filtering would need total count context
    // For now, skip this filter at path level
    
    return filtered;
  }

  /**
   * Group paths by protocol for protocol_groups structure
   */
  groupPathsByProtocol(paths) {
    const byProtocol = paths.reduce((acc, p) => {
      const key = this.normalizeProtocol(p.protocol) || 'UNKNOWN';
      (acc[key] ||= []).push(p);
      return acc;
    }, {});

    const protocol_groups = {};
    Object.entries(byProtocol).forEach(([proto, groupPaths]) => {
      // In no-aggregation mode, don't pick primary/alternatives within protocol
      protocol_groups[proto] = {
        primary_path: null,
        alternatives: groupPaths,
        total_traces: groupPaths.length
      };
    });

    return protocol_groups;
  }

  /**
   * Cross-destination prefix aggregation (placeholder)
   */
  transformWithCrossPrefixAggregation(filteredRuns, opts) {
    // TODO: Implement cross-destination prefix aggregation
    // This would group paths that go through the same prefixes regardless of destination
    return this.transformWithDestinationAggregation(filteredRuns, opts);
  }


}

const dataTransformerInstance = new DataTransformer();
export default dataTransformerInstance; 