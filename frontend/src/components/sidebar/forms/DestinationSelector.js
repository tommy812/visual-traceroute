import React from 'react';
import { generateDestinationColor } from '../../../utils/colorUtils';

const DestinationSelector = ({
  filteredDestinations,            // [{ id, address }]
  totalAvailableCount,             // number
  selectedDestinationIds,          // number[]
  selectedDestinationAddresses,    // string[]
  onToggle,                        // (id:number) => void
  onSelectAll,                     // (ids:number[]) => void
  onClearAll,                      // () => void
  searchTerm,
  onSearchTermChange
}) => {
  return (
    <div style={{ padding: "15px", borderBottom: "1px solid #dee2e6" }}>
      <h3 style={{ margin: "0 0 10px 0", fontSize: "14px", color: "#333" }}>
        🎯 Destinations ({selectedDestinationIds.length}/{totalAvailableCount})
      </h3>

      <div style={{ marginBottom: "8px" }}>
        <input
          type="text"
          placeholder="Search destinations..."
          value={searchTerm}
          onChange={(e) => onSearchTermChange(e.target.value)}
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

      <div style={{ display: "flex", gap: "6px", marginBottom: "8px" }}>
        <button
          onClick={() => onSelectAll(filteredDestinations.map(d => d.id))}
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
          onClick={onClearAll}
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
            No destinations found
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
                  onChange={() => onToggle(destination.id)}
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
  );
};

export default DestinationSelector;