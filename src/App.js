import React, { useState, useEffect, useMemo, useCallback } from "react";
import NetworkGraph from "./components/NetworkGraph";
import HopDrawer from "./components/HopDrawer";
import "./styles.css";
import "./network.css";

// Import API service and data transformer
import apiService from "./services/api";
import dataTransformer from "./services/dataTransformer";

function App() {
  // State management
  const [pathData, setPathData] = useState({});
  const [loading, setLoading] = useState(false); // Changed from true to false since we don't load by default
  const [error, setError] = useState(null);
  const [selectedDestinations, setSelectedDestinations] = useState([]);
  const [availableDestinations, setAvailableDestinations] = useState([]);
  
  // Set default date range to current day
  const [dateRange, setDateRange] = useState(() => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    return { start: startOfDay, end: endOfDay };
  });
  
  const [selectedHop, setSelectedHop] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [showPrimaryOnly, setShowPrimaryOnly] = useState(false);
  
  // New filtering states
  const [destinationSearchTerm, setDestinationSearchTerm] = useState('');
  const [minRTT, setMinRTT] = useState('');
  const [maxRTT, setMaxRTT] = useState('');
  const [minUsagePercent, setMinUsagePercent] = useState('');
  const [selectedPathTypes, setSelectedPathTypes] = useState(['PRIMARY', 'ALTERNATIVE']);

  // Load data from API
  const loadNetworkData = useCallback(async () => {
    // Only load data if destinations are selected
    if (selectedDestinations.length === 0) {
      setPathData({});
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Build API filters
      const filters = {};
      
      if (selectedDestinations.length > 0) {
        filters.destinations = selectedDestinations;
      }
      
      if (dateRange.start) {
        filters.start_date = dateRange.start.toISOString();
      }
      
      if (dateRange.end) {
        filters.end_date = dateRange.end.toISOString();
      }

      // Fetch network data from API
      const response = await apiService.getNetworkData(filters);
      
      // Transform the data to frontend format
      const transformedData = dataTransformer.transformNetworkData(response.data);
      const validatedData = dataTransformer.validateTransformedData(transformedData);
      
      setPathData(validatedData);

    } catch (err) {
      console.error('Error loading network data:', err);
      setError(err.message || 'Failed to load network data');
      setPathData({});
    } finally {
      setLoading(false);
    }
  }, [selectedDestinations, dateRange]);

  // Load available destinations on app start
  const loadAvailableDestinations = useCallback(async () => {
    try {
      const response = await apiService.getDestinations();
      const destinations = response.data || [];
    setAvailableDestinations(destinations);
      
      // Don't auto-select any destinations - let user choose
      
    } catch (err) {
      console.error('Error loading destinations:', err);
      // Don't set error state for this as it's not critical
    }
  }, []);

  // Initial data load
  useEffect(() => {
    loadAvailableDestinations();
  }, [loadAvailableDestinations]);

  // Load network data when dependencies change
  useEffect(() => {
    loadNetworkData();
  }, [loadNetworkData]);

  // Memoize filtered destinations to prevent unnecessary re-renders
  const filteredDestinations = useMemo(() => 
    availableDestinations.filter(dest =>
      dest.toLowerCase().includes(destinationSearchTerm.toLowerCase())
    ), [availableDestinations, destinationSearchTerm]);

  // Memoize event handlers to prevent unnecessary re-renders of child components
  const handleHopSelect = useCallback((hopData) => {
    setSelectedHop(hopData);
    setIsDrawerOpen(!!hopData); // Close drawer if hopData is null/falsy
  }, []);

  const handleDrawerClose = useCallback(() => {
    setIsDrawerOpen(false);
    setSelectedHop(null);
  }, []);

  const handleDestinationToggle = useCallback((destination) => {
    setSelectedDestinations(prev => 
      prev.includes(destination) 
        ? prev.filter(d => d !== destination)
        : [...prev, destination]
    );
  }, []);

  const handleSelectAllDestinations = useCallback(() => {
    setSelectedDestinations(filteredDestinations);
  }, [filteredDestinations]);

  const handleClearAllDestinations = useCallback(() => {
    setSelectedDestinations([]);
  }, []);

  const handlePathTypeToggle = useCallback((pathType) => {
    setSelectedPathTypes(prev => 
      prev.includes(pathType) 
        ? prev.filter(p => p !== pathType)
        : [...prev, pathType]
    );
  }, []);

  const handleResetFilters = useCallback(() => {
    
    setDestinationSearchTerm('');
    setMinRTT('');
    setMaxRTT('');
    setMinUsagePercent('');
    setSelectedPathTypes(['PRIMARY', 'ALTERNATIVE']);
    setShowPrimaryOnly(false);
    
    // Reset to current day
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    setDateRange({ start: startOfDay, end: endOfDay });
  }, []);

  const handleQuickAccess = useCallback((period) => {
    const now = new Date();
    let startDate, endDate;
    
    switch(period) {
      case 'current-day':
        // From 00:00 today until current time
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
        endDate = now;
        break;
        
      case 'last-day':
        // From 00:00 to 23:59 of yesterday
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        startDate = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 0, 0, 0);
        endDate = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59);
        break;
        
      case 'current-week':
        // From Monday of current week until present day and time
        const currentDayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
        const daysFromMonday = currentDayOfWeek === 0 ? 6 : currentDayOfWeek - 1; // If Sunday, go back 6 days
        const currentMonday = new Date(now.getTime() - daysFromMonday * 24 * 60 * 60 * 1000);
        startDate = new Date(currentMonday.getFullYear(), currentMonday.getMonth(), currentMonday.getDate(), 0, 0, 0);
        endDate = now;
        break;
        
      case 'last-week':
        // From Monday to Sunday of last week (full week)
        const currentDay = now.getDay();
        const daysToLastMonday = currentDay === 0 ? 6 : currentDay - 1; // Days since current Monday
        const daysToLastWeekMonday = daysToLastMonday + 7; // Go back one more week
        
        const lastMonday = new Date(now.getTime() - daysToLastWeekMonday * 24 * 60 * 60 * 1000);
        const lastSunday = new Date(lastMonday.getTime() + 6 * 24 * 60 * 60 * 1000);
        
        startDate = new Date(lastMonday.getFullYear(), lastMonday.getMonth(), lastMonday.getDate(), 0, 0, 0);
        endDate = new Date(lastSunday.getFullYear(), lastSunday.getMonth(), lastSunday.getDate(), 23, 59, 59);
        break;
        
      case 'last-30-days':
        // Last 30 days from current time
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        endDate = now;
        break;
        
      default:
        // Fallback to current day
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
        endDate = now;
    }
    
    setDateRange({ start: startDate, end: endDate });
  }, []);

  const handleRefresh = useCallback(() => {
    loadNetworkData();
  }, [loadNetworkData]);

  // Memoize destination color generator
  const generateDestinationColor = useCallback((index) => {
    const hue = (index * 137.5) % 360;
    const saturation = 65;
    const lightness = 55;
    
    const hslToHex = (h, s, l) => {
      l /= 100;
      const a = s * Math.min(l, 1 - l) / 100;
      const f = n => {
        const k = (n + h / 30) % 12;
        const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
        return Math.round(255 * color).toString(16).padStart(2, '0');
      };
      return `#${f(0)}${f(8)}${f(4)}`;
    };
    
    return hslToHex(hue, saturation, lightness);
  }, []);

  // If loading, show loading state
  if (loading) {
  return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        flexDirection: 'column'
      }}>
        <div style={{ fontSize: '18px', marginBottom: '10px' }}>
          🔄 Loading network data...
        </div>
        <div style={{ fontSize: '14px', color: '#666' }}>
          Connecting to database and processing traceroute data
        </div>
      </div>
    );
  }

  // If error, show error state
  if (error) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        flexDirection: 'column'
      }}>
        <div style={{ fontSize: '18px', marginBottom: '10px', color: '#d32f2f' }}>
          ❌ Error loading data
        </div>
        <div style={{ fontSize: '14px', color: '#666', marginBottom: '20px' }}>
          {error}
        </div>
        <button 
          onClick={handleRefresh}
          style={{
            padding: '10px 20px',
            fontSize: '14px',
            backgroundColor: '#1976d2',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          🔄 Retry
        </button>
      </div>
    );
  }

  return (
    <div style={{ 
      display: "flex", 
      height: "100vh", 
      fontFamily: "Arial, sans-serif",
      overflow: "hidden" 
    }}>
      {/* Left Sidebar - Filters */}
      <div style={{
        width: "320px",
        backgroundColor: "#f8f9fa",
        borderRight: "1px solid #dee2e6",
        display: "flex",
        flexDirection: "column",
        overflowY: "auto"
      }}>
      {/* Header */}
        <div style={{ 
          padding: "20px 15px 15px 15px",
          borderBottom: "1px solid #dee2e6",
          backgroundColor: "#fff"
        }}>
          <h1 style={{ margin: "0 0 5px 0", color: "#333", fontSize: "18px" }}>
            🌐 Network Traceroute
        </h1>
          <p style={{ margin: "0 0 10px 0", color: "#666", fontSize: "12px" }}>
            Real-time network path analysis
          </p>
          
          {/* API Status & Refresh */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px',
            fontSize: '12px'
          }}>
            <span style={{ color: '#4caf50' }}>🟢 API</span>
            <span style={{ color: '#666' }}>
              {Object.keys(pathData).length} destinations
            </span>
            <button
              onClick={handleRefresh}
              style={{
                padding: '4px 8px',
                fontSize: '11px',
                backgroundColor: '#e3f2fd',
                border: '1px solid #2196f3',
                borderRadius: '3px',
                cursor: 'pointer',
                color: '#1976d2',
                marginLeft: 'auto'
              }}
              disabled={loading}
            >
              🔄
            </button>
          </div>
        </div>

        {/* Destination Selection */}
        <div style={{
          padding: "15px",
          borderBottom: "1px solid #dee2e6"
        }}>
          <h3 style={{ margin: "0 0 10px 0", fontSize: "14px", color: "#333" }}>
            🎯 Destinations ({selectedDestinations.length}/{availableDestinations.length})
          </h3>
          
          {/* Search Input */}
          <div style={{ marginBottom: "8px" }}>
            <input
              type="text"
              placeholder="Search destinations..."
              value={destinationSearchTerm}
              onChange={(e) => setDestinationSearchTerm(e.target.value)}
              style={{
                width: "100%",
                padding: "6px 8px",
                border: "1px solid #ccc",
                borderRadius: "4px",
                fontSize: "12px",
                boxSizing: "border-box"
              }}
            />
          </div>

          {/* Bulk Actions */}
          <div style={{ display: "flex", gap: "6px", marginBottom: "8px" }}>
            <button
              onClick={handleSelectAllDestinations}
              style={{
                flex: "1",
                padding: "4px 8px",
                border: "1px solid #28a745",
                backgroundColor: "#28a745",
                color: "white",
                borderRadius: "3px",
                cursor: "pointer",
                fontSize: "11px"
              }}
            >
              Select All
            </button>
            <button
              onClick={handleClearAllDestinations}
              style={{
                flex: "1",
                padding: "4px 8px",
                border: "1px solid #dc3545",
                backgroundColor: "#dc3545",
                color: "white",
                borderRadius: "3px",
                cursor: "pointer",
                fontSize: "11px"
              }}
            >
              Clear All
            </button>
          </div>

          {/* Destination List */}
          <div style={{
            maxHeight: "120px",
            overflowY: "auto",
            border: "1px solid #dee2e6",
            borderRadius: "4px",
            padding: "6px",
            backgroundColor: "#fff"
          }}>
            {filteredDestinations.length === 0 ? (
              <div style={{ textAlign: "center", color: "#666", padding: "15px", fontSize: "12px" }}>
                {availableDestinations.length === 0 ? "Loading destinations..." : "No destinations found"}
              </div>
            ) : (
              filteredDestinations.map((destination, index) => (
                <label key={destination} style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  cursor: "pointer",
                  padding: "4px 6px",
                  borderRadius: "3px",
                  margin: "1px 0",
                  backgroundColor: selectedDestinations.includes(destination) ? "#e3f2fd" : "transparent",
                  fontSize: "12px",
                  border: selectedDestinations.includes(destination) ? "1px solid #2196f3" : "1px solid transparent"
                }}>
                  <input
                    type="checkbox"
                    checked={selectedDestinations.includes(destination)}
                    onChange={() => handleDestinationToggle(destination)}
                    style={{ margin: 0, transform: "scale(0.8)" }}
                  />
                  <div style={{
                    width: "10px",
                    height: "10px",
                    backgroundColor: generateDestinationColor(selectedDestinations.indexOf(destination)),
                    borderRadius: "2px",
                    border: "1px solid #333",
                    flexShrink: 0
                  }}></div>
                  <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {destination}
                  </span>
                </label>
              ))
            )}
          </div>
        </div>

        {/* Date Range & Quick Access */}
        <div style={{
          padding: "15px",
          borderBottom: "1px solid #dee2e6"
        }}>
          <h3 style={{ margin: "0 0 10px 0", fontSize: "14px", color: "#333" }}>
            📅 Time Range
          </h3>
          
          {/* Quick Access Buttons */}
          <div style={{ marginBottom: "10px" }}>
            <label style={{ fontSize: "12px", fontWeight: "500", color: "#666", display: "block", marginBottom: "6px" }}>
              Quick Access:
            </label>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              {[
                { key: 'current-day', label: 'Current Day', isDefault: true },
                { key: 'last-day', label: 'Last Day' },
                { key: 'current-week', label: 'Current Week' },
                { key: 'last-week', label: 'Last Week' },
                { key: 'last-30-days', label: 'Last 30 Days' }
              ].map(({ key, label, isDefault }) => (
                <button
                  key={key}
                  onClick={() => handleQuickAccess(key)}
                  style={{
                    padding: "6px 10px",
                    border: `1px solid ${isDefault ? '#28a745' : '#007bff'}`,
                    backgroundColor: isDefault ? '#28a745' : '#007bff',
                    color: "white",
                    borderRadius: "3px",
                    cursor: "pointer",
                    fontSize: "11px",
                    fontWeight: isDefault ? "bold" : "500"
                  }}
                >
                  {label} {isDefault && '(Default)'}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Date Range */}
          <div>
            <label style={{ fontSize: "12px", fontWeight: "500", color: "#666", display: "block", marginBottom: "6px" }}>
              Custom Range:
            </label>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <div>
                <label style={{ fontSize: "11px", color: "#666" }}>Start:</label>
                <input
                  type="datetime-local"
                  value={dateRange.start ? dateRange.start.toISOString().slice(0, 16) : ''}
                  onChange={(e) => setDateRange(prev => ({ ...prev, start: new Date(e.target.value) }))}
                  style={{
                    width: "100%",
                    padding: "4px 6px",
                    border: "1px solid #ccc",
                    borderRadius: "3px",
                    fontSize: "11px",
                    display: "block",
                    marginTop: "2px",
                    boxSizing: "border-box"
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: "11px", color: "#666" }}>End:</label>
                <input
                  type="datetime-local"
                  value={dateRange.end ? dateRange.end.toISOString().slice(0, 16) : ''}
                  onChange={(e) => setDateRange(prev => ({ ...prev, end: new Date(e.target.value) }))}
                  style={{
                    width: "100%",
                    padding: "4px 6px",
                    border: "1px solid #ccc",
                    borderRadius: "3px",
                    fontSize: "11px",
                    display: "block",
                    marginTop: "2px",
                    boxSizing: "border-box"
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Advanced Filters */}
        <div style={{
          padding: "15px",
          borderBottom: "1px solid #dee2e6"
        }}>
          <h3 style={{ margin: "0 0 10px 0", fontSize: "14px", color: "#333" }}>
            🔍 Advanced Filters
          </h3>
          
          {/* Path Type Filters */}
          <div style={{ marginBottom: "10px" }}>
            <label style={{ fontSize: "12px", fontWeight: "500", color: "#666", display: "block", marginBottom: "6px" }}>
              Path Types:
            </label>
            <div style={{ display: "flex", gap: "6px" }}>
              {['PRIMARY', 'ALTERNATIVE'].map(pathType => (
                <label key={pathType} style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "3px",
                  cursor: "pointer",
                  padding: "3px 6px",
                  borderRadius: "3px",
                  backgroundColor: selectedPathTypes.includes(pathType) ? "#e3f2fd" : "#fff",
                  border: "1px solid #ccc",
                  fontSize: "11px",
                  flex: "1"
                }}>
                  <input
                    type="checkbox"
                    checked={selectedPathTypes.includes(pathType)}
                    onChange={() => handlePathTypeToggle(pathType)}
                    style={{ margin: 0, transform: "scale(0.8)" }}
                  />
                  {pathType}
                </label>
              ))}
            </div>
          </div>

          {/* RTT Range */}
          <div style={{ marginBottom: "10px" }}>
            <label style={{ fontSize: "12px", fontWeight: "500", color: "#666", display: "block", marginBottom: "6px" }}>
              RTT Range (ms):
            </label>
            <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
              <input
                type="number"
                placeholder="Min"
                value={minRTT}
                onChange={(e) => setMinRTT(e.target.value)}
                style={{
                  flex: "1",
                  padding: "4px 6px",
                  border: "1px solid #ccc",
                  borderRadius: "3px",
                  fontSize: "11px"
                }}
              />
              <span style={{ color: "#666", fontSize: "11px" }}>to</span>
              <input
                type="number"
                placeholder="Max"
                value={maxRTT}
                onChange={(e) => setMaxRTT(e.target.value)}
                style={{
                  flex: "1",
                  padding: "4px 6px",
                  border: "1px solid #ccc",
                  borderRadius: "3px",
                  fontSize: "11px"
                }}
              />
            </div>
          </div>

          {/* Usage Percentage */}
          <div style={{ marginBottom: "10px" }}>
            <label style={{ fontSize: "12px", fontWeight: "500", color: "#666", display: "block", marginBottom: "6px" }}>
              Min Usage %:
            </label>
            <input
              type="number"
              placeholder="e.g., 10"
              value={minUsagePercent}
              onChange={(e) => setMinUsagePercent(e.target.value)}
              style={{
                width: "100%",
                padding: "4px 6px",
                border: "1px solid #ccc",
                borderRadius: "3px",
                fontSize: "11px",
                boxSizing: "border-box"
              }}
            />
          </div>

          {/* Display Options */}
          <div style={{ marginBottom: "10px" }}>
            <label style={{ fontSize: "12px", fontWeight: "500", color: "#666", display: "block", marginBottom: "6px" }}>
              Display Options:
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", marginBottom: "6px" }}>
              <input
                type="checkbox"
                checked={showPrimaryOnly}
                onChange={(e) => setShowPrimaryOnly(e.target.checked)}
                style={{ margin: 0, transform: "scale(0.8)" }}
              />
              <span style={{ fontSize: "11px" }}>Show Primary Paths Only</span>
            </label>
          
          </div>

          {/* Reset Button */}
          <button
            onClick={handleResetFilters}
            style={{
              width: "100%",
              padding: "6px 10px",
              border: "1px solid #6c757d",
              backgroundColor: "#6c757d",
              color: "white",
              borderRadius: "3px",
              cursor: "pointer",
              fontSize: "11px"
            }}
          >
            Reset All Filters
          </button>
      </div>

      {/* Current Selection Info */}
      {selectedDestinations.length > 0 && (
        <div style={{
          padding: "10px 15px",
            backgroundColor: "#e8f5e8",
            borderBottom: "1px solid #c3e6c3",
            fontSize: "11px"
          }}>
            <div style={{ fontWeight: "bold", marginBottom: "4px" }}>Active Filters:</div>
            <div>{selectedDestinations.length} destination(s)</div>
            {selectedDestinations.length <= 3 && (
              <div style={{ color: "#666" }}>{selectedDestinations.join(", ")}</div>
            )}
            {showPrimaryOnly && <div style={{ color: "#666" }}>Primary paths only</div>}
          {(minRTT || maxRTT) && (
              <div style={{ color: "#666" }}>
                RTT: {minRTT || '0'}ms - {maxRTT || '∞'}ms
              </div>
          )}
          {minUsagePercent && (
              <div style={{ color: "#666" }}>Min usage: {minUsagePercent}%</div>
          )}
        </div>
      )}
      </div>

      {/* Right Side - Graph */}
      <div style={{
        flex: "1",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#fff",
        position: "relative"
      }}>
        {/* Graph Area */}
        {selectedDestinations.length === 0 ? (
          <div style={{
            flex: "1",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
            backgroundColor: "#f8f9fa"
            
          }}>
            <div style={{ marginBottom: "15px", fontSize: "48px" }}>📋</div>
            <div style={{ marginBottom: "10px", fontWeight: "bold", color: "#856404", fontSize: "18px" }}>
              No destinations selected
            </div>
            <div style={{ color: "#856404", fontSize: "14px", textAlign: "center", maxWidth: "400px" }}>
              Please select one or more destinations from the sidebar to view network traceroute data.
            </div>
            {availableDestinations.length > 0 && (
              <div style={{ 
                color: "#666", 
                fontSize: "12px", 
                marginTop: "10px",
                textAlign: "center",
                maxWidth: "500px"
              }}>
                Available destinations: {availableDestinations.slice(0, 5).join(", ")}
                {availableDestinations.length > 5 && ` and ${availableDestinations.length - 5} more...`}
              </div>
            )}
          </div>
        ) : (
          <div style={{ flex: "1", position: "relative" }}>
        <NetworkGraph
          pathData={pathData}
          selectedDestinations={selectedDestinations}
          dateRange={dateRange}
          onHopSelect={handleHopSelect}
          showPrimaryOnly={showPrimaryOnly}
          minRTT={minRTT}
          maxRTT={maxRTT}
          minUsagePercent={minUsagePercent}
          selectedPathTypes={selectedPathTypes}
        />
        
        {/* Instructions */}
        <div style={{
          position: "absolute",
          top: "10px",
          right: "10px",
          background: "rgba(255, 255, 255, 0.9)",
          padding: "8px 12px",
          borderRadius: "4px",
          fontSize: "12px",
              border: "1px solid #ccc",
              zIndex: 1000
        }}>
          💡 Click on any network hop to view detailed information
        </div>
          </div>
        )}
      </div>

      {/* Hop Details Drawer */}
      <HopDrawer
        hopData={selectedHop}
        isOpen={isDrawerOpen}
        onClose={handleDrawerClose}
      />
    </div>
  );
}

export default App;
