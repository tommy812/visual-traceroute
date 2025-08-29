import React, { useState, useMemo, useCallback } from 'react';
import { generateDestinationColor } from '../../../../utils/colorUtils';


// Memoized domain group component
const DomainGroup = React.memo(function DomainGroup({
  domainName,
  destinations,
  expanded,
  selectionState,          // 'none' | 'partial' | 'all'
  isDomainSelected,        // boolean
  selectedIdsInDomainSet,  // Set
  onToggleDomain,
  onToggleDestination,
  onToggleExpand,
  colorIndexMap
}) {
  return (
    <div style={{ marginBottom: "6px" }}>
      {/* Domain Row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          cursor: "pointer",
          padding: "4px 6px",
          borderRadius: "4px",
          background: "#f1f3f5",
          fontSize: "12px",
          border: "1px solid #ccc",
          userSelect: "none"
        }}
      >
        <input
          type="checkbox"
          checked={selectionState === 'all'}
          ref={el => { if (el) el.indeterminate = selectionState === 'partial'; }}
          onChange={() => onToggleDomain(domainName)}
          style={{ margin: 0, transform: "scale(0.9)" }}
          title={selectionState === 'partial'
            ? 'Partially selected domain'
            : 'Toggle entire domain'}
        />
        <span
          onClick={() => onToggleExpand(domainName)}
          style={{ fontWeight: 600, flex: 1 }}
          title={domainName}
        >
          {expanded ? '▾' : '▸'} {domainName} ({destinations.length})
        </span>
        <button
          onClick={() => onToggleExpand(domainName)}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            fontSize: '11px',
            padding: 0,
            color: '#1976d2'
          }}
          title="Expand / Collapse"
        >
          {expanded ? 'Hide' : 'Show'}
        </button>
      </div>

      {/* Destination Rows */}
      {expanded && (
        <div style={{ marginTop: "4px", paddingLeft: "14px" }}>
          {destinations.map(dest => {
            const individuallySelected = selectedIdsInDomainSet.has(dest.id);
            const isSelected = isDomainSelected || individuallySelected;
            const colorIdx = colorIndexMap.get(dest.address) ?? -1;
            return (
              <label key={dest.id} style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                cursor: "pointer",
                padding: "3px 6px",
                borderRadius: "3px",
                margin: "2px 0",
                backgroundColor: isSelected ? "#e3f2fd" : "transparent",
                fontSize: "11px",
                border: isSelected ? "1px solid #2196f3" : "1px solid transparent"
              }}>
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => onToggleDestination(dest.id, domainName)}
                  style={{ margin: 0, transform: "scale(0.75)" }}
                />
                <div style={{
                  width: "10px",
                  height: "10px",
                  backgroundColor: generateDestinationColor(colorIdx),
                  borderRadius: "2px",
                  border: "1px solid #333",
                  flexShrink: 0
                }} />
                <span style={{
                  flex: 1,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap"
                }}>
                  {dest.address}
                </span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}, (prev, next) => {
  // Custom props equality: re-render only if something relevant for this domain changed
  return (
    prev.expanded === next.expanded &&
    prev.selectionState === next.selectionState &&
    prev.isDomainSelected === next.isDomainSelected &&
    prev.destinations.length === next.destinations.length &&
    prev.selectedIdsInDomainSet.size === next.selectedIdsInDomainSet.size
  );
});

DomainGroup.displayName = 'DomainGroup';

const DestinationSelector = ({
  filteredDestinations,
  totalAvailableCount,
  selectedDestinationIds,
  selectedDestinationAddresses,
  selectedDomainNames,
  domainGroups,
  toggleDomain,
  getDomainSelectionState,
  onToggle,
  onSelectAll,
  onClearAll,
  searchTerm,
  onSearchTermChange
}) => {
  const [expandedDomains, setExpandedDomains] = useState(new Set());

  const toggleExpand = useCallback((domain) => {
    setExpandedDomains(prev => {
      const next = new Set(prev);
      next.has(domain) ? next.delete(domain) : next.add(domain);
      return next;
    });
  }, []);

  // Precompute search filter & per-domain selection snapshot
  const {
    domainList,
    perDomainSelectedIdSets,
    perDomainSelectionState,
    perDomainIsDomainSelected
  } = useMemo(() => {
    const q = (searchTerm || '').toLowerCase();
    const list = [];
    const selectedIdsSet = new Set(selectedDestinationIds);
    const selectedDomainSet = new Set(selectedDomainNames);
    const perDomainIds = {};
    const perState = {};
    const perIsDomain = {};

    Object.entries(domainGroups).forEach(([name, grp]) => {
      const filtered = grp.destinations.filter(d => !q || d.address.toLowerCase().includes(q));
      if (!filtered.length) return;

      const ids = new Set(filtered.map(d => d.id).filter(id => selectedDestinationIds.includes(id)));
      const isDomain = selectedDomainSet.has(name);
      let state;
      if (isDomain) state = 'all';
      else if (ids.size === 0) state = 'none';
      else if (ids.size === filtered.length) state = 'all';
      else state = 'partial';

      perDomainIds[name] = ids;
      perState[name] = state;
      perIsDomain[name] = isDomain;
      list.push({ name, destinations: filtered });
    });

    return {
      domainList: list,
      perDomainSelectedIdSets: perDomainIds,
      perDomainSelectionState: perState,
      perDomainIsDomainSelected: perIsDomain
    };
  }, [domainGroups, searchTerm, selectedDestinationIds, selectedDomainNames]);

  // Color index map to avoid repeated indexOf
  const colorIndexMap = useMemo(() => {
    const map = new Map();
    selectedDestinationAddresses.forEach((addr, i) => map.set(addr, i));
    return map;
  }, [selectedDestinationAddresses]);

  // Select All based on currently filtered flat list (so it respects search)
  const handleSelectAll = useCallback(() => {
   onSelectAll(filteredDestinations.map(d => d.id));
 }, [filteredDestinations, onSelectAll]);

  return (
    <div style={{ padding: "15px", borderBottom: "1px solid #dee2e6" }}>
      <h3 style={{ margin: "0 0 10px 0", fontSize: "14px", color: "#333" }}>
        🎯 Destinations ({selectedDestinationAddresses.length}/{totalAvailableCount})
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
          onClick={handleSelectAll}
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
        maxHeight: "180px",
        overflowY: "auto",
        border: "1px solid #dee2e6",
        borderRadius: "4px",
        padding: "6px",
        backgroundColor: "#fff"
      }}>
        {domainList.length === 0 ? (
          <div style={{ textAlign: "center", color: "#666", padding: "15px", fontSize: "12px" }}>
            No destinations found
          </div>
        ) : (
          domainList.map(group => (
            <DomainGroup
              key={group.name}
              domainName={group.name}
              destinations={group.destinations}
              expanded={expandedDomains.has(group.name)}
              selectionState={perDomainSelectionState[group.name]}
              isDomainSelected={perDomainIsDomainSelected[group.name]}
              selectedIdsInDomainSet={perDomainSelectedIdSets[group.name]}
              onToggleDomain={toggleDomain}
              onToggleDestination={onToggle}
              onToggleExpand={toggleExpand}
              colorIndexMap={colorIndexMap}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default DestinationSelector;