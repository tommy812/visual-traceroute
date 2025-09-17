/**
 * Request Validation Service - Handles validation and sanitization of request parameters
 * Single Responsibility: Request validation and parameter processing
 * Implements: IRequestValidator interface
 */

const { DateTime } = require('luxon');
const Logger = require('../utils/logger');
const IRequestValidator = require('../interfaces/IRequestValidator');

const LONDON = 'Europe/London';

class RequestValidationService extends IRequestValidator {
  validateGetAggregatedPathsParams(req) {
    const {
      destinations,
      start_date,
      end_date,
      protocols = ['icmp', 'udp', 'tcp']
    } = req.query;

    // Validate destinations
    const destIds = this.parseDestinations(destinations);
    if (!destIds || destIds.length === 0) {
      throw new Error('destinations parameter is required and must contain valid destination IDs');
    }

    // Validate and parse dates
    const { startDate, endDate } = this.validateDateRange(start_date, end_date);

    // Validate protocols
    const protoList = this.validateProtocols(protocols);

    return {
      destIds,
      startDate,
      endDate,
      protoList
    };
  }

  parseDestinations(destinations) {
    if (!destinations) {
      return null;
    }

    try {
      let destIds;
      if (typeof destinations === 'string') {
        destIds = destinations.split(',').map(id => parseInt(id.trim(), 10));
      } else if (Array.isArray(destinations)) {
        destIds = destinations.map(id => parseInt(id, 10));
      } else {
        destIds = [parseInt(destinations, 10)];
      }

      // Filter out invalid IDs
      const validIds = destIds.filter(id => !isNaN(id) && id > 0);
      
      if (validIds.length === 0) {
        throw new Error('No valid destination IDs provided');
      }

      return validIds;
    } catch (error) {
      Logger.error('Error parsing destinations:', error);
      throw new Error('Invalid destinations format');
    }
  }

  validateDateRange(startDateStr, endDateStr) {
    try {
      let startDate, endDate;

      if (startDateStr) {
        startDate = DateTime.fromISO(startDateStr, { zone: LONDON });
        if (!startDate.isValid) {
          throw new Error('Invalid start_date format. Use ISO format.');
        }
      } else {
        // Default to 7 days ago if not provided
        startDate = DateTime.now().setZone(LONDON).minus({ days: 7 });
      }

      if (endDateStr) {
        endDate = DateTime.fromISO(endDateStr, { zone: LONDON });
        if (!endDate.isValid) {
          throw new Error('Invalid end_date format. Use ISO format.');
        }
      } else {
        // Default to now if not provided
        endDate = DateTime.now().setZone(LONDON);
      }

      // Ensure start is before end
      if (startDate >= endDate) {
        throw new Error('start_date must be before end_date');
      }

      // Ensure reasonable date range (max 90 days)
      const daysDiff = endDate.diff(startDate, 'days').days;
      if (daysDiff > 90) {
        throw new Error('Date range cannot exceed 90 days');
      }

      return {
        startDate: startDate.toISO(),
        endDate: endDate.toISO()
      };
    } catch (error) {
      Logger.error('Date validation error:', error);
      throw error;
    }
  }

  validateProtocols(protocols) {
    const validProtocols = ['icmp', 'udp', 'tcp'];
    let protoList;

    if (typeof protocols === 'string') {
      protoList = protocols.split(',').map(p => p.trim().toLowerCase());
    } else if (Array.isArray(protocols)) {
      protoList = protocols.map(p => String(p).trim().toLowerCase());
    } else {
      protoList = ['icmp', 'udp', 'tcp']; // Default
    }

    // Filter to only valid protocols
    const filteredProtocols = protoList.filter(p => validProtocols.includes(p));
    
    if (filteredProtocols.length === 0) {
      // If no valid protocols, use defaults
      return ['icmp', 'udp', 'tcp'];
    }

    return filteredProtocols;
  }

  sanitizeQueryParams(params) {
    const sanitized = {};
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        // Basic sanitization - remove potentially harmful characters
        if (typeof value === 'string') {
          sanitized[key] = value.trim().replace(/[<>\"'&]/g, '');
        } else {
          sanitized[key] = value;
        }
      }
    });

    return sanitized;
  }
}

module.exports = new RequestValidationService();
