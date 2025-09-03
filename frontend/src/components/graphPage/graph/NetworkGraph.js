import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Graph from 'react-graph-vis';
import ipGeoService from '../../../services/ipGeoService';
import GraphControls from './GraphControls';


import { useNetworkGraphModel } from '../../../hooks/useNetworkGraphModel';
import { useGraphData } from '../../../hooks/useGraphData';
import { usePathHighlighting, useGraphFullscreen, useGraphExport } from '../../../hooks';


// Error Boundary for NetworkGraph
class GraphErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('NetworkGraph Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100%',
          flexDirection: 'column',
          padding: '20px',
          backgroundColor: '#f8f9fa',
          border: '1px solid #dee2e6',
          borderRadius: '4px'
        }}>
          <div style={{ fontSize: '24px', marginBottom: '10px' }}>⚠️</div>
          <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '8px', color: '#dc3545' }}>
            Graph Rendering Error
          </div>
          <div style={{ fontSize: '14px', color: '#666', textAlign: 'center', marginBottom: '15px' }}>
            There was an error rendering the network graph. Please try refreshing the page.
          </div>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '8px 16px',
              fontSize: '14px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            🔄 Refresh Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}


// Optimized NetworkGraph component with React.memo
const NetworkGraph = React.memo(({
  pathData,
  selectedDestinations,
  dateRange,
  onHopSelect,
  showPrimaryOnly = false,
  minRTT = '',
  maxRTT = '',
  minUsagePercent = '',
  selectedPathTypes = ['PRIMARY', 'ALTERNATIVE'],
  selectedProtocols = []
}) => {
  // Store network instance for zoom controls
  const [networkInstance, setNetworkInstance] = useState(null);
  const [expandedPrefixes, setExpandedPrefixes] = useState(new Set()); // Track expanded prefix groups
  const [showPrefixAggregation, setShowPrefixAggregation] = useState(false); // Toggle prefix aggregation
  
  // New aggregation controls
  const [aggregationMode, setAggregationMode] = useState('none'); // 'none', 'shared-ips', 'asn'
  const [aggregationScope, setAggregationScope] = useState('cross-destination'); // 'per-destination', 'cross-destination'
  const [expandedAsnGroups, setExpandedAsnGroups] = useState(new Set()); // Track expanded ASN groups
  
  // Network hierarchy controls (separate from path aggregation)
  const [networkHierarchy, setNetworkHierarchy] = useState('none'); // 'none', 'subnet', 'isp-pop', 'isp'
  const graphContainerRef = useRef(null); // Ref for capturing the graph
  const { isFullscreen, dimensions, toggleFullscreen, containerStyle } = useGraphFullscreen();
  const networkRef = useRef(null);
  const { filteredData: filteredByHook } = useGraphData(pathData, {
    minRTT,
    maxRTT,
    minUsagePercent,
    selectedPathTypes,
    showPrimaryOnly,
    selectedProtocols
  });




  // Toggle prefix expansion
  const handlePrefixToggle = useCallback((prefix) => {
    setExpandedPrefixes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(prefix)) {
        newSet.delete(prefix);
      } else {
        newSet.add(prefix);
      }
      return newSet;
    });
  }, []);

  // Toggle prefix aggregation
  const handlePrefixAggregationToggle = useCallback(() => {
    setShowPrefixAggregation(prev => !prev);
    setExpandedPrefixes(new Set()); // Reset expanded prefixes when toggling
  }, []);

  // Handle aggregation mode changes
  const handleAggregationModeChange = useCallback((mode) => {
    setAggregationMode(mode);
    // Reset expanded groups when changing mode
    setExpandedPrefixes(new Set());
    setExpandedAsnGroups(new Set());
    // Auto-enable prefix aggregation when switching to prefix mode
    if (mode === 'prefix') {
      setShowPrefixAggregation(true);
    } else if (mode === 'none') {
      setShowPrefixAggregation(false);
    }
  }, []);

  // Handle aggregation scope changes
  const handleAggregationScopeChange = useCallback((scope) => {
    setAggregationScope(scope);
  }, []);

  // Handle network hierarchy changes
  const handleNetworkHierarchyChange = useCallback((hierarchy) => {
    setNetworkHierarchy(hierarchy);
    // Reset expanded prefixes when changing hierarchy
    setExpandedPrefixes(new Set());
  }, []);

  // Handle ASN group toggle
  const handleAsnToggle = useCallback((asnGroup) => {
    setExpandedAsnGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(asnGroup)) {
        newSet.delete(asnGroup);
      } else {
        newSet.add(asnGroup);
      }
      return newSet;
    });
  }, []);

  // Create a stable key for the graph to force re-creation when needed
  const graphKey = useMemo(() => {
    const keyParts = [
      selectedDestinations.sort().join(','),
      dateRange.start?.toISOString() || 'null',
      dateRange.end?.toISOString() || 'null',
      showPrimaryOnly.toString(),
      minRTT,
      maxRTT,
      minUsagePercent,
      selectedPathTypes.sort().join(','),
      (selectedProtocols && selectedProtocols.length
       ? selectedProtocols.slice().sort().join(',')
       : 'ALL'),          
      // Remove highlightedPaths from key to prevent remounting on selection
      isFullscreen.toString(),
      `${dimensions.width}x${dimensions.height}`,
      Array.from(expandedPrefixes).sort().join(','),
      showPrefixAggregation.toString(),
      aggregationMode,
      aggregationScope,
      networkHierarchy,
      Array.from(expandedAsnGroups).sort().join(',')
    ];
    return keyParts.join('|');
 }, [selectedDestinations, dateRange, showPrimaryOnly, minRTT, maxRTT, minUsagePercent, selectedPathTypes, selectedProtocols, isFullscreen, dimensions, expandedPrefixes, showPrefixAggregation, aggregationMode, aggregationScope, networkHierarchy, expandedAsnGroups]);



  const { graph, nodeDetails, pathMapping } = useNetworkGraphModel({
    filteredByHook,
    selectedDestinations,
    dateRange,
    showPrimaryOnly,
    showPrefixAggregation,
    expandedPrefixes,
    aggregationMode,
    aggregationScope,
    networkHierarchy,
    expandedAsnGroups
  });


  const { highlightedGraph, highlightedPaths, highlightPath, highlightPathById, highlightPathsForNode, clearHighlight } =
    usePathHighlighting({ graph, pathMapping, nodeDetails });



  // Memoize zoom control functions
  const handleZoomIn = useCallback(() => {
    if (networkInstance) {
      const currentScale = networkInstance.getScale();
      networkInstance.moveTo({ scale: currentScale * 1.2 });
    }
  }, [networkInstance]);

  const handleZoomOut = useCallback(() => {
    if (networkInstance) {
      const currentScale = networkInstance.getScale();
      networkInstance.moveTo({ scale: currentScale * 0.8 });
    }
  }, [networkInstance]);

  const handleResetZoom = useCallback(() => {
    if (networkInstance) {
      networkInstance.fit();
    }
  }, [networkInstance]);

  // Handle ESC key to exit fullscreen
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && isFullscreen) {
        // setIsFullscreen(false); // ❌ not defined
        toggleFullscreen();        // ✅ exit fullscreen
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen, toggleFullscreen]);


  // Force resize of network when going fullscreen
  useEffect(() => {
    if (networkInstance && isFullscreen) {
      // Small delay to ensure DOM is updated
      const timer = setTimeout(() => {
        networkInstance.fit();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [networkInstance, isFullscreen, dimensions]);

  const [layoutOptimization] = useState('minimal-crossings');

  const options = useMemo(() => {
    const baseOptions = {
      nodes: {
        font: { face: 'Arial' },
        margin: 10,
        chosen: {
          node: function (values, id, selected, hovering) {
            values.borderColor = '#2196F3';
            values.borderWidth = 2;
          }
        }
      },
      interaction: {
        dragNodes: true,
        zoomView: true,
        dragView: true,
        selectConnectedEdges: false
      },
      configure: { enabled: false },
      layout: { improvedLayout: false }
    };

    switch (layoutOptimization) {
      case 'minimal-crossings':
        return {
          ...baseOptions,
          layout: {
            hierarchical: {
              enabled: true,
              direction: "LR",
              sortMethod: "directed",
              shakeTowards: "leaves",
              nodeSpacing: 80,
              treeSpacing: 60,
              levelSeparation: 250,
              blockShifting: false,
              edgeMinimization: true,
              parentCentralization: false
            }
          },
          physics: { enabled: false },
          edges: {
            smooth: {
              type: "continuous",
              roundness: 0.1,
              forceDirection: "horizontal"
            },
            chosen: false
          }
        };

      case 'ultra-clean':
        return {
          ...baseOptions,
          layout: {
            hierarchical: {
              enabled: true,
              direction: "LR",
              sortMethod: "directed",
              shakeTowards: "leaves",
              nodeSpacing: 120,
              treeSpacing: 100,
              levelSeparation: 300,
              blockShifting: false,
              edgeMinimization: true,
              parentCentralization: false
            }
          },
          physics: { enabled: false },
          edges: {
            smooth: true, // Straight lines only
            chosen: false
          }
        };

      default:
        return baseOptions;
    }
  }, [layoutOptimization]);

  // Enhanced hop selection handler that fetches IP geolocation data
  const handleHopSelection = useCallback(async (nodeData) => {
    if (!nodeData || !Array.isArray(nodeData)) {
      onHopSelect(null);
      return;
    }

    // Check if any hop already has geolocation data - if so, don't refetch
    const hasGeoData = nodeData.some(hop => hop.ipGeoInfo);
    if (hasGeoData) {
      onHopSelect(nodeData);
      return;
    }

    // Find unique IPs that need geolocation data
    const uniqueIPs = [...new Set(
      nodeData
        .filter(hop => hop.ip && !hop.is_timeout)
        .map(hop => hop.ip)
    )];

    // Immediately open drawer with loading state for geolocation
    const nodeDataWithLoadingState = nodeData.map(hop => {
      if (hop.ip && !hop.is_timeout && uniqueIPs.includes(hop.ip)) {
        return {
          ...hop,
          ipGeoInfo: null,
          hasLoadingGeoData: true
        };
      }
      return hop;
    });

    onHopSelect(nodeDataWithLoadingState);

    // Fetch geolocation data asynchronously if we have valid IPs
    if (uniqueIPs.length > 0) {
      try {
        console.log('Fetching geolocation for IPs:', uniqueIPs);
        const ipInfoMap = new Map();

        // Fetch IP info for each unique IP (with caching)
        for (const ip of uniqueIPs) {
          const ipInfo = await ipGeoService.getIPInfo(ip);
          console.log(`IP ${ip} geolocation result:`, ipInfo);

          if (ipInfo) {
            // Format the raw API response (getIPInfo returns raw data, even from cache)
            const formattedInfo = ipGeoService.formatIPInfo(ipInfo);
            if (formattedInfo) {
              ipInfoMap.set(ip, formattedInfo);
            }
          }
        }

        // Update drawer with geolocation data (remove loading state)
        const enhancedNodeData = nodeData.map(hop => {
          if (hop.ip && !hop.is_timeout) {
            return {
              ...hop,
              ipGeoInfo: ipInfoMap.get(hop.ip) || null,
              hasLoadingGeoData: false
            };
          }
          return hop;
        });

        console.log('Updating hop data with geolocation info');
        onHopSelect(enhancedNodeData);

      } catch (error) {
        console.error('Error fetching IP geolocation data:', error);

        // Remove loading state and keep original data
        const errorNodeData = nodeData.map(hop => {
          if (hop.ip && !hop.is_timeout) {
            return {
              ...hop,
              ipGeoInfo: null,
              hasLoadingGeoData: false
            };
          }
          return hop;
        });

        onHopSelect(errorNodeData);
      }
    }
  }, [onHopSelect]);

  // Memoize events to prevent unnecessary re-renders
  const events = useMemo(() => ({
    select: function (event) {
      event.preventDefault?.();
      const { nodes, edges } = event;
      if (nodes.length > 0) {
        // Coerce node id to number (vis may return string ids)
        const rawId = nodes[0];
        const nodeId = typeof rawId === 'string' ? parseInt(rawId, 10) : rawId;

        const node = graph.nodes.find(n => n.id === nodeId);
        // Handle expand/collapse nodes
        if (node?.nodeType === 'prefix') { handlePrefixToggle(node.prefix); return; }
        if (node?.nodeType === 'timeout_group') { handlePrefixToggle(node.timeoutGroup); return; }
        if (node?.nodeType === 'asn') { handleAsnToggle(node.asnGroup); return; }

        // Try getting precomputed details
        let nodeData = nodeDetails.get(nodeId);

        // Fallback: build lightweight details so drawer still opens
        if (!nodeData || !Array.isArray(nodeData) || nodeData.length === 0) {
          if (node?.nodeType === 'hop' && node?.ip) {
            nodeData = [{
              ip: node.ip,
              hostname: node.label,
              rtt_ms: null,
              destination: null,
              hopNumber: node.level ?? null,
              pathType: null,
              is_timeout: false
            }];
          } else if (node?.nodeType === 'timeout' && node?.timeoutKey) {
            // Extract hop number if present in timeoutKey: timeout_<hop>_...
            const match = String(node.timeoutKey).match(/^timeout_(\d+)_/);
            const hopNumber = match ? parseInt(match[1], 10) : (node.level ?? null);
            nodeData = [{
              ip: null,
              hostname: 'Timeout',
              rtt_ms: null,
              destination: null,
              hopNumber,
              pathType: null,
              is_timeout: true
            }];
          }
        }

        if (nodeData && Array.isArray(nodeData)) {
          handleHopSelection(nodeData);
          const set = pathMapping.get(nodeId);
          if (set && set.size) {
            // NEW: highlight all paths through this node (most used = solid)
            highlightPathsForNode(nodeId);
          } else {
            clearHighlight();
          }
        }
      } else if (edges.length > 0) {
        const edgeId = edges[0]; // string id (edge_x)
        highlightPath(edgeId, 'edge');
      } else {
        onHopSelect(null);
        clearHighlight();
      }
    },
    click: function (event) {
      event.preventDefault?.();
      if (event.nodes.length === 0 && event.edges.length === 0) {
        onHopSelect(null);
        clearHighlight();
      }
    },
    hoverNode: function () {},
    hoverEdge: function () {}
  }), [handleAsnToggle,pathMapping, graph, nodeDetails, handleHopSelection, clearHighlight, handlePrefixToggle, highlightPath, onHopSelect, highlightPathsForNode]);
  // Memoize the getNetwork callback
  const getNetwork = useCallback((network) => {
    networkRef.current = network;
    setNetworkInstance(network);
  }, []);

  // After networkInstance is set, apply highlight changes directly:
useEffect(() => {
  if (!networkInstance) return;
  if (!highlightedGraph || !graph) return;
  if (highlightedGraph === graph) return; // no highlighting active

  const nodesDS = networkInstance.body.data.nodes;
  const edgesDS = networkInstance.body.data.edges;

  const changedNodes = [];
  const changedEdges = [];

  // Helper comparators (only compare few styling fields)
  const nodeChanged = (curr, next) => {
    return (
      curr.color?.background !== next.color?.background ||
      curr.color?.border !== next.color?.border ||
      curr.opacity !== next.opacity ||
      curr.borderWidth !== next.borderWidth
    );
  };

  const edgeChanged = (curr, next) => {
    return (
      curr.color !== next.color &&
      curr.color?.color !== next.color?.color ||
      curr.color?.opacity !== next.color?.opacity ||
      curr.width !== next.width ||
      JSON.stringify(curr.dashes) !== JSON.stringify(next.dashes)
    );
  };

  let raf = requestAnimationFrame(() => {
    // Diff nodes
    for (const n of highlightedGraph.nodes) {
      const current = nodesDS.get(n.id);
      if (!current) continue;
      if (nodeChanged(current, n)) {
        changedNodes.push({
          id: n.id,
          color: n.color,
          opacity: n.opacity,
          borderWidth: n.borderWidth,
          font: n.font // keep label styling sync
        });
      }
    }
    // Diff edges
    for (const e of highlightedGraph.edges) {
      const current = edgesDS.get(e.id);
      if (!current) continue;
      if (edgeChanged(current, e)) {
        changedEdges.push({
          id: e.id,
          color: e.color,
          width: e.width,
          dashes: e.dashes
        });
      }
    }

    if (changedNodes.length) nodesDS.update(changedNodes);
    if (changedEdges.length) edgesDS.update(changedEdges);
  });

  return () => cancelAnimationFrame(raf);
}, [highlightedGraph, networkInstance, graph]);



  const { downloadAsPNG, downloadAsSVG } = useGraphExport({ networkInstance, graphContainerRef, graph });

  

  return (
    <div style={containerStyle} ref={graphContainerRef}>
      <GraphErrorBoundary>
        <Graph
          key={graphKey}
          graph={graph}
          options={options}
          events={events}
          getNetwork={getNetwork}
        />
      </GraphErrorBoundary>

      <GraphControls
        isFullscreen={isFullscreen}
        onToggleFullscreen={toggleFullscreen}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onFit={handleResetZoom}
        onDownloadPNG={downloadAsPNG}
        onDownloadSVG={downloadAsSVG} 
        canDownload={!!networkInstance}
        // Aggregation controls
        aggregationMode={aggregationMode}
        onAggregationModeChange={handleAggregationModeChange}
        aggregationScope={aggregationScope}
        onAggregationScopeChange={handleAggregationScopeChange}
        showPrefixAggregation={showPrefixAggregation}
        onTogglePrefixAggregation={handlePrefixAggregationToggle}
        expandedCount={expandedPrefixes.size + expandedAsnGroups.size}
        // Network hierarchy controls
        networkHierarchy={networkHierarchy}
        onNetworkHierarchyChange={handleNetworkHierarchyChange}
        highlightedPaths={highlightedPaths}      // added
        onClearHighlight={clearHighlight}        // added
      />
    </div>
  );
});

NetworkGraph.displayName = 'NetworkGraph';

export default NetworkGraph;