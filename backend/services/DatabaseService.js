/**
 * Database Service - Handles all database operations
 * Single Responsibility: Database interactions only
 * Implements: IDatabaseService interface
 */

const { supabase } = require('../config/database');
const Logger = require('../utils/logger');
const IDatabaseService = require('../interfaces/IDatabaseService');

class DatabaseService extends IDatabaseService {
  async getTracerouteMethods() {
    try {
      const { data, error } = await supabase
        .from('traceroute_methods')
        .select('*')
        .order('id');

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error) {
      Logger.error('Database error in getTracerouteMethods:', error);
      throw error;
    }
  }

  async getAggregatedPaths({ destination_ids, start_date, end_date, protocols }) {
    try {
      Logger.time('DatabaseService.getAggregatedPaths');
      
      const { data, error } = await supabase.rpc('get_aggregated_paths', {
        p_destination_ids: destination_ids,
        p_start_date: start_date,
        p_end_date: end_date,
        p_protocols: protocols
      });

      Logger.timeEnd('DatabaseService.getAggregatedPaths');

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error) {
      Logger.error('Database error in getAggregatedPaths:', error);
      throw error;
    }
  }

  async getDestinations() {
    try {
      const { data, error } = await supabase
        .from('destinations')
        .select('*')
        .order('id');

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error) {
      Logger.error('Database error in getDestinations:', error);
      throw error;
    }
  }

  async getRunTimestamp(runId) {
    try {
      const { data, error } = await supabase
        .from('trace_runs')
        .select('timestamp')
        .eq('id', runId)
        .single();

      if (error) {
        throw error;
      }

      return data?.timestamp;
    } catch (error) {
      Logger.warn('Failed to fetch timestamp for run', runId, error.message);
      return null;
    }
  }
}

module.exports = new DatabaseService();
