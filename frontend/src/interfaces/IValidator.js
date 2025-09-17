/**
 * Validator Interface
 * Defines the contract for data validation services
 */

export class IValidator {
  /**
   * Validate transformed data structure
   * @param {Object} data - Data to validate
   * @returns {boolean} Validation result
   */
  validateTransformedData(data) {
    throw new Error('validateTransformedData must be implemented');
  }

  /**
   * Validate network data structure
   * @param {Array} networkData - Network data to validate
   * @returns {boolean} Validation result
   */
  validateNetworkData(networkData) {
    throw new Error('validateNetworkData must be implemented');
  }
}

export default IValidator;
