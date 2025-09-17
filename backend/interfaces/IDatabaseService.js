/**
 * Database Service Interface
 * Defines the contract for database operations
 * Follows Interface Segregation Principle
 */

class IDatabaseService {
  /**
   * Get all traceroute methods
   * @returns {Promise<Array>} Traceroute methods
   */
  async getTracerouteMethods() {
    throw new Error('getTracerouteMethods must be implemented');
  }

  /**
   * Get aggregated paths from database
   * @param {Object} params - Query parameters
   * @returns {Promise<Array>} Aggregated paths
   */
  async getAggregatedPaths(params) {
    throw new Error('getAggregatedPaths must be implemented');
  }

  /**
   * Get all destinations
   * @returns {Promise<Array>} Destinations
   */
  async getDestinations() {
    throw new Error('getDestinations must be implemented');
  }

  /**
   * Get timestamp for a specific run
   * @param {number} runId - Run ID
   * @returns {Promise<string|null>} Timestamp
   */
  async getRunTimestamp(runId) {
    throw new Error('getRunTimestamp must be implemented');
  }
}

module.exports = IDatabaseService;
