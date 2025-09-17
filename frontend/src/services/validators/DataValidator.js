/**
 * Responsible for validating network data structures
 * Single Responsibility: Data validation only
 * Implements: IValidator interface
 */
import IValidator from '../../interfaces/IValidator';

export class DataValidator extends IValidator {
  validateTransformedData(data) {
    if (!data || typeof data !== 'object') {
      throw new Error('Data must be an object');
    }
    
    if (!Array.isArray(data.destinations)) {
      throw new Error('Data must have destinations array');
    }
    
    // Validate each destination
    data.destinations.forEach((dest, index) => {
      if (!dest.destination_name) {
        throw new Error(`Destination ${index} missing destination_name`);
      }
      
      if (!Array.isArray(dest.paths)) {
        throw new Error(`Destination ${index} must have paths array`);
      }
      
      // Validate each path
      dest.paths.forEach((path, pathIndex) => {
        if (!Array.isArray(path.hops)) {
          throw new Error(`Path ${pathIndex} in destination ${index} must have hops array`);
        }
        
        // Validate each hop
        path.hops.forEach((hop, hopIndex) => {
          if (!hop.ip_address && !hop.is_timeout) {
            throw new Error(`Hop ${hopIndex} in path ${pathIndex} of destination ${index} must have ip_address or be timeout`);
          }
        });
      });
    });
    
    return true;
  }
  
  validateNetworkData(networkData) {
    if (!networkData || !Array.isArray(networkData)) {
      throw new Error('Network data must be an array');
    }
    
    return networkData.every(run => {
      return run.destination_name && 
             Array.isArray(run.hops) && 
             run.hops.length > 0;
    });
  }
}

const dataValidatorInstance = new DataValidator();
export default dataValidatorInstance;
