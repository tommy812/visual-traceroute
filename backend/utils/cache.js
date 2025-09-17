/**
 * Simple in-memory cache utility with request deduplication
 */

class SimpleCache {
  constructor(defaultTTLSeconds = 60 * 60 * 24) { // 24 hours default
    this.cache = new Map();
    this.requestQueue = new Map();
    this.defaultTTL = defaultTTLSeconds * 1000; // Convert to milliseconds
  }

  isExpired(entry) {
    return !entry || (entry.expiresAt && Date.now() > entry.expiresAt);
  }

  get(key) {
    const cached = this.cache.get(key);
    if (cached && !this.isExpired(cached)) {
      return cached.data;
    }
    return null;
  }

  set(key, data, ttlSeconds = null) {
    const ttl = ttlSeconds ? ttlSeconds * 1000 : this.defaultTTL;
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttl
    });
  }

  async getOrFetch(key, fetchFunction, ttlSeconds = null) {
    // Return cached if present and not expired
    const cached = this.get(key);
    if (cached) {
      return cached;
    }

    // If a request for this key is already in-flight, await it
    if (this.requestQueue.has(key)) {
      return await this.requestQueue.get(key);
    }

    // Create and store the promise
    const promise = (async () => {
      try {
        const data = await fetchFunction();
        this.set(key, data, ttlSeconds);
        return data;
      } finally {
        this.requestQueue.delete(key);
      }
    })();

    this.requestQueue.set(key, promise);
    return await promise;
  }

  clear() {
    this.cache.clear();
    this.requestQueue.clear();
  }

  size() {
    return this.cache.size;
  }
}

module.exports = SimpleCache;
