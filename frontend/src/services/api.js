const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api/traceroute';

class ApiService {
  async makeRequest(endpoint, options = {}) {
    try {
      const url = `${API_BASE_URL}${endpoint}`;
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
        },
        ...options
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'API request failed');
      }

      return data;
    } catch (error) {
      console.error(`API request failed for ${endpoint}:`, error);
      throw error;
    }
  }

  // Get all traceroute methods
  async getMethods() {
    return this.makeRequest('/methods');
  }

  // Get unique destinations
  async getDestinations() {
    const res = await this.makeRequest('/destinations');
    // Expect backend shape: { success:true, data: { <domain>: { domain_id, destinations:[{id,address}] } } }
    const grouped = res?.data || {};
    const flat = [];
    Object.entries(grouped).forEach(([domain, obj]) => {
      (obj?.destinations || []).forEach(d => {
        flat.push({
          id: d.id,
          address: d.address,
          domain
        });
      });
    });
    return { grouped, flat };
  }

  // Get trace runs with filtering
  async getTraceRuns(filters = {}) {
    const params = new URLSearchParams();

    Object.entries(filters).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') {
        if (Array.isArray(value)) {
          params.append(key, value.join(','));
        } else {
          params.append(key, value);
        }
      }
    });

    const queryString = params.toString();
    const endpoint = queryString ? `/runs?${queryString}` : '/runs';

    return this.makeRequest(endpoint);
  }

  // Get a specific trace run with hops
  async getTraceRunById(id) {
    return this.makeRequest(`/runs/${id}`);
  }

  // Get latest trace run by destination address (IPv4/IPv6 safe)
  async getLatestRunByDestination(address) {
    const params = new URLSearchParams();
    params.set('destination', address);
    return this.makeRequest(`/runs/latest-by-destination?${params.toString()}`);
  }

  // Get network data for visualisation
  async getNetworkData(filters = {}) {
    const params = new URLSearchParams();

    Object.entries(filters).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') {
        if (Array.isArray(value)) {
          params.append(key, value.join(','));
        } else {
          params.append(key, value);
        }
      }
    });

    const queryString = params.toString();
    const endpoint = queryString ? `/network-data?${queryString}` : '/network-data';

    return this.makeRequest(endpoint);
  }

  async getProtocols() {
    return this.makeRequest('/protocols');
  }

  async getAggregatedPaths(params = {}) {
  const qs = new URLSearchParams();
  if (params.destinations?.length) qs.set('destinations', params.destinations.join(','));
  if (params.protocols?.length) qs.set('protocols', params.protocols.join(','));
  if (params.start_date) qs.set('start_date', params.start_date);
  if (params.end_date) qs.set('end_date', params.end_date);
  const endpoint = `/aggregated-paths?${qs.toString()}`;
  const res = await this.makeRequest(endpoint);
  // Preserve previous return shape for callers: return the aggregated object directly
  const raw = res?.data || {};

  // Sanitize excessively large arrays to avoid client-side perf issues when
  // backend returns huge aggregated payloads. We keep the shape but trim
  // long lists such as timestamps, sample_run_ids, and per-hop rtt_ms.
  const MAX_SAMPLE_RUN_IDS = 50;
  const MAX_TIMESTAMPS = 200;
  const MAX_RTT_ENTRIES = 200;

  const sanitizePath = (p) => {
    if (!p || typeof p !== 'object') return p;
    // Trim sample_run_ids (if backend includes it)
    if (Array.isArray(p.sample_run_ids) && p.sample_run_ids.length > MAX_SAMPLE_RUN_IDS) {
      p.sample_run_ids = p.sample_run_ids.slice(0, MAX_SAMPLE_RUN_IDS);
      p._truncated_sample_run_ids = true;
    }
    // Trim timestamps array on path object
    if (Array.isArray(p.timestamps) && p.timestamps.length > MAX_TIMESTAMPS) {
      p.timestamps = p.timestamps.slice(0, MAX_TIMESTAMPS);
      p._truncated_timestamps = true;
    }
    // Trim per-hop rtt_ms arrays
    if (Array.isArray(p.path)) {
      p.path = p.path.map(h => {
        if (!h || typeof h !== 'object') return h;
        if (Array.isArray(h.rtt_ms) && h.rtt_ms.length > MAX_RTT_ENTRIES) {
          h.rtt_ms = h.rtt_ms.slice(0, MAX_RTT_ENTRIES);
          h._truncated_rtt_ms = true;
        }
        return h;
      });
    }
    return p;
  };

  try {
    // Clone shallow to avoid mutating original response object from fetch
    const out = Array.isArray(raw) ? raw : { ...raw };
    // If object mapping destinations => payload
    if (out && typeof out === 'object' && !Array.isArray(out)) {
      Object.keys(out).forEach(k => {
        const v = out[k];
        if (!v) return;
        // sanitize primary/alternatives/protocol groups
        if (v.primary_path) v.primary_path = sanitizePath(v.primary_path);
        if (Array.isArray(v.alternatives)) v.alternatives = v.alternatives.map(sanitizePath);
        if (v.fastest_path) v.fastest_path = sanitizePath(v.fastest_path);
        if (v.shortest_path) v.shortest_path = sanitizePath(v.shortest_path);
        if (v.protocol_groups && typeof v.protocol_groups === 'object') {
          Object.keys(v.protocol_groups).forEach(pg => {
            const g = v.protocol_groups[pg];
            if (!g) return;
            if (g.primary_path) g.primary_path = sanitizePath(g.primary_path);
            if (Array.isArray(g.alternatives)) g.alternatives = g.alternatives.map(sanitizePath);
            if (g.fastest_path) g.fastest_path = sanitizePath(g.fastest_path);
            if (g.shortest_path) g.shortest_path = sanitizePath(g.shortest_path);
          });
        }
      });
    }
    return out;
  } catch (e) {
    // Fallback: return raw if sanitization fails for any reason
    console.warn('Failed to sanitize aggregated paths response:', e);
    return raw;
  }
  }

  // Health check
  async healthCheck() {
    return this.makeRequest('/health');
  }

}

const apiService = new ApiService();
export default apiService; 