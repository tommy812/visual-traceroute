import React from 'react';
import DestinationSelector from './forms/DestinationSelector';
import AdvancedFilters from './forms/AdvancedFilters';
import TimeRangeSelector from './forms/TimeRangeSelector';


const Sidebar = ({
  // Date range
  dateRange,
  onQuickAccess,
  currentPeriod,

  // Destinations (ID-based)
  filteredDestinations,            // [{ id, address }]
  totalAvailableCount,             // number
  selectedDestinationIds,          // number[]
  selectedDestinationAddresses,    // string[]
  onToggle,                        // (id:number) => void
  onSelectAll,                     // (ids:number[]) => void
  onClearAll,                      // () => void
  searchTerm,                      // string
  onSearchTermChange,              // (s:string) => void

  // Advanced filters
  availableProtocols,
  selectedProtocol,
  setSelectedProtocol,
  selectedPathTypes,
  togglePathType,
  minRTT,
  setMinRTT,
  maxRTT,
  setMaxRTT,
  minUsagePercent,
  setMinUsagePercent,
  showPrimaryOnly,
  setShowPrimaryOnly,

  // Actions
  onResetFilters,
  apiHealthy
}) => {
  return (
    <div style={{
      width: '320px',
      backgroundColor: '#f8f9fa',
      borderRight: '1px solid #dee2e6',
      display: 'flex',
      flexDirection: 'column',
      overflowY: 'auto',
      height: '100vh'
    }}>
      {/* Header with title + API status */}
      <div style={{ padding: "20px 15px 15px 15px", backgroundColor: "#fff", borderBottom: "1px solid #dee2e6" }}>
        <h1 style={{ margin: 0, fontSize: "18px", color: "#333" }}>🌐 Network Traceroute</h1>
        <p style={{ margin: "6px 0 10px 0", color: "#666", fontSize: "12px" }}>Real-time network path analysis</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
          <span style={{ color: apiHealthy ? '#4caf50' : '#dc3545' }}>{apiHealthy ? '🟢 API Connected' : '🔴 API Not Connected'}</span>
        
        </div>
      </div>

   

      
      {/* Destination Selector */}
      <DestinationSelector
        filteredDestinations={filteredDestinations}
        totalAvailableCount={totalAvailableCount}
        selectedDestinationIds={selectedDestinationIds}
        selectedDestinationAddresses={selectedDestinationAddresses}
        onToggle={onToggle}
        onSelectAll={onSelectAll}
        onClearAll={onClearAll}
        searchTerm={searchTerm}
        onSearchTermChange={onSearchTermChange}
      />

      {/* Time Range Selector */}
      <TimeRangeSelector
        dateRange={dateRange}
        currentPeriod={currentPeriod}
        onQuickAccess={onQuickAccess}
      />


      {/* Advanced Filters */}
      <AdvancedFilters
        availableProtocols={availableProtocols}
        selectedProtocol={selectedProtocol}
        setSelectedProtocol={setSelectedProtocol}
        selectedPathTypes={selectedPathTypes}
        togglePathType={togglePathType}
        minRTT={minRTT}
        setMinRTT={setMinRTT}
        maxRTT={maxRTT}
        setMaxRTT={setMaxRTT}
        minUsagePercent={minUsagePercent}
        setMinUsagePercent={setMinUsagePercent}
        showPrimaryOnly={showPrimaryOnly}
        setShowPrimaryOnly={setShowPrimaryOnly}
        onReset={onResetFilters}
      />
    </div>
  );
};

export default Sidebar;