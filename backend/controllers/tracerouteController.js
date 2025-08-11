const { supabase } = require('../config/database');

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
      destinations:destination_id(id,address)
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
      destinations:destination_id(id,address)
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
      destinations:destination_id(id,address),
      hops(
        id,
        hop_number,
        ip,
        hostname,
        rtt1,
        rtt2,
        rtt3,
        extra
      )
    `;

      let query = supabase
        .from('trace_runs')
        .select(selectStr)
        .order('timestamp', { ascending: false });

      // Destination filtering: accept ids or addresses
      if (destinations) {
        const items = destinations.split(',').map(s => s.trim()).filter(Boolean);
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

      if (protocol) query = query.eq('traceroute_methods.description', protocol);
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
        .select('id,address')                 // already unique by design
        .order('address', { ascending: true })
        .range(0, limit - 1);                 // avoid PostgREST 1k default

      if (q) query = query.ilike('address', `%${q}%`);

      const { data, error } = await query;
      if (error) throw error;

      res.json({
        success: true,
        data,                                 // [{id, address}, ...]
        count: data.length
      });
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
      const { data, error } = await supabase
        .from('traceroute_methods')
        .select('description')
        .order('description');

      if (error) {
        throw error;
      }

      // Extract unique protocol names
      const protocols = [...new Set(data.map(method => method.description))];

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