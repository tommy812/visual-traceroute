/**
 * Responsible for network-related calculations and normalization
 * Single Responsibility: Network calculations and protocol handling
 */
export class NetworkCalculator {
  normalizeProtocol(protocol) {
    if (!protocol) return 'unknown';
    return protocol.toLowerCase();
  }

  getNetworkPrefix(ipAddress, prefixLength = 24) {
    if (!ipAddress) return null;
    
    // Simple IPv4 prefix calculation
    const parts = ipAddress.split('.');
    if (parts.length !== 4) return null;
    
    const octets = parts.map(part => parseInt(part, 10));
    if (octets.some(octet => isNaN(octet) || octet < 0 || octet > 255)) {
      return null;
    }
    
    // Calculate network prefix based on prefix length
    const networkOctets = [];
    let remainingBits = prefixLength;
    
    for (let i = 0; i < 4; i++) {
      if (remainingBits >= 8) {
        networkOctets.push(octets[i]);
        remainingBits -= 8;
      } else if (remainingBits > 0) {
        const mask = 255 << (8 - remainingBits);
        networkOctets.push(octets[i] & mask);
        remainingBits = 0;
      } else {
        networkOctets.push(0);
      }
    }
    
    return `${networkOctets.join('.')}/${prefixLength}`;
  }

  aggregateHopData(hops) {
    if (!Array.isArray(hops) || hops.length === 0) {
      return null;
    }

    // Group hops by IP address
    const hopGroups = new Map();
    
    hops.forEach(hop => {
      const key = hop.ip_address || 'timeout';
      if (!hopGroups.has(key)) {
        hopGroups.set(key, []);
      }
      hopGroups.get(key).push(hop);
    });

    // Create aggregated hop data
    const aggregatedHops = Array.from(hopGroups.entries()).map(([ip, hopList]) => {
      if (ip === 'timeout') {
        return {
          ip_address: null,
          is_timeout: true,
          hop_number: hopList[0].hop_number,
          occurrences: hopList.length
        };
      }

      const validRtts = hopList
        .filter(hop => hop.rtt_ms && hop.rtt_ms > 0)
        .map(hop => hop.rtt_ms);

      return {
        ip_address: ip,
        is_timeout: false,
        hop_number: hopList[0].hop_number,
        rtt_ms: validRtts.length > 0 ? 
          validRtts.reduce((sum, rtt) => sum + rtt, 0) / validRtts.length : null,
        min_rtt: validRtts.length > 0 ? Math.min(...validRtts) : null,
        max_rtt: validRtts.length > 0 ? Math.max(...validRtts) : null,
        occurrences: hopList.length,
        asn: hopList[0].asn || null,
        hostname: hopList[0].hostname || null
      };
    });

    return aggregatedHops.sort((a, b) => a.hop_number - b.hop_number);
  }

  calculateNetworkDistance(ip1, ip2) {
    if (!ip1 || !ip2) return Infinity;
    
    const parts1 = ip1.split('.').map(x => parseInt(x, 10));
    const parts2 = ip2.split('.').map(x => parseInt(x, 10));
    
    if (parts1.length !== 4 || parts2.length !== 4) return Infinity;
    
    // Simple Hamming distance for IP addresses
    let distance = 0;
    for (let i = 0; i < 4; i++) {
      distance += Math.abs(parts1[i] - parts2[i]);
    }
    
    return distance;
  }

  isPrivateIP(ip) {
    if (!ip) return false;
    
    const parts = ip.split('.').map(x => parseInt(x, 10));
    if (parts.length !== 4) return false;
    
    // Check for private IP ranges
    return (
      (parts[0] === 10) ||
      (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
      (parts[0] === 192 && parts[1] === 168) ||
      (parts[0] === 127) // localhost
    );
  }
}

const networkCalculatorInstance = new NetworkCalculator();
export default networkCalculatorInstance;
