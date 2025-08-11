import React from "react";
import NetworkGraph from "./components/NetworkGraph";
import HopDrawer from "./components/HopDrawer";
import "./styles.css";
import "./network.css";

// Import custom hooks
import { useFilters } from "./hooks/useFilters";
import { useDateRange } from "./hooks/useDateRange";
import { useNetworkData } from "./hooks/useNetworkData";
import { useDestinations } from "./hooks/useDestinations";
import { useHopDrawer } from "./hooks/useHopDrawer";

// Error Boundary for the entire application
class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('App Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          flexDirection: 'column',
          padding: '20px',
          backgroundColor: '#f8f9fa'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '20px' }}>🚨</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '10px', color: '#dc3545' }}>
            Application Error
          </div>
          <div style={{ fontSize: '16px', color: '#666', textAlign: 'center', marginBottom: '20px', maxWidth: '500px' }}>
            Something went wrong with the application. Please try refreshing the page or contact support if the problem persists.
          </div>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '12px 24px',
              fontSize: '16px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              marginBottom: '10px'
            }}
          >
            🔄 Refresh Application
          </button>
          <details style={{ fontSize: '12px', color: '#666', maxWidth: '500px' }}>
            <summary style={{ cursor: 'pointer', marginBottom: '10px' }}>Error Details</summary>
            <pre style={{
              backgroundColor: '#f8f9fa',
              padding: '10px',
              borderRadius: '4px',
              overflow: 'auto',
              fontSize: '11px',
              border: '1px solid #dee2e6'
            }}>
              {this.state.error?.toString()}
            </pre>
          </details>
        </div>
      );
    }

    return this.props.children;
  }
}

// Optimized App component with React.memo
const App = React.memo(() => {
  // Use custom hooks for state management
  const filters = useFilters();
  const { dateRange, handleQuickAccess, resetToCurrentDay, currentPeriod } = useDateRange();
  const {
    selectedDestinationIds,
    setSelectedDestinationIds,
    selectedDestinations,          // [{ id, address }]
    availableDestinations,         // [{ id, address }]
    availableProtocols,
    resetDestinations,
  } = useDestinations();
  // Derive addresses to use with the data hook and the graph
  const selectedDestinationAddresses = React.useMemo(
    () => selectedDestinations.map(d => d.address),
    [selectedDestinations]
  );
  const { pathData, loading, error } = useNetworkData(selectedDestinationAddresses, dateRange, filters.selectedProtocol);
  const { selectedHop, isDrawerOpen, handleHopSelect, closeDrawer } = useHopDrawer();

  // Memoize filtered destinations to prevent unnecessary re-renders
  const filteredDestinations = React.useMemo(
    () => availableDestinations.filter(d =>
      d.address.toLowerCase().includes(filters.destinationSearchTerm.toLowerCase())
    ),
    [availableDestinations, filters.destinationSearchTerm]
  );
  // Memoize destination color generator
  const generateDestinationColor = React.useCallback((index) => {
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


  // Reset all filters
  const handleResetFilters = () => {
    filters.resetFilters();
    resetDestinations(); // was setSelectedDestinations([])
    resetToCurrentDay();
  };

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
          onClick={() => window.location.reload()}
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
          </div>
        </div>

        {/* Destination Selection */}
        <div style={{
          padding: "15px",
          borderBottom: "1px solid #dee2e6"
        }}>
          <h3 style={{ margin: "0 0 10px 0", fontSize: "14px", color: "#333" }}>
            🎯 Destinations ({selectedDestinationIds.length}/{availableDestinations.length})
          </h3>

          {/* Search Input */}
          <div style={{ marginBottom: "8px" }}>
            <input
              type="text"
              placeholder="Search destinations..."
              value={filters.destinationSearchTerm}
              onChange={(e) => filters.setDestinationSearchTerm(e.target.value)}
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
              onClick={() => setSelectedDestinationIds(filteredDestinations.map(d => d.id))}
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
              onClick={() => setSelectedDestinationIds([])}
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
              filteredDestinations.map((destination) => {
                const isSelected = selectedDestinationIds.includes(destination.id);
                return (
                  <label key={destination.id} style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    cursor: "pointer",
                    padding: "4px 6px",
                    borderRadius: "3px",
                    margin: "1px 0",
                    backgroundColor: isSelected ? "#e3f2fd" : "transparent",
                    fontSize: "12px",
                    border: isSelected ? "1px solid #2196f3" : "1px solid transparent"
                  }}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {
                        setSelectedDestinationIds(prev =>
                          prev.includes(destination.id)
                            ? prev.filter(id => id !== destination.id)
                            : [...prev, destination.id]
                        );
                      }}
                      style={{ margin: 0, transform: "scale(0.8)" }}
                    />
                    <div style={{
                      width: "10px",
                      height: "10px",
                      backgroundColor: generateDestinationColor(
                        selectedDestinationAddresses.indexOf(destination.address)
                      ),
                      borderRadius: "2px",
                      border: "1px solid #333",
                      flexShrink: 0
                    }}></div>
                    <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {destination.address}
                    </span>
                  </label>
                );
              })
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
                { key: 'current-day', label: 'Current Day', isDefault: currentPeriod === 'current-day' },
                { key: 'last-day', label: 'Last Day', isDefault: currentPeriod === 'last-day' },
                { key: 'current-week', label: 'Current Week', isDefault: currentPeriod === 'current-week' },
                { key: 'last-week', label: 'Last Week', isDefault: currentPeriod === 'last-week' },
                { key: 'last-30-days', label: 'Last 30 Days', isDefault: currentPeriod === 'last-30-days' }
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
                  {label} {isDefault && '(Active)'}
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
                  value={dateRange.start ? new Date(dateRange.start.getTime() - dateRange.start.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''}
                  onChange={(e) => {
                    const localDate = new Date(e.target.value);
                    const utcDate = new Date(localDate.getTime() + localDate.getTimezoneOffset() * 60000);
                    handleQuickAccess('custom', { start: utcDate });
                  }}
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
                  value={dateRange.end ? new Date(dateRange.end.getTime() - dateRange.end.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''}
                  onChange={(e) => {
                    const localDate = new Date(e.target.value);
                    const utcDate = new Date(localDate.getTime() + localDate.getTimezoneOffset() * 60000);
                    handleQuickAccess('custom', { end: utcDate });
                  }}
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

          {/* Protocol Selection */}
          <div style={{ marginBottom: "10px" }}>
            <label style={{ fontSize: "12px", fontWeight: "500", color: "#666", display: "block", marginBottom: "6px" }}>
              Probe Protocol:
            </label>
            <select
              value={filters.selectedProtocol}
              onChange={(e) => filters.setSelectedProtocol(e.target.value)}
              style={{
                width: "100%",
                padding: "4px 6px",
                border: "1px solid #ccc",
                borderRadius: "3px",
                fontSize: "11px",
                backgroundColor: "#fff",
                boxSizing: "border-box"
              }}
            >
              <option value="">All Protocols</option>
              {availableProtocols.map(protocol => (
                <option key={protocol} value={protocol}>
                  {protocol}
                </option>
              ))}
            </select>
          </div>

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
                  backgroundColor: filters.selectedPathTypes.includes(pathType) ? "#e3f2fd" : "#fff",
                  border: "1px solid #ccc",
                  fontSize: "11px",
                  flex: "1"
                }}>
                  <input
                    type="checkbox"
                    checked={filters.selectedPathTypes.includes(pathType)}
                    onChange={() => {
                      if (filters.selectedPathTypes.includes(pathType)) {
                        filters.setSelectedPathTypes(prev => prev.filter(p => p !== pathType));
                      } else {
                        filters.setSelectedPathTypes(prev => [...prev, pathType]);
                      }
                    }}
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
                value={filters.minRTT}
                onChange={(e) => filters.setMinRTT(e.target.value)}
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
                value={filters.maxRTT}
                onChange={(e) => filters.setMaxRTT(e.target.value)}
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
              value={filters.minUsagePercent}
              onChange={(e) => filters.setMinUsagePercent(e.target.value)}
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
                checked={filters.showPrimaryOnly}
                onChange={(e) => filters.setShowPrimaryOnly(e.target.checked)}
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
        {selectedDestinationIds.length > 0 && (
          <div style={{
            padding: "10px 15px",
            backgroundColor: "#e8f5e8",
            borderBottom: "1px solid #c3e6c3",
            fontSize: "11px"
          }}>
            <div style={{ fontWeight: "bold", marginBottom: "4px" }}>Active Filters:</div>
            <div>{selectedDestinationIds.length} destination(s)</div>
            {selectedDestinationIds.length <= 3 && (
              <div style={{ color: "#666" }}>
                {selectedDestinationAddresses.join(", ")}
              </div>
            )}
            {filters.showPrimaryOnly && <div style={{ color: "#666" }}>Primary paths only</div>}
            {filters.selectedProtocol && (
              <div style={{ color: "#666" }}>Protocol: {filters.selectedProtocol}</div>
            )}
            {(filters.minRTT || filters.maxRTT) && (
              <div style={{ color: "#666" }}>
                RTT: {filters.minRTT || '0'}ms - {filters.maxRTT || '∞'}ms
              </div>
            )}
            {filters.minUsagePercent && (
              <div style={{ color: "#666" }}>Min usage: {filters.minUsagePercent}%</div>
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
        {selectedDestinationIds.length === 0 ? (
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
          </div>
        ) : (
          <div style={{ flex: "1", position: "relative" }}>
            <NetworkGraph
              pathData={pathData}
              selectedDestinations={selectedDestinationAddresses}
              dateRange={dateRange}
              onHopSelect={handleHopSelect}
              showPrimaryOnly={filters.showPrimaryOnly}
              minRTT={filters.minRTT}
              maxRTT={filters.maxRTT}
              minUsagePercent={filters.minUsagePercent}
              selectedPathTypes={filters.selectedPathTypes}
              selectedProtocol={filters.selectedProtocol}
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
        hopData={selectedHop?.allHops || []}
        isOpen={isDrawerOpen}
        onClose={closeDrawer}
      />
    </div>
  );
});

App.displayName = 'App';

// Export the App wrapped with error boundary
export default function AppWithErrorBoundary() {
  return (
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  );
}
