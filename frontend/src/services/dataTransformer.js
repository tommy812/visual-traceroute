class DataTransformer {
  /**
   * Transform raw database data into the format expected by the frontend
   * @param {Array} rawData - Array of trace runs with hops from the database
   * @returns {Object} - Transformed data in frontend format
   */
  transformNetworkData(rawData) {
    if (!rawData || !Array.isArray(rawData) || rawData.length === 0) {
      return {};
    }

    // Group data by destination
    const groupedByDestination = this.groupByDestination(rawData);

    // Transform each destination's data
    const transformedData = {};

    Object.entries(groupedByDestination).forEach(([destination, traceRuns]) => {
      transformedData[destination] = this.transformDestinationData(destination, traceRuns);
    });

    return transformedData;
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
      pathGroup.forEach(p => {
        if (p.path[hopIndex] && Array.isArray(p.path[hopIndex].rtt_ms)) {
          allRtts.push(...p.path[hopIndex].rtt_ms);
        }
      });

      return {
        hop_number: templateHop.hop_number,
        ip: templateHop.ip,
        hostname: templateHop.hostname,
        rtt_ms: allRtts.length > 0 ? allRtts : (templateHop.rtt_ms || []),
        is_timeout: templateHop.is_timeout,
        // preserve hop protocol so frontend can match by hop-level protocol
        protocol: templateHop.protocol ?? null
      };
    });
  }



  /**
   * Transform a destination's trace runs into the expected format
   */
  transformDestinationData(destination, traceRuns) {
    // Convert trace runs to path format
    const paths = traceRuns.map(traceRun => this.convertTraceRunToPath(traceRun));

    // Group paths by similarity to identify primary vs alternatives
    const { primaryPath, alternatives } = this.identifyPrimaryAndAlternatives(paths);

    // Group by protocol
    const byProtocol = paths.reduce((acc, p) => {
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

    // Calculate total traces
    const totalTraces = traceRuns.length;

    return {
      primary_path: primaryPath,
      alternatives: alternatives,
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
      protocol: pathProtocol
    }));

    const avgRtt = this.calculatePathAverageRtt(path);

    return {
      path,
      count: 1,
      percent: 0,
      avg_rtt: avgRtt,
      timeStamp: traceRun.timestamp || new Date().toISOString(),
      protocol: pathProtocol
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
   */
  getNetworkPrefix(ip, prefixLength = 24) {
    if (!ip || ip === 'null' || ip === null) {
      return 'timeout';
    }

    try {
      // Handle IPv4
      if (ip.includes('.')) {
        const parts = ip.split('.');
        if (prefixLength === 24) {
          return `${parts[0]}.${parts[1]}.${parts[2]}.0/24`;
        } else if (prefixLength === 16) {
          return `${parts[0]}.${parts[1]}.0.0/16`;
        }
      }

      // Handle IPv6 - simplified prefix extraction
      if (ip.includes(':')) {
        const parts = ip.split(':');
        if (parts.length >= 4) {
          return `${parts[0]}:${parts[1]}:${parts[2]}:${parts[3]}::/64`;
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
}

const dataTransformerInstance = new DataTransformer();
export default dataTransformerInstance; 