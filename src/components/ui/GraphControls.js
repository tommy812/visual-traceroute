import React from 'react';

const GraphControls = ({
  isFullscreen,
  onToggleFullscreen,
  showPrefixAggregation,
  onTogglePrefixAggregation,
  expandedPrefixes,
  onTogglePrefixExpansion
}) => {
  return (
    <div style={{
      position: 'absolute',
      top: '10px',
      right: '10px',
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column',
      gap: '8px'
    }}>
      {/* Fullscreen Toggle */}
      <button
        onClick={onToggleFullscreen}
        style={{
          padding: '8px 12px',
          backgroundColor: isFullscreen ? '#dc3545' : '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '12px',
          fontWeight: 'bold'
        }}
        title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
      >
        {isFullscreen ? '⛌' : '⛶'}
      </button>
      
      {/* Prefix Aggregation Toggle */}
      <button
        onClick={onTogglePrefixAggregation}
        style={{
          padding: '8px 12px',
          backgroundColor: showPrefixAggregation ? '#28a745' : '#6c757d',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '12px',
          fontWeight: 'bold'
        }}
        title={showPrefixAggregation ? 'Disable Prefix Aggregation' : 'Enable Prefix Aggregation'}
      >
        {showPrefixAggregation ? '🔗' : '🔗'}
      </button>
    </div>
  );
};

export default GraphControls; 