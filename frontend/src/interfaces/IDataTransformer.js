/**
 * Data Transformer Interface
 * Defines the contract for data transformation services
 * Follows Interface Segregation Principle - focused interface
 */

export class IDataTransformer {
  /**
   * Transform raw network data into structured format
   * @param {Array} rawData - Raw network data
   * @param {Object} options - Transformation options
   * @returns {Object} Transformed data
   */
  transformNetworkData(rawData, options = {}) {
    throw new Error('transformNetworkData must be implemented');
  }

  /**
   * Validate transformed data structure
   * @param {Object} data - Data to validate
   * @returns {boolean} Validation result
   */
  validateTransformedData(data) {
    throw new Error('validateTransformedData must be implemented');
  }
}

export default IDataTransformer;
