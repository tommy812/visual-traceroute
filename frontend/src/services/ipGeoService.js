/**
 * IP Geolocation Service using ip-api.com
 * Provides geolocation, ISP, and other metadata for IP addresses
 */

import logger from "../utils/logger";

class IPGeoService {
  constructor() {
  // point to backend proxy which exposes HTTPS to the frontend
  // In development, default to the backend on port 3001 if env var not provided
  this.baseURL = process.env.REACT_APP_IPGEO_BACKEND || (process.env.NODE_ENV === 'development' ? 'http://localhost:3001/api/ipgeo' : '/api/ipgeo');
    this.cache = new Map(); // Cache responses to avoid repeated API calls
    this.requestQueue = new Map(); // Prevent duplicate concurrent requests
  }

  /**
   * Get geolocation and ISP information for an IP address
   * @param {string} ip - The IP address to lookup
   * @returns {Promise<Object>} IP information object
   */
  async getIPInfo(ip) {
    logger.log('getIPInfo called with IP:', ip);
    
    // Return null for invalid or private IPs
    if (!ip || !this.isValidPublicIP(ip)) {
      logger.log('IP is invalid or private:', ip);
      return null;
    }

    // Check cache first
    if (this.cache.has(ip)) {
      logger.log('Returning cached result for IP:', ip);
      return this.cache.get(ip);
    }

    // Check if request is already in progress
    if (this.requestQueue.has(ip)) {
      logger.log('Request already in progress for IP:', ip);
      return this.requestQueue.get(ip);
    }

    logger.log('Making new API request for IP:', ip);
    
    // Create new request
    const requestPromise = this.fetchIPInfo(ip);
    this.requestQueue.set(ip, requestPromise);

    try {
      const result = await requestPromise;
      
      // Cache successful results
      if (result && result.status === 'success') {
        logger.log('Caching successful result for IP:', ip);
        this.cache.set(ip, result);
      } else {
        logger.log('Not caching result for IP:', ip, 'Status:', result?.status);
      }
      
      return result;
    } catch (error) {
      console.error(`Error fetching IP info for ${ip}:`, error);
      return null;
    } finally {
      // Remove from queue
      logger.log('Removing IP from request queue:', ip);
      this.requestQueue.delete(ip);
    }
  }

  /**
   * Fetch IP information from ip-api.com
   * @param {string} ip - The IP address
   * @returns {Promise<Object>} Raw API response
   */
  async fetchIPInfo(ip) {
  const encodedIp = encodeURIComponent(ip);
  const url = `${this.baseURL}/${encodedIp}`;
  logger.log('Fetching IP info from backend proxy:', url, 'original ip:', ip, 'encoded:', encodedIp);

    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' }
    });

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error('Rate limited by backend');
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    logger.log('Proxy API response:', data);

    // Keep the same behavior: return raw data and let caller use formatIPInfo
    return data;
  }

  /**
   * Check if an IP address is valid and public
   * @param {string} ip - IP address to validate
   * @returns {boolean} True if valid public IP
   */
  isValidPublicIP(ip) {
    if (!ip || typeof ip !== 'string') {
      return false;
    }

    // Basic IP format validation
    const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    
    // More comprehensive IPv6 regex that handles compressed notation (::)
    const ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;

    const isIPv4 = ipv4Regex.test(ip);
    const isIPv6 = ipv6Regex.test(ip);

    if (!isIPv4 && !isIPv6) {
      logger.log('IP format validation failed for:', ip);
      return false;
    }

    // Check for private/reserved IPv4 ranges
    if (isIPv4) {
      const parts = ip.split('.').map(Number);
      
      // Private ranges
      if (parts[0] === 10) return false; // 10.0.0.0/8
      if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return false; // 172.16.0.0/12
      if (parts[0] === 192 && parts[1] === 168) return false; // 192.168.0.0/16
      
      // Loopback
      if (parts[0] === 127) return false; // 127.0.0.0/8
      
      // Link-local
      if (parts[0] === 169 && parts[1] === 254) return false; // 169.254.0.0/16
      
      // Multicast
      if (parts[0] >= 224 && parts[0] <= 239) return false; // 224.0.0.0/4
      
      // Reserved
      if (parts[0] >= 240) return false; // 240.0.0.0/4
    }

    // Check for private/reserved IPv6 ranges
    if (isIPv6) {
      const ipLower = ip.toLowerCase();
      
      // Loopback ::1
      if (ipLower === '::1') return false;
      
      // Link-local fe80::/10
      if (ipLower.startsWith('fe80:')) return false;
      
      // Unique local fc00::/7 and fd00::/8
      if (ipLower.startsWith('fc') || ipLower.startsWith('fd')) return false;
      
      // Multicast ff00::/8
      if (ipLower.startsWith('ff')) return false;
      
      // Documentation prefix 2001:db8::/32
      if (ipLower.startsWith('2001:db8:')) return false;
    }

    logger.log('IP validation passed for:', ip, isIPv4 ? '(IPv4)' : '(IPv6)');
    return true;
  }

  /**
   * Get multiple IP infos in batch (with rate limiting)
   * @param {string[]} ips - Array of IP addresses
   * @returns {Promise<Map>} Map of IP -> info data
   */
  async getBatchIPInfo(ips) {
    const results = new Map();
    const validIPs = ips.filter(ip => this.isValidPublicIP(ip));
    
    // Process IPs with delay to respect rate limits (ip-api.com allows 45 requests/minute)
    for (let i = 0; i < validIPs.length; i++) {
      const ip = validIPs[i];
      
      try {
        const info = await this.getIPInfo(ip);
        if (info) {
          results.set(ip, info);
        }
        
        // Add delay between requests (1.5 seconds to stay well under rate limit)
        if (i < validIPs.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
      } catch (error) {
        console.warn(`Failed to get info for IP ${ip}:`, error);
      }
    }
    
    return results;
  }

  /**
   * Clear cached data
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Get cache size
   * @returns {number} Number of cached entries
   */
  getCacheSize() {
    return this.cache.size;
  }

  /**
   * Format IP info for display
   * @param {Object} ipInfo - Raw IP info from API
   * @returns {Object} Formatted info object
   */
  formatIPInfo(ipInfo) {
    if (!ipInfo) {
      return null;
    }
    
    if (ipInfo.status !== 'success') {
      logger.log('IP info has non-success status:', ipInfo.status, ipInfo.message);
      return null;
    }

    const formatted = {
      status: ipInfo.status,
      country: ipInfo.country || 'Unknown',
      countryCode: ipInfo.countryCode || '',
      region: ipInfo.regionName || ipInfo.region || 'Unknown',
      city: ipInfo.city || 'Unknown', 
      zip: ipInfo.zip || '',
      coordinates: ipInfo.lat && ipInfo.lon ? {
        lat: ipInfo.lat,
        lon: ipInfo.lon
      } : null,
      timezone: ipInfo.timezone || 'Unknown',
      isp: ipInfo.isp || 'Unknown',
      organization: ipInfo.org || '',
      asn: ipInfo.as || '',
      mobile: ipInfo.mobile || false,
      proxy: ipInfo.proxy || false,
      hosting: ipInfo.hosting || false,
      fetchedAt: ipInfo.fetchedAt
    };
    
    return formatted;
  }
}

// Create and export singleton instance
const ipGeoService = new IPGeoService();
export default ipGeoService; 