
import { useCallback, useEffect, useMemo, useState } from 'react';
import { pathHighlightColors } from '../utils/colorUtils';

export default function usePathHighlighting({ graph, pathMapping, nodeDetails }) {
  const [highlightedPaths, setHighlightedPaths] = useState([]);

  // Identify source node id (stable per graph build)
  const sourceId = useMemo(() => {
    if (!graph?.nodes) return null;
    const src = graph.nodes.find(n => n.nodeType === 'source');
    return src ? src.id : null;
  }, [graph]);

  // Rebuild edges for a path (now includes source)
  const reconstructEdgesForPath = useCallback((pathId) => {
    if (!graph || !nodeDetails) return [];
  const [dest, pathType] = pathId.split('-', 2);
    const hopEntries = [];

    nodeDetails.forEach((details, nodeId) => {
      details.forEach(d => {
        if (d.pathId === pathId || (d.destination === dest && d.pathType === pathType)) {
          hopEntries.push({ nodeId, hop: d.hopNumber ?? d.hop ?? null });
        }
      });
    });

    const ordered = hopEntries
      .filter(h => h.hop != null)
      .sort((a, b) => a.hop - b.hop);

    if (!ordered.length) return [];

    // Prepend virtual source hop (hop 0) if sourceId present and not already first
    if (sourceId && ordered[0].nodeId !== sourceId) {
      ordered.unshift({ nodeId: sourceId, hop: 0 });
    }

    const out = [];
    for (let i = 0; i < ordered.length - 1; i++) {
      const fromId = ordered[i].nodeId;
      const toId = ordered[i + 1].nodeId;
      const edge = graph.edges.find(e => e.from === fromId && e.to === toId);
      if (edge) out.push({ from: edge.from, to: edge.to, id: edge.id });
    }
    return out;
  }, [graph, nodeDetails, sourceId]);

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

    // Ensure source node included
    if (sourceId && !nodes.includes(sourceId)) {
      nodes.unshift(sourceId);
    }

    // Fallback reconstruction (also ensures source→firstHop)
    if (edges.length === 0) {
      const rebuilt = reconstructEdgesForPath(pathId);
      rebuilt.forEach(r => edges.push(r));
    } else if (sourceId) {
      // Add missing source edge if first edge doesn't start at source
      const firstNonSource = nodes.find(id => id !== sourceId);
      if (firstNonSource &&
          !edges.some(e => e.from === sourceId && e.to === firstNonSource)) {
        const srcEdge = graph.edges.find(e => e.from === sourceId && e.to === firstNonSource);
        if (srcEdge) edges.unshift({ from: srcEdge.from, to: srcEdge.to, id: srcEdge.id });
      }
    }

    return { nodes, edges };
  }, [graph, pathMapping, reconstructEdgesForPath, sourceId]);

  // --- highlightPathById (unchanged except for source enforcement) ---
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

  // highlightPathsForNode (adds source automatically via collectForPathId)
  const highlightPathsForNode = useCallback((nodeId) => {
    if (!graph || !pathMapping) return;
    const passingPaths = pathMapping.get(nodeId);
    if (!passingPaths || passingPaths.size === 0) return;

    const details = nodeDetails?.get(nodeId) || [];
    const pathStats = new Map();

    details.forEach(d => {
  const pid = d.pathId || `${d.destination}-${d.pathType}`;
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
        const existing = pathStats.get(pid);
        existing.pathPercent = Math.max(existing.pathPercent, d.pathPercent || 0);
        existing.pathCount = Math.max(existing.pathCount, d.pathCount || 0);
        existing.totalTraces = Math.max(existing.totalTraces, d.totalTraces || 0);
      }
    });

    // Pick "most-used" path
    let mostUsedPathId = null;
    let bestScore = -1;
    pathStats.forEach((stats, pid) => {
      const score = (stats.pathPercent * 10000) + (stats.pathCount * 10) + (stats.isPrimary ? 1 : 0);
      if (score > bestScore) { bestScore = score; mostUsedPathId = pid; }
    });
    if (!mostUsedPathId) {
      mostUsedPathId = Array.from(passingPaths).find(p => p.endsWith('-PRIMARY')) || Array.from(passingPaths)[0];
    }

    let colorIdx = 0;
    const result = Array.from(passingPaths).map(pathId => {
      const { nodes, edges } = collectForPathId(pathId);
      const stats = pathStats.get(pathId);
      const isMostUsed = pathId === mostUsedPathId;
      const color = pathHighlightColors[colorIdx % pathHighlightColors.length];
      colorIdx++;
      return {
        id: pathId,
        destination: pathId.split('-')[0] || 'Unknown',
        pathType: pathId.split('-')[1] || 'UNKNOWN',
        isPrimary: isMostUsed,
        isSecondary: !isMostUsed,
        nodes,
        edges,
        highlightColor: color,
        lineStyle: isMostUsed ? 'solid' : 'dotted',
        pathPercent: stats?.pathPercent || 0,
        pathCount: stats?.pathCount || 0,
        usageStats: stats
      };
    });

    result.sort((a, b) => {
      if (a.isPrimary && !b.isPrimary) return -1;
      if (!a.isPrimary && b.isPrimary) return 1;
      return (b.pathPercent || 0) - (a.pathPercent || 0);
    });

    setHighlightedPaths(result);
  }, [graph, pathMapping, nodeDetails, collectForPathId]);

  const highlightPath = useCallback((elementId) => {
    if (!graph || !pathMapping) return;
    const paths = pathMapping.get(elementId);
    if (!paths || paths.size === 0) return;

    // If elementId is an edge (string id like 'edge_#'), build highlights directly
    if (typeof elementId === 'string' && elementId.startsWith('edge_')) {
      let colorIdx = 0;
      const result = Array.from(paths).map(pathId => {
        const { nodes, edges } = collectForPathId(pathId);
        const isPrimary = /-PRIMARY(\b|$)/.test(pathId);
        const color = pathHighlightColors[colorIdx % pathHighlightColors.length];
        colorIdx++;
        const [dest, type] = pathId.split('-', 2);
        return {
          id: pathId,
          destination: dest || 'Unknown',
          pathType: type || 'UNKNOWN',
          isPrimary,
          nodes,
          edges,
          highlightColor: color,
          lineStyle: isPrimary ? 'solid' : 'dotted'
        };
      }).sort((a, b) => (a.isPrimary === b.isPrimary ? 0 : a.isPrimary ? -1 : 1));
      setHighlightedPaths(result);
      return;
    }

    // Otherwise treat as node id
    highlightPathsForNode(elementId);
  }, [graph, pathMapping, collectForPathId, highlightPathsForNode]);

  const clearHighlight = useCallback(() => setHighlightedPaths([]), []);

  useEffect(() => {
    const handler = e => {
      const pathId = e.detail?.pathId;
      if (pathId) highlightPathById(pathId);
    };
    window.addEventListener('graph:highlightPath', handler);
    return () => window.removeEventListener('graph:highlightPath', handler);
  }, [highlightPathById]);

  // Keep existing highlightedGraph transformation (optional optimization later)
  const highlightedGraph = useMemo(() => {
    if (!graph || highlightedPaths.length === 0) return graph;

    const nodes = graph.nodes.map(n => {
      const activeInPaths = highlightedPaths.filter(p => p.nodes.includes(n.id));
      if (activeInPaths.length > 0) {
        const isPrimaryPath = activeInPaths.some(p => p.isPrimary);

        return {
          ...n,
          color: {
            ...n.color,
            background: isPrimaryPath ? '#FFD700' : '#FFA500',
            // Border color: red if node timed out, else green
            border: n.nodeType === 'timeout' ? '#FF3333' : '#07852aff'
            
          },
          font: { ...n.font, color: '#000', strokeWidth: 2, strokeColor: '#fff' },
          borderWidth: isPrimaryPath ? 3 : 2
        };
      }
      return {
        ...n,
        color: { ...n.color, background: '#E0E0E0', border: '#CCCCCC' },
        opacity: 0.3
      };
    });

    const edges = graph.edges.map(e => {
      const matchingPaths = highlightedPaths.filter(p =>
        p.edges.some(ed => (ed.id ? ed.id === e.id : (ed.from === e.from && ed.to === e.to)))
      );
      if (matchingPaths.length > 0) {
        const primaryPath = matchingPaths.find(p => p.isPrimary);
        const secondaryPaths = matchingPaths.filter(p => !p.isPrimary);
        if (primaryPath) {
          return {
            ...e,
            color: primaryPath.highlightColor,
            width: 3,
            dashes: false
          };
        } else if (secondaryPaths.length > 0) {
          const path = secondaryPaths[0];
            return {
              ...e,
              color: path.highlightColor,
              width: 2,
              dashes: [5, 5]
            };
        }
      }
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
    highlightPath,
    highlightPathById,
    highlightPathsForNode,
    clearHighlight
  };
}