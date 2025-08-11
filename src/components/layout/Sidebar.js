import React from 'react';
import QuickAccessButtons from '../ui/QuickAccessButtons';
import DestinationSelector from '../forms/DestinationSelector';
import AdvancedFilters from '../forms/AdvancedFilters';

const Sidebar = ({
  // Date range props
  dateRange,
  onQuickAccess,
  currentPeriod,
  
  // Destination props
  availableDestinations,
  selectedDestinations,
  setSelectedDestinations,
  destinationSearchTerm,
  setDestinationSearchTerm,
  
  // Filter props
  minRTT,
  setMinRTT,
  maxRTT,
  setMaxRTT,
  minUsagePercent,
  setMinUsagePercent,
  selectedPathTypes,
  setSelectedPathTypes,
  selectedProtocol,
  setSelectedProtocol,
  availableProtocols,
  showPrimaryOnly,
  setShowPrimaryOnly,
  
  // Actions
  onResetFilters
}) => {
  return (
    <div style={{
      width: '300px',
      backgroundColor: '#f8f9fa',
      borderRight: '1px solid #dee2e6',
      padding: '15px',
      overflowY: 'auto',
      height: '100vh'
    }}>
      <h2 style={{ 
        margin: '0 0 20px 0', 
        fontSize: '18px', 
        color: '#495057',
        borderBottom: '2px solid #007bff',
        paddingBottom: '8px'
      }}>
        Network Graph Filters
      </h2>
      
      {/* Quick Access Buttons */}
      <QuickAccessButtons 
        onQuickAccess={onQuickAccess}
        currentPeriod={currentPeriod}
      />
      
      {/* Destination Selector */}
      <DestinationSelector
        availableDestinations={availableDestinations}
        selectedDestinations={selectedDestinations}
        setSelectedDestinations={setSelectedDestinations}
        destinationSearchTerm={destinationSearchTerm}
        setDestinationSearchTerm={setDestinationSearchTerm}
      />
      
      {/* Advanced Filters */}
      <AdvancedFilters
        minRTT={minRTT}
        setMinRTT={setMinRTT}
        maxRTT={maxRTT}
        setMaxRTT={setMaxRTT}
        minUsagePercent={minUsagePercent}
        setMinUsagePercent={setMinUsagePercent}
        selectedPathTypes={selectedPathTypes}
        setSelectedPathTypes={setSelectedPathTypes}
        selectedProtocol={selectedProtocol}
        setSelectedProtocol={setSelectedProtocol}
        availableProtocols={availableProtocols}
        showPrimaryOnly={showPrimaryOnly}
        setShowPrimaryOnly={setShowPrimaryOnly}
      />
      
      {/* Reset Button */}
      <button
        onClick={onResetFilters}
        style={{
          width: '100%',
          padding: '8px',
          backgroundColor: '#6c757d',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '12px',
          marginTop: '10px'
        }}
      >
        Reset All Filters
      </button>
    </div>
  );
};

export default Sidebar; 