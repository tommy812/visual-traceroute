// Backend 30-day network data cache.
// Stores full 30-day slices per (destinations set, protocol filter, method_id filter)
// so sub‑range queries inside that window can be served purely from memory.
// Not multi-process safe; fine for single instance. Can be swapped with Redis later.

class NetworkData30DayCache {
  constructor({ maxEntries = 100, ttlMs = 30 * 60 * 1000 } = {}) { // default 30 min TTL
    this.maxEntries = maxEntries;
    this.ttlMs = ttlMs;
    this.map = new Map(); // key -> { data, coverageStart, coverageEnd, createdAt, expiresAt }
    this.inflight = new Map(); // key -> Promise
  this.stats = { hits: 0, misses: 0, stores: 0, evictions: 0, prunes: 0 };
  }

  _now() { return Date.now(); }

  _pruneExpired() {
    const now = this._now();
    for (const [k, v] of this.map.entries()) {
  if (v.expiresAt <= now) { this.map.delete(k); this.stats.prunes++; }
    }
  }

  _evictIfNeeded() {
    if (this.map.size <= this.maxEntries) return;
    const over = this.map.size - this.maxEntries;
    let i = 0;
    for (const key of this.map.keys()) {
      this.map.delete(key);
  this.stats.evictions++;
      if (++i >= over) break;
    }
  }

  makeKey({ destinations, protocol, method_id }) {
    const d = destinations && destinations.length
      ? [...destinations].map(String).sort().join(',') : 'ALL';
    const p = protocol ? String(protocol).trim().toUpperCase() : 'ALL';
    const m = method_id ? String(method_id).trim() : 'ALL';
    return `30d|${d}|${p}|${m}`;
  }

  getFull(key) {
    this._pruneExpired();
    const entry = this.map.get(key);
  if (!entry) { this.stats.misses++; return null; }
  if (entry.expiresAt <= this._now()) { this.map.delete(key); this.stats.misses++; return null; }
    // touch
    this.map.delete(key);
    this.map.set(key, entry);
  this.stats.hits++;
  if (process.env.CACHE_DEBUG === '1') console.log('[networkData30d] HIT', key);
    return entry;
  }

  setFull(key, { data, coverageStart, coverageEnd }) {
    const now = this._now();
    this.map.set(key, {
      data,
      coverageStart,
      coverageEnd,
      createdAt: new Date(now).toISOString(),
      expiresAt: now + this.ttlMs
    });
  this.stats.stores++;
  if (process.env.CACHE_DEBUG === '1') console.log('[networkData30d] STORE', key, 'size=', data.length);
    this._evictIfNeeded();
  }

  getInflight(key) { return this.inflight.get(key); }
  setInflight(key, promise) { this.inflight.set(key, promise); }
  clearInflight(key) { this.inflight.delete(key); }
  clear() { this.map.clear(); this.inflight.clear(); }
  getStats() { return { ...this.stats, size: this.map.size, ttlMs: this.ttlMs, maxEntries: this.maxEntries }; }
}

const ttl = parseInt(process.env.NETWORK_DATA_30D_CACHE_TTL_MS || '', 10);
const maxEntries = parseInt(process.env.NETWORK_DATA_30D_CACHE_MAX || '', 10);
const networkDataCache = new NetworkData30DayCache({
  ttlMs: !isNaN(ttl) && ttl > 0 ? ttl : 30 * 60 * 1000,
  maxEntries: !isNaN(maxEntries) && maxEntries > 0 ? maxEntries : 100
});

module.exports = { networkDataCache };
