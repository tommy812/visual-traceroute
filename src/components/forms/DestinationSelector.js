import React from 'react';

const DestinationSelector = ({ 
  availableDestinations, 
  selectedDestinations, 
  setSelectedDestinations, 
  destinationSearchTerm, 
  setDestinationSearchTerm 
}) => {
  const filteredDestinations = availableDestinations.filter(dest => {
    // Handle both string and object formats for destinations
    const destString = typeof dest === 'string' ? dest : (dest?.address || '');
    return destString.toLowerCase().includes(destinationSearchTerm.toLowerCase());
  });

  const handleDestinationToggle = (destination) => {
    setSelectedDestinations(prev => {
      const destKey = typeof destination === 'string' ? destination : destination.address;
      const isSelected = prev.some(selected => {
        const selectedKey = typeof selected === 'string' ? selected : selected.address;
        return selectedKey === destKey;
      });
      
      if (isSelected) {
        return prev.filter(d => {
          const dKey = typeof d === 'string' ? d : d.address;
          return dKey !== destKey;
        });
      } else {
        return [...prev, destination];
      }
    });
  };

  const handleSelectAll = () => {
    setSelectedDestinations([...availableDestinations]);
  };

  const handleClearAll = () => {
    setSelectedDestinations([]);
  };

  return (
    <div style={{ marginBottom: '15px' }}>
      <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: '14px' }}>
        Destinations:
      </label>
      
      <input
        type="text"
        placeholder="Search destinations..."
        value={destinationSearchTerm}
        onChange={(e) => setDestinationSearchTerm(e.target.value)}
        style={{
          width: '100%',
          padding: '6px 8px',
          fontSize: '12px',
          border: '1px solid #ccc',
          borderRadius: '4px',
          marginBottom: '8px'
        }}
      />
      
      <div style={{ marginBottom: '8px' }}>
        <button
          onClick={handleSelectAll}
          style={{
            padding: '4px 8px',
            fontSize: '11px',
            backgroundColor: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '3px',
            cursor: 'pointer',
            marginRight: '5px'
          }}
        >
          Select All
        </button>
        <button
          onClick={handleClearAll}
          style={{
            padding: '4px 8px',
            fontSize: '11px',
            backgroundColor: '#dc3545',
            color: 'white',
            border: 'none',
            borderRadius: '3px',
            cursor: 'pointer'
          }}
        >
          Clear All
        </button>
      </div>
      
      <div style={{ 
        maxHeight: '200px', 
        overflowY: 'auto', 
        border: '1px solid #ccc', 
        borderRadius: '4px',
        padding: '4px'
      }}>
        {filteredDestinations.map(destination => {
          const destKey = typeof destination === 'string' ? destination : destination.address;
          const destDisplay = typeof destination === 'string' ? destination : destination.address;
          const isSelected = selectedDestinations.some(selected => {
            const selectedKey = typeof selected === 'string' ? selected : selected.address;
            return selectedKey === destKey;
          });
          
          return (
            <label
              key={destKey}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '4px 8px',
                fontSize: '12px',
                cursor: 'pointer',
                backgroundColor: isSelected ? '#e3f2fd' : 'transparent'
              }}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => handleDestinationToggle(destination)}
                style={{ marginRight: '8px' }}
              />
              {destDisplay}
            </label>
          );
        })}
      </div>
    </div>
  );
};

export default DestinationSelector; 