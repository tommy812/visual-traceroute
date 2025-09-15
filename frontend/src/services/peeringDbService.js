// Minimal PeeringDB client focused on network (net) by ASN.
const PDB_BASE = 'https://www.peeringdb.com/api';
const PDB_ORIGIN = 'https://www.peeringdb.com';
const PDB_MEDIA = `${PDB_ORIGIN}/media`;

function parseAsnNumber(asnLike) {
  if (!asnLike) return null;
  const m = String(asnLike).match(/AS\s*([0-9]+)/i) || String(asnLike).match(/^\s*([0-9]+)\s*$/);
  return m ? parseInt(m[1], 10) : null;
}

class PeeringDbService {
  constructor() {
  // Backend proxy URL (defaults to local backend in development)
  this.baseURL = process.env.REACT_APP_PDB_BACKEND || (process.env.NODE_ENV === 'development' ? 'http://localhost:3001/api/peeringdb' : '/api/peeringdb');

  this.netCache = new Map(); // Map<number, object|null>
  this.inFlight = new Map(); // Map<number, Promise>
  this.orgCache = new Map(); // Map<number, object|null>
  }

  async getNetByAsn(asnInput) {
    const asn = typeof asnInput === 'number' ? asnInput : parseAsnNumber(asnInput);
    if (!asn || Number.isNaN(asn)) return null;

    if (this.netCache.has(asn)) return this.netCache.get(asn);
    if (this.inFlight.has(asn)) return this.inFlight.get(asn);

    const p = (async () => {
      try {
        const url = `${this.baseURL}/net?asn=${asn}`;
        const res = await fetch(url, { method: 'GET', headers: { Accept: 'application/json' } });
        if (!res.ok) throw new Error(`PeeringDB proxy HTTP ${res.status}`);
        const json = await res.json();
        const net = Array.isArray(json?.data) && json.data.length > 0 ? json.data[0] : null;
        this.netCache.set(asn, net);
        return net;
      } catch (e) {
        console.warn('PeeringDB lookup failed for ASN', asn, e);
        this.netCache.set(asn, null);
        return null;
      } finally {
        this.inFlight.delete(asn);
      }
    })();

    this.inFlight.set(asn, p);
    return p;
  }



  // Extract common “protocol support” style flags from PeeringDB net
  summarizeCapabilities(net) {
    if (!net) return null;
    return {
      name: net.name || null,
      aka: net.aka || null,
      website: net.website || null,
      irr_as_set: net.irr_as_set || null,
      policy_general: net.policy_general || null,
      policy_url: net.policy_url || null,
      policy_contracts: net.policy_contracts || null,
      // Capabilities
      info_ipv4: !!net.info_ipv4,
      info_ipv6: !!net.info_ipv6,
      info_unicast: !!net.info_unicast,
      info_multicast: !!net.info_multicast,
      info_prefixes4: net.info_prefixes4 ?? null,
      info_prefixes6: net.info_prefixes6 ?? null,
      // Traffic and related descriptors
      info_traffic: net.info_traffic || null, // e.g., "1-5Gbps", "100-200Gbps"
      info_ratio: net.info_ratio || null,     // e.g., "Balanced", "Outbound heavy"
      info_scope: net.info_scope || null,     // e.g., "Global", "Regional"
      info_type: net.info_type || null        // e.g., "NSP", "Content", "Enterprise"
    };
  }

  parseAsnNumber(asnLike) {
    return parseAsnNumber(asnLike);
  }


  async getOrgById(orgId) {
    const id = Number(orgId);
    if (!id) return null;
    if (this.orgCache?.has(id)) return this.orgCache.get(id);

    try {
      const res = await fetch(`${PDB_BASE}/org?id=${id}`);
      if (!res.ok) throw new Error(`PeeringDB org HTTP ${res.status}`);
      const json = await res.json();
      const org = Array.isArray(json?.data) && json.data.length > 0 ? json.data[0] : null;
      if (!this.orgCache) this.orgCache = new Map();
      this.orgCache.set(id, org);
      return org;
    } catch (e) {
      console.warn('PeeringDB org lookup failed for', id, e);
      if (!this.orgCache) this.orgCache = new Map();
      this.orgCache.set(id, null);
      return null;
    }
  }

  // Normalize PeeringDB media paths to a usable URL
  getLogoUrl({ net, org }) {
    const candidate =
      net?.logo_url || // if present, already absolute
      org?.logo ||     // often a relative media path
      null;

    if (!candidate) return null;

    const s = String(candidate);
    if (s.startsWith('http://') || s.startsWith('https://')) return s;
    if (s.startsWith('/media/')) return `${PDB_ORIGIN}${s}`;
    if (s.startsWith('media/')) return `${PDB_ORIGIN}/${s}`;
    return `${PDB_MEDIA}/${s}`;
  }
}

const peeringDbService = new PeeringDbService();
export default peeringDbService;