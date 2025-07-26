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
        destination, 
        method_id, 
        start_date, 
        end_date, 
        limit = 100, 
        offset = 0 
      } = req.query;

      let query = supabase
        .from('trace_runs')
        .select(`
          *,
          traceroute_methods(name, version, description)
        `)
        .order('timestamp', { ascending: false });

      // Apply filters
      if (destination) {
        query = query.ilike('destination', `%${destination}%`);
      }
      
      if (method_id) {
        query = query.eq('method_id', method_id);
      }
      
      if (start_date) {
        query = query.gte('timestamp', start_date);
      }
      
      if (end_date) {
        query = query.lte('timestamp', end_date);
      }

      // Apply pagination
      query = query.range(offset, offset + limit - 1);

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      res.json({
        success: true,
        data: data || [],
        count: data?.length || 0,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset)
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

      const { data: traceRun, error: traceError } = await supabase
        .from('trace_runs')
        .select(`
          *,
          traceroute_methods(name, version, description)
        `)
        .eq('id', id)
        .single();

      if (traceError) {
        throw traceError;
      }

      if (!traceRun) {
        return res.status(404).json({
          success: false,
          error: 'Trace run not found'
        });
      }

      const { data: hops, error: hopsError } = await supabase
        .from('hops')
        .select('*')
        .eq('trace_run_id', id)
        .order('hop_number');

      if (hopsError) {
        throw hopsError;
      }

      res.json({
        success: true,
        data: {
          ...traceRun,
          hops: hops || []
        }
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
        destinations, 
        start_date, 
        end_date, 
        method_id 
      } = req.query;

      // Build the query with proper joins
      let query = supabase
        .from('trace_runs')
        .select(`
          id,
          destination,
          timestamp,
          method_id,
          traceroute_methods(
            name,
            version,
            description
          ),
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
        `)
        .order('timestamp', { ascending: false });

      // Apply filters
      if (destinations) {
        const destArray = destinations.split(',').map(d => d.trim());
        query = query.in('destination', destArray);
      }
      
      if (method_id) {
        query = query.eq('method_id', method_id);
      }
      
      if (start_date) {
        query = query.gte('timestamp', start_date);
      }
      
      if (end_date) {
        query = query.lte('timestamp', end_date);
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      // Filter out trace runs without hops
      const validTraceRuns = (data || []).filter(traceRun => 
        traceRun.hops && Array.isArray(traceRun.hops) && traceRun.hops.length > 0
      );

      // Sort hops within each trace run
      validTraceRuns.forEach(traceRun => {
        if (traceRun.hops) {
          traceRun.hops.sort((a, b) => a.hop_number - b.hop_number);
        }
      });

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
      const { data, error } = await supabase
        .from('trace_runs')
        .select('destination')
        .order('destination');

      if (error) {
        throw error;
      }

      // Get unique destinations
      const uniqueDestinations = [...new Set(data.map(row => row.destination))];

      res.json({
        success: true,
        data: uniqueDestinations,
        count: uniqueDestinations.length
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