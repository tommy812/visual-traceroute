const express = require('express');
const router = express.Router();

// Simple in-memory cache and request dedupe for PeeringDB API
const cache = new Map(); // key -> { data, expiresAt }
const requestQueue = new Map(); // key -> Promise

const CACHE_TTL = parseInt(process.env.PDB_CACHE_TTL_SECONDS || String(60 * 60 * 24), 10); // 24h default

let fetchFn = global.fetch;
try {
  if (!fetchFn) fetchFn = require('node-fetch');
} catch (e) {}

const PDB_BASE = 'https://www.peeringdb.com/api';

function isExpired(entry) {
  return !entry || (entry.expiresAt && Date.now() > entry.expiresAt);
}

router.get('/*', async (req, res) => {
  // Build provider URL by appending the incoming path+query to PDB_BASE
  // req.url is the path relative to the router, including query string
  const providerPath = req.url || '/';
  const providerUrl = `${PDB_BASE}${providerPath}`;

  const key = providerUrl;

  const cached = cache.get(key);
  if (cached && !isExpired(cached)) {
    return res.json(cached.data);
  }

  if (requestQueue.has(key)) {
    try {
      const data = await requestQueue.get(key);
      return res.json(data);
    } catch (err) {
      return res.status(500).json({ status: 'fail', message: 'Proxy error' });
    }
  }

  const promise = (async () => {
    try {
      const r = await fetchFn(providerUrl, { method: 'GET', headers: { Accept: 'application/json' } });
      if (!r.ok) {
        const msg = `HTTP ${r.status}: ${r.statusText}`;
        return { status: 'fail', message: msg };
      }
      const data = await r.json();
      // Add fetchedAt for downstream clients
      if (data && typeof data === 'object') data.fetchedAt = new Date().toISOString();

      cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL * 1000 });
      return data;
    } catch (err) {
      console.error('PeeringDB proxy error for', providerUrl, err.message || err);
      cache.set(key, { data: { status: 'fail', message: 'Proxy fetch error' }, expiresAt: Date.now() + 5000 });
      return { status: 'fail', message: 'Proxy fetch error' };
    } finally {
      requestQueue.delete(key);
    }
  })();

  requestQueue.set(key, promise);

  try {
    const result = await promise;
    res.json(result);
  } catch (err) {
    res.status(500).json({ status: 'fail', message: 'Proxy error' });
  }
});

module.exports = router;
