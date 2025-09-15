const express = require('express');
const router = express.Router();

// Simple in-memory cache and request dedupe. Suitable for small deployments.
const cache = new Map(); // ip -> { data, expiresAt }
const requestQueue = new Map(); // ip -> Promise

// TTL for cached entries (seconds)
const CACHE_TTL = parseInt(process.env.IPGEO_CACHE_TTL_SECONDS || String(60 * 60 * 24), 10); // default 24h

// Use global fetch if available (Node 18+), otherwise try node-fetch
let fetchFn = global.fetch;
try {
  if (!fetchFn) fetchFn = require('node-fetch');
} catch (e) {
  // node-fetch not installed; assume runtime provides fetch
}

const fields = [
  'status', 'message', 'country', 'countryCode', 'region', 'regionName',
  'city', 'zip', 'lat', 'lon', 'timezone', 'isp', 'org', 'as', 'mobile', 'proxy', 'hosting', 'query'
].join(',');

function isExpired(entry) {
  return !entry || (entry.expiresAt && Date.now() > entry.expiresAt);
}

router.get('/:ip', async (req, res) => {
  const ip = req.params.ip;
  if (!ip) return res.status(400).json({ status: 'fail', message: 'Missing IP' });

  // Return cached if present and not expired
  const cached = cache.get(ip);
  if (cached && !isExpired(cached)) {
    return res.json(cached.data);
  }

  // If a request for this IP is already in-flight, await it
  if (requestQueue.has(ip)) {
    try {
      const data = await requestQueue.get(ip);
      return res.json(data);
    } catch (err) {
      return res.status(500).json({ status: 'fail', message: 'Proxy error' });
    }
  }

  const providerUrl = `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=${fields}`;

  const promise = (async () => {
    try {
      const r = await fetchFn(providerUrl, { method: 'GET', headers: { Accept: 'application/json' } });
      if (!r.ok) {
        // propagate a shape similar to ip-api fail
        const msg = `HTTP ${r.status}: ${r.statusText}`;
        return { status: 'fail', message: msg };
      }

      const data = await r.json();
      // Add timestamp
      data.fetchedAt = new Date().toISOString();

      if (data.status === 'success') {
        cache.set(ip, { data, expiresAt: Date.now() + CACHE_TTL * 1000 });
      }

      return data;
    } catch (err) {
      console.error('ipgeo proxy error for', ip, err.message || err);
      return { status: 'fail', message: 'Proxy fetch error' };
    } finally {
      requestQueue.delete(ip);
    }
  })();

  requestQueue.set(ip, promise);

  try {
    const result = await promise;
    res.json(result);
  } catch (err) {
    res.status(500).json({ status: 'fail', message: 'Proxy error' });
  }
});

module.exports = router;
