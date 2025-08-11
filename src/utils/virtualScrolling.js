// Virtual scrolling utilities for handling large datasets
import React from "react";
import { useState, useCallback, useMemo } from 'react';

// Virtual scrolling hook for large lists
export const useVirtualScrolling = (items, itemHeight, containerHeight, overscan = 5) => {
  const [scrollTop, setScrollTop] = useState(0);

  // Calculate visible range
  const visibleRange = useMemo(() => {
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const endIndex = Math.min(
      items.length - 1,
      Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
    );
    
    return { startIndex, endIndex };
  }, [scrollTop, itemHeight, containerHeight, overscan, items.length]);

  // Get visible items
  const visibleItems = useMemo(() => {
    const { startIndex, endIndex } = visibleRange;
    return items.slice(startIndex, endIndex + 1).map((item, index) => ({
      ...item,
      virtualIndex: startIndex + index,
      style: {
        position: 'absolute',
        top: (startIndex + index) * itemHeight,
        height: itemHeight,
        width: '100%'
      }
    }));
  }, [items, visibleRange, itemHeight]);

  // Calculate total height
  const totalHeight = useMemo(() => items.length * itemHeight, [items.length, itemHeight]);

  // Handle scroll
  const handleScroll = useCallback((event) => {
    setScrollTop(event.target.scrollTop);
  }, []);

  return {
    visibleItems,
    totalHeight,
    scrollTop,
    handleScroll,
    visibleRange
  };
};

// Virtual scrolling component for destinations list
export const VirtualDestinationList = React.memo(({ 
  destinations, 
  selectedDestinations, 
  onDestinationToggle, 
  searchTerm = '',
  containerHeight = 200,
  itemHeight = 32
}) => {
  // Filter destinations based on search term
  const filteredDestinations = useMemo(() => {
    if (!searchTerm) return destinations;
    return destinations.filter(dest => {
      // Handle both string and object formats for destinations
      const destString = typeof dest === 'string' ? dest : (dest?.address || '');
      return destString.toLowerCase().includes(searchTerm.toLowerCase());
    });
  }, [destinations, searchTerm]);

  // Use virtual scrolling
  const { visibleItems, totalHeight, handleScroll } = useVirtualScrolling(
    filteredDestinations,
    itemHeight,
    containerHeight
  );

  return (
    <div style={{ height: containerHeight, overflow: 'auto' }} onScroll={handleScroll}>
      <div style={{ height: totalHeight, position: 'relative' }}>
        {visibleItems.map(({ virtualIndex, style, ...destination }) => (
          <div key={destination} style={style}>
            <label style={{
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
                onChange={() => onDestinationToggle(destination)}
                style={{ margin: 0, transform: "scale(0.8)" }}
              />
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {destination}
              </span>
            </label>
          </div>
        ))}
      </div>
    </div>
  );
});

VirtualDestinationList.displayName = 'VirtualDestinationList';

// Virtual scrolling component for hop details
export const VirtualHopList = React.memo(({ 
  hops, 
  containerHeight = 400,
  itemHeight = 120
}) => {
  const { visibleItems, totalHeight, handleScroll } = useVirtualScrolling(
    hops,
    itemHeight,
    containerHeight
  );

  return (
    <div style={{ height: containerHeight, overflow: 'auto' }} onScroll={handleScroll}>
      <div style={{ height: totalHeight, position: 'relative' }}>
        {visibleItems.map(({ virtualIndex, style, ...hop }) => (
          <div key={`${hop.destination}-${hop.hop_number}-${virtualIndex}`} style={style}>
            <div style={{
              marginBottom: '20px',
              padding: '15px',
              border: '1px solid #e9ecef',
              borderRadius: '6px',
              backgroundColor: '#fff'
            }}>
              {/* Hop Header */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '10px',
                paddingBottom: '8px',
                borderBottom: '1px solid #f1f3f4'
              }}>
                <div style={{ fontWeight: 'bold', color: '#333' }}>
                  Hop #{hop.hop_number}
                </div>
                <div style={{
                  padding: '4px 8px',
                  borderRadius: '12px',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  backgroundColor: hop.is_timeout ? '#f8d7da' : '#d4edda',
                  color: hop.is_timeout ? '#721c24' : '#155724'
                }}>
                  {hop.is_timeout ? '⏰ Timeout' : '✅ Active'}
                </div>
              </div>

              {/* IP Information */}
              <div style={{ marginBottom: '12px' }}>
                <div style={{ fontWeight: 'bold', marginBottom: '4px', color: '#333' }}>
                  🌐 IP Address
                </div>
                <div style={{ fontSize: '14px', fontFamily: 'monospace', color: '#007bff' }}>
                  {hop.ip || 'Unknown'}
                </div>
                {hop.hostname && hop.hostname !== 'Unknown' && (
                  <div style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>
                    Hostname: {hop.hostname}
                  </div>
                )}
              </div>

              {/* RTT Information */}
              <div style={{ marginBottom: '12px' }}>
                <div style={{ fontWeight: 'bold', marginBottom: '4px', color: '#333' }}>
                  ⏱️ Response Times
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', fontSize: '12px' }}>
                  <div>
                    <strong>Probe 1:</strong> {hop.rtt1 ? `${hop.rtt1.toFixed(2)} ms` : 'N/A'}
                  </div>
                  <div>
                    <strong>Probe 2:</strong> {hop.rtt2 ? `${hop.rtt2.toFixed(2)} ms` : 'N/A'}
                  </div>
                  <div>
                    <strong>Probe 3:</strong> {hop.rtt3 ? `${hop.rtt3.toFixed(2)} ms` : 'N/A'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});

VirtualHopList.displayName = 'VirtualHopList';

// Utility function to chunk large arrays for processing
export const chunkArray = (array, chunkSize) => {
  const chunks = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
};

// Utility function to process large datasets in chunks
export const processInChunks = async (items, processFunction, chunkSize = 100) => {
  const chunks = chunkArray(items, chunkSize);
  const results = [];

  for (const chunk of chunks) {
    const chunkResults = await Promise.all(chunk.map(processFunction));
    results.push(...chunkResults);
    
    // Allow other tasks to run
    await new Promise(resolve => setTimeout(resolve, 0));
  }

  return results;
}; 