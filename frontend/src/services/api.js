const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api/traceroute';

class ApiService {
  async makeRequest(endpoint, options = {}) {
    try {
      const url = `${API_BASE_URL}${endpoint}`;
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
        },
        ...options
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'API request failed');
      }

      return data;
    } catch (error) {
      console.error(`API request failed for ${endpoint}:`, error);
      throw error;
    }
  }

  // Get all traceroute methods
  async getMethods() {
    return this.makeRequest('/methods');
  }

  // Get unique destinations
  async getDestinations() {
    const res = await this.makeRequest('/destinations');
    // Expect backend shape: { success:true, data: { <domain>: { domain_id, destinations:[{id,address}] } } }
    const grouped = res?.data || {};
    const flat = [];
    Object.entries(grouped).forEach(([domain, obj]) => {
      (obj?.destinations || []).forEach(d => {
        flat.push({
          id: d.id,
            address: d.address,
            domain
        });
      });
    });
    return { grouped, flat };
  }

  // Get trace runs with filtering
  async getTraceRuns(filters = {}) {
    const params = new URLSearchParams();
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') {
        if (Array.isArray(value)) {
          params.append(key, value.join(','));
        } else {
          params.append(key, value);
        }
      }
    });

    const queryString = params.toString();
    const endpoint = queryString ? `/runs?${queryString}` : '/runs';
    
    return this.makeRequest(endpoint);
  }

  // Get a specific trace run with hops
  async getTraceRunById(id) {
    return this.makeRequest(`/runs/${id}`);
  }

  // Get network data for visualization
  async getNetworkData(filters = {}) {
    const params = new URLSearchParams();
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') {
        if (Array.isArray(value)) {
          params.append(key, value.join(','));
        } else {
          params.append(key, value);
        }
      }
    });

    const queryString = params.toString();
    const endpoint = queryString ? `/network-data?${queryString}` : '/network-data';
    
    return this.makeRequest(endpoint);
  }
  
  async getProtocols() {
    return this.makeRequest('/protocols');
  }

  // Health check
  async healthCheck() {
    return this.makeRequest('/health');
  }
  
}

const apiService = new ApiService();
export default apiService; 