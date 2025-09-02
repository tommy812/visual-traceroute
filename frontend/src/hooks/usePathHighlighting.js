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
    const paths = pathMapping.get(nodeId);
    if (!paths || paths.size === 0) return;

    const details = nodeDetails?.get(nodeId) || [];
    const usageByPath = new Map();
    details.forEach(d => {
      const pid = `${d.destination}-${d.pathType}`;
      if (d.pathPercent != null) {
        usageByPath.set(pid, Math.max(usageByPath.get(pid) ?? -Infinity, d.pathPercent));
      }
    });

    // Determine most used (highest percent) fallback to PRIMARY then first
    let best = null;
    let bestVal = -Infinity;
    usageByPath.forEach((v, k) => {
      if (v > bestVal) { bestVal = v; best = k; }
    });
    if (!best) {
      best = Array.from(paths).find(p => p.endsWith('-PRIMARY')) || Array.from(paths)[0];
    }

    let colorIdx = 0;
    const result = Array.from(paths).map(pid => {
      const { nodes, edges } = collectForPathId(pid);
      const solid = pid === best;
      const color = pathHighlightColors[colorIdx % pathHighlightColors.length];
      const entry = {
        id: pid,
        destination: pid.split('-', 2)[0],
        pathType: pid.split('-', 2)[1] || 'UNKNOWN',
        isPrimary: solid,
        nodes,
        edges,
        highlightColor: solid ? color : adjustColorIntensity(color, 0.6),
        lineStyle: solid ? 'solid' : 'dashed'
      };
      colorIdx++;
      return entry;
    });

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
    const nodes = graph.nodes.map(n => {
      const active = highlightedPaths.some(p => p.nodes.includes(n.id));
      return active
        ? { ...n, color: { ...n.color, background: '#ffd166', border: '#333' }, font: { ...n.font } }
        : { ...n, color: { ...n.color, background: '#E0E0E0', border: '#CCCCCC' }, opacity: 0.3 };
    });
    const edges = graph.edges.map(e => {
      const hits = highlightedPaths.filter(p => p.edges.some(ed => ed.from === e.from && ed.to === e.to));
      if (hits.length) {
        const anyDashed = hits.some(h => h.lineStyle === 'dashed');
        return { ...e, color: { ...e.color, opacity: 1 }, width: anyDashed ? 2 : 3, dashes: anyDashed ? [5,5] : false };
      }
      return { ...e, color: { ...e.color, opacity: 0.25 } };
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