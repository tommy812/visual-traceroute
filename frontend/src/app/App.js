import React from "react";
import NetworkGraph from "../components/graphPage/graph/NetworkGraph";
import HopDrawer from "../components/graphPage/drawer/HopDrawer";
import Sidebar from "../components/graphPage/sidebar/Sidebar";
import LandingPage from "../components/landingPage/landingPage"
import DocumentationPage from "../components/documentationPage/documentationPage"

import "../styles/styles.css";
import "../styles/network.css";
// hooks
import { useFilters } from "../hooks/useFilters";
import { useDateRange } from "../hooks/useDateRange";
import { useNetworkData } from "../hooks/useNetworkData";
import { useDestinations } from "../hooks/useDestinations";
import { useHopDrawer } from "../hooks/useHopDrawer";


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
const ChartsApp = React.memo(({onGoLanding}) => {
  // Use custom hooks for state management
  const filters = useFilters();
  const { dateRange, handleQuickAccess, resetToCurrentDay, currentPeriod } = useDateRange();
  const {
    selectedDestinationIds,
    selectedDestinationAddresses,
    selectedDomainNames,
    domainGroups,
    toggleDomain,
    getDomainSelectionState,
    availableDestinations,
    availableProtocols,
    resetDestinations,
    toggleDestination,
    selectAll,
    clearAll,
    getFilteredDestinations
  } = useDestinations();


  const { pathData, loading, error } = useNetworkData(selectedDestinationAddresses, dateRange, filters.selectedProtocols);
  const { selectedHop, isDrawerOpen, handleHopSelect, closeDrawer } = useHopDrawer();
  const apiHealthy = !error;

  const handleOpenSettings = React.useCallback(() => {
    // placeholder: open settings modal (implement later)
    alert('Settings panel coming soon');
  }, []);

  // Filtered destinations
  const filteredDestinations = React.useMemo(
   () => getFilteredDestinations(filters.destinationSearchTerm, filters),
   [getFilteredDestinations, filters.destinationSearchTerm, filters.selectedProtocols]
 );

  const handleDrawerHighlight = React.useCallback((pathId) => {
    window.dispatchEvent(new CustomEvent('graph:highlightPath', { detail: { pathId } }));
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
    <div style={{ display: "flex", height: "100vh", fontFamily: "Arial, sans-serif", overflow: "hidden" }}>
      <Sidebar
        dateRange={dateRange}
        onQuickAccess={handleQuickAccess}
        currentPeriod={currentPeriod}
        filteredDestinations={filteredDestinations}
        totalAvailableCount={availableDestinations.length}
        selectedDestinationIds={selectedDestinationIds}
        selectedDestinationAddresses={selectedDestinationAddresses}
        selectedDomainNames={selectedDomainNames}
        domainGroups={domainGroups}
        toggleDomain={toggleDomain}
        getDomainSelectionState={getDomainSelectionState}
        onToggle={toggleDestination}
        onSelectAll={selectAll}
        onClearAll={clearAll}
        searchTerm={filters.destinationSearchTerm}
        onSearchTermChange={filters.setDestinationSearchTerm}
        availableProtocols={availableProtocols}
        selectedProtocols={filters.selectedProtocols}
        toggleProtocol={filters.toggleProtocol}
        clearProtocols={filters.clearProtocols}
        selectedPathTypes={filters.selectedPathTypes}
        togglePathType={filters.togglePathType}
        minRTT={filters.minRTT}
        setMinRTT={filters.setMinRTT}
        maxRTT={filters.maxRTT}
        setMaxRTT={filters.setMaxRTT}
        minUsagePercent={filters.minUsagePercent}
        setMinUsagePercent={filters.setMinUsagePercent}
        showPrimaryOnly={filters.showPrimaryOnly}
        setShowPrimaryOnly={filters.setShowPrimaryOnly}
        hideTimeouts={filters.hideTimeouts}                 
        setHideTimeouts={filters.setHideTimeouts}  
        onResetFilters={handleResetFilters}
        apiHealthy={apiHealthy}
        onOpenSettings={handleOpenSettings}
        onGoLanding={onGoLanding}
      />

      {/* Right Side - Graph */}
      <div style={{ flex: "1", display: "flex", flexDirection: "column", backgroundColor: "#fff", position: "relative" }}>
        {selectedDestinationAddresses.length === 0 ? (
          <div> {/* keep your current empty-state JSX */} </div>
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
              selectedProtocols={filters.selectedProtocols}
              hideTimeouts={filters.hideTimeouts}  
            />
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

      <HopDrawer
        hopData={selectedHop?.allHops || []}
        isOpen={isDrawerOpen}
        onClose={closeDrawer}
        onHighlightPath={handleDrawerHighlight} // added
      />
    </div>
  );
});

ChartsApp.displayName = 'ChartsApp';

// Landing gate wrapper
function AppWithLanding() {
  const [mode, setMode] = React.useState(() => {
    try { return localStorage.getItem('enteredCharts') === '1' ? 'charts' : 'landing'; }
    catch { return 'landing'; }
  });

  const enterCharts = React.useCallback(() => {
    setMode('charts');
    try { localStorage.setItem('enteredCharts', '1'); } catch {}
  }, []);

  const showLanding = React.useCallback(() => {
    setMode('landing');
    try { localStorage.removeItem('enteredCharts'); } catch {}
  }, []);

  const showDocs = React.useCallback(() => {
    setMode('docs');
  }, []);

  if (mode === 'landing') {
    return <LandingPage onEnter={enterCharts} onShowDocs={showDocs} />;
  }
  if (mode === 'docs') {
    return <DocumentationPage onBack={showLanding} onEnter={enterCharts} />;
  }
  return <ChartsApp onGoLanding={showLanding} />;
}

// Export the App wrapped with error boundary
export default function AppWithErrorBoundary() {
  return (
    <AppErrorBoundary>
      <AppWithLanding />
    </AppErrorBoundary>
  );
}
