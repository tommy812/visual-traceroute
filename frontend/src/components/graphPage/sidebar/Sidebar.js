import React, { useState } from 'react';
import './sidebar.css';
import DestinationSelector from './forms/DestinationSelector';
import AdvancedFilters from './forms/AdvancedFilters';
import TimeRangeSelector from './forms/TimeRangeSelector';
import SideBarFooter from './forms/sideBarFooter.js'

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
  selectedDomainNames,
  domainGroups,
  toggleDomain,
  getDomainSelectionState,

  // Advanced filters
  availableProtocols,
  selectedProtocols,
  toggleProtocol,
  clearProtocols,
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
  hideReachedOnly,
  setHideReachedOnly,
  showReachedOnly,
  setShowReachedOnly,

  // Actions
  onResetFilters,
  apiHealthy,
  onOpenSettings,
  onGoLanding,
  onShowDocs,
  onImportGraph, onImportError, onClearImportedGraph, importedName
}) => {
  const [open, setOpen] = useState(false);


  return (
    <>
      {/* Mobile toggle button */}
      <button
        className="rgv-toggle-button"
        aria-expanded={open}
        aria-controls="rgv-sidebar"
        onClick={() => setOpen(true)}
        title="Open filters"
      >
        Filters
      </button>

      {/* Backdrop (mobile) */}
      <div
        className={`rgv-sidebar-backdrop ${open ? 'rgv-visible' : ''}`}
        onClick={() => setOpen(false)}
        aria-hidden={!open}
      />

      <div id="rgv-sidebar" className={`rgv-sidebar ${open ? 'rgv-open' : ''}`}>
      <div className="rgv-scroll">
      {/* Header with title + API status */}
      <div style={{ padding: "20px 15px 15px 15px", backgroundColor: "#fff", borderBottom: "1px solid #dee2e6" }}>
        {/* Mobile close row */}
        <div className="rgv-mobile-close" style={{ display: open ? 'flex' : 'none' }}>
          <button onClick={() => setOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '14px' }} aria-label="Close filters">X</button>
        </div>
        <h1 style={{ margin: 0, fontSize: "18px", color: "#333" }}>
          🌐 Network Traceroute</h1>
        <p style={{ margin: "6px 0 10px 0", color: "#666", fontSize: "12px" }}>Real-time network path analysis</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
          <span style={{ color: apiHealthy ? '#4caf50' : '#dc3545' }}>{apiHealthy ? '🟢 API Connected' : '🔴 API Not Connected'}</span>
        
        </div>
      </div>
  {/* (main header already rendered above; continue with selectors) */}
      {/* Destination Selector */}
      <DestinationSelector
        filteredDestinations={filteredDestinations}
        totalAvailableCount={totalAvailableCount}
        selectedDestinationIds={selectedDestinationIds}
        selectedDestinationAddresses={selectedDestinationAddresses}
        selectedDomainNames={selectedDomainNames}
        domainGroups={domainGroups}
        toggleDomain={toggleDomain}
        getDomainSelectionState={getDomainSelectionState}
        onToggle={onToggle}
        onSelectAll={onSelectAll}
        onClearAll={onClearAll}
        searchTerm={searchTerm}
        onSearchTermChange={onSearchTermChange}
        onImportGraph={onImportGraph}
        onImportError={onImportError}
        onClearImportedGraph={onClearImportedGraph}
        importedName={importedName}
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
        selectedProtocols={selectedProtocols}
        toggleProtocol={toggleProtocol}
        clearProtocols={clearProtocols}
        selectedPathTypes={selectedPathTypes}
        togglePathType={togglePathType}
        minRTT={minRTT}
        setMinRTT={setMinRTT}
        maxRTT={maxRTT}
        setMaxRTT={setMaxRTT}
        minUsagePercent={minUsagePercent}
        setMinUsagePercent={setMinUsagePercent}
        showPrimaryOnly={showPrimaryOnly}
        hideReachedOnly={hideReachedOnly}          // NEW
        setHideReachedOnly={setHideReachedOnly}  
  showReachedOnly={showReachedOnly}
  setShowReachedOnly={setShowReachedOnly}
        setShowPrimaryOnly={setShowPrimaryOnly}
        onReset={onResetFilters}
      />
    </div>

    {/*Footer*/}
    <SideBarFooter
      onOpenSettings={onOpenSettings}
      onGoLanding={onGoLanding}
      onShowDocs={onShowDocs}
    />
    </div>
    </>
  );
};

export default Sidebar;