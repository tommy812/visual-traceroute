/**
 * Request Validator Interface
 * Defines the contract for request validation services
 */

class IRequestValidator {
  /**
   * Validate aggregated paths request parameters
   * @param {Object} req - Express request object
   * @returns {Object} Validated parameters
   */
  validateGetAggregatedPathsParams(req) {
    throw new Error('validateGetAggregatedPathsParams must be implemented');
  }

  /**
   * Parse destinations from request
   * @param {string|Array} destinations - Destinations parameter
   * @returns {Array} Parsed destination IDs
   */
  parseDestinations(destinations) {
    throw new Error('parseDestinations must be implemented');
  }

  /**
   * Validate date range
   * @param {string} startDate - Start date string
   * @param {string} endDate - End date string
   * @returns {Object} Validated date range
   */
  validateDateRange(startDate, endDate) {
    throw new Error('validateDateRange must be implemented');
  }

  /**
   * Validate protocols
   * @param {string|Array} protocols - Protocols parameter
   * @returns {Array} Validated protocols
   */
  validateProtocols(protocols) {
    throw new Error('validateProtocols must be implemented');
  }
}

module.exports = IRequestValidator;
