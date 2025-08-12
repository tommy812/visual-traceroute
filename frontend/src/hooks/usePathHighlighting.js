import { useCallback, useEffect, useMemo, useState } from 'react';
import { adjustColorIntensity } from '../utils/colorUtils';

// Small, fixed palette for path coloring
const palette = ["#FF6B35","#004E89","#009639","#7209B7","#FF1654","#FF8500","#0FA3B1","#B5179E","#F72585","#4361EE"];

export default function usePathHighlighting({ graph, pathMapping }) {
  const [highlightedPaths, setHighlightedPaths] = useState([]);

  const collectForPathId = useCallback((pathId) => {
    const nodes = [];
    const edges = [];
    pathMapping?.forEach((set, elementId) => {
      if (set.has(pathId)) {
        if (typeof elementId === 'string' && elementId.startsWith('edge_')) {
          const e = graph?.edges?.find(ed => ed.id === elementId);
          if (e) edges.push({ from: e.from, to: e.to, id: e.id });
        } else {
          nodes.push(elementId);
        }
      }
    });
    return { nodes, edges };
  }, [graph, pathMapping]);

  const highlightPathById = useCallback((pathId) => {
    if (!graph || !pathMapping || !pathId) return;
    const [destination, pathTypeRaw] = pathId.split('-', 2);
    const isPrimary = pathTypeRaw === 'PRIMARY';
    const { nodes, edges } = collectForPathId(pathId);
    const base = palette[0];
    const color = isPrimary ? base : adjustColorIntensity(base, 0.6);
    setHighlightedPaths([{
      id: pathId,
      destination: destination || 'Unknown',
      pathType: pathTypeRaw || 'UNKNOWN',
      isPrimary,
      nodes,
      edges,
      highlightColor: color,
      lineStyle: isPrimary ? 'solid' : 'dashed'
    }]);
  }, [graph, pathMapping, collectForPathId]);

  const highlightPath = useCallback((elementId) => {
    if (!graph || !pathMapping) return;
    const paths = pathMapping.get(elementId);
    if (!paths || paths.size === 0) return;

    const result = [];
    let idx = 0;
    paths.forEach(pathId => {
      const [destination, pathTypeRaw] = pathId.split('-', 2);
      const isPrimary = pathTypeRaw === 'PRIMARY';
      const { nodes, edges } = collectForPathId(pathId);
      const base = palette[idx % palette.length];
      const color = isPrimary ? base : adjustColorIntensity(base, 0.6);
      idx++;
      result.push({
        id: pathId,
        destination: destination || 'Unknown',
        pathType: pathTypeRaw || 'UNKNOWN',
        isPrimary,
        nodes,
        edges,
        highlightColor: color,
        lineStyle: isPrimary ? 'solid' : 'dashed'
      });
    });
    setHighlightedPaths(result);
  }, [graph, pathMapping, collectForPathId]);

  const clearHighlight = useCallback(() => setHighlightedPaths([]), []);

  // Bridge from HopDrawer
  useEffect(() => {
    const handler = (e) => {
      const pathId = e.detail?.pathId;
      if (pathId) highlightPathById(pathId);
    };
    window.addEventListener('graph:highlightPath', handler);
    return () => window.removeEventListener('graph:highlightPath', handler);
  }, [highlightPathById]);

  const highlightedGraph = useMemo(() => {
    if (!graph || !graph.nodes || !graph.edges || highlightedPaths.length === 0) return graph;

    const nodes = graph.nodes.map(n => {
      const on = highlightedPaths.some(p => p.nodes.includes(n.id));
      if (on) return { ...n, color: { ...n.color, background: '#ffd166', border: '#333' }, font: { ...n.font, background: '#fff' } };
      return { ...n, color: { ...n.color, background: '#E0E0E0', border: '#CCCCCC' }, opacity: 0.3 };
    });

    const edges = graph.edges.map(e => {
      const hits = highlightedPaths.filter(p => p.edges.some(x => x.from === e.from && x.to === e.to));
      if (hits.length) {
        const hasDashed = hits.some(h => h.lineStyle === 'dashed');
        return { ...e, color: { ...e.color, opacity: 1 }, width: hasDashed ? 2 : 3, dashes: hasDashed ? [5, 5] : false };
      }
      return { ...e, color: { ...e.color, opacity: 0.25 } };
    });

    return { nodes, edges };
  }, [graph, highlightedPaths]);

  return { highlightedGraph, highlightedPaths, highlightPath, highlightPathById, clearHighlight };
}