const { supabase } = require('../config/database');
const { aggregatedPathsCache } = require('../cache/aggregatedCache');

class TracerouteController {
  // Get all traceroute methods
  async getMethods(req, res) {
    try {
      const { data, error } = await supabase
        .from('traceroute_methods')
        .select('*')
        .order('id');

      if (error) {
        throw error;
      }

      res.json({
        success: true,
        data: data || [],
        count: data?.length || 0
      });
    } catch (error) {
      console.error('Error fetching traceroute methods:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch traceroute methods',
        details: error.message
      });
    }
  }

  // Get all trace runs with optional filtering
  async getTraceRuns(req, res) {
    try {
      const {
        destination,          // substring match on destinations.address
        method_id,            // single id or comma-separated list
        start_date,
        end_date,
        limit = 100,
        offset = 0
      } = req.query;

      const selectStr = `
      id,
      timestamp,
      method_id,
      raw_output,
      parameters,
      error,
      destination_id,
      traceroute_methods(name,version,description),
      destinations:destination_id(
        id,
        address,
        domain:domain_id (id, name)
      )
    `;

      let query = supabase
        .from('trace_runs')
        .select(selectStr, { count: 'exact' })       // get total_count
        .order('timestamp', { ascending: false })
        .range(Number(offset), Number(offset) + Number(limit) - 1);

      // Filters
      if (destination && destination.trim()) {
        query = query.ilike('destinations.address', `%${destination.trim()}%`);
      }

      if (method_id) {
        const ids = String(method_id).split(',').map(s => s.trim()).filter(Boolean);
        if (ids.length === 1) query = query.eq('method_id', ids[0]);
        else if (ids.length > 1) query = query.in('method_id', ids);
      }

      if (start_date) query = query.gte('timestamp', start_date);
      if (end_date) query = query.lte('timestamp', end_date);

      const { data, error, count } = await query;
      if (error) throw error;

      res.json({
        success: true,
        data: data ?? [],
        count: data?.length ?? 0,     // page size
        total_count: count ?? 0,      // total rows matching filters
        pagination: {
          limit: Number(limit),
          offset: Number(offset),
          has_more: count != null ? Number(offset) + Number(limit) < count : null
        }
      });
    } catch (error) {
      console.error('Error fetching trace runs:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch trace runs',
        details: error.message
      });
    }
  }

  // Get a specific trace run with its hops
  async getTraceRunById(req, res) {
    try {
      const { id } = req.params;

      const selectStr = `
      id,
      timestamp,
      method_id,
      raw_output,
      parameters,
      error,
      destination_id,
      traceroute_methods(name,version,description),
      destinations:destination_id(
        id,
        address,
        domain:domain_id (id, name)
      )
    `;

      const { data: traceRun, error: traceError } = await supabase
        .from('trace_runs')
        .select(selectStr)
        .eq('id', id)
        .single();

      if (traceError) throw traceError;
      if (!traceRun) {
        return res.status(404).json({ success: false, error: 'Trace run not found' });
      }

      const { data: hops, error: hopsError } = await supabase
        .from('hops')
        .select('*')
        .eq('trace_run_id', id)
        .order('hop_number');

      if (hopsError) throw hopsError;

      res.json({
        success: true,
        data: { ...traceRun, hops: hops || [] }
      });
    } catch (error) {
      console.error('Error fetching trace run:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch trace run',
        details: error.message
      });
    }
  }

  // Get hops for a specific trace run
  async getHops(req, res) {
    try {
      const { trace_run_id } = req.params;

      const { data, error } = await supabase
        .from('hops')
        .select('*')
        .eq('trace_run_id', trace_run_id)
        .order('hop_number');

      if (error) {
        throw error;
      }

      res.json({
        success: true,
        data: data || [],
        count: data?.length || 0
      });
    } catch (error) {
      console.error('Error fetching hops:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch hops',
        details: error.message
      });
    }
  }

  // Get aggregated data for network visualization
  async getNetworkData(req, res) {
    try {
      const {
        destinations,  // comma-separated list of addresses or ids
        start_date,
        end_date,
        method_id,
        protocol       // matches traceroute_methods.description
      } = req.query;

      const selectStr = `
        id,
        timestamp,
        method_id,
        destination_id,
        traceroute_methods(name,version,description),
        destinations:destination_id (
          id,
          address,
          domain:domain_id ( id, name )
        ),
        hops(
          id, hop_number, ip, hostname, rtt1, rtt2, rtt3, extra
        )
      `;

      let query = supabase
        .from('trace_runs')
        .select(selectStr)
        .order('timestamp', { ascending: false });

      // Destination filtering: accept ids or addresses
      if (destinations) {
        const raw = destinations;
        const items = Array.isArray(raw) ? raw : String(raw).split(','); // handle arrays or comma-separated
        const ids = items.filter(x => /^\d+$/.test(x));          // numeric ids
        const addrs = items.filter(x => !/^\d+$/.test(x));       // addresses

        if (ids.length) query = query.in('destination_id', ids);
        if (addrs.length) {
          // If both ids and addresses are present, both conditions will be applied.
          // PostgREST applies AND; to emulate (ids OR addresses) you’d make two
          // queries or use a server-side RPC. If you only pass one type, this is fine.
          query = query.in('destinations.address', addrs);
        }
      }

      if (method_id) {
        const ids = String(method_id).split(',').map(s => s.trim()).filter(Boolean);
        if (ids.length === 1) query = query.eq('method_id', ids[0]);
        else if (ids.length > 1) query = query.in('method_id', ids);
      }

      if (protocol) query = query.ilike('traceroute_methods.description', String(protocol));
      if (start_date) query = query.gte('timestamp', start_date);
      if (end_date) query = query.lte('timestamp', end_date);

      const { data, error } = await query;
      if (error) throw error;

      const validTraceRuns = (data || []).filter(
        tr => Array.isArray(tr.hops) && tr.hops.length > 0
      );

      validTraceRuns.forEach(tr => tr.hops.sort((a, b) => a.hop_number - b.hop_number));

      res.json({
        success: true,
        data: validTraceRuns,
        count: validTraceRuns.length,
        total_available: data?.length || 0,
        message: 'Network data retrieved successfully'
      });
    } catch (error) {
      console.error('Error fetching network data:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch network data',
        details: error.message
      });
    }
  }

  // Get unique destinations
  async getDestinations(req, res) {
    try {
      // optional query params: ?q=face&limit=5000
      const q = (req.query.q || '').trim();
      const limit = Math.min(parseInt(req.query.limit || '10000', 10), 50000); // safety cap

      let query = supabase
        .from('destinations')
        .select('id,address,domain:domain_id(id,name)')       // already unique by design
        .order('address', { ascending: true })
        .range(0, limit - 1);                 // avoid PostgREST 1k default

      if (q) query = query.ilike('address', `%${q}%`);

      const { data, error } = await query;
      if (error) throw error;

      const grouped = {};
      data.forEach(row => {
        const dn = row.domain?.name || '(unassigned)';
        if (!grouped[dn]) grouped[dn] = { domain: { id: row.domain?.id || null, name: dn }, destinations: [] };
        grouped[dn].destinations.push({ id: row.id, address: row.address });
      });

      res.json({ success: true, data: grouped, count: data.length });
    } catch (error) {
      console.error('Error fetching destinations:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch destinations',
        details: error.message
      });
    }
  }

  // Get available protocols from traceroute methods
  async getProtocols(req, res) {
    try {
      const {
        destinations,   // comma-separated list of addresses or ids
        start_date,
        end_date
      } = req.query;

      // Pull protocols only from trace_runs that match filters
      const selectStr = `
        id,
        timestamp,
        destinations:destination_id(
          address,
          domain:domain_id(name,id)
        ),
        traceroute_methods(name,description)
      `;

      let query = supabase
        .from('trace_runs')
        .select(selectStr)
        .order('timestamp', { ascending: false })
        .limit(10000); // safety cap

      if (destinations) {
        const raw = destinations;
        const items = Array.isArray(raw) ? raw : String(raw).split(',');
        const ids = items.filter(x => /^\d+$/.test(x.trim())).map(x => x.trim());
        const addrs = items.filter(x => !/^\d+$/.test(x.trim())).map(x => x.trim());
        if (ids.length) query = query.in('destination_id', ids);
        if (addrs.length) query = query.in('destinations.address', addrs);
      }

      if (start_date) query = query.gte('timestamp', start_date);
      if (end_date) query = query.lte('timestamp', end_date);

      const { data, error } = await query;
      if (error) throw error;

      // Unique, normalized protocol names from joined traceroute_methods
      const protocols = Array.from(new Set(
        (data || [])
          .map(r => r?.traceroute_methods?.description || r?.traceroute_methods?.name)
          .filter(Boolean)
          .map(s => String(s).trim())
      )).sort();

      res.json({
        success: true,
        data: protocols,
        count: protocols.length
      });
    } catch (error) {
      console.error('Error fetching protocols:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch protocols',
        details: error.message
      });
    }
  }

  async getAggregatedPaths(req, res) {
    try {
      console.time('getAggregatedPaths');
      const { destinations, protocols, start_date, end_date, fastest, shortest, debug } = req.query;
  const self = this; // defensive reference

      // Accept both numeric destination IDs and address strings; resolve addresses to IDs
      let destIds = null;
      let unresolvedAddresses = [];
      if (destinations) {
  const rawItems = destinations.split(',');
  // Drop malformed tokens like 'destinations=2491'
  const items = rawItems.map(s => s.trim()).filter(t => t && !t.includes('='));
        const numericIds = items.filter(v => /^\d+$/.test(v)).map(v => parseInt(v, 10));
        const addrCandidates = items.filter(v => !/^\d+$/.test(v));
        // Filter out entries that look like invalid hostnames quickly (allow dots / letters / hyphens)
        const addressItems = addrCandidates.filter(v => /[a-zA-Z]/.test(v));
        unresolvedAddresses = addressItems;
        let resolvedIds = [];
        if (addressItems.length) {
          const { data: destRows, error: destErr } = await supabase
            .from('destinations')
            .select('id,address')
            .in('address', addressItems);
          if (destErr) throw destErr;
            resolvedIds = (destRows || []).map(r => r.id);
          // Track which addresses failed to resolve
          unresolvedAddresses = addressItems.filter(a => !destRows.find(r => r.address === a));
        }
        destIds = [...numericIds, ...resolvedIds];
        if (!destIds.length) destIds = null; // if nothing resolved keep null
      }
      const protoList = protocols
        ? protocols.split(',').map(s => s.trim().toUpperCase()).filter(Boolean)
        : null;

      const { data: groups, error } = await supabase.rpc('get_aggregated_paths', {
        p_destination_ids: destIds,
        p_protocols: protoList,
        p_start: start_date || null,
        p_end: end_date || null
      });
      if (error) throw error;
  const debugInfo = debug ? { input: { destinations, resolved_destination_ids: destIds, unresolved_addresses: unresolvedAddresses, protocols: protoList, start_date, end_date }, rpc_group_count: groups?.length || 0 } : undefined;

      // If empty, still return JSON (maybe filters too restrictive or underlying view has no data)
      if (!groups || groups.length === 0) {
        console.warn('[getAggregatedPaths] RPC returned 0 rows', debugInfo || '');
        return res.json({ success: true, data: {}, debug: debugInfo });
      }
      // Organize by destination
      const byDest = new Map();
      (groups || []).forEach(row => {
        const dest = row.destination_id;
        if (!byDest.has(dest)) byDest.set(dest, []);
        byDest.get(dest).push(row);
      });

      // Cache key (exclude debug param)
      const cacheKey = aggregatedPathsCache.makeKey({
        destIds,
        protocols: protoList,
        start: start_date,
        end: end_date,
        fastest: Boolean(fastest),
        shortest: Boolean(shortest)
      });

      // Serve from cache if available and not requesting debug forced miss
      if (!debug) {
        const cached = aggregatedPathsCache.get(cacheKey);
        if (cached) {
          console.timeEnd('getAggregatedPaths');
          return res.json({ success: true, data: cached, cached: true });
        }
      }

      const result = {};
      // Build destination id => address map for all destinations appearing in groups
      const allDestIds = Array.from(byDest.keys());
      let destAddressMap = new Map();
      if (allDestIds.length) {
        const { data: destRows, error: destRowsErr } = await supabase
          .from('destinations')
          .select('id,address')
          .in('id', allDestIds);
        if (destRowsErr) throw destRowsErr;
        destAddressMap = new Map((destRows || []).map(r => [r.id, r.address]));
      }

  for (const [destId, rows] of byDest.entries()) {
        // Group by protocol
        const protoMap = new Map();
        rows.forEach(r => {
          const p = r.protocol || 'UNKNOWN';
          if (!protoMap.has(p)) protoMap.set(p, []);
          protoMap.get(p).push(r);
        });

        let primary_path = null;
        let alternatives = [];
        const allProtoPaths = []; // collect for global fastest/shortest selection
        const protocol_groups = {};

        for (const [proto, list] of protoMap.entries()) {
          // Rank
          list.sort((a, b) => {
            if (b.run_count !== a.run_count) return b.run_count - a.run_count;
            if (a.path_avg_rtt !== b.path_avg_rtt) return a.path_avg_rtt - b.path_avg_rtt;
            if (a.hop_count !== b.hop_count) return a.hop_count - b.hop_count;
            return a.signature.localeCompare(b.signature);
          });

          // Identify fastest & shortest if requested
          const fastestPath = fastest
            ? [...list].sort((a, b) => {
              if (a.path_avg_rtt !== b.path_avg_rtt) return a.path_avg_rtt - b.path_avg_rtt;
              if (a.run_count !== b.run_count) return b.run_count - a.run_count;
              return a.hop_count - b.hop_count;
            })[0]
            : null;

          const shortestPath = shortest
            ? [...list].sort((a, b) => {
              if (a.hop_count !== b.hop_count) return a.hop_count - b.hop_count;
              if (a.path_avg_rtt !== b.path_avg_rtt) return a.path_avg_rtt - b.path_avg_rtt;
              return b.run_count - a.run_count;
            })[0]
            : null;

          const primary = list[0];
          const totalProtoRuns = list.reduce((s, r) => s + r.run_count, 0);

          const protoPrimaryPath = await self.buildPathObject(primary, totalProtoRuns);
          const protoAlternatives = await Promise.all(
            list.slice(1).map(r => self.buildPathObject(r, totalProtoRuns))
          );

          const fastestObj = (fastestPath && fastestPath.signature !== primary.signature)
            ? await self.buildPathObject(fastestPath, totalProtoRuns)
            : null;
          const shortestObj = (shortestPath && shortestPath.signature !== primary.signature && (!fastestObj || shortestPath.signature !== fastestPath.signature))
            ? await self.buildPathObject(shortestPath, totalProtoRuns)
            : null;

          protocol_groups[proto] = {
            primary_path: protoPrimaryPath,
            fastest_path: fastestObj,
            shortest_path: shortestObj,
            alternatives: protoAlternatives,
            total_traces: totalProtoRuns
          };

          if (!primary_path || primary.run_count > primary_path.count) {
            primary_path = protoPrimaryPath;
          }
          alternatives.push(...protoAlternatives);

          // collect for global fastest/shortest
          allProtoPaths.push({ proto, obj: protoPrimaryPath, raw: primary });
          if (fastestObj) allProtoPaths.push({ proto, obj: fastestObj, raw: fastestPath });
          if (shortestObj) allProtoPaths.push({ proto, obj: shortestObj, raw: shortestPath });
        }

        const totalDestRuns = rows.reduce((s, r) => s + r.run_count, 0);

        // Recompute top-level usage percents
        if (primary_path) primary_path.percent = +(primary_path.count / totalDestRuns * 100).toFixed(2);
        alternatives.forEach(a => { a.percent = +(a.count / totalDestRuns * 100).toFixed(2); });

        // Determine fastest / shortest globally
        const fastestGlobal = [...allProtoPaths].sort((a, b) => {
          if (a.raw.path_avg_rtt !== b.raw.path_avg_rtt) return a.raw.path_avg_rtt - b.raw.path_avg_rtt;
          return b.raw.run_count - a.raw.run_count;
        })[0]?.obj;

        const shortestGlobal = [...allProtoPaths].sort((a, b) => {
          if (a.raw.hop_count !== b.raw.hop_count) return a.raw.hop_count - b.raw.hop_count;
          if (a.raw.path_avg_rtt !== b.raw.path_avg_rtt) return a.raw.path_avg_rtt - b.raw.path_avg_rtt;
          return b.raw.run_count - a.raw.run_count;
        })[0]?.obj;

        const destAddress = destAddressMap.get(destId) || String(destId);
        result[destAddress] = {
          destination_id: destId,
          primary_path,
          fastest_path: fastestGlobal && fastestGlobal !== primary_path ? fastestGlobal : null,
          shortest_path: shortestGlobal &&
            shortestGlobal !== primary_path &&
            shortestGlobal !== fastestGlobal ? shortestGlobal : null,
          alternatives,
          total_traces: totalDestRuns,
          protocol_groups
        };
  }
  console.timeEnd('getAggregatedPaths');
  // Store in cache
  aggregatedPathsCache.set(cacheKey, result);
  return res.json({ success: true, data: result, debug: debugInfo, cached: false });
      
    } catch (e) {
      console.error('getAggregatedPaths error:', e);
      if (e && typeof e.message === 'string' && e.message.includes('invalid input syntax for type inet')) {
        return res.status(400).json({
          success: false,
            error: 'Bad destination filter',
          details: 'One or more provided destinations are not valid numeric IDs or resolvable addresses.',
          hint: 'Send numeric destination IDs (preferred) or valid addresses. Avoid passing repeated query keys like destinations=2490,destinations=2491.'
        });
      }
      return res.status(500).json({ success: false, error: 'Aggregation failed', details: e.message });
    }
  }

  /**
   * Internal helper (non-Express) to compute aggregated paths result for caching.
   * Mirrors getAggregatedPaths core logic but returns the result object directly.
   */
  async _computeAggregated({ destIds = null, protoList = null, start_date = null, end_date = null, fastest = false, shortest = false }) {
    const { data: groups, error } = await supabase.rpc('get_aggregated_paths', {
      p_destination_ids: destIds && destIds.length ? destIds : null,
      p_protocols: protoList && protoList.length ? protoList : null,
      p_start: start_date || null,
      p_end: end_date || null
    });
    if (error) throw error;
    if (!groups || groups.length === 0) return {};

    const byDest = new Map();
    groups.forEach(row => {
      const dest = row.destination_id;
      if (!byDest.has(dest)) byDest.set(dest, []);
      byDest.get(dest).push(row);
    });

    const allDestIds = Array.from(byDest.keys());
    let destAddressMap = new Map();
    if (allDestIds.length) {
      const { data: destRows, error: destRowsErr } = await supabase
        .from('destinations')
        .select('id,address')
        .in('id', allDestIds);
      if (destRowsErr) throw destRowsErr;
      destAddressMap = new Map((destRows || []).map(r => [r.id, r.address]));
    }

    const result = {};
    for (const [destId, rows] of byDest.entries()) {
      const protoMap = new Map();
      rows.forEach(r => {
        const p = r.protocol || 'UNKNOWN';
        if (!protoMap.has(p)) protoMap.set(p, []);
        protoMap.get(p).push(r);
      });
      let primary_path = null;
      let alternatives = [];
      const allProtoPaths = [];
      const protocol_groups = {};
      for (const [proto, list] of protoMap.entries()) {
        list.sort((a, b) => {
          if (b.run_count !== a.run_count) return b.run_count - a.run_count;
            if (a.path_avg_rtt !== b.path_avg_rtt) return a.path_avg_rtt - b.path_avg_rtt;
          if (a.hop_count !== b.hop_count) return a.hop_count - b.hop_count;
          return a.signature.localeCompare(b.signature);
        });
        const fastestPath = fastest ? [...list].sort((a, b) => {
          if (a.path_avg_rtt !== b.path_avg_rtt) return a.path_avg_rtt - b.path_avg_rtt;
          if (a.run_count !== b.run_count) return b.run_count - a.run_count;
          return a.hop_count - b.hop_count;
        })[0] : null;
        const shortestPath = shortest ? [...list].sort((a, b) => {
          if (a.hop_count !== b.hop_count) return a.hop_count - b.hop_count;
          if (a.path_avg_rtt !== b.path_avg_rtt) return a.path_avg_rtt - b.path_avg_rtt;
          return b.run_count - a.run_count;
        })[0] : null;
        const primary = list[0];
        const totalProtoRuns = list.reduce((s, r) => s + r.run_count, 0);
        const protoPrimaryPath = await this.buildPathObject(primary, totalProtoRuns);
        const protoAlternatives = await Promise.all(list.slice(1).map(r => this.buildPathObject(r, totalProtoRuns)));
        const fastestObj = (fastestPath && fastestPath.signature !== primary.signature)
          ? await this.buildPathObject(fastestPath, totalProtoRuns) : null;
        const shortestObj = (shortestPath && shortestPath.signature !== primary.signature && (!fastestObj || shortestPath.signature !== fastestPath.signature))
          ? await this.buildPathObject(shortestPath, totalProtoRuns) : null;
        protocol_groups[proto] = {
          primary_path: protoPrimaryPath,
          fastest_path: fastestObj,
          shortest_path: shortestObj,
          alternatives: protoAlternatives,
          total_traces: totalProtoRuns
        };
        if (!primary_path || primary.run_count > primary_path.count) primary_path = protoPrimaryPath;
        alternatives.push(...protoAlternatives);
        allProtoPaths.push({ proto, obj: protoPrimaryPath, raw: primary });
        if (fastestObj) allProtoPaths.push({ proto, obj: fastestObj, raw: fastestPath });
        if (shortestObj) allProtoPaths.push({ proto, obj: shortestObj, raw: shortestPath });
      }
      const totalDestRuns = rows.reduce((s, r) => s + r.run_count, 0);
      if (primary_path) primary_path.percent = +(primary_path.count / totalDestRuns * 100).toFixed(2);
      alternatives.forEach(a => { a.percent = +(a.count / totalDestRuns * 100).toFixed(2); });
      const fastestGlobal = fastest ? [...allProtoPaths].sort((a, b) => {
        if (a.raw.path_avg_rtt !== b.raw.path_avg_rtt) return a.raw.path_avg_rtt - b.raw.path_avg_rtt;
        return b.raw.run_count - a.raw.run_count;
      })[0]?.obj : null;
      const shortestGlobal = shortest ? [...allProtoPaths].sort((a, b) => {
        if (a.raw.hop_count !== b.raw.hop_count) return a.raw.hop_count - b.raw.hop_count;
        if (a.raw.path_avg_rtt !== b.raw.path_avg_rtt) return a.raw.path_avg_rtt - b.raw.path_avg_rtt;
        return b.raw.run_count - a.raw.run_count;
      })[0]?.obj : null;
      const destAddress = destAddressMap.get(destId) || String(destId);
      result[destAddress] = {
        destination_id: destId,
        primary_path,
        fastest_path: fastestGlobal && fastestGlobal !== primary_path ? fastestGlobal : null,
        shortest_path: shortestGlobal && shortestGlobal !== primary_path && shortestGlobal !== fastestGlobal ? shortestGlobal : null,
        alternatives,
        total_traces: totalDestRuns,
        protocol_groups
      };
    }
    return result;
  }

  /** Pre-warm cache at startup or via manual trigger */
  async prewarmAggregatedPaths({ destinations, protocols, lookbackMinutes = 60, fastest = false, shortest = false } = {}) {
    try {
      const destIds = Array.isArray(destinations)
        ? destinations.map(d => parseInt(d, 10)).filter(n => !isNaN(n))
        : (typeof destinations === 'string' && destinations.trim() ? destinations.split(',').map(d => parseInt(d, 10)).filter(n => !isNaN(n)) : null);
      const protoList = Array.isArray(protocols)
        ? protocols.map(p => String(p).trim().toUpperCase()).filter(Boolean)
        : (typeof protocols === 'string' && protocols.trim() ? protocols.split(',').map(p => p.trim().toUpperCase()).filter(Boolean) : null);
      const end = new Date();
      const start = new Date(end.getTime() - lookbackMinutes * 60 * 1000);
      const start_iso = start.toISOString();
      const end_iso = end.toISOString();
      const key = aggregatedPathsCache.makeKey({ destIds, protocols: protoList, start: start_iso, end: end_iso, fastest, shortest });
      const existing = aggregatedPathsCache.get(key);
      if (existing) return { cached: true, key };
      const computed = await this._computeAggregated({ destIds, protoList, start_date: start_iso, end_date: end_iso, fastest, shortest });
      aggregatedPathsCache.set(key, computed);
      return { cached: false, key, count: Object.keys(computed).length };
    } catch (e) {
      console.error('Prewarm failed:', e.message);
      return { error: e.message };
    }
  }

  async handlePrewarm(req, res) {
    try {
      const token = process.env.PREWARM_TOKEN;
      if (token) {
        const provided = req.headers['x-prewarm-token'] || req.query.token;
        if (provided !== token) return res.status(401).json({ success: false, error: 'Unauthorized' });
      }
      const { destinations, protocols, lookback_minutes, fastest, shortest } = req.body || req.query;
      const result = await this.prewarmAggregatedPaths({
        destinations,
        protocols,
        lookbackMinutes: lookback_minutes ? parseInt(lookback_minutes, 10) : 60,
        fastest: Boolean(fastest),
        shortest: Boolean(shortest)
      });
      res.json({ success: !result.error, data: result });
    } catch (e) {
      res.status(500).json({ success: false, error: 'Prewarm failed', details: e.message });
    }
  }

  // Helper: convert aggregated row to frontend path object
   async buildPathObject(row, totalRunsForPercent) {
      if (!row) return null;
      const sampleRun = row.sample_run_ids?.[0];
      let path = [];
      let runTimestamp = null;
      if (sampleRun) {
        const { data: hopsData, error: hopsErr } = await supabase
          .from('hops')
          .select('hop_number, ip, hostname, rtt1, rtt2, rtt3')
          .eq('trace_run_id', sampleRun)
          .order('hop_number');
        if (hopsErr) throw hopsErr;
        // fetch representative run timestamp so frontend date-range filter keeps it
        const { data: runMeta, error: runErr } = await supabase
          .from('trace_runs')
          .select('timestamp')
          .eq('id', sampleRun)
          .single();
        if (runErr) {
          // non-fatal; leave timestamp null
          console.warn('Failed to fetch timestamp for run', sampleRun, runErr.message);
        } else {
          runTimestamp = runMeta?.timestamp || null;
        }
        path = (hopsData || []).map(h => ({
          hop_number: h.hop_number,
          ip: h.ip,
          hostname: h.hostname,
          rtt_ms: [h.rtt1, h.rtt2, h.rtt3].filter(v => v !== null && v !== undefined),
          is_timeout: !h.ip,
          protocol: row.protocol
        }));
      }
      const percent = totalRunsForPercent
        ? +(row.run_count / totalRunsForPercent * 100).toFixed(2)
        : 0;
      return {
        path,
        count: row.run_count,
        percent,
        avg_rtt: Math.round(row.path_avg_rtt * 100) / 100,
        timeStamp: runTimestamp || new Date().toISOString(),
        protocol: row.protocol
      };
    }




  // Health check for the controller
  async healthCheck(req, res) {
      try {
        const { count, error } = await supabase
          .from('traceroute_methods')
          .select('*', { count: 'exact', head: true });

        if (error) {
          throw error;
        }

        res.json({
          success: true,
          message: 'Traceroute controller is healthy',
          database_status: 'connected',
          methods_count: count || 0
        });
      } catch (error) {
        console.error('Health check failed:', error);
        res.status(500).json({
          success: false,
          error: 'Health check failed',
          details: error.message
        });
      }
    }
  }

      module.exports = new TracerouteController(); 