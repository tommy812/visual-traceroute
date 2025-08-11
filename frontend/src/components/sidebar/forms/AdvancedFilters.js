import React from 'react';

const AdvancedFilters = ({
  availableProtocols,
  selectedProtocol,
  setSelectedProtocol,
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
  onReset
}) => {
  return (
    <div style={{ padding: "15px", borderBottom: "1px solid #dee2e6" }}>
      <h3 style={{ margin: "0 0 10px 0", fontSize: "14px", color: "#333" }}>
        🔍 Advanced Filters
      </h3>

      <div style={{ marginBottom: "10px" }}>
        <label style={{ fontSize: "12px", fontWeight: "500", color: "#666", display: "block", marginBottom: "6px" }}>
          Probe Protocol:
        </label>
        <select
          value={selectedProtocol}
          onChange={(e) => setSelectedProtocol(e.target.value)}
          style={{
            width: "100%",
            padding: "4px 6px",
            border: "1px solid #ccc",
            borderRadius: "3px",
            fontSize: "11px",
            backgroundColor: "#fff",
            boxSizing: "border-box"
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