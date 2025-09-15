// Simple in-memory cache for raw trace_runs per destination.
// Stores coverage flags for the "last 30 days" window.

class NetworkDataCache {
  constructor() {
    // Map<string destinationKey (prefer destination_id), { runsById: Map<string,object>, last30DaysCovered: boolean }>
    this.byDestination = new Map();
  }

  clear() {
    this.byDestination.clear();
  }

  _bucket(dest) {
    if (!this.byDestination.has(dest)) {
      this.byDestination.set(dest, { runsById: new Map(), last30DaysCovered: false });
    }
    return this.byDestination.get(dest);
  }

  // Merge runs for a destination (dedupe by id)
  addRunsForDestination(dest, runs) {
    const bucket = this._bucket(dest);
    const map = bucket.runsById;
    (Array.isArray(runs) ? runs : []).forEach(run => {
      if (!run || !run.id) return;
      map.set(run.id, run);
    });
  }

  // Bulk add: Map<dest, run[]>
  addRunsByDestination(mapOfRuns) {
    if (!(mapOfRuns instanceof Map)) return;
    mapOfRuns.forEach((runs, dest) => this.addRunsForDestination(dest, runs));
  }

  // Return raw runs in [start, end] for given destinations
  getRunsInRange(destinations, start, end) {
    const out = [];
    const startMs = start?.getTime?.() ?? null;
    const endMs = end?.getTime?.() ?? null;

    (Array.isArray(destinations) ? destinations : []).forEach(dest => {
      const bucket = this.byDestination.get(dest);
      if (!bucket) return;
      bucket.runsById.forEach(run => {
        const ts = new Date(run.timestamp).valueOf();
        const okStart = startMs === null || ts >= startMs;
        const okEnd = endMs === null || ts <= endMs;
        if (okStart && okEnd) out.push(run);
      });
    });
    return out;
  }

  markCoverageLast30Days(destinations) {
    (Array.isArray(destinations) ? destinations : []).forEach(dest => {
      const bucket = this._bucket(dest);
      bucket.last30DaysCovered = true;
    });
  }

  hasLast30DaysCoverage(destinations) {
    return (Array.isArray(destinations) ? destinations : []).every(dest => {
      const bucket = this.byDestination.get(dest);
      return bucket?.last30DaysCovered === true;
    });
  }

  // Simple stats for debugging
  getStats() {
    const stats = {};
    this.byDestination.forEach((bucket, dest) => {
      stats[dest] = {
        runs: bucket.runsById.size,
        last30DaysCovered: bucket.last30DaysCovered
      };
    });
    return stats;
  }
  splitRunsByDestination(rawRuns) {
    const byDest = new Map();
    (Array.isArray(rawRuns) ? rawRuns : []).forEach(run => {
      if (!run) return;
      // Prefer numeric id (matches UI params), fallback to address
      const key =
        run.destination_id != null
          ? String(run.destination_id)
          : (run.destinations?.address ||
            run.destination?.address ||
            run.destination ||
            'UNKNOWN');
      if (!byDest.has(key)) byDest.set(key, []);
      byDest.get(key).push(run);
    });
    return byDest;
  }





}

const networkDataCache = new NetworkDataCache();
export default networkDataCache;