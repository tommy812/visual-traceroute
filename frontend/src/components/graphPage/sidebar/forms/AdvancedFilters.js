import React from 'react';

const AdvancedFilters = ({
  availableProtocols,
  selectedProtocols,
  toggleProtocol,
  clearProtocols,
  togglePathType,
  minRTT,
  setMinRTT,
  maxRTT,
  setMaxRTT,
  minUsagePercent,
  setMinUsagePercent,
  showPrimaryOnly,
  setShowPrimaryOnly,
  onReset,
  selectedPathTypes, 
  setSelectedPathTypes,
  showReachedOnly, 
  setShowReachedOnly,
  showUnreachedOnly, 
  setShowUnreachedOnly,
  hideTimeouts,          
  setHideTimeouts  

}) => {
  return (
    <div style={{ padding: "15px", borderBottom: "1px solid #dee2e6" }}>
      <h3 style={{ margin: "0 0 10px 0", fontSize: "14px", color: "#333" }}>
        🔍 Advanced Filters
      </h3>


      {/* Protocols Multi-select */}
      <div style={{ marginBottom: "10px" }}>
        <label style={{ fontSize: "12px", fontWeight: 500, color: "#666", display: "block", marginBottom: "6px" }}>
          Probe Protocols:
        </label>
        <div style={{
          display: "flex",
          flexDirection: "column",
          gap: "4px",
          maxHeight: "110px",
          overflowY: "auto",
          border: "1px solid #ccc",
          borderRadius: "4px",
          padding: "6px",
          background: "#fff"
        }}>
          {availableProtocols.length === 0 && (
            <div style={{ fontSize: "11px", color: "#999" }}>No protocols</div>
          )}
          {availableProtocols.map(proto => {
            const checked = selectedProtocols.includes(proto);
            return (
              <label key={proto} style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "11px",
                cursor: "pointer",
                padding: "2px 4px",
                borderRadius: "3px",
                background: checked ? "#e3f2fd" : "transparent"
              }}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleProtocol(proto)}
                  style={{ margin: 0, transform: "scale(0.85)" }}
                />
                <span style={{ flex: 1 }}>{proto}</span>
              </label>
            );
          })}
        </div>
        <div style={{ marginTop: "6px", display: "flex", gap: "6px" }}>
          <button
            type="button"
            onClick={clearProtocols}
            style={{
              flex: 1,
              padding: "4px 6px",
              border: "1px solid #6c757d",
              background: "#6c757d",
              color: "#fff",
              fontSize: "10px",
              borderRadius: "3px",
              cursor: "pointer"
            }}
            title="Clear protocol selection (show all)"
          >
            All
          </button>
          <span style={{
            flex: 2,
            fontSize: "10px",
            color: "#555",
            alignSelf: "center",
            textAlign: "right"
          }}>
            {selectedProtocols.length === 0
              ? 'All protocols'
              : `${selectedProtocols.length} selected`}
          </span>
        </div>
      </div>

      <div style={{ marginBottom: "10px" }}>
        <label style={{ fontSize: "12px", fontWeight: "500", color: "#666", display: "block", marginBottom: "6px" }}>
          Path Types:
        </label>
        <div style={{ display: "flex", gap: "6px" }}>
          {['PRIMARY', 'ALTERNATIVE'].map(pathType => (
            <label key={pathType} style={{
              display: "flex",
              alignItems: "center",
              gap: "3px",
              cursor: "pointer",
              padding: "3px 6px",
              borderRadius: "3px",
              backgroundColor: selectedPathTypes.includes(pathType) ? "#e3f2fd" : "#fff",
              border: "1px solid #ccc",
              fontSize: "11px",
              flex: "1"
            }}>
              <input
                type="checkbox"
                checked={selectedPathTypes.includes(pathType)}
                onChange={() => togglePathType(pathType)}
                style={{ margin: 0, transform: "scale(0.8)" }}
              />
              {pathType}
            </label>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: "10px" }}>
        <label style={{ fontSize: "12px", fontWeight: "500", color: "#666", display: "block", marginBottom: "6px" }}>
          Timeouts:
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={hideTimeouts}
            onChange={(e) => setHideTimeouts(e.target.checked)}
            style={{ margin: 0, transform: "scale(0.8)" }}
          />
          <span style={{ fontSize: "11px" }}>Hide Timed-out Paths</span>
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", marginTop: "6px" }}>
          <input
            type="checkbox"
            checked={showReachedOnly}
            onChange={(e) => setShowReachedOnly(e.target.checked)}
            style={{ margin: 0, transform: "scale(0.8)" }}
          />
          <span style={{ fontSize: "11px" }}>Only Successful Paths</span>
        </label>
      </div>

      <div style={{ marginBottom: "10px" }}>
        <label style={{ fontSize: "12px", fontWeight: "500", color: "#666", display: "block", marginBottom: "6px" }}>
          RTT Range (ms):
        </label>
        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
          <input
            type="number"
            placeholder="Min"
            value={minRTT}
            onChange={(e) => setMinRTT(e.target.value)}
            style={{
              flex: "1",
              padding: "4px 6px",
              border: "1px solid #ccc",
              borderRadius: "3px",
              fontSize: "11px"
            }}
          />
          <span style={{ color: "#666", fontSize: "11px" }}>to</span>
          <input
            type="number"
            placeholder="Max"
            value={maxRTT}
            onChange={(e) => setMaxRTT(e.target.value)}
            style={{
              flex: "1",
              padding: "4px 6px",
              border: "1px solid #ccc",
              borderRadius: "3px",
              fontSize: "11px"
            }}
          />
        </div>
      </div>

      <div style={{ marginBottom: "10px" }}>
        <label style={{ fontSize: "12px", fontWeight: "500", color: "#666", display: "block", marginBottom: "6px" }}>
          Min Usage %:
        </label>
        <input
          type="number"
          placeholder="e.g., 10"
          value={minUsagePercent}
          onChange={(e) => setMinUsagePercent(e.target.value)}
          style={{
            width: "100%",
            padding: "4px 6px",
            border: "1px solid #ccc",
            borderRadius: "3px",
            fontSize: "11px",
            boxSizing: "border-box"
          }}
        />
      </div>

  


      {/* TODO add show most used path, show fastest path */}
      <div style={{ marginBottom: "10px" }}>
        <label style={{ fontSize: "12px", fontWeight: "500", color: "#666", display: "block", marginBottom: "6px" }}>
          Display Options:
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", marginBottom: "6px" }}>
          <input
            type="checkbox"
            checked={showPrimaryOnly}
            onChange={(e) => setShowPrimaryOnly(e.target.checked)}
            style={{ margin: 0, transform: "scale(0.8)" }}
          />
          <span style={{ fontSize: "11px" }}>Show Most Used Path</span>
        </label>
      </div>

      <button
        onClick={onReset}
        style={{
          width: "100%",
          padding: "6px 10px",
          border: "1px solid #6c757d",
          backgroundColor: "#6c757d",
          color: "white",
          borderRadius: "3px",
          cursor: "pointer",
          fontSize: "11px"
        }}
      >
        Reset All Filters
      </button>
    </div>
  );
};

export default AdvancedFilters;