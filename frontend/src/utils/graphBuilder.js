import dataTransformer from '../services/dataTransformer';
import { generateDestinationColor } from './colorUtils';
import { curvedForIndex } from './edges';
import { computeDestinationLanes } from './graphLayoutUtils';

// Map hierarchy → IPv6 mask
const HIERARCHY_MASKS_V6 = {
  subnet: 64,   // /64
  'isp-pop': 48, // /48
  isp: 32       // /32
};

/**
 * Build a deterministic graph with optional IPv6 hierarchy aggregation.
 * Supports:
 *  - Aggregation by shared IPs
 *  - Aggregation by hierarchical IPv6 prefixes (/64 subnet, /48 ISP-PoP, /32 ISP)
 *  - Per-destination vs cross-destination scopes
 *  - Correct handling of timeout nodes at the right hop
 *
 * Assumptions:
 *  - Only IPv6 is used (no IPv4 branches)
 */
export function buildGraph({
  filteredData,
  selectedDestinations,
  showPrimaryOnly,
  showPrefixAggregation,
  expandedPrefixes,
  aggregationMode = 'none',                 // 'none' | 'shared-ips' | 'asn' | 'prefix'
  aggregationScope = 'per-destination',     // 'per-destination' | 'cross-destination'
  networkHierarchy = 'none',                // 'none' | 'subnet' (/64) | 'isp-pop' (/48) | 'isp' (/32)
  expandedAsnGroups = new Set()
}) {
  const nodes = [];
  const edges = [];
  const nodeDetails = new Map();
  const pathMapping = new Map();
  const addedNodeIds = new Set(); // Track which node IDs we've already added

  // Early exit
  if (!filteredData || Object.keys(filteredData).length === 0) {
    return { graph: { nodes, edges }, nodeDetails, pathMapping };
  }

  // Stable id map - include aggregation mode/scope in mapping to ensure complete separation
  const nodeIdMap = new Map();
  let nextId = 1;
  const getOrCreateNodeId = (key) => {
    const fullKey = `${aggregationMode}:${aggregationScope}:${key}`;
    if (nodeIdMap.has(fullKey)) return nodeIdMap.get(fullKey);
    const id = nextId++;
    nodeIdMap.set(fullKey, id);
    return id;
  };

  const addNodeOnce = (key, factory) => {
    const id = getOrCreateNodeId(key);
    if (!addedNodeIds.has(id)) {
      nodes.push(factory(id));
      addedNodeIds.add(id);
    }
    return id;
  };

  const addPathMapping = (entityId, pathId) => {
    if (!pathMapping.has(entityId)) pathMapping.set(entityId, new Set());
    pathMapping.get(entityId).add(pathId);
  };

  // Lanes for destinations
  const { laneByDest } = computeDestinationLanes(filteredData);
  const rowHeight = 80;

  // Order destinations by lane index and compute a level offset per destination
  const orderedDestinations = Array.from(laneByDest.entries())
    .sort((a, b) => a[1] - b[1])
    .map(([d]) => d);

  const rowOffsetByDest = new Map();
  {
    let cumulativeLevel = 0;
    orderedDestinations.forEach(dest => {
      const dp = filteredData[dest];
      const lengths = [];
      if (dp?.includePrimary !== false && Array.isArray(dp?.primary_path?.path)) {
        lengths.push(dp.primary_path.path.length);
      }
      (Array.isArray(dp?.alternatives) ? dp.alternatives : []).forEach(alt => {
        lengths.push(Array.isArray(alt?.path) ? alt.path.length : 0);
      });
      const maxLen = lengths.length ? Math.max(...lengths) : 0;
      rowOffsetByDest.set(dest, cumulativeLevel);
      cumulativeLevel += maxLen + 10; // generous vertical gap between destinations
    });
  }

  // ===== IPv6-only helpers =====
  const isIPv6 = (s) => typeof s === 'string' && s.includes(':');
  const normalizeIp = (s) => (isIPv6(s) ? s : null);

  // Map hierarchy → IPv6 mask
  const HIERARCHY_MASKS_V6 = {
    subnet: 64,   // /64
    'isp-pop': 48, // /48
    isp: 32       // /32
  };

  // Returns canonical IPv6 prefix string (e.g., "2001:db8:abcd::/48")
  function getHierarchyPrefix(ip, networkHierarchy, dataTransformer) {
    if (!ip || networkHierarchy === 'none') return null;
    const mask = HIERARCHY_MASKS_V6[networkHierarchy];
    if (!mask) return null;
    return dataTransformer.getNetworkPrefix(ip, mask);
  }

  // Build a detail bucket per logical node key so drawers always work
  // Key format:
  // Show All Paths mode (none):
  // - ip node:       ip:<ip>@d:<dest>@h:<hop>@p:<pathId>
  // - timeout node:  timeout@d:<dest>@h:<hop>@p:<pathId>
  // Shared IPs mode:
  // - ip node:       ip:<ip>@h:<hop>
  // - timeout node:  timeout@h:<hop>
  // Per-destination scope (prefix/asn):
  // - ip node:       ip:<ip>@d:<dest>@h:<hop>
  // - prefix node:   prefix:<prefix>@d:<dest>@h:<hop>
  // - asn node:      asn:<asn>@d:<dest>@h:<hop>
  // - timeout node:  timeout@d:<dest>@h:<hop>
  // Cross-destination scope (prefix/asn):
  // - ip node:       ip:<ip>@h:<hop>
  // - prefix node:   prefix:<prefix>@h:<hop>
  // - asn node:      asn:<asn>@h:<hop>
  // - timeout node:  timeout@h:<hop>
  const detailsByKey = new Map();
  // Track earliest hop where a collapsed hierarchy prefix appears (global across paths)
  const collapsedPrefixMinHop = new Map(); // prefix -> earliestHopNumber

  const getCollapsedPrefixKey = (prefix, hopNumber) => {
    if (!collapsedPrefixMinHop.has(prefix)) collapsedPrefixMinHop.set(prefix, hopNumber);
    const firstHop = collapsedPrefixMinHop.get(prefix);
    return `prefix:${prefix}@h:${firstHop}`;
  };

  // Pass 1: collect details and compute max hop per destination
  const pathDescriptors = []; // [{ destination, destColor, pathId, hops }]
  let globalMaxHop = 0;

  Object.entries(filteredData).forEach(([destination, destData]) => {
    const destColor = generateDestinationColor(selectedDestinations.indexOf(destination));

    const addPath = (pathObj, type, altIndex) => {
      if (!pathObj || !Array.isArray(pathObj.path)) return;
      const hops = pathObj.path;
  const isSingleHopPath = Array.isArray(hops) && hops.length === 1;

      // Deterministic pathId so the graph is stable across renders.
      // Cache it directly on the path object to avoid recomputing on subsequent renders.
      let pathId = pathObj._cachedPathId;
      if (!pathId) {
        const hopSig = JSON.stringify((hops || []).map(h => h?.ip || 'timeout'));
        let hash = 0; for (let i = 0; i < hopSig.length; i++) hash = ((hash << 5) - hash) + hopSig.charCodeAt(i) | 0;
        pathId = type === 'PRIMARY'
          ? `${destination}-PRIMARY-${hash}`
          : `${destination}-ALTERNATIVE-${altIndex}-${hash}`;
        Object.defineProperty(pathObj, '_cachedPathId', { value: pathId, enumerable: false, configurable: true });
      }

      pathDescriptors.push({ destination, destColor, pathId, hops });
      globalMaxHop = Math.max(globalMaxHop, hops.length);

      // Determine expected destination IP (from data or destination key if it's an IP)
      const expectedDestIp =
        destData?.destination_ip ??
        destData?.dest_ip ??
        destData?.ip ??
        normalizeIp(destination);

      // Find the last real hop index (non-timeout with an IP)
      let lastRealIdx = -1;
      for (let i = hops.length - 1; i >= 0; i--) {
        const h = hops[i];
        if (h && !h.is_timeout && h.ip) { lastRealIdx = i; break; }
      }
      const matchesExpected =
        lastRealIdx >= 0 &&
        !!expectedDestIp &&
        hops[lastRealIdx]?.ip === expectedDestIp;

      const isTerminalHop = (idx) =>
        !isSingleHopPath && idx === lastRealIdx && (!expectedDestIp || matchesExpected);

      // Collect details keyed by the final rendering key
      hops.forEach((hop, idx) => {
        const hopNumber = hop?.hop_number ?? (idx + 1);
        let key;

        if (!hop || hop.is_timeout || !hop.ip) {
          // Timeout nodes handling
          if (aggregationMode === 'none') {
            key = `timeout@d:${destination}@h:${hopNumber}@p:${pathId}`;
          } else if (aggregationMode === 'shared-ips') {
            key = `timeout@h:${hopNumber}`;
          } else {
            key = (aggregationScope === 'cross-destination')
              ? `timeout@h:${hopNumber}`
              : `timeout@d:${destination}@h:${hopNumber}`;
          }
        } else if (!isIPv6(hop.ip)) {
          // If anything non-IPv6 sneaks in, treat as timeout-like to avoid mixing
          const base = (aggregationScope === 'cross-destination')
            ? `timeout@h:${hopNumber}` : `timeout@d:${destination}@h:${hopNumber}`;
          key = (aggregationMode === 'none') ? `${base}@p:${pathId}` : base;
        } else {
          // Handle different aggregation modes for IP nodes
          if (networkHierarchy !== 'none') {
            const prefix = getHierarchyPrefix(hop.ip, networkHierarchy, dataTransformer);
            const isExpanded = expandedPrefixes?.has(prefix);
            if (isExpanded) {
              if (aggregationMode === 'none') {
                key = (aggregationScope === 'cross-destination')
                  ? `ip:${hop.ip}@h:${hopNumber}@p:${pathId}`
                  : `ip:${hop.ip}@d:${destination}@h:${hopNumber}@p:${pathId}`;
              } else {
                key = (aggregationScope === 'cross-destination')
                  ? `ip:${hop.ip}@h:${hopNumber}`
                  : `ip:${hop.ip}@d:${destination}@h:${hopNumber}`;
              }
            } else {
              // Collapsed hierarchy prefix: use earliest hop number globally so all occurrences map to one node
              key = getCollapsedPrefixKey(prefix, hopNumber);
            }
          } else if (aggregationMode === 'none') {
            key = `ip:${hop.ip}@d:${destination}@h:${hopNumber}@p:${pathId}`;
          } else if (aggregationMode === 'shared-ips') {
            key = `ip:${hop.ip}@h:${hopNumber}`;
          } else if (aggregationMode === 'asn') {
            const asnGroup = `ASN-Unknown`; // TODO: real ASN lookup if/when available
            const collapsed = !expandedAsnGroups?.has(asnGroup);
            if (collapsed) {
              key = (aggregationScope === 'cross-destination')
                ? `asn:${asnGroup}@h:${hopNumber}`
                : `asn:${asnGroup}@d:${destination}@h:${hopNumber}`;
            } else {
              key = (aggregationScope === 'cross-destination')
                ? `ip:${hop.ip}@h:${hopNumber}`
                : `ip:${hop.ip}@d:${destination}@h:${hopNumber}`;
            }
          } else {
            // 'prefix' mode without hierarchy → treat like shared-ips keys then aggregate later
            key = (aggregationScope === 'cross-destination')
              ? `ip:${hop.ip}@h:${hopNumber}`
              : `ip:${hop.ip}@d:${destination}@h:${hopNumber}`;
          }
        }
        const destDomainName = destData?.domain?.name || destData?.domainName || null;

        if (!detailsByKey.has(key)) detailsByKey.set(key, []);
        detailsByKey.get(key).push({
          ip: hop?.ip ?? null,
          hostname: hop?.hostname ?? (hop?.ip ?? 'Timeout'),
          rtt_ms: hop?.rtt_ms ?? [],
          destination,
          domainName: destDomainName,        
          hopNumber,
          pathType: type,
          is_timeout: !hop || hop.is_timeout || !hop.ip,
          timestamp: pathObj?.timeStamp ?? null,
          pathTimestamps: Array.isArray(pathObj?.timestamps) ? pathObj.timestamps : [],
          protocol: pathObj?.protocol ?? (hop?.protocol ?? null),
          destinationReached: isTerminalHop(idx),
          pathPercent: pathObj?.percent ?? null,
          pathAvgRtt: pathObj?.avg_rtt ?? null,
          pathCount: pathObj?.count ?? null,
          totalTraces: destData?.total_traces ?? null,
          pathId
        });
      });
    };

    if (destData?.primary_path) addPath(destData.primary_path, 'PRIMARY', 0);
    if (!showPrimaryOnly && Array.isArray(destData?.alternatives)) {
      destData.alternatives.forEach((alt, i) => addPath(alt, 'ALTERNATIVE', i + 1));
    }
  });

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

  // Pass 1.5: Apply prefix aggregation if enabled (or hierarchy forces it)
  let finalDetailsByKey = new Map(detailsByKey);
  if (networkHierarchy !== 'none' || showPrefixAggregation) {
    finalDetailsByKey = applyPrefixAggregation(detailsByKey, {
      aggregationScope,
      expandedPrefixes,
      dataTransformer,
      networkHierarchy
    });
  }

  // Pass 2: create all nodes (so edges never point to ghosts)
  finalDetailsByKey.forEach((list, key) => {
    // Parse key
    // patterns:
    // - <type>:(value)?@d:<dest>@h:<hop>@p:<pathId> (show all paths)
    // - <type>:(value)?@d:<dest>@h:<hop> (per-destination)
    // - <type>:(value)?@h:<hop> (cross-destination/shared)
    let left, rest, dest, hopStr;

    // Handle path ID suffix first (for "none" mode)
    let cleanKey = key;
    if (key.includes('@p:')) {
      cleanKey = key.substring(0, key.lastIndexOf('@p:'));
    }

    if (cleanKey.includes('@d:')) {
      // Per-destination format: <type>:(value)?@d:<dest>@h:<hop>
      [left, rest] = cleanKey.split('@d:');
      const [destAndHop] = rest.split('@h:');
      dest = destAndHop;
      hopStr = rest.substring(destAndHop.length + 3);
    } else {
      // Cross-destination format: <type>:(value)?@h:<hop>
      [left, rest] = cleanKey.split('@h:');
      dest = 'cross-destination'; // placeholder for display
      hopStr = rest;
    }

    const [typeAndValue] = left.split('@'); // ignore extra
    const type = typeAndValue.startsWith('timeout') ? 'timeout'
      : typeAndValue.startsWith('ip:') ? 'ip'
      : typeAndValue.startsWith('asn:') ? 'asn'
      : 'prefix';

    const value = type === 'ip'
      ? typeAndValue.substring(3)
      : type === 'prefix'
        ? typeAndValue.substring(7)
        : type === 'asn'
          ? typeAndValue.substring(4)
          : null;

    const hopNumber = parseInt(hopStr, 10);

    // Y positioning
    let y;
    if (dest === 'cross-destination') {
      y = hopNumber * rowHeight;
    } else {
      const baseRows = rowOffsetByDest.get(dest) ?? 0;
      const yIndex = baseRows + hopNumber;
      y = yIndex * rowHeight;
    }

    if (type === 'timeout') {
      addNodeOnce(key, (id) => {
        nodeDetails.set(id, list);
  list.forEach(d => addPathMapping(id, d.pathId || `${d.destination}-${d.pathType}`));
        const isMaxTtl = hopNumber === 30;
        // Aggregation insight: number of unique paths & destinations represented by this timeout node
        const uniquePaths = new Set(list.map(d => d.pathId).filter(Boolean));
        const uniqueDests = new Set(list.map(d => d.destination).filter(Boolean));
        const pathCount = uniquePaths.size;
        const destCount = uniqueDests.size;
        const aggregated = pathCount > 1 || destCount > 1;
        const dynamicLabel = aggregated ? `⏱ ${pathCount}` : '⏱️';
        const dynamicSize = aggregated ? Math.min(16 + (pathCount - 1) * 2, 32) : 16;
        return {
          id,
          label: dynamicLabel,
          title: `${isMaxTtl ? 'Max TTL reached' : 'Timeout'} • Hop #${hopNumber} • ${dest}` + (aggregated ? `\nAggregated: ${pathCount} path${pathCount!==1?'s':''} across ${destCount} destination${destCount!==1?'s':''}` : ''),
          color: { background: '#F44336', border: '#D32F2F' },
          font: { size: 12, color: '#FFF', strokeWidth: 2, strokeColor: '#fff' },
          shape: 'dot',
          size: dynamicSize,
          nodeType: 'timeout',
          timeoutKey: key,
          aggregatedTimeout: aggregated,
          timeoutPaths: Array.from(uniquePaths),
          timeoutDestinations: Array.from(uniqueDests),
          level: hopNumber,
          y,
          physics: false,
          fixed: { x: false, y: true }
        };
      });
    } else if (type === 'ip') {
      const display = list[0]?.hostname || value;
      const isTerminal = list.some(d => d.destinationReached);
      addNodeOnce(key, (id) => {
        nodeDetails.set(id, list);
  list.forEach(d => addPathMapping(id, d.pathId || `${d.destination}-${d.pathType}`));
        return {
          id,
          label: display,
          title: `IP: ${value}\nHop #${hopNumber} • ${dest}${isTerminal ? '\nDestination reached' : ''}`,
          color: { background: '#FFA726', border: isTerminal ? '#2ECC71' : '#FF8F00' },
          font: { size: 12, color: '#333', strokeWidth: 2, strokeColor: '#fff' },
          shape: isTerminal ? 'box' : 'dot',
          size: 18,
          nodeType: 'hop',
          ip: value,
          // Provide parentPrefix so expanded hierarchy groups can be collapsed via UI / double-click
          parentPrefix: networkHierarchy !== 'none' ? getHierarchyPrefix(value, networkHierarchy, dataTransformer) : null,
          level: hopNumber,
          y,
          physics: false,
          fixed: { x: false, y: true }
        };
      });
    } else if (type === 'prefix') {
      addNodeOnce(key, (id) => {
        nodeDetails.set(id, list);
  list.forEach(d => addPathMapping(id, d.pathId || `${d.destination}-${d.pathType}`));
        // Determine if this prefix actually aggregates >1 distinct IP.
        const uniqueIps = new Set(list.filter(d => d.ip && !d.is_timeout).map(d => d.ip));
        const isAggregatedPrefix = uniqueIps.size > 1;
        const firstDetail = list[0];
        const fallbackLabel = firstDetail?.hostname || firstDetail?.ip || value;
        if (!isAggregatedPrefix) {
          // Treat as a normal hop (dot) since it represents only one underlying node
          return {
            id,
            label: fallbackLabel,
            title: `IP: ${fallbackLabel}\n(Hierarchy mask produced no aggregation)\nHop #${hopNumber} • ${dest}`,
            color: { background: '#FFA726', border: '#FF8F00' },
            font: { size: 12, color: '#333', strokeWidth: 2, strokeColor: '#fff' },
            shape: 'dot',
            size: 18,
            nodeType: 'hop',
            ip: firstDetail?.ip || null,
            level: hopNumber,
            y,
            physics: false,
            fixed: { x: false, y: true }
          };
        }
        // Aggregated: keep rectangle, move text below
        return {
          id,
          label: value,
          title: `Network Prefix: ${value}\nAggregated ${uniqueIps.size} IPs\nHop #${hopNumber} • ${dest}\nClick to expand`,
            color: { background: '#FF9800', border: '#F57C00' },
          font: { size: 11, color: '#333', strokeWidth: 2, strokeColor: '#fff', vadjust: 26 },
          shape: 'box',
          shapeProperties: { borderRadius: 2 },
          margin: 4,
          size: 20,
          nodeType: 'prefix',
          prefix: value,
          level: hopNumber,
          y,
          physics: false,
          fixed: { x: false, y: true }
        };
      });
    } else if (type === 'asn') {
      addNodeOnce(key, (id) => {
        nodeDetails.set(id, list);
  list.forEach(d => addPathMapping(id, d.pathId || `${d.destination}-${d.pathType}`));
        const label = value;
        return {
          id,
          label: `🏢 ${label}`,
          title: `ASN: ${value}\nHop #${hopNumber} • ${dest}\nClick to expand`,
          color: { background: '#9C27B0', border: '#7B1FA2' },
          font: { size: 11, color: '#fff', strokeWidth: 2, strokeColor: '#333', vadjust: 28 },
          shape: 'box',
          shapeProperties: { borderRadius: 2 },
          margin: 4,
          size: 22,
          nodeType: 'asn',
          asnGroup: value,
          level: hopNumber,
          y,
          physics: false,
          fixed: { x: false, y: true }
        };
      });
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
    const keyForHop = (hop, idx) => {
      const hopNumber = hop?.hop_number ?? (idx + 1);

      const resolveTimeoutKey = (baseKeyWithMaybeP) => {
        if (aggregationMode === 'none') return `${baseKeyWithMaybeP}@p:${pathId}`;
        return baseKeyWithMaybeP;
      };

      // Network hierarchy first (IPv6-only)
      if (networkHierarchy !== 'none') {
        if (!hop || hop.is_timeout || !hop.ip) {
          const base = (aggregationScope === 'cross-destination')
            ? `timeout@h:${hopNumber}`
            : `timeout@d:${destination}@h:${hopNumber}`;
        return resolveTimeoutKey(base);
        }
        if (!isIPv6(hop.ip)) {
          const base = (aggregationScope === 'cross-destination')
            ? `timeout@h:${hopNumber}`
            : `timeout@d:${destination}@h:${hopNumber}`;
          return resolveTimeoutKey(base);
        }
        const prefix = getHierarchyPrefix(hop.ip, networkHierarchy, dataTransformer);
        const isExpanded = expandedPrefixes?.has(prefix);
        if (isExpanded) {
          if (aggregationMode === 'none') {
            return (aggregationScope === 'cross-destination')
              ? `ip:${hop.ip}@h:${hopNumber}@p:${pathId}`
              : `ip:${hop.ip}@d:${destination}@h:${hopNumber}@p:${pathId}`;
          } else {
            return (aggregationScope === 'cross-destination')
              ? `ip:${hop.ip}@h:${hopNumber}`
              : `ip:${hop.ip}@d:${destination}@h:${hopNumber}`;
          }
        }
  // Collapsed hierarchy prefix: unify to earliest hop index
  return getCollapsedPrefixKey(prefix, hopNumber);
      }

      // Timeouts (non-hierarchy)
      if (!hop || hop.is_timeout || !hop.ip || !isIPv6(hop.ip)) {
        if (aggregationMode === 'none') {
          return resolveTimeoutKey(`timeout@d:${destination}@h:${hopNumber}`);
        } else if (aggregationMode === 'shared-ips') {
          return `timeout@h:${hopNumber}`;
        } else {
          return (aggregationScope === 'cross-destination')
            ? `timeout@h:${hopNumber}`
            : `timeout@d:${destination}@h:${hopNumber}`;
        }
      }

      // Other aggregation modes (IPv6)
      if (aggregationMode === 'none') {
        return `ip:${hop.ip}@d:${destination}@h:${hopNumber}@p:${pathId}`;
      } else if (aggregationMode === 'shared-ips') {
        return `ip:${hop.ip}@h:${hopNumber}`;
      } else if (aggregationMode === 'asn') {
        const asnGroup = `ASN-Unknown`;
        const collapsed = !expandedAsnGroups?.has(asnGroup);
        if (collapsed) {
          return (aggregationScope === 'cross-destination')
            ? `asn:${asnGroup}@h:${hopNumber}`
            : `asn:${asnGroup}@d:${destination}@h:${hopNumber}`;
        }
        return (aggregationScope === 'cross-destination')
          ? `ip:${hop.ip}@h:${hopNumber}`
          : `ip:${hop.ip}@d:${destination}@h:${hopNumber}`;
      }
      // 'prefix' mode without hierarchy base
      return (aggregationScope === 'cross-destination')
        ? `ip:${hop.ip}@h:${hopNumber}`
        : `ip:${hop.ip}@d:${destination}@h:${hopNumber}`;
    };

    // 1) Build raw node id sequence
  const rawIds = [];
    let firstIdPushed = false;
    hops.forEach((hop, idx) => {
      const key = keyForHop(hop, idx);
      const id = getOrCreateNodeId(key);
      rawIds.push(id);
      if (!firstIdPushed) firstIdPushed = true;
    });

    // 2) Compress consecutive duplicates BUT keep ordering
    const seq = [];
    let prev = null;
    rawIds.forEach(id => {
      if (id !== prev) {
        seq.push(id);
        prev = id;
      }
    });

    // 3) Prepend sourceId if first hop id is different (normally yes)
    if (seq.length === 0 || seq[0] !== sourceId) {
      seq.unshift(sourceId);
    }

    // 4) Add edges along the compressed sequence
    for (let i = 0; i < seq.length - 1; i++) {
      const fromId = seq[i];
      const toId = seq[i + 1];
      addEdgeUsage(fromId, toId, destination, destColor, pathId);
    }

    // If after compression there is only source + one destination node, record that node to force dot shape later
    if (seq.length === 2) {
      const loneNodeId = seq[1];
      const node = nodes.find(n => n.id === loneNodeId);
      // Only convert real hop nodes (not prefix/asn/timeout aggregated nodes) to dot
      if (node && node.nodeType === 'hop' && node.shape !== 'dot') {
        node.shape = 'dot';
        node.size = 16; // consistent size
      }
    }
  });

  // Emit edges (bundle multi-destination colors)
  let edgeId = 1;
  const isAggregated = aggregationMode !== 'none' || networkHierarchy !== 'none';

  edgeUsage.forEach((usage, key) => {
    const [fromStr, toStr] = key.split('->');
    const from = parseInt(fromStr, 10);
    const to = parseInt(toStr, 10);
    const colors = [...new Set(usage.colors)];
    const destinationLines = Array.from(usage.destinations).map(d => {
      const dom =
        filteredData?.[d]?.domain?.name ||
        filteredData?.[d]?.domainName ||
        null;
      return dom ? `${d} (${dom})` : d;
    });
    const destinationsBlock = destinationLines.length
      ? `Destinations:\n${destinationLines.join('\n')}\n`
      : '';
    const title = `${destinationsBlock}Paths: ${usage.paths.size}`;

    const straightLineStyle = { type: 'continuous', roundness: 0.0, forceDirection: 'horizontal' };
    const normalCurveStyle = { type: 'continuous', roundness: 0.4, forceDirection: 'horizontal' };

    if (colors.length <= 1) {
      const eid = `edge_${edgeId++}`;
      edges.push({
        id: eid,
        from, to,
        color: { color: colors[0] || '#999', opacity: 1 },
        width: 2,
        arrows: 'to',
        smooth: isAggregated ? straightLineStyle : normalCurveStyle,
        dashes: false,
        arrowStrikethrough: false,
        title,                        // <-- updated
        destinations: destinationLines, // optional extra data
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
          smooth: isAggregated ? straightLineStyle : curvedForIndex(idx, colors.length),
          dashes: false,
          arrowStrikethrough: false,
          title,                        // <-- updated
          destinations: destinationLines,
          paths: Array.from(usage.paths)
        });
        usage.paths.forEach(pid => {
          if (!pathMapping.has(eid)) pathMapping.set(eid, new Set());
          pathMapping.get(eid).add(pid);
        });
      });
    }
  });

  // Final safety check: remove any duplicate IDs that might have slipped through
  const uniqueNodes = [];
  const seenIds = new Set();
  for (const node of nodes) {
    if (!seenIds.has(node.id)) {
      uniqueNodes.push(node);
      seenIds.add(node.id);
    }
  }

  return { graph: { nodes: uniqueNodes, edges }, nodeDetails, pathMapping };
}

/**
 * Apply prefix aggregation (IPv6):
 * - Groups IP nodes by prefix only when multiple IPs share the same prefix at the same hop.
 * - Respects aggregationScope (per-destination vs cross-destination).
 * - Respects expandedPrefixes (do not collapse those).
 * - If networkHierarchy is set, uses its mask (/64, /48, /32); otherwise defaults to /64 when showPrefixAggregation = true.
 */
function applyPrefixAggregation(detailsByKey, { aggregationScope, expandedPrefixes, dataTransformer, networkHierarchy }) {
  const result = new Map();
  const ipsByHopAndPrefix = new Map(); // hop -> prefix -> [ { key, details, ip, dest? } ]

  // choose an effective mask if hierarchy is off but prefix aggregation requested
  const effectiveMask = networkHierarchy !== 'none'
    ? HIERARCHY_MASKS_V6[networkHierarchy]
    : 64; // default to /64 when showPrefixAggregation is used without hierarchy

  // Walk every detail bucket, re-group IP keys by hop+prefix
  for (const [key, details] of detailsByKey) {
    if (!key.startsWith('ip:')) {
      // Pass through non-IP (timeout/prefix/asn) untouched
      result.set(key, details);
      continue;
    }

    // Extract hop number and remove optional pathId suffix
    const hSplit = key.split('@h:');
    if (hSplit.length < 2) { result.set(key, details); continue; }

    let hopStr = hSplit[1];
    if (hopStr.includes('@p:')) hopStr = hopStr.split('@p:')[0];
    const hopNumber = parseInt(hopStr, 10);

    // Extract destination if present
    let dest = null;
    if (key.includes('@d:')) {
      const m = key.match(/@d:([^@]+)/);
      dest = m ? m[1] : null;
    }

    // Extract IP
    const ipMatch = key.match(/^ip:([^@]+)/);
    if (!ipMatch) { result.set(key, details); continue; }
    const ip = ipMatch[1];
    if (!ip || ip.indexOf(':') === -1) { result.set(key, details); continue; } // skip non-IPv6

    // Compute prefix
    const prefix = dataTransformer.getNetworkPrefix(ip, effectiveMask);
    const isExpanded = expandedPrefixes?.has(prefix);

    if (!ipsByHopAndPrefix.has(hopNumber)) {
      ipsByHopAndPrefix.set(hopNumber, new Map());
    }
    const prefixMap = ipsByHopAndPrefix.get(hopNumber);
    const bucketKey = prefix;
    if (!prefixMap.has(bucketKey)) {
      prefixMap.set(bucketKey, []);
    }
    prefixMap.get(bucketKey).push({ key, details, ip, dest, isExpanded });
  }

  // For each hop/prefix group, either keep IP nodes (expanded or singletons) or build a prefix node
  for (const [hopNumber, prefixMap] of ipsByHopAndPrefix) {
    for (const [prefix, ipEntries] of prefixMap) {
      const anyExpanded = ipEntries.some(e => e.isExpanded);

      if (anyExpanded || ipEntries.length === 1) {
        // Keep all IP nodes as-is
        for (const entry of ipEntries) {
          result.set(entry.key, entry.details);
        }
        continue;
      }

      // Collapsed: build a single prefix node per scope
      // For per-destination scope, we must not mix different dests into one node.
      if (aggregationScope === 'per-destination') {
        const byDest = new Map();
        for (const entry of ipEntries) {
          const d = entry.dest ?? 'unknown';
          if (!byDest.has(d)) byDest.set(d, []);
          byDest.get(d).push(entry);
        }
        for (const [d, entries] of byDest) {
          const allDetails = entries.flatMap(e => e.details);
          const prefixKey = `prefix:${prefix}@d:${d}@h:${hopNumber}`;
          // If a prefixKey already exists (e.g., from pass-through), merge
          result.set(prefixKey, (result.get(prefixKey) || []).concat(allDetails));
        }
      } else {
        // Cross-destination: single node at hop
        const allDetails = ipEntries.flatMap(e => e.details);
        const prefixKey = `prefix:${prefix}@h:${hopNumber}`;
        result.set(prefixKey, (result.get(prefixKey) || []).concat(allDetails));
      }
    }
  }

  return result;
}
