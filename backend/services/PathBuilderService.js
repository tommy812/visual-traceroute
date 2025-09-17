/**
 * Path Builder Service - Handles construction of path objects from database results
 * Single Responsibility: Path object construction and aggregation
 */

const { DateTime } = require('luxon');
const DatabaseService = require('./DatabaseService');
const Logger = require('../utils/logger');

const LONDON = 'Europe/London';

class PathBuilderService {
  constructor(databaseService = DatabaseService) {
    this.databaseService = databaseService;
  }

  async buildPathObject(row) {
    const {
      destination_id,
      destination_address,
      hops,
      run_id,
      trace_method,
      proto,
      source_ip,
      // New aggregated data fields
      run_count,
      path_avg_rtt,
      timestamps,
      sample_timestamp,
      earliest_timestamp,
      latest_timestamp,
      signature
    } = row;

    // Handle aggregated vs raw data
    const isAggregated = run_count !== undefined;
    
    let timestamp = null;
    let allTimestamps = null;
    
    if (isAggregated) {
      // For aggregated data, use the provided timestamps
      timestamp = sample_timestamp ? DateTime.fromJSDate(new Date(sample_timestamp)).setZone(LONDON).toISO() : null;
      allTimestamps = timestamps ? (Array.isArray(timestamps) ? timestamps : [timestamps]) : [];
    } else {
      // For raw data, get timestamp for this run
      timestamp = (run_id && run_id !== undefined) ? 
        await this.databaseService.getRunTimestamp(run_id) : null;
      allTimestamps = timestamp ? [timestamp] : [];
    }

    // Process hops data
    const processedHops = this.processHops(hops);

    const result = {
      destination_id,
      destination_address,
      run_id,
      trace_method,
      protocol: proto,
      source_ip,
      timestamp,
      hops: processedHops
    };

    // Add aggregated-specific fields
    if (isAggregated) {
      result.run_count = run_count;
      result.path_avg_rtt = path_avg_rtt;
      result.signature = signature;
      result.timestamps = allTimestamps;
      result.earliest_timestamp = earliest_timestamp ? DateTime.fromJSDate(new Date(earliest_timestamp)).setZone(LONDON).toISO() : null;
      result.latest_timestamp = latest_timestamp ? DateTime.fromJSDate(new Date(latest_timestamp)).setZone(LONDON).toISO() : null;
      result.is_aggregated = true;
    }

    return result;
  }

  processHops(hopsData) {
    if (!Array.isArray(hopsData)) {
      return [];
    }

    return hopsData.map(hop => ({
      hop_number: hop.hop_number,
      ip_address: hop.ip_address,
      hostname: hop.hostname,
      rtt_ms: hop.rtt_ms,
      is_timeout: hop.is_timeout || false,
      asn: hop.asn ?? null,
      // Add any additional hop processing here
    }));
  }

  groupPathsByDestination(paths) {
    const grouped = {};

    paths.forEach(path => {
      const destKey = path.destination_address || path.destination_id || 'unknown';
      
      if (!grouped[destKey]) {
        grouped[destKey] = [];
      }
      
      grouped[destKey].push(path);
    });

    return grouped;
  }

  aggregatePathStats(paths) {
    if (!Array.isArray(paths) || paths.length === 0) {
      return {
        totalPaths: 0,
        avgHopCount: 0,
        protocols: [],
        timeRange: null
      };
    }

    const protocols = [...new Set(paths.map(p => p.protocol).filter(Boolean))];
    const hopCounts = paths.map(p => p.hops?.length || 0);
    const avgHopCount = hopCounts.reduce((sum, count) => sum + count, 0) / hopCounts.length;

    const timestamps = paths
      .map(p => p.timestamp)
      .filter(Boolean)
      .sort();

    const timeRange = timestamps.length > 0 ? {
      start: timestamps[0],
      end: timestamps[timestamps.length - 1]
    } : null;

    return {
      totalPaths: paths.length,
      avgHopCount: Math.round(avgHopCount * 100) / 100,
      protocols,
      timeRange
    };
  }
}

module.exports = new PathBuilderService();
