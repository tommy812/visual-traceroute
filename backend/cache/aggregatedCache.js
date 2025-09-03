// Simple in-memory TTL + size bounded cache for aggregated paths
// Keyed by normalized query params (destIds|protocols|start|end|fastest|shortest)
// Not clustered/multi-process safe; fine for single instance.

class AggregatedPathsCache {
  constructor({ maxEntries = 200, ttlMs = 60_000 } = {}) {
    this.maxEntries = maxEntries;
    this.ttlMs = ttlMs;
    this.map = new Map(); // key -> { value, expiresAt }
  }

  _now() { return Date.now(); }

  _pruneExpired() {
    const now = this._now();
    for (const [k, v] of this.map.entries()) {
      if (v.expiresAt <= now) this.map.delete(k);
    }
  }

  _evictIfNeeded() {
    if (this.map.size <= this.maxEntries) return;
    // Evict oldest insertion (Map iteration order) until under limit
    const over = this.map.size - this.maxEntries;
    let i = 0;
    for (const key of this.map.keys()) {
      this.map.delete(key);
      if (++i >= over) break;
    }
  }

  makeKey({ destIds, protocols, start, end, fastest, shortest }) {
    const d = Array.isArray(destIds) ? [...destIds].sort((a,b)=>a-b).join(',') : 'ALL';
    const p = Array.isArray(protocols) ? [...protocols].sort().join(',') : 'ALL';
    return [d, p, start || 'null', end || 'null', fastest ? '1':'0', shortest ? '1':'0'].join('|');
  }

  get(key) {
    this._pruneExpired();
    const entry = this.map.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= this._now()) { this.map.delete(key); return null; }
    // Touch entry (re-insert to maintain recent usage ordering)
    this.map.delete(key);
    this.map.set(key, entry);
    return entry.value;
  }

  set(key, value) {
    const expiresAt = this._now() + this.ttlMs;
    this.map.set(key, { value, expiresAt });
    this._evictIfNeeded();
  }

  clear() { this.map.clear(); }
}

// Singleton instance (configurable via env vars)
const ttl = parseInt(process.env.AGGREGATED_CACHE_TTL_MS || '60000', 10);
const maxEntries = parseInt(process.env.AGGREGATED_CACHE_MAX || '200', 10);
const aggregatedPathsCache = new AggregatedPathsCache({ ttlMs: ttl, maxEntries });

module.exports = { aggregatedPathsCache };
