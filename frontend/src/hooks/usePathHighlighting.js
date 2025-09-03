// ...existing imports...
import { useCallback, useEffect, useMemo, useState } from 'react';
import { adjustColorIntensity, pathHighlightColors } from '../utils/colorUtils';

const palette = ["#FF6B35","#004E89","#009639","#7209B7","#FF1654","#FF8500","#0FA3B1","#B5179E","#F72585","#4361EE"];
export default function usePathHighlighting({ graph, pathMapping, nodeDetails }) {
  const [highlightedPaths, setHighlightedPaths] = useState([]);

  const collectForPathId = useCallback((pathId) => {
    const nodes = [];
    const edges = [];
    pathMapping?.forEach((set, elementId) => {
      if (!set.has(pathId)) return;
      if (typeof elementId === 'string' && elementId.startsWith('edge_')) {
        const e = graph?.edges?.find(ed => ed.id === elementId);
        if (e) edges.push({ from: e.from, to: e.to, id: e.id });
      } else {
        nodes.push(elementId);
      }
    });
    return { nodes, edges };
  }, [graph, pathMapping]);



  const highlightPathById = useCallback((pathId) => {
    if (!graph || !pathMapping || !pathId) return;
    const [destination, pathTypeRaw] = pathId.split('-', 2);
    const { nodes, edges } = collectForPathId(pathId);
    setHighlightedPaths([{
      id: pathId,
      destination: destination || 'Unknown',
      pathType: pathTypeRaw || 'UNKNOWN',
      isPrimary: pathTypeRaw === 'PRIMARY',
      nodes,
      edges,
      highlightColor: pathHighlightColors[0],
      lineStyle: pathTypeRaw === 'PRIMARY' ? 'solid' : 'dashed'
    }]);
  }, [graph, pathMapping, collectForPathId]);

  const highlightPathsForNode = useCallback((nodeId) => {
    if (!graph || !pathMapping) return;
    
    // Get all paths that pass through the selected node
    const passingPaths = pathMapping.get(nodeId);
    if (!passingPaths || passingPaths.size === 0) return;

    const details = nodeDetails?.get(nodeId) || [];
    
    // Build usage statistics for each path
    const pathStats = new Map();
    details.forEach(d => {
      const pid = `${d.destination}-${d.pathType}`;
      if (!pathStats.has(pid)) {
        pathStats.set(pid, {
          pathPercent: d.pathPercent || 0,
          pathCount: d.pathCount || 0,
          totalTraces: d.totalTraces || 0,
          pathType: d.pathType,
          destination: d.destination,
          isPrimary: d.pathType === 'PRIMARY'
        });
      } else {
        // Update with highest values found
        const existing = pathStats.get(pid);
        existing.pathPercent = Math.max(existing.pathPercent, d.pathPercent || 0);
        existing.pathCount = Math.max(existing.pathCount, d.pathCount || 0);
        existing.totalTraces = Math.max(existing.totalTraces, d.totalTraces || 0);
      }
    });

    // Determine most used path based on usage percentage, then count, then primary status
    let mostUsedPathId = null;
    let bestScore = -1;
    
    pathStats.forEach((stats, pid) => {
      // Score based on percentage (primary), count (secondary), isPrimary (tertiary)
      const score = (stats.pathPercent * 10000) + (stats.pathCount * 10) + (stats.isPrimary ? 1 : 0);
      if (score > bestScore) {
        bestScore = score;
        mostUsedPathId = pid;
      }
    });

    // Fallback selection if no stats available
    if (!mostUsedPathId) {
      mostUsedPathId = Array.from(passingPaths).find(p => p.endsWith('-PRIMARY')) || Array.from(passingPaths)[0];
    }

    // Create highlight entries for each complete path using the working collectForPathId
    let colorIdx = 0;
    const result = Array.from(passingPaths).map(pathId => {
      const { nodes, edges } = collectForPathId(pathId);
      
      const stats = pathStats.get(pathId);
      const isMostUsed = pathId === mostUsedPathId;
      const color = pathHighlightColors[colorIdx % pathHighlightColors.length];
      
      const entry = {
        id: pathId,
        destination: pathId.split('-')[0] || 'Unknown',
        pathType: pathId.split('-')[1] || 'UNKNOWN',
        isPrimary: isMostUsed,
        isSecondary: !isMostUsed,
        nodes,
        edges,
        highlightColor: color, // Use full color for all paths for better visibility
        lineStyle: isMostUsed ? 'solid' : 'dotted',
        pathPercent: stats?.pathPercent || 0,
        pathCount: stats?.pathCount || 0,
        usageStats: stats
      };
      colorIdx++;
      return entry;
    });

    // Sort results with most used first
    result.sort((a, b) => {
      if (a.isPrimary && !b.isPrimary) return -1;
      if (!a.isPrimary && b.isPrimary) return 1;
      return (b.pathPercent || 0) - (a.pathPercent || 0);
    });

    // Debug: log the final result
    if (process.env.NODE_ENV === 'development') {
      console.log('Final highlighted paths:', result.map(r => `${r.id} (primary: ${r.isPrimary}, edges: ${r.edges.length})`));
    }
    
    setHighlightedPaths(result);
  }, [graph, pathMapping, nodeDetails, collectForPathId]);

  const highlightPath = useCallback((elementId) => {
    if (!graph || !pathMapping) return;
    const paths = pathMapping.get(elementId);
    if (!paths || paths.size === 0) return;
    // Reuse multi path logic
    highlightPathsForNode(elementId);
  }, [graph, pathMapping, highlightPathsForNode]);

  const clearHighlight = useCallback(() => setHighlightedPaths([]), []);

  useEffect(() => {
    const handler = e => {
      const pathId = e.detail?.pathId;
      if (pathId) highlightPathById(pathId);
    };
    window.addEventListener('graph:highlightPath', handler);
    return () => window.removeEventListener('graph:highlightPath', handler);
  }, [highlightPathById]);

  const highlightedGraph = useMemo(() => {
    if (!graph || highlightedPaths.length === 0) return graph;
    
    // Create enhanced node highlighting
    const nodes = graph.nodes.map(n => {
      const activeInPaths = highlightedPaths.filter(p => p.nodes.includes(n.id));
      if (activeInPaths.length > 0) {
        // Node is part of highlighted paths
        const isPrimaryPath = activeInPaths.some(p => p.isPrimary);
        return { 
          ...n, 
          color: { 
            ...n.color, 
            background: isPrimaryPath ? '#FFD700' : '#FFA500', // Gold for primary, orange for secondary
            border: '#333' 
          }, 
          font: { ...n.font, color: '#000', strokeWidth: 2, strokeColor: '#fff' },
          borderWidth: isPrimaryPath ? 3 : 2
        };
      } else {
        // Node is not part of highlighted paths - fade it
        return { 
          ...n, 
          color: { ...n.color, background: '#E0E0E0', border: '#CCCCCC' }, 
          opacity: 0.3 
        };
      }
    });
    
    // Create enhanced edge highlighting with proper line styles
    let highlightedEdgeCount = 0;
    const edges = graph.edges.map(e => {
      const matchingPaths = highlightedPaths.filter(p => 
        p.edges.some(ed => ed.from === e.from && ed.to === e.to)
      );
      
      if (matchingPaths.length > 0) {
        highlightedEdgeCount++;
        
        // Edge is part of highlighted paths
        const primaryPath = matchingPaths.find(p => p.isPrimary);
        const secondaryPaths = matchingPaths.filter(p => !p.isPrimary);
        
        // Debug: log what we found
        if (process.env.NODE_ENV === 'development' && e.id === 'edge_51') {
          console.log(`Edge ${e.id}: primary=${!!primaryPath}, secondary=${secondaryPaths.length}, paths:`, matchingPaths.map(p => `${p.id}(primary:${p.isPrimary})`));
        }
        
        if (primaryPath) {
          // Primary path gets solid line
          return { 
            ...e, 
            color: primaryPath.highlightColor, // Direct color value
            width: 3,
            dashes: false, // Solid line
            smooth: e.smooth // Preserve original smoothing
          };
        } else if (secondaryPaths.length > 0) {
          // Secondary paths get dotted lines
          const path = secondaryPaths[0]; // Use first secondary path color
          return { 
            ...e, 
            color: path.highlightColor, // Direct color value
            width: 2,
            dashes: [5, 5], // More visible dotted line pattern
            smooth: e.smooth // Preserve original smoothing
          };
        }
      }
      
      // Edge is not part of highlighted paths - fade it
      return { 
        ...e, 
        color: { 
          color: e.color?.color || '#999999',
          opacity: 0.2 
        },
        width: 1
      };
    });
    
    return { nodes, edges };
  }, [graph, highlightedPaths]);

  return {
    highlightedGraph,
    highlightedPaths,
    highlightPath,          // for edges (reuses node logic)
    highlightPathById,      // explicit (drawer)
    highlightPathsForNode,  // node click
    clearHighlight
  };
}