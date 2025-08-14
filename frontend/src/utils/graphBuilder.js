import dataTransformer from '../services/dataTransformer';
import { generateDestinationColor } from './colorUtils';
import { curvedForIndex } from './edges';
import { computeDestinationLanes } from './graphLayoutUtils';

// Build a simple, deterministic graph:
// - level = hop number (strict columns)
// - one node per destination per hop (prevents contention across paths)
// - lane = destination lane (keeps each path on its row)
export function buildGraph({
  filteredData,
  selectedDestinations,
  showPrimaryOnly,
  showPrefixAggregation,
  expandedPrefixes
}) {
  const nodes = [];
  const edges = [];
  const nodeDetails = new Map();
  const pathMapping = new Map();

  // Early exit
  if (!filteredData || Object.keys(filteredData).length === 0) {
    return { graph: { nodes, edges }, nodeDetails, pathMapping };
  }

  // Stable id map
  const nodeIdMap = new Map();
  let nextId = 1;
  const getOrCreateNodeId = (key) => {
    if (nodeIdMap.has(key)) return nodeIdMap.get(key);
    const id = nextId++;
    nodeIdMap.set(key, id);
    return id;
  };

  const addNodeOnce = (key, factory) => {
    const id = getOrCreateNodeId(key);
    if (!nodes.some(n => n.id === id)) nodes.push(factory(id));
    return id;
  };

  const addPathMapping = (entityId, pathId) => {
    if (!pathMapping.has(entityId)) pathMapping.set(entityId, new Set());
    pathMapping.get(entityId).add(pathId);
  };

  // Lanes for destinations
  const { laneByDest } = computeDestinationLanes(filteredData);
  const laneHeight = 160;

  // Build a detail bucket per logical node key so drawers always work
  // Key format:
  // - ip node:       ip:<ip>@d:<dest>@h:<hop>
  // - prefix node:   prefix:<prefix>@d:<dest>@h:<hop>
  // - timeout node:  timeout@d:<dest>@h:<hop>
  const detailsByKey = new Map();

  // Pass 1: collect details and compute max hop per destination
  const pathDescriptors = []; // [{ destination, destColor, pathId, hops }]
  let globalMaxHop = 0;

  Object.entries(filteredData).forEach(([destination, destData]) => {
    const destColor = generateDestinationColor(selectedDestinations.indexOf(destination));

    const addPath = (pathObj, type, altIndex) => {
      if (!pathObj || !Array.isArray(pathObj.path)) return;
      const hops = pathObj.path;
      const pathId = type === 'PRIMARY'
        ? `${destination}-PRIMARY`
        : `${destination}-ALTERNATIVE ${altIndex}`;
      pathDescriptors.push({ destination, destColor, pathId, hops });

      globalMaxHop = Math.max(globalMaxHop, hops.length);

      // Collect details keyed by the final rendering key
      hops.forEach((hop, idx) => {
        const hopNumber = hop?.hop_number ?? (idx + 1);
        let key;
        if (!hop || hop.is_timeout || !hop.ip) {
          key = `timeout@d:${destination}@h:${hopNumber}`;
        } else {
          if (showPrefixAggregation) {
            const prefix = dataTransformer.getNetworkPrefix(hop.ip);
            // collapsed when the prefix is not expanded
            const collapsed = !expandedPrefixes?.has(prefix);
            if (collapsed) {
              key = `prefix:${prefix}@d:${destination}@h:${hopNumber}`;
            } else {
              key = `ip:${hop.ip}@d:${destination}@h:${hopNumber}`;
            }
          } else {
            key = `ip:${hop.ip}@d:${destination}@h:${hopNumber}`;
          }
        }

        if (!detailsByKey.has(key)) detailsByKey.set(key, []);
        detailsByKey.get(key).push({
          ip: hop?.ip ?? null,
          hostname: hop?.hostname ?? (hop?.ip ?? 'Timeout'),
          rtt_ms: hop?.rtt_ms ?? [],
          destination,
          hopNumber,
          pathType: type,
          is_timeout: !hop || hop.is_timeout || !hop.ip,
          timestamp: pathObj?.timeStamp ?? null,
          pathTimestamps: Array.isArray(pathObj?.timestamps) ? pathObj.timestamps : [],
          protocol: pathObj?.protocol ?? (hop?.protocol ?? null),

          pathPercent: pathObj?.percent ?? null,
          pathAvgRtt: pathObj?.avg_rtt ?? null,
          pathCount: pathObj?.count ?? null,
          totalTraces: destData?.total_traces ?? null,
          pathLength: hops.length
        });
      });
    };

    if (destData?.primary_path) addPath(destData.primary_path, 'PRIMARY', 0);
    if (!showPrimaryOnly && Array.isArray(destData?.alternatives)) {
      destData.alternatives.forEach((alt, i) => addPath(alt, 'ALTERNATIVE', i + 1));
    }
  });

  // Destination column is last
  const destinationLevel = globalMaxHop + 1;

  // Source node
  const sourceId = addNodeOnce('source', (id) => ({
    id,
    label: 'Source',
    title: 'Starting point',
    color: { background: '#97C2FC', border: '#2B7CE9' },
    font: { size: 12, color: '#333', strokeWidth: 2, strokeColor: '#fff' },
    shape: 'dot',
    size: 18,
    nodeType: 'source',
    level: 0,
    physics: false,
    fixed: { x: false, y: true }
  }));

  // Pass 2: create all per-destination/hop nodes (so edges never point to ghosts)
  detailsByKey.forEach((list, key) => {
    // Parse key
    // pattern: <type>:(value)?@d:<dest>@h:<hop>
    const [left, rest] = key.split('@d:');
    const [typeAndValue] = left.split('@'); // ignore extra
    const type = typeAndValue.startsWith('timeout') ? 'timeout'
      : typeAndValue.startsWith('ip:') ? 'ip'
        : 'prefix';
    const value = type === 'ip'
      ? typeAndValue.substring(3)
      : type === 'prefix'
        ? typeAndValue.substring(7)
        : null;

    const [destAndHop] = rest.split('@h:');
    const [dest, hopStr] = [destAndHop, rest.substring(destAndHop.length + 3)];
    const hopNumber = parseInt(hopStr, 10);
    const laneIndex = laneByDest.get(dest) ?? 0;
    const y = laneIndex * laneHeight;

    if (type === 'timeout') {
      addNodeOnce(key, (id) => {
        nodeDetails.set(id, list);
        return {
          id,
          label: '⏱️',
          title: `Timeout • Hop #${hopNumber} • ${dest}`,
          color: { background: '#F44336', border: '#D32F2F' },
          font: { size: 12, color: '#FFF', strokeWidth: 2, strokeColor: '#fff' },
          shape: 'dot',
          size: 16,
          nodeType: 'timeout',
          timeoutKey: key,
          level: hopNumber,
          y,
          physics: false,
          fixed: { x: false, y: true }
        };
      });
    } else if (type === 'ip') {
      const display = list[0]?.hostname || value;
      addNodeOnce(key, (id) => {
        nodeDetails.set(id, list);
        list.forEach(d => addPathMapping(id, `${d.destination}-${d.pathType}`));
        return {
          id,
          label: display,
          title: `IP: ${value}\nHop #${hopNumber} • ${dest}`,
          color: { background: '#FFA726', border: '#FF8F00' },
          font: { size: 12, color: '#333', strokeWidth: 2, strokeColor: '#fff' },
          shape: 'dot',
          size: 18,
          nodeType: 'hop',
          ip: value,
          level: hopNumber,
          y,
          physics: false,
          fixed: { x: false, y: true }
        };
      });
    } else {
      // prefix (collapsed). Click toggles expansion, drawer not used.
      const label = value;
      addNodeOnce(key, (id) => ({
        id,
        label,
        title: `Network Prefix: ${value}\nHop #${hopNumber} • ${dest}\nClick to expand`,
        color: { background: '#FF9800', border: '#F57C00' },
        font: { size: 11, color: '#333', strokeWidth: 2, strokeColor: '#fff' },
        shape: 'box',
        size: 20,
        nodeType: 'prefix',
        prefix: value,
        level: hopNumber,
        y,
        physics: false,
        fixed: { x: false, y: true }
      }));
    }
  });

  // Pass 3: build edges per path using the same keys we used for nodes
  const edgeUsage = new Map(); // key -> { destinations:Set, colors:[], paths:Set }
  const addEdgeUsage = (fromId, toId, dest, color, pathId) => {
    const k = `${fromId}->${toId}`;
    if (!edgeUsage.has(k)) edgeUsage.set(k, { destinations: new Set(), colors: [], paths: new Set() });
    const u = edgeUsage.get(k);
    u.destinations.add(dest);
    u.colors.push(color);
    u.paths.add(pathId);
  };

  pathDescriptors.forEach(({ destination, destColor, pathId, hops }) => {
    const laneIndex = laneByDest.get(destination) ?? 0;
    let lastId = sourceId;

    const keyForHop = (hop, idx) => {
      const hopNumber = hop?.hop_number ?? (idx + 1);
      if (!hop || hop.is_timeout || !hop.ip) {
        return `timeout@d:${destination}@h:${hopNumber}`;
      }
      if (showPrefixAggregation) {
        const prefix = dataTransformer.getNetworkPrefix(hop.ip);
        const collapsed = !expandedPrefixes?.has(prefix);
        return collapsed
          ? `prefix:${prefix}@d:${destination}@h:${hopNumber}`
          : `ip:${hop.ip}@d:${destination}@h:${hopNumber}`;
      }
      return `ip:${hop.ip}@d:${destination}@h:${hopNumber}`;
    };

    hops.forEach((hop, idx) => {
      const k = keyForHop(hop, idx);
      const id = getOrCreateNodeId(k); // already materialized
      if (id !== lastId) {
        addEdgeUsage(lastId, id, destination, destColor, pathId);
        lastId = id;
      }
    });

    // last edge to destination
    const destKey = `dest:${destination}`;
    const destId = addNodeOnce(destKey, (id) => ({
      id,
      label: destination,
      color: { background: destColor, border: '#333' },
      font: { size: 14, color: '#333', strokeWidth: 2, strokeColor: '#fff' },
      shape: 'box',
      size: 28,
      nodeType: 'destination',
      level: destinationLevel,
      y: laneIndex * laneHeight,
      physics: false,
      fixed: { x: false, y: true }
    }));
    if (lastId !== destId) {
      addEdgeUsage(lastId, destId, destination, destColor, pathId);
    }
  });

  // Emit edges (bundle multi-destination colors)
  let edgeId = 1;
  edgeUsage.forEach((usage, key) => {
    const [fromStr, toStr] = key.split('->');
    const from = parseInt(fromStr, 10);
    const to = parseInt(toStr, 10);
    const colors = [...new Set(usage.colors)];
    const title = `Used by: ${Array.from(usage.destinations).join(', ')}\nPaths: ${usage.paths.size}`;

    if (colors.length <= 1) {
      const eid = `edge_${edgeId++}`;
      edges.push({
        id: eid,
        from, to,
        color: { color: colors[0] || '#999', opacity: 1 },
        width: 2,
        arrows: 'to',
        smooth: { type: 'continuous', roundness: 0.0, forceDirection: 'horizontal' },
        dashes: false,
        arrowStrikethrough: false,
        title,
        paths: Array.from(usage.paths)
      });
      usage.paths.forEach(pid => {
        if (!pathMapping.has(eid)) pathMapping.set(eid, new Set());
        pathMapping.get(eid).add(pid);
      });
    } else {
      colors.forEach((col, idx) => {
        const eid = `edge_${edgeId++}`;
        edges.push({
          id: eid,
          from, to,
          color: { color: col, opacity: 1 },
          width: 2,
          arrows: 'to',
          smooth: curvedForIndex(idx, colors.length),
          dashes: false,
          arrowStrikethrough: false,
          title,
          paths: Array.from(usage.paths)
        });
        usage.paths.forEach(pid => {
          if (!pathMapping.has(eid)) pathMapping.set(eid, new Set());
          pathMapping.get(eid).add(pid);
        });
      });
    }
  });

  return { graph: { nodes, edges }, nodeDetails, pathMapping };
}