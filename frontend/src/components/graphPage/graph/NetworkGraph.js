import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Graph from 'react-graph-vis';
import ipGeoService from '../../../services/ipGeoService';
import GraphControls from './GraphControls';
import AggregatedHopTooltip from './AggregatedHopTooltip';
import EdgeTooltip from './EdgeTooltip';


import { useNetworkGraphModel, useGraphData, usePathHighlighting, useGraphFullscreen, useGraphExport } from '../../../hooks';
import ErrorBoundary from '../../ui/ErrorBoundary';
import { buildVisOptions } from '../../../utils/visOptions';


// Error Boundary for NetworkGraph
// Reuse shared app error boundary
const GraphErrorBoundary = (props) => <ErrorBoundary {...props} />;


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
  selectedProtocols = [],
  hideReachedOnly = false,
  showReachedOnly = false
  ,
  isImported = false
}) => {
  // Store network instance for zoom controls
  const [networkInstance, setNetworkInstance] = useState(null);
  const [expandedPrefixes, setExpandedPrefixes] = useState(new Set()); // Track expanded prefix groups
  const [showPrefixAggregation, setShowPrefixAggregation] = useState(false); // Toggle prefix aggregation
  
  // New aggregation controls
  // Default to 'none' (Show All Paths) to avoid unintended aggregation hiding data
  const [aggregationMode, setAggregationMode] = useState('none'); // 'none', 'shared-ips', 'asn'
  // Default: show all paths (mode 'none') should be per-destination
  const [aggregationScope, setAggregationScope] = useState('per-destination'); // 'per-destination', 'cross-destination'
  const [expandedAsnGroups, setExpandedAsnGroups] = useState(new Set()); // Track expanded ASN groups
  
  // Network hierarchy controls (separate from path aggregation)
  const [networkHierarchy, setNetworkHierarchy] = useState('none'); // 'none', 'asn', 'subnet', 'isp-pop', 'isp'
  const graphContainerRef = useRef(null); // Ref for capturing the graph
  const { isFullscreen, dimensions, toggleFullscreen, containerStyle } = useGraphFullscreen();
  const networkRef = useRef(null);
  const [layoutOptimization, setLayoutOptimization] = useState('minimal-crossings');
  const [hoverState, setHoverState] = useState({ visible: false, x: 0, y: 0, items: [] });
  const [pinnedTooltip, setPinnedTooltip] = useState({ active: false, nodeId: null, x: 0, y: 0, items: [] });
  const [edgeHover, setEdgeHover] = useState({ visible: false, x: 0, y: 0, edge: null });
  const [pinnedEdge, setPinnedEdge] = useState({ active: false, x: 0, y: 0, edge: null });

 

  // With single-source fetching, the graph uses the data from parent directly
  const effectivePathData = useMemo(() => {
    return pathData && typeof pathData === 'object' ? pathData : null;
  }, [pathData]);

  // Normalize selected destinations to match keys in effectivePathData (prefer destination address over id)
  const normalizedDestinations = useMemo(() => {
    const input = Array.isArray(selectedDestinations) ? selectedDestinations : [];
    const keySet = effectivePathData && typeof effectivePathData === 'object'
      ? new Set(Object.keys(effectivePathData))
      : null;
    const out = [];
    for (const d of input) {
      let candidate = null;
      if (typeof d === 'string') {
        candidate = d;
      } else if (d && typeof d === 'object') {
        candidate = d.address || (d.id != null ? String(d.id) : null);
      }
      if (!candidate) continue;
      // Lowercase to match transformer keys (addresses are lowercased in transform)
      const lc = typeof candidate === 'string' ? candidate.toLowerCase() : candidate;
      // If we know the keys, prefer matches; otherwise accept the candidate
      if (keySet) {
        if (typeof lc === 'string' && keySet.has(lc)) {
          out.push(lc);
          continue;
        }
        // If the object had both address and id, address would have been used already
        // Fall through to include the candidate to avoid dropping selections entirely
      }
      out.push(lc);
    }
    const unique = Array.from(new Set(out));
    if (keySet && unique.length === 0) {
      // Fallback to all available keys to avoid empty/incomplete graphs due to key mismatch
      return Array.from(keySet);
    }
    return unique;
  }, [selectedDestinations, effectivePathData]);

  const { filteredData: filteredByHook } = useGraphData(effectivePathData, {
    minRTT,
    maxRTT,
    minUsagePercent,
    selectedPathTypes,
    showPrimaryOnly,
    selectedProtocols,
  hideReachedOnly,
  showReachedOnly
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

  // Explicit collapse of a prefix (used by UI buttons / double-click)
  const handlePrefixCollapse = useCallback((prefix) => {
    setExpandedPrefixes(prev => {
      if (!prev.has(prefix)) return prev;
      const next = new Set(prev);
      next.delete(prefix);
      return next;
    });
  }, []);

  const handleCollapseAllPrefixes = useCallback(() => {
    setExpandedPrefixes(new Set());
  }, []);

  // Toggle prefix aggregation
  const handlePrefixAggregationToggle = useCallback(() => {
    setShowPrefixAggregation(prev => !prev);
    setExpandedPrefixes(new Set()); // Reset expanded prefixes when toggling
  }, []);

  // Handle aggregation mode changes
  const handleAggregationModeChange = useCallback((mode) => {
    setAggregationMode(mode);
    setExpandedPrefixes(new Set());
    setExpandedAsnGroups(new Set());

    if (mode === 'prefix') {
      setShowPrefixAggregation(true);
    } else if (mode === 'none') {
      setShowPrefixAggregation(false);
    }

    if (mode === 'none') {
      // Show All Paths
      setAggregationScope('per-destination');
      setLayoutOptimization('all-paths');
    } else {
      if (mode === 'shared-ips') {
        setAggregationScope('cross-destination');
      } else if (mode === 'asn' || mode === 'prefix') {
        // For ASN/prefix aggregation modes, always use cross-destination scope
        // to enable proper merging of paths through the same ASN/prefix
        setAggregationScope('cross-destination');
      }
      setLayoutOptimization('minimal-crossings');
    }
  }, []);


  // Handle network hierarchy changes
  const handleNetworkHierarchyChange = useCallback((hierarchy) => {
    setNetworkHierarchy(hierarchy);
    // Reset expanded prefixes when changing hierarchy
    setExpandedPrefixes(new Set());
    setExpandedAsnGroups(new Set());
    
    // Auto-toggle prefix grouping based on hierarchy selection
    if (hierarchy === 'none' || hierarchy === 'asn') {
      setShowPrefixAggregation(false);
    } else {
      // subnet / isp-pop / isp
      setShowPrefixAggregation(true);
    }
    
    // For ASN/prefix hierarchies, ensure appropriate aggregation scope
    // to allow proper cross-destination grouping for ASN/prefix aggregation
    if (hierarchy === 'asn' || hierarchy === 'subnet' || hierarchy === 'isp-pop' || hierarchy === 'isp') {
      if (aggregationMode === 'shared-ips') {
        // For shared-ips mode with hierarchical views, use cross-destination scope
        // to allow ASN/prefix nodes to merge across destinations properly
        setAggregationScope('cross-destination');
      }
    }
  }, [aggregationMode]);

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
  // Lightweight data signature so Graph remounts cleanly when the underlying dataset source changes (cache vs fresh)
  const dataSig = useMemo(() => {
    try {
      if (!effectivePathData || typeof effectivePathData !== 'object') return 'null';
      const dests = Object.keys(effectivePathData).sort();
      const parts = [String(dests.length), `mode:${aggregationMode}`];
      for (const d of dests) {
        const dp = effectivePathData[d] || {};
        const priLen = Array.isArray(dp?.primary_path?.path) ? dp.primary_path.path.length : 0;
        const altCount = Array.isArray(dp?.alternatives) ? dp.alternatives.length : 0;
        const total = dp?.total_traces || 0;
        parts.push(`${d}:${priLen}:${altCount}:${total}`);
      }
      return parts.join(';');
    } catch {
      return 'sig-error';
    }
  }, [effectivePathData, aggregationMode]);

  const graphKey = useMemo(() => {
    const keyParts = [
      normalizedDestinations.slice().sort().join(','),
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
  hideReachedOnly.toString(),
  showReachedOnly.toString(),
      // Remove highlightedPaths from key to prevent remounting on selection
      isFullscreen.toString(),
      `${dimensions.width}x${dimensions.height}`,
      Array.from(expandedPrefixes).sort().join(','),
      showPrefixAggregation.toString(),
      aggregationMode,
      aggregationScope,
      networkHierarchy,
      Array.from(expandedAsnGroups).sort().join(','),
      // Include data signature to force clean remount when data source/content changes
      `DATA:${dataSig}`
    ];
    return keyParts.join('|');
  }, [normalizedDestinations, dateRange, showPrimaryOnly, minRTT, maxRTT, minUsagePercent, selectedPathTypes, selectedProtocols, hideReachedOnly, showReachedOnly, isFullscreen, dimensions, expandedPrefixes, showPrefixAggregation, aggregationMode, aggregationScope, networkHierarchy, expandedAsnGroups, dataSig]);

  // Heuristic: consider query heavy when many destinations or a long range
  const isHeavyQuery = useMemo(() => {
    const destCount = Array.isArray(normalizedDestinations) ? normalizedDestinations.length : 0;
    const startMs = dateRange?.start?.getTime?.() ?? 0;
    const endMs = dateRange?.end?.getTime?.() ?? 0;
    const days = startMs && endMs ? Math.max(0, (endMs - startMs) / (24 * 60 * 60 * 1000)) : 0;
    return destCount > 20 || days > 14; // tweak thresholds as needed
  }, [normalizedDestinations, dateRange?.start, dateRange?.end]);

  // If heavy, auto-avoid 'Show All Paths' (per-run) to reduce payloads
  useEffect(() => {
    if (isHeavyQuery && aggregationMode === 'none') {
      setAggregationMode('shared-ips');
    }
  }, [isHeavyQuery, aggregationMode]);

  // Ensure proper aggregation scope for hierarchical views in heavy query mode
  useEffect(() => {
    if (isHeavyQuery && aggregationMode === 'shared-ips' && 
        (networkHierarchy === 'asn' || networkHierarchy === 'subnet' || 
         networkHierarchy === 'isp-pop' || networkHierarchy === 'isp')) {
      setAggregationScope('cross-destination');
    }
  }, [isHeavyQuery, aggregationMode, networkHierarchy]);


  const { graph, nodeDetails, pathMapping } = useNetworkGraphModel({
    filteredByHook,
    selectedDestinations: normalizedDestinations,
    dateRange,
    showPrimaryOnly,
    showPrefixAggregation,
    expandedPrefixes,
    aggregationMode,
    aggregationScope,
    networkHierarchy,
    expandedAsnGroups
  });


  const { highlightedGraph, highlightedPaths, highlightPath, highlightPathsForNode, clearHighlight } =
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


  const options = useMemo(() => {
  // Auto-pick compact ASN layout for Shared IPs + ASN hierarchy/aggregation
  const useAsnCompact = (aggregationMode === 'shared-ips') && (networkHierarchy === 'asn' || aggregationMode === 'asn');
  const preset = useAsnCompact ? 'asn-compact' : layoutOptimization;
  const opts = buildVisOptions(preset, graph);
    // Preserve chosen.node behavior from previous inline config
  return {
      ...opts,
      nodes: {
        ...opts.nodes,
        font: { face: 'Arial', ...(opts.nodes?.font || {}) },
        margin: 10,
        chosen: {
          node: function (values, id, selected) {
            try {
              const node = graph?.nodes?.find(n => n.id === id);
              if (node) {
                values.borderColor = node.nodeType === 'timeout' ? '#FF3333' : (node.color?.border || '#07852aff');
                const baseWidth = node.borderWidth || 2;
                values.borderWidth = selected ? baseWidth + 1 : baseWidth;
              } else {
                values.borderColor = '#2196F3';
                values.borderWidth = 2;
              }
            } catch (e) {
              values.borderColor = '#2196F3';
              values.borderWidth = 2;
            }
          }
        }
      },
      interaction: {
        ...(opts.interaction || {}),
        hover: true,
        tooltipDelay: 50
      }
    };
  }, [layoutOptimization, graph, aggregationMode, networkHierarchy]);

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
        // When a network hierarchy is active, disable click-to-expand behavior
        if (networkHierarchy === 'none') {
          if (node?.nodeType === 'prefix') { handlePrefixToggle(node.prefix); return; }
          if (node?.nodeType === 'timeout_group') { handlePrefixToggle(node.timeoutGroup); return; }
          if (node?.nodeType === 'asn') { handleAsnToggle(node.asnGroup); return; }
        }

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
    doubleClick: function(event) {
      const { nodes } = event;
      if (nodes && nodes.length === 1) {
        const rawId = nodes[0];
        const nodeId = typeof rawId === 'string' ? parseInt(rawId, 10) : rawId;
        const node = graph.nodes.find(n => n.id === nodeId);
        // Collapse parent prefix if double-clicking a child hop
  if (networkHierarchy === 'none' && node?.nodeType === 'hop' && node.parentPrefix && expandedPrefixes.has(node.parentPrefix)) {
          handlePrefixCollapse(node.parentPrefix);
        }
        // Collapse prefix if double-clicking the prefix node itself (if expanded representation kept)
  if (networkHierarchy === 'none' && node?.nodeType === 'prefix' && expandedPrefixes.has(node.prefix)) {
          handlePrefixCollapse(node.prefix);
        }
      }
    },
    click: function (event) {
      event.preventDefault?.();
      if ((event.nodes?.length || 0) === 0 && (event.edges?.length || 0) === 0) {
        // Background click: clear selection, highlights, and any tooltip
        onHopSelect(null);
        clearHighlight();
        setHoverState({ visible: false, x: 0, y: 0, items: [] });
        setPinnedTooltip({ active: false, nodeId: null, x: 0, y: 0, items: [] });
        setEdgeHover({ visible: false, x: 0, y: 0, edge: null });
        setPinnedEdge({ active: false, x: 0, y: 0, edge: null });
      }
    },
    hoverNode: function (event) {
      try {
        const { node, pointer } = event || {};
        if (!node) { if (!pinnedTooltip.active) setHoverState({ visible: false, x: 0, y: 0, items: [] }); return; }
        const id = typeof node === 'string' ? parseInt(node, 10) : node;
        const nd = graph.nodes.find(n => n.id === id);
        if (!nd) { if (!pinnedTooltip.active) setHoverState({ visible: false, x: 0, y: 0, items: [] }); return; }

        // Use our tooltip for all node types. For timeout nodes, data set may be empty and the tooltip will hide itself.
        const items = nodeDetails.get(id) || [];
        const list = Array.isArray(items)
          ? ((nd?.nodeType === 'timeout' || nd?.nodeType === 'timeout_group') ? items : items.filter(it => (it?.is_timeout !== true)))
          : [];

        if (!pinnedTooltip.active || pinnedTooltip.nodeId !== id) {
          setHoverState({ visible: list.length > 0, x: pointer?.DOM?.x || 0, y: pointer?.DOM?.y || 0, items: list });
        }
      } catch {
        if (!pinnedTooltip.active) setHoverState({ visible: false, x: 0, y: 0, items: [] });
      }
    },
    blurNode: function () { if (!pinnedTooltip.active) setHoverState({ visible: false, x: 0, y: 0, items: [] }); },
    hoverEdge: function (event) {
      try {
        const { edge, pointer } = event || {};
        if (!edge) { if (!pinnedEdge.active) setEdgeHover({ visible: false, x: 0, y: 0, edge: null }); return; }
        const eid = typeof edge === 'string' ? edge : String(edge);
        const e = graph.edges.find(ed => ed.id === eid);
        if (!e) { if (!pinnedEdge.active) setEdgeHover({ visible: false, x: 0, y: 0, edge: null }); return; }
        if (!pinnedEdge.active) setEdgeHover({ visible: true, x: pointer?.DOM?.x || 0, y: pointer?.DOM?.y || 0, edge: e });
      } catch {
        if (!pinnedEdge.active) setEdgeHover({ visible: false, x: 0, y: 0, edge: null });
      }
    },
    blurEdge: function () { if (!pinnedEdge.active) setEdgeHover({ visible: false, x: 0, y: 0, edge: null }); }
  }), [pinnedTooltip, pinnedEdge.active, handleAsnToggle, pathMapping, graph, nodeDetails, handleHopSelection, clearHighlight, handlePrefixToggle, highlightPath, onHopSelect, highlightPathsForNode, expandedPrefixes, handlePrefixCollapse, networkHierarchy]);
  // Memoize the getNetwork callback
  const getNetwork = useCallback((network) => {
    networkRef.current = network;
    setNetworkInstance(network);
  }, []);

  // Pin/unpin tooltip on click for aggregated nodes
  const handlePinFromHover = useCallback(() => {
    if (!hoverState.visible || !graph) return;
    // Find a node under current hover by proximity (best-effort)
    try {
      const pos = networkRef.current?.DOMtoCanvas({ x: hoverState.x, y: hoverState.y });
      if (!pos) return setPinnedTooltip({ active: true, nodeId: null, x: hoverState.x, y: hoverState.y, items: hoverState.items });
      // Use last hovered aggregated node id by scanning nodeDetails entries whose list equals items
      let matchId = null;
      nodeDetails.forEach((list, id) => {
        if (matchId != null) return;
        if (Array.isArray(list) && list.length && hoverState.items.length && list.length === hoverState.items.length) {
          // shallow compare a few fields
          const a0 = list[0]; const b0 = hoverState.items[0];
          if (a0 && b0 && a0.ip === b0.ip && a0.hopNumber === b0.hopNumber) matchId = id;
        }
      });
      setPinnedTooltip({ active: true, nodeId: matchId, x: hoverState.x, y: hoverState.y, items: hoverState.items });
    } catch {
      setPinnedTooltip({ active: true, nodeId: null, x: hoverState.x, y: hoverState.y, items: hoverState.items });
    }
  }, [hoverState, graph, nodeDetails]);

  // Unpin logic removed: background click now dismisses tooltip directly

  // Bridge hover events from FullTraceroutePanel to graph highlighting
  useEffect(() => {
    const onHoverHop = (e) => {
      try {
        const detail = e?.detail || {};
        const ip = detail.ip || null;
        const isTimeout = !!detail.isTimeout;
        const runId = detail.traceRunId || detail.trace_run_id || null;
        const destAddr = detail.destinationAddress || null;
        if (!graph || !nodeDetails) return;

        // Find candidate node ids that match this hop (prefer exact IP match)
        const candidates = [];
        nodeDetails.forEach((list, nodeId) => {
          if (!Array.isArray(list) || list.length === 0) return;
          const any = list.some(d => {
            if (isTimeout) return d.is_timeout === true;
            return !!ip && d.ip === ip;
          });
          if (any) candidates.push(nodeId);
        });

        if (candidates.length === 0) return;

        // If we have a specific run id, prefer nodes whose details include it; else prefer matching destination
        let filtered = candidates;
        if (runId) {
          const byRun = candidates.filter(id => {
            const list = nodeDetails.get(id) || [];
            return list.some(d => d.trace_run_id === runId || d.run_id === runId);
          });
          if (byRun.length) filtered = byRun;
        } else if (destAddr) {
          const byDest = candidates.filter(id => {
            const list = nodeDetails.get(id) || [];
            return list.some(d => (d.destinationAddress || d.destination) === destAddr);
          });
          if (byDest.length) filtered = byDest;
        }

        // If multiple, prefer a node that participates in the most paths and/or
        // has the closest hop number to the hovered hop
        const hopIndex = Number.isFinite(detail.hopIndex) ? detail.hopIndex : (Number.isFinite(detail.hop) ? detail.hop : null);
        let best = filtered[0];
        let bestScore = -Infinity;
        for (const id of filtered) {
          const list = nodeDetails.get(id) || [];
          const passCount = (pathMapping.get(id)?.size) || 0;
          let hopCloseness = 0;
          if (hopIndex != null) {
            const diffs = list
              .map(d => (d.hopNumber ?? d.hop))
              .filter(n => Number.isFinite(n))
              .map(n => -Math.abs(n - hopIndex)); // higher is better
            hopCloseness = diffs.length ? Math.max(...diffs) : 0;
          }
          // Slight preference if this node's details include the runId/destAddr we care about
          let affinity = 0;
          if (runId && list.some(d => d.trace_run_id === runId || d.run_id === runId)) affinity += 5;
          if (!runId && destAddr && list.some(d => (d.destinationAddress || d.destination) === destAddr)) affinity += 2;
          const score = passCount * 10 + hopCloseness + affinity;
          if (score > bestScore) { best = id; bestScore = score; }
        }

        // Highlight all paths through the chosen node (most-used solid, others dotted)
        highlightPathsForNode(best);
      } catch {
        // ignore
      }
    };
    const onLeave = () => clearHighlight();
    const onClear = () => clearHighlight();
    window.addEventListener('traceroute:hover-hop', onHoverHop);
    window.addEventListener('traceroute:leave', onLeave);
    window.addEventListener('graph:clearHighlight', onClear);
    return () => {
      window.removeEventListener('traceroute:hover-hop', onHoverHop);
      window.removeEventListener('traceroute:leave', onLeave);
      window.removeEventListener('graph:clearHighlight', onClear);
    };
  }, [graph, nodeDetails, pathMapping, highlightPathsForNode, clearHighlight]);

  // After networkInstance is set, apply highlight changes directly:
useEffect(() => {
  if (!networkInstance || !graph) return;
  const nodesDS = networkInstance.body.data.nodes;
  const edgesDS = networkInstance.body.data.edges;

  // If no highlighted paths -> restore original styles
  if (!highlightedPaths || highlightedPaths.length === 0) {
    let rafRestore = requestAnimationFrame(() => {
      // Reset nodes
      nodesDS.update(graph.nodes.map(n => ({
        id: n.id,
        color: n.color,
        opacity: n.opacity ?? 1,
        borderWidth: n.borderWidth ?? 1,
        font: n.font
      })));
      // Reset edges
      edgesDS.update(graph.edges.map(e => ({
        id: e.id,
        color: e.color,
        width: e.width,
        dashes: e.dashes || false
      })));
    });
    return () => cancelAnimationFrame(rafRestore);
  }

  // Active highlighting: apply diff from highlightedGraph
  if (!highlightedGraph) return;

  const changedNodes = [];
  const changedEdges = [];

  const nodeChanged = (curr, next) => (
    curr.color?.background !== next.color?.background ||
    curr.color?.border !== next.color?.border ||
    curr.opacity !== next.opacity ||
    curr.borderWidth !== next.borderWidth
  );

  const edgeChanged = (curr, next) => (
    (curr.color?.color !== next.color?.color || curr.color?.opacity !== next.color?.opacity) ||
    curr.width !== next.width ||
    JSON.stringify(curr.dashes) !== JSON.stringify(next.dashes)
  );

  let raf = requestAnimationFrame(() => {
    for (const n of highlightedGraph.nodes) {
      const current = nodesDS.get(n.id);
      if (!current) continue;
      if (nodeChanged(current, n)) {
        changedNodes.push({ id: n.id, color: n.color, opacity: n.opacity, borderWidth: n.borderWidth, font: n.font });
      }
    }
    for (const e of highlightedGraph.edges) {
      const current = edgesDS.get(e.id);
      if (!current) continue;
      if (edgeChanged(current, e)) {
        changedEdges.push({ id: e.id, color: e.color, width: e.width, dashes: e.dashes });
      }
    }
    if (changedNodes.length) nodesDS.update(changedNodes);
    if (changedEdges.length) edgesDS.update(changedEdges);
  });
  return () => cancelAnimationFrame(raf);
}, [highlightedGraph, highlightedPaths, networkInstance, graph]);



  const { downloadAsPNG, downloadAsSVG } = useGraphExport({ networkInstance, graphContainerRef, graph });

  // Export graph as JSON (nodes + edges + meta)
  const exportGraphJSON = useCallback(() => {
    try {
      // Build a sanitized filename base from selected destinations or available pathData keys
      const timestamp = new Date().toISOString().slice(0,19).replace(/:/g,'-');
      let titleBase = 'network';
      try {
        if (Array.isArray(normalizedDestinations) && normalizedDestinations.length === 1 && normalizedDestinations[0]) {
          titleBase = String(normalizedDestinations[0]);
        } else if (Array.isArray(normalizedDestinations) && normalizedDestinations.length > 1) {
          titleBase = `multi-${normalizedDestinations.length}`;
        } else if (effectivePathData && typeof effectivePathData === 'object') {
          const k = Object.keys(effectivePathData)[0];
          if (k) titleBase = k;
        }
      } catch { /* ignore */ }
      // sanitize filename (remove slashes and forbidden chars)
      titleBase = titleBase.replace(/[\\/:*?"<>|\s]+/g, '-');

      // Prefer exporting the original pathData mapping so the file is directly importable
      if (effectivePathData && typeof effectivePathData === 'object' && !Array.isArray(effectivePathData)) {
        const keys = Object.keys(effectivePathData);
        if (keys.length === 0) { alert('No path data available to export'); return; }
        // Quick validation: ensure exported object looks like expected importer shape
        const sample = effectivePathData[keys[0]];
        const looksLikePaths = sample && typeof sample === 'object' && (sample.primary_path || sample.alternatives || sample.total_traces != null);
        if (!looksLikePaths) {
          // If the structure isn't the expected one, fall back to exporting the visual graph snapshot
          if (!graph) { alert('No importable path data available and no graph to export'); return; }
          const fallback = {
            generated_at: new Date().toISOString(),
            note: 'Exported visual graph snapshot because original path data was not available in importable shape',
            node_count: Array.isArray(graph.nodes) ? graph.nodes.length : 0,
            edge_count: Array.isArray(graph.edges) ? graph.edges.length : 0,
            graph
          };
          const blob = new Blob([JSON.stringify(fallback, null, 2)], { type: 'application/json' });
          const link = document.createElement('a');
          link.download = `${titleBase}-snapshot-${timestamp}.json`;
          link.href = URL.createObjectURL(blob);
          link.click();
          URL.revokeObjectURL(link.href);
          return;
        }

        // Export the destination->data mapping directly (this will be accepted by the importer)
        const payload = effectivePathData;
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const link = document.createElement('a');
        link.download = `${titleBase}-Graph-${timestamp}.json`;
        link.href = URL.createObjectURL(blob);
        link.click();
        URL.revokeObjectURL(link.href);
        return;
      }

      // Fallback: export the visual graph snapshot as before
      if (!graph) { alert('Graph not ready'); return; }
      const payload = {
        generated_at: new Date().toISOString(),
        node_count: Array.isArray(graph.nodes) ? graph.nodes.length : 0,
        edge_count: Array.isArray(graph.edges) ? graph.edges.length : 0,
        graph
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const link = document.createElement('a');
      link.download = `${titleBase}-Graph-${timestamp}.json`;
      link.href = URL.createObjectURL(blob);
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (e) {
      console.error('Export JSON failed', e);
      alert('Export failed: ' + (e?.message || String(e)));
    }
  }, [graph, effectivePathData, normalizedDestinations]);

  

  return (
    <div style={containerStyle} ref={graphContainerRef}>
      <GraphErrorBoundary>
        <Graph
          key={graphKey}
          graph={graph}
          options={options}
      events={{
            ...events,
            click: (e) => {
              const isBackground = ((e?.nodes?.length || 0) === 0 && (e?.edges?.length || 0) === 0);
              if (isBackground) {
                // Close any tooltip on background click
                setHoverState({ visible: false, x: 0, y: 0, items: [] });
                setPinnedTooltip({ active: false, nodeId: null, x: 0, y: 0, items: [] });
                setEdgeHover({ visible: false, x: 0, y: 0, edge: null });
                setPinnedEdge({ active: false, x: 0, y: 0, edge: null });
              } else if (hoverState.visible && hoverState.items?.length) {
                // Pin current hover tooltip on any node/edge click
                handlePinFromHover();
              } else if (edgeHover.visible && edgeHover.edge) {
                // Pin edge tooltip
                setPinnedEdge({ active: true, x: edgeHover.x, y: edgeHover.y, edge: edgeHover.edge });
              }
              events.click?.(e);
            }
          }}
          getNetwork={getNetwork}
        />
      </GraphErrorBoundary>

  <AggregatedHopTooltip
        visible={pinnedTooltip.active ? true : hoverState.visible}
        x={pinnedTooltip.active ? pinnedTooltip.x : hoverState.x}
        y={pinnedTooltip.active ? pinnedTooltip.y : hoverState.y}
        items={pinnedTooltip.active ? pinnedTooltip.items : hoverState.items}
        pinned={pinnedTooltip.active}
        onMove={(nx, ny) => {
          // Only allow moving when pinned
          setPinnedTooltip((prev) => prev.active ? { ...prev, x: nx, y: ny } : prev);
        }}
      />

      <EdgeTooltip
        visible={pinnedEdge.active ? true : edgeHover.visible}
        x={pinnedEdge.active ? pinnedEdge.x : edgeHover.x}
        y={pinnedEdge.active ? pinnedEdge.y : edgeHover.y}
        edge={pinnedEdge.active ? pinnedEdge.edge : edgeHover.edge}
        getNodeLabel={(id) => {
          const n = graph?.nodes?.find?.(nn => nn.id === id);
          return n?.label || String(id);
        }}
        onMove={(nx, ny) => setPinnedEdge(prev => prev.active ? { ...prev, x: nx, y: ny } : prev)}
      />

      <GraphControls
        isFullscreen={isFullscreen}
        onToggleFullscreen={toggleFullscreen}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onFit={handleResetZoom}
  onDownloadPNG={downloadAsPNG}
  onDownloadSVG={downloadAsSVG}
  onExportJSON={!isImported ? exportGraphJSON : undefined}
        canDownload={!!networkInstance}
        // Aggregation controls
        aggregationMode={aggregationMode}
        onAggregationModeChange={handleAggregationModeChange}
        showPrefixAggregation={showPrefixAggregation}
        onTogglePrefixAggregation={handlePrefixAggregationToggle}
        expandedCount={expandedPrefixes.size + expandedAsnGroups.size}
  disableShowAllPaths={isHeavyQuery}
  disableReason={isHeavyQuery ? 'Disabled for large selection (many destinations or long time range)' : ''}
        // Network hierarchy controls
        networkHierarchy={networkHierarchy}
        onNetworkHierarchyChange={handleNetworkHierarchyChange}
        highlightedPaths={highlightedPaths}      // added
        onClearHighlight={clearHighlight}        // added
  onCollapseAllPrefixes={handleCollapseAllPrefixes}
  onCollapsePrefix={handlePrefixCollapse}
      />
    </div>
  );
});

NetworkGraph.displayName = 'NetworkGraph';

export default NetworkGraph;