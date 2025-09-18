import React, { useMemo } from 'react';

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
  // Dynamic instructions based on current settings
  const instructions = useMemo(() => {
    const baseInstructions = [
      { icon: "💡", text: "Click: Node/edge to highlight all paths" },
      { icon: "🎨", text: "Colors: Different paths shown in unique colors" },
      { icon: "📍", text: "Lines: Solid (primary) ⋯ Dashed (alternative)" },
      { icon: "🎯", text: "Empty space: Clear highlighting" }
    ];

    const aggregationInstructions = [];
    const hierarchyInstructions = [];

    // Add aggregation-specific instructions
    if (aggregationMode === 'shared-ips') {
      aggregationInstructions.push(
        { icon: "🔗", text: "Shared IPs: Common nodes across paths grouped" },
        { icon: "📊", text: "Counts: Numbers show how many paths use each node" }
      );
    } else {
      aggregationInstructions.push(
        { icon: "📊", text: "All Paths: Every individual path shown separately" },
        { icon: "🎨", text: "Unique Colors: Each path gets its own color" }
      );
    }

    // Add hierarchy-specific instructions
    if (networkHierarchy === 'asn') {
      hierarchyInstructions.push(
        { icon: "🏢", text: "ASN View: Nodes grouped by Autonomous System" },
      );
    } else if (networkHierarchy === 'subnet') {
      hierarchyInstructions.push(
        { icon: "🌐", text: "Subnet View: Nodes grouped by /64 prefix" },
      );
    } else if (networkHierarchy === 'isp-pop') {
      hierarchyInstructions.push(
        { icon: "🏢", text: "ISP-PoP View: Nodes grouped by /48 prefix" },
      );
    } else if (networkHierarchy === 'isp') {
      hierarchyInstructions.push(
        { icon: "🌍", text: "ISP View: Nodes grouped by /32 prefix" },
      );
    } else {
      hierarchyInstructions.push(
        { icon: "🔸", text: "Individual IPs: Each hop shown separately" }
      );
    }

    // Add prefix aggregation instructions
    if (showPrefixAggregation && networkHierarchy !== 'none' && networkHierarchy !== 'asn') {
      hierarchyInstructions.push(
        { icon: "📦", text: "Prefix Grouping: Similar prefixes combined" },
        { icon: "🔢", text: "Numbers: Show how many IPs in each group" }
      );
    }

    return [...baseInstructions, ...aggregationInstructions, ...hierarchyInstructions];
  }, [aggregationMode, networkHierarchy, showPrefixAggregation]);

  // Check if mobile (simple detection)
  const isMobile = useMemo(() => {
    return window.innerWidth <= 768;
  }, []);

  // Responsive styles
  const responsiveStyles = useMemo(() => ({
    // Instructions panel
    instructions: {
      position: "absolute",
      // On mobile, position above controls if path highlighting is active
      bottom: isMobile && highlightedPaths.length > 0 ? "220px" : (isMobile ? "5px" : "10px"),
      right: isMobile ? "5px" : "10px",
      background: "rgba(255, 255, 255, 0.95)",
      padding: isMobile ? "6px 8px" : "8px 12px",
      borderRadius: "4px",
      fontSize: isMobile ? "10px" : "12px",
      border: "1px solid #ccc",
      maxWidth: isMobile ? "180px" : "220px",
      backdropFilter: "blur(5px)",
      zIndex: 10,
      display: isMobile ? 'none' : 'block'
    },
    // Path highlighting panel
    pathHighlight: {
      position: "absolute",
      bottom: isMobile ? "5px" : "10px",
      left: isMobile ? "5px" : "200px",
      background: "rgba(255, 255, 255, 0.95)",
      padding: isMobile ? "8px 10px" : "10px 15px",
      borderRadius: "6px",
      border: "2px solid #FFD700",
      backdropFilter: "blur(5px)",
      zIndex: 10,
      maxWidth: isMobile ? "250px" : "280px",
      maxHeight: isMobile ? "200px" : "300px",
      overflowY: "auto",
      display: isMobile ? 'none' : 'block'
    },
    // Controls panel
    controls: {
      position: "absolute",
      bottom: isMobile ? "5px" : (isFullscreen ? "20px" : "10px"),
      left: isMobile ? "5px" : (isFullscreen ? "20px" : "10px"),
      background: "rgba(255, 255, 255, 0.95)",
      padding: isMobile ? "8px 10px" : "10px 15px",
      borderRadius: "6px",
      border: "1px solid #ccc",
      backdropFilter: "blur(5px)",
      zIndex: 10,
      fontSize: isMobile ? "11px" : (isFullscreen ? "14px" : "12px")
    }
  }), [isMobile, isFullscreen, highlightedPaths.length]);
  return (
    <>
      {/* Zoom Controls - Responsive */}
      <div className="zoom-controls" style={{
        fontSize: isMobile ? '12px' : '14px',
        padding: isMobile ? '4px' : '6px'
      }}>
        <button
          onClick={onToggleFullscreen}
          title={isFullscreen ? "Exit Fullscreen (ESC)" : "Enter Fullscreen"}
          className="zoom-button fullscreen"
          style={{
            fontSize: isMobile ? '12px' : '14px',
            padding: isMobile ? '4px 6px' : '6px 8px'
          }}
        >
          {isFullscreen ? "➡" : "⬅"}
        </button>

        <button
          onClick={onZoomIn}
          title="Zoom In"
          className="zoom-button zoom-in"
          style={{
            fontSize: isMobile ? '12px' : '14px',
            padding: isMobile ? '4px 6px' : '6px 8px'
          }}
        >
          +
        </button>

        <button
          onClick={onZoomOut}
          title="Zoom Out"
          className="zoom-button zoom-out"
          style={{
            fontSize: isMobile ? '12px' : '14px',
            padding: isMobile ? '4px 6px' : '6px 8px'
          }}
        >
          −
        </button>

        <button
          onClick={onFit}
          title="Fit to Screen"
          className="zoom-button fit-screen"
          style={{
            fontSize: isMobile ? '12px' : '14px',
            padding: isMobile ? '4px 6px' : '6px 8px'
          }}
        >
          ◎
        </button>

        {/* Download Controls */}
        <div style={{ height: isMobile ? "4px" : "8px" }}></div>

        <button
          onClick={onDownloadPNG}
          title="Download as PNG"
          className="zoom-button download-png"
          disabled={!canDownload}
          style={{
            fontSize: isMobile ? '10px' : '12px',
            padding: isMobile ? '3px 5px' : '4px 6px'
          }}
        >
          PNG
        </button>

        <button
          onClick={() => onDownloadSVG && onDownloadSVG(false)}
          title="Download as SVG"
          className="zoom-button download-svg"
          disabled={!canDownload}
          style={{
            fontSize: isMobile ? '10px' : '12px',
            padding: isMobile ? '3px 5px' : '4px 6px'
          }}
        >
          SVG
        </button>
        <button
          onClick={() => onExportJSON && onExportJSON()}
          title="Export graph JSON"
          className="zoom-button download-json"
          disabled={!canDownload}
          style={{
            fontSize: isMobile ? '10px' : '12px',
            padding: isMobile ? '3px 5px' : '4px 6px'
          }}
        >
          JSON
        </button>
      </div>

      {/* Path Highlighting Controls - Responsive */}
      {highlightedPaths.length > 0 && (
        <div style={responsiveStyles.pathHighlight}>
          <div style={{
            fontSize: isMobile ? "12px" : "14px",
            fontWeight: "bold",
            color: "#333",
            marginBottom: "8px"
          }}>
            🔍 {highlightedPaths.length > 1 ? `${highlightedPaths.length} Paths` : 'Path'} Highlighted
          </div>

          {highlightedPaths.map((path, index) => (
            <div key={path?.id || index} style={{
              marginBottom: index < highlightedPaths.length - 1 ? "8px" : "0",
              paddingBottom: index < highlightedPaths.length - 1 ? "6px" : "0",
              borderBottom: index < highlightedPaths.length - 1 ? "1px solid #eee" : "none"
            }}>
              <div style={{
                display: "flex",
                alignItems: "center",
                marginBottom: "3px"
              }}>
                <div style={{
                  width: isMobile ? "10px" : "12px",
                  height: isMobile ? "10px" : "12px",
                  backgroundColor: path?.highlightColor || "#ccc",
                  marginRight: "6px",
                  borderRadius: "2px",
                  border: "1px solid #333"
                }}></div>
                <div style={{
                  fontSize: isMobile ? "10px" : "12px",
                  fontWeight: "bold",
                  color: "#333"
                }}>
                  {path?.destination || "Unknown"}
                </div>
              </div>

              <div style={{ 
                fontSize: isMobile ? "9px" : "11px", 
                color: "#666", 
                marginLeft: isMobile ? "16px" : "20px" 
              }}>
                <strong>Type:</strong> {path?.pathType || "Unknown"}
                {path?.isPrimary ?
                  <span style={{ color: "#28a745", marginLeft: "4px" }}>●</span> :
                  <span style={{ color: "#6c757d", marginLeft: "4px" }}>⋯</span>
                }<br />
                {path?.protocols && path.protocols.length > 0 && (
                  <>
                    <strong>Protocols:</strong> {path.protocols.join(', ')}<br />
                  </>
                )}
                {path?.domains && path.domains.length > 0 && (
                  <>
                    <strong>Domains:</strong> {path.domains.join(', ')}<br />
                  </>
                )}
                <strong>Nodes:</strong> {path?.nodes?.length || 0} | <strong>Edges:</strong> {path?.edges?.length || 0}
              </div>
            </div>
          ))}

          <div style={{ marginTop: "8px", paddingTop: "6px", borderTop: "1px solid #eee" }}>
            <button
              onClick={onClearHighlight}
              style={{
                padding: isMobile ? "3px 6px" : "4px 8px",
                backgroundColor: "#dc3545",
                color: "white",
                border: "none",
                borderRadius: "3px",
                cursor: "pointer",
                fontSize: isMobile ? "9px" : "11px",
                width: "100%"
              }}
            >
              Clear All Highlights
            </button>
          </div>
        </div>
      )}

      {/* Dynamic Instructions - Responsive */}
      {!isFullscreen && (
        <div style={responsiveStyles.instructions}>
          {instructions.map((instruction, index) => (
            <div key={index} style={{ 
              marginBottom: index < instructions.length - 1 ? "3px" : "0",
              lineHeight: isMobile ? "1.2" : "1.3"
            }}>
              {instruction.icon} <strong>{instruction.text.split(':')[0]}:</strong> {instruction.text.split(':').slice(1).join(':')}
            </div>
          ))}
        </div>
      )}

      {/* Network Controls - Responsive */}
      <div style={responsiveStyles.controls}>
        <label style={{ 
          fontSize: isMobile ? '11px' : (isFullscreen ? '14px' : '12px'), 
          fontWeight: 'bold', 
          marginBottom: '8px', 
          display: 'block' 
        }}>
          🌐 Network View
        </label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '6px' : '8px' }}>
          {/* Path Aggregation */}
          <div style={{ 
            fontSize: isMobile ? '10px' : (isFullscreen ? '11px' : '10px'), 
            fontWeight: 'bold', 
            color: '#555' 
          }}>
            Path Aggregation:
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginLeft: '6px' }}>
            {['none', 'shared-ips'].map(mode => {
              const isNone = mode === 'none';
              const disabled = isNone && disableShowAllPaths;
              return (
                <label key={mode} style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '4px', 
                  fontSize: isMobile ? '9px' : (isFullscreen ? '11px' : '10px'), 
                  cursor: disabled ? 'not-allowed' : 'pointer', 
                  opacity: disabled ? 0.55 : 1 
                }} title={disabled ? (disableReason || 'Disabled for large selections') : undefined}>
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
          <div style={{ 
            fontSize: isMobile ? '10px' : (isFullscreen ? '11px' : '10px'), 
            fontWeight: 'bold', 
            color: '#555', 
            marginTop: '6px' 
          }}>
            Network Hierarchy:
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginLeft: '6px' }}>
            {['none', 'asn', 'subnet', 'isp-pop', 'isp'].map(hierarchy => (
              <label key={hierarchy} style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '4px', 
                fontSize: isMobile ? '9px' : (isFullscreen ? '11px' : '10px'), 
                cursor: 'pointer' 
              }}>
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
            <label style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px', 
              fontSize: isMobile ? '9px' : (isFullscreen ? '11px' : '10px'), 
              cursor: 'pointer', 
              marginTop: '6px', 
              paddingTop: '6px', 
              borderTop: '1px solid #eee' 
            }}>
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
            <div style={{ 
              fontSize: isMobile ? '8px' : (isFullscreen ? '10px' : '9px'), 
              color: '#666', 
              marginLeft: '20px' 
            }}>
              Expanded: {expandedCount} group(s)
            </div>
          )}
          {showPrefixAggregation && expandedCount > 0 && (
            <div style={{ display: 'flex', gap: '4px', marginLeft: '6px', marginTop: '4px' }}>
              <button
                onClick={onCollapseAllPrefixes}
                style={{ 
                  fontSize: isMobile ? '8px' : (isFullscreen ? '10px' : '9px'), 
                  padding: isMobile ? '1px 4px' : '2px 6px', 
                  cursor: 'pointer', 
                  border: '1px solid #ccc', 
                  background: '#f7f7f7', 
                  borderRadius: '3px' 
                }}
                title="Collapse all expanded prefixes"
              >
                Collapse All
              </button>
            </div>
          )}
          {networkHierarchy !== 'none' && (
            <div style={{ 
              fontSize: isMobile ? '7px' : (isFullscreen ? '9px' : '8px'), 
              color: '#888', 
              marginLeft: '6px', 
              fontStyle: 'italic' 
            }}>
              Click grouped nodes to expand/collapse
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default GraphControls;