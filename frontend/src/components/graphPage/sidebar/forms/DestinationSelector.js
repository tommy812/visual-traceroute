import React, { useState, useMemo, useCallback } from 'react';
import { generateDestinationColor } from '../../../../utils/colorUtils';

// DomainGroup component (unchanged behavior)
const DomainGroup = React.memo(function DomainGroup({
  domainName,
  destinations,
  expanded,
  selectionState,
  isDomainSelected,
  selectedIdsInDomainSet,
  onToggleDomain,
  onToggleDestination,
  onToggleExpand,
  colorIndexMap
}) {
  return (
    <div style={{ marginBottom: '6px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', padding: '4px 6px', borderRadius: '4px', background: '#f1f3f5', fontSize: '12px', border: '1px solid #ccc', userSelect: 'none' }}>
        <input
          type="checkbox"
          checked={selectionState === 'all'}
          ref={el => { if (el) el.indeterminate = selectionState === 'partial'; }}
          onChange={() => onToggleDomain(domainName)}
          style={{ margin: 0, transform: 'scale(0.9)' }}
        />
        <span onClick={() => onToggleExpand(domainName)} style={{ fontWeight: 600, flex: 1 }} title={domainName}>
          {expanded ? '▾' : '▸'} {domainName} ({destinations.length})
        </span>
        <button onClick={() => onToggleExpand(domainName)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '11px', padding: 0, color: '#1976d2' }} title="Expand / Collapse">
          {expanded ? 'Hide' : 'Show'}
        </button>
      </div>

      {expanded && (
        <div style={{ marginTop: '4px', paddingLeft: '14px' }}>
          {destinations.map(dest => {
            const individuallySelected = selectedIdsInDomainSet.has(dest.id);
            const isSelected = isDomainSelected || individuallySelected;
            const colorIdx = colorIndexMap.get(dest.address) ?? -1;
            return (
              <label key={dest.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', padding: '3px 6px', borderRadius: '3px', margin: '2px 0', backgroundColor: isSelected ? '#e3f2fd' : 'transparent', fontSize: '11px', border: isSelected ? '1px solid #2196f3' : '1px solid transparent' }}>
                <input type="checkbox" checked={isSelected} onChange={() => onToggleDestination(dest.id, domainName)} style={{ margin: 0, transform: 'scale(0.75)' }} />
                <div style={{ width: '10px', height: '10px', backgroundColor: generateDestinationColor(colorIdx), borderRadius: '2px', border: '1px solid #333', flexShrink: 0 }} />
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{dest.address}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}, (prev, next) => (
  prev.expanded === next.expanded &&
  prev.selectionState === next.selectionState &&
  prev.isDomainSelected === next.isDomainSelected &&
  prev.destinations.length === next.destinations.length &&
  prev.selectedIdsInDomainSet.size === next.selectedIdsInDomainSet.size
));

DomainGroup.displayName = 'DomainGroup';

// DestinationSelector
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
  onSearchTermChange,
  // import callbacks
  onImportGraph,
  onImportError,
  onClearImportedGraph,
  importedName
}) => {
  const [expandedDomains, setExpandedDomains] = useState(new Set());
  const [importLoading, setImportLoading] = useState(false);
  const [localImportError, setLocalImportError] = useState(null);

  const toggleExpand = useCallback((domain) => {
    setExpandedDomains(prev => {
      const next = new Set(prev);
      next.has(domain) ? next.delete(domain) : next.add(domain);
      return next;
    });
  }, []);

  const {
    domainList,
    perDomainSelectedIdSets,
    perDomainSelectionState,
    perDomainIsDomainSelected
  } = useMemo(() => {
    const q = (searchTerm || '').toLowerCase();
    const list = [];
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

  const colorIndexMap = useMemo(() => {
    const map = new Map();
    selectedDestinationAddresses.forEach((addr, i) => map.set(addr, i));
    return map;
  }, [selectedDestinationAddresses]);

  const handleSelectAll = useCallback(() => { onSelectAll(filteredDestinations.map(d => d.id)); }, [filteredDestinations, onSelectAll]);

  const handleFile = useCallback(async (file) => {
    if (!file) return;
    setImportLoading(true);
    setLocalImportError(null);
    try {
      const text = await file.text();
      let parsed = null;
      try { parsed = JSON.parse(text); } catch (e) { throw new Error('Invalid JSON file'); }
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Imported graph must be a JSON object mapping destination->data');
      const keys = Object.keys(parsed);
      if (keys.length === 0) throw new Error('Imported graph contains no destinations');
      const sample = parsed[keys[0]];
      const ok = sample && typeof sample === 'object' && (sample.primary_path || sample.alternatives || sample.total_traces != null);
      if (!ok) throw new Error('JSON does not match expected graph shape (missing primary_path / alternatives)');
      onImportGraph && onImportGraph(parsed, file.name || 'imported-graph.json');
    } catch (err) {
      const msg = err?.message || String(err);
      setLocalImportError(msg);
      onImportError && onImportError(msg);
    } finally {
      setImportLoading(false);
    }
  }, [onImportGraph, onImportError]);

  const onFileInputChange = useCallback((e) => {
    const f = (e.target && e.target.files && e.target.files[0]) || null;
    if (!f) return;
    handleFile(f);
    e.target.value = '';
  }, [handleFile]);

  return (
    <div id="destination-selector" style={{ padding: '15px', borderBottom: '1px solid #dee2e6' }}>
      <h3 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#333' }}>🎯 Destinations ({selectedDestinationAddresses.length}/{totalAvailableCount})</h3>

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



      <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid #dee2e6', borderRadius: '4px', padding: '6px', backgroundColor: '#fff' }}>
        {domainList.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#666', padding: '15px', fontSize: '12px' }}>No destinations found</div>
        ) : (
          domainList.map(group => (
            <DomainGroup key={group.name} domainName={group.name} destinations={group.destinations} expanded={expandedDomains.has(group.name)} selectionState={perDomainSelectionState[group.name]} isDomainSelected={perDomainIsDomainSelected[group.name]} selectedIdsInDomainSet={perDomainSelectedIdSets[group.name]} onToggleDomain={toggleDomain} onToggleDestination={onToggle} onToggleExpand={toggleExpand} colorIndexMap={colorIndexMap} />
          ))
        )}
      </div>

      <div style={{ display: "flex", gap: "6px", marginBottom: "8px" }}>

          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#fff', padding: '4px 6px', border: '1px dashed #ccc', borderRadius: 4, cursor: 'pointer' }} title="Import graph JSON">
            <input type="file" accept="application/json" onChange={onFileInputChange} style={{ display: 'none' }} />
            <span style={{ fontSize: 11, color: '#1976d2' }}>Import Graph</span>
          </label>
          <button onClick={() => { onClearImportedGraph && onClearImportedGraph(); }} style={{ padding: '4px 8px', border: '1px solid #6c757d', backgroundColor: '#6c757d', color: 'white', borderRadius: '3px', cursor: 'pointer', fontSize: '11px' }} title="Clear imported graph">Clear Import</button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginLeft: 8 }}>
          {importLoading && <div style={{ fontSize: 11, color: '#1976d2' }}>Importing...</div>}
          {!importLoading && localImportError && <div style={{ fontSize: 11, color: '#dc3545' }}>{localImportError}</div>}
          {!importLoading && !localImportError && importedName && <div style={{ fontSize: 11, color: '#28a745' }}>Imported: {importedName}</div>}
        </div>

    </div>
  );
};

export default DestinationSelector;