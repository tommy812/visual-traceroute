import React from 'react';

const AdvancedFilters = ({
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
  setShowPrimaryOnly
}) => {
  const handlePathTypeToggle = (pathType) => {
    setSelectedPathTypes(prev => {
      if (prev.includes(pathType)) {
        return prev.filter(type => type !== pathType);
      } else {
        return [...prev, pathType];
      }
    });
  };

  return (
    <div style={{ marginBottom: '15px' }}>
      <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: '14px' }}>
        Advanced Filters:
      </label>
      
      {/* RTT Filters */}
      <div style={{ marginBottom: '10px' }}>
        <div style={{ marginBottom: '5px' }}>
          <input
            type="number"
            placeholder="Min RTT (ms)"
            value={minRTT}
            onChange={(e) => setMinRTT(e.target.value)}
            style={{
              width: '100%',
              padding: '4px 6px',
              fontSize: '11px',
              border: '1px solid #ccc',
              borderRadius: '3px'
            }}
          />
        </div>
        <div>
          <input
            type="number"
            placeholder="Max RTT (ms)"
            value={maxRTT}
            onChange={(e) => setMaxRTT(e.target.value)}
            style={{
              width: '100%',
              padding: '4px 6px',
              fontSize: '11px',
              border: '1px solid #ccc',
              borderRadius: '3px'
            }}
          />
        </div>
      </div>
      
      {/* Usage Percent Filter */}
      <div style={{ marginBottom: '10px' }}>
        <input
          type="number"
          placeholder="Min Usage %"
          value={minUsagePercent}
          onChange={(e) => setMinUsagePercent(e.target.value)}
          style={{
            width: '100%',
            padding: '4px 6px',
            fontSize: '11px',
            border: '1px solid #ccc',
            borderRadius: '3px'
          }}
        />
      </div>
      
      {/* Protocol Filter */}
      <div style={{ marginBottom: '10px' }}>
        <select
          value={selectedProtocol}
          onChange={(e) => setSelectedProtocol(e.target.value)}
          style={{
            width: '100%',
            padding: '4px 6px',
            fontSize: '11px',
            border: '1px solid #ccc',
            borderRadius: '3px'
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
      <div style={{ marginBottom: '10px' }}>
        <label style={{ display: 'block', marginBottom: '5px', fontSize: '11px' }}>
          Path Types:
        </label>
        <label style={{ display: 'flex', alignItems: 'center', fontSize: '11px', marginBottom: '3px' }}>
          <input
            type="checkbox"
            checked={selectedPathTypes.includes('PRIMARY')}
            onChange={() => handlePathTypeToggle('PRIMARY')}
            style={{ marginRight: '5px' }}
          />
          Primary
        </label>
        <label style={{ display: 'flex', alignItems: 'center', fontSize: '11px' }}>
          <input
            type="checkbox"
            checked={selectedPathTypes.includes('ALTERNATIVE')}
            onChange={() => handlePathTypeToggle('ALTERNATIVE')}
            style={{ marginRight: '5px' }}
          />
          Alternative
        </label>
      </div>
      
      {/* Show Primary Only */}
      <div>
        <label style={{ display: 'flex', alignItems: 'center', fontSize: '11px' }}>
          <input
            type="checkbox"
            checked={showPrimaryOnly}
            onChange={(e) => setShowPrimaryOnly(e.target.checked)}
            style={{ marginRight: '5px' }}
          />
          Show Primary Only
        </label>
      </div>
    </div>
  );
};

export default AdvancedFilters; 