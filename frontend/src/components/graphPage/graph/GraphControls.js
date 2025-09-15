import React from 'react';

const GraphControls = ({
  // fullscreen
  isFullscreen,
  onToggleFullscreen,

  // zoom/view
  onZoomIn,
  onZoomOut,
  onFit,

  // downloads
  onDownloadPNG,
  onDownloadSVG,
  onExportJSON,
  canDownload = true,

  // aggregation controls
  aggregationMode,
  onAggregationModeChange,
  showPrefixAggregation,
  onTogglePrefixAggregation,
  expandedCount = 0,
  
  // network hierarchy controls
  networkHierarchy = 'none',
  onNetworkHierarchyChange,

  // highlighting (moved from NetworkGraph)
  highlightedPaths = [],
  onClearHighlight
  , onCollapseAllPrefixes
  , onCollapsePrefix
  , disableShowAllPaths = false
  , disableReason = ''
}) => {
  return (
    <>
      {/* Zoom Controls (keep same class/markup) */}
      <div className="zoom-controls">
        <button
          onClick={onToggleFullscreen}
          title={isFullscreen ? "Exit Fullscreen (ESC)" : "Enter Fullscreen"}
          className="zoom-button fullscreen"
        >
          {isFullscreen ? "➡" : "⬅"}
        </button>

        <button
          onClick={onZoomIn}
          title="Zoom In"
          className="zoom-button zoom-in"
        >
          +
        </button>

        <button
          onClick={onZoomOut}
          title="Zoom Out"
          className="zoom-button zoom-out"
        >
          −
        </button>

        <button
          onClick={onFit}
          title="Fit to Screen"
          className="zoom-button fit-screen"
        >
          ◎
        </button>

        {/* Download Controls */}
        <div style={{ height: "8px" }}></div>

        <button
          onClick={onDownloadPNG}
          title="Download as PNG"
          className="zoom-button download-png"
          disabled={!canDownload}
        >
          PNG
        </button>

        <button
          onClick={() => onDownloadSVG && onDownloadSVG(false)}
          title="Download as SVG"
          className="zoom-button download-svg"
          disabled={!canDownload}
        >
          SVG
        </button>
        <button
          onClick={() => onExportJSON && onExportJSON()}
          title="Export graph JSON"
          className="zoom-button download-json"
          disabled={!canDownload}
        >
          JSON
        </button>
      </div>

      {/* Path Highlighting Controls (moved from NetworkGraph, top-right) */}
      {highlightedPaths.length > 0 && (
        <div style={{
          position: "absolute",
          bottom: "10px",
          left: "200px",
          background: "rgba(255, 255, 255, 0.95)",
          padding: "10px 15px",
          borderRadius: "6px",
          border: "2px solid #FFD700",
          backdropFilter: "blur(5px)",
          zIndex: 10,
          maxWidth: "280px",
          maxHeight: "300px",
          overflowY: "auto"
        }}>
          <div style={{
            fontSize: "14px",
            fontWeight: "bold",
            color: "#333",
            marginBottom: "8px"
          }}>
            🔍 {highlightedPaths.length > 1 ? `${highlightedPaths.length} Paths` : 'Path'} Highlighted
          </div>

          {highlightedPaths.map((path, index) => (
            <div key={path?.id || index} style={{
              marginBottom: index < highlightedPaths.length - 1 ? "10px" : "0",
              paddingBottom: index < highlightedPaths.length - 1 ? "8px" : "0",
              borderBottom: index < highlightedPaths.length - 1 ? "1px solid #eee" : "none"
            }}>
              <div style={{
                display: "flex",
                alignItems: "center",
                marginBottom: "4px"
              }}>
                <div style={{
                  width: "12px",
                  height: "12px",
                  backgroundColor: path?.highlightColor || "#ccc",
                  marginRight: "8px",
                  borderRadius: "2px",
                  border: "1px solid #333"
                }}></div>
                <div style={{
                  fontSize: "12px",
                  fontWeight: "bold",
                  color: "#333"
                }}>
                  {path?.destination || "Unknown"}
                </div>
              </div>

              <div style={{ fontSize: "11px", color: "#666", marginLeft: "20px" }}>
                <strong>Type:</strong> {path?.pathType || "Unknown"}
                {path?.isPrimary ?
                  <span style={{ color: "#28a745", marginLeft: "4px" }}>●</span> :
                  <span style={{ color: "#6c757d", marginLeft: "4px" }}>⋯</span>
                }<br />
                <strong>Nodes:</strong> {path?.nodes?.length || 0} | <strong>Edges:</strong> {path?.edges?.length || 0}
              </div>
            </div>
          ))}

          <div style={{ marginTop: "10px", paddingTop: "8px", borderTop: "1px solid #eee" }}>
            <button
              onClick={onClearHighlight}
              style={{
                padding: "4px 8px",
                backgroundColor: "#dc3545",
                color: "white",
                border: "none",
                borderRadius: "3px",
                cursor: "pointer",
                fontSize: "11px",
                width: "100%"
              }}
            >
              Clear All Highlights
            </button>
          </div>
        </div>
      )}

      {/* Instructions (moved from NetworkGraph, bottom-right; hidden in fullscreen) */}
      {!isFullscreen && (
        <div style={{
          position: "absolute",
          bottom: "10px",
          right: "10px",
          background: "rgba(255, 255, 255, 0.9)",
          padding: "8px 12px",
          borderRadius: "4px",
          fontSize: "12px",
          border: "1px solid #ccc",
          maxWidth: "220px"
        }}>
          💡 <strong>Click:</strong> Node/edge to highlight all paths<br />
          🎨 <strong>Colors:</strong> Different paths shown in unique colors<br />
          📍 <strong>Lines:</strong> Solid (primary) ⋯ Dashed (alternative)<br />
          🎯 <strong>Empty space:</strong> Clear highlighting
        </div>
      )}

      {/* Prefix Aggregation Controls (keep bottom-left) */}
      <div style={{
        position: "absolute",
        bottom: isFullscreen ? "20px" : "10px",
        left: isFullscreen ? "20px" : "10px",
        background: "rgba(255, 255, 255, 0.95)",
        padding: "10px 15px",
        borderRadius: "6px",
        border: "1px solid #ccc",
        backdropFilter: "blur(5px)",
        zIndex: 10,
        fontSize: isFullscreen ? "14px" : "12px"
      }}>
        <label style={{ fontSize: isFullscreen ? '14px' : '12px', fontWeight: 'bold', marginBottom: '8px', display: 'block' }}>
          🌐 Network View
        </label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {/* Path Aggregation */}
          <div style={{ fontSize: isFullscreen ? '11px' : '10px', fontWeight: 'bold', color: '#555' }}>
            Path Aggregation:
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginLeft: '8px' }}>
            {['none', 'shared-ips'].map(mode => {
              const isNone = mode === 'none';
              const disabled = isNone && disableShowAllPaths;
              return (
                <label key={mode} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: isFullscreen ? '11px' : '10px', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.55 : 1 }} title={disabled ? (disableReason || 'Disabled for large selections') : undefined}>
                  <input
                    type="radio"
                    name="aggregationMode"
                    value={mode}
                    checked={aggregationMode === mode}
                    onChange={(e) => !disabled && onAggregationModeChange(e.target.value)}
                    style={{ margin: 0, cursor: disabled ? 'not-allowed' : 'pointer' }}
                    disabled={disabled}
                  />
                  {isNone ? '📊 Show All Paths' : '🔗 Shared IPs'}
                </label>
              );
            })}
          </div>
          
          {/* Network Hierarchy */}
          <div style={{ fontSize: isFullscreen ? '11px' : '10px', fontWeight: 'bold', color: '#555', marginTop: '8px' }}>
            Network Hierarchy:
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginLeft: '8px' }}>
            {['none', 'asn', 'subnet', 'isp-pop', 'isp'].map(hierarchy => (
              <label key={hierarchy} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: isFullscreen ? '11px' : '10px', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="networkHierarchy"
                  value={hierarchy}
                  checked={networkHierarchy === hierarchy}
                  onChange={(e) => onNetworkHierarchyChange(e.target.value)}
                  style={{ margin: 0, cursor: 'pointer' }}
                />
                {hierarchy === 'none' ? '🔸 Individual IPs' : 
                 hierarchy === 'asn' ? '🏢 ASN' :
                 hierarchy === 'subnet' ? '🌐 Prefix (/64)' :
                 hierarchy === 'isp-pop' ? '🏢 Prefix (/48)' : '🌍 Prefix (/32)'
                 }
              </label>
            ))}
          </div>
          
          
          {/* Prefix aggregation toggle - show when network hierarchy is selected */}
          {networkHierarchy !== 'none' && networkHierarchy !== 'asn' && (
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: isFullscreen ? '11px' : '10px', cursor: 'pointer', marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #eee' }}>
              <input
                type="checkbox"
                checked={showPrefixAggregation}
                onChange={onTogglePrefixAggregation}
                style={{ margin: 0, cursor: 'pointer' }}
              />
              Enable Prefix Grouping
            </label>
          )}
          
          {showPrefixAggregation && expandedCount > 0 && (
            <div style={{ fontSize: isFullscreen ? '10px' : '9px', color: '#666', marginLeft: '24px' }}>
              Expanded: {expandedCount} group(s)
            </div>
          )}
          {showPrefixAggregation && expandedCount > 0 && (
            <div style={{ display: 'flex', gap: '6px', marginLeft: '8px', marginTop: '6px' }}>
              <button
                onClick={onCollapseAllPrefixes}
                style={{ fontSize: isFullscreen ? '10px' : '9px', padding: '2px 6px', cursor: 'pointer', border: '1px solid #ccc', background: '#f7f7f7', borderRadius: '3px' }}
                title="Collapse all expanded prefixes"
              >
                Collapse All
              </button>
            </div>
          )}
          {networkHierarchy !== 'none' && (
            <div style={{ fontSize: isFullscreen ? '9px' : '8px', color: '#888', marginLeft: '8px', fontStyle: 'italic' }}>
              Click grouped nodes to expand/collapse
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default GraphControls;