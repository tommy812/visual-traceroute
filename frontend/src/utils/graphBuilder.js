import dataTransformer from '../services/dataTransformer';
import { generateDestinationColor } from './colorUtils';
import { curvedForIndex } from './edges';
import protocolFilteringService from '../services/protocolFilteringService';
import pathSortingService from '../services/pathSortingService';

// Map hierarchy → IPv6 mask
const HIERARCHY_MASKS_V6 = {
  subnet: 64,   // /64
  'isp-pop': 48, // /48
  isp: 32       // /32
};

/**
 * Graph Builder
 * 
 * Builds network graphs from traceroute data with support for various aggregation modes.
 * Handles IPv6 hierarchy aggregation, shared IP grouping, and timeout node placement.
 */
export function buildGraph({
  filteredData,
  selectedDestinations,
  showPrimaryOnly,
  showPrefixAggregation,
  expandedPrefixes,
  aggregationMode = 'none',                 // 'none' | 'shared-ips' | 'asn' | 'prefix'
  aggregationScope = 'per-destination',     // 'per-destination' | 'cross-destination'
  networkHierarchy = 'none',                // 'none' | 'asn' | 'subnet' (/64) | 'isp-pop' (/48) | 'isp' (/32)
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
  // Canonicalize keys for ID mapping (e.g., unify ASN across steps in Shared IPs)
  const canonicalizeKeyForId = (key) => {
    if (aggregationMode === 'shared-ips' && key.startsWith('asn:')) {
      return key.replace(/@h:\d+/, '@h:0');
    }
    return key;
  };
  const getOrCreateNodeId = (key) => {
    const fullKey = `${aggregationMode}:${aggregationScope}:${canonicalizeKeyForId(key)}`;
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

  // (lane ordering and row offsets were removed; hierarchical layout handles positioning)

  // ===== IPv6-only helpers =====
  const isIPv6 = (s) => typeof s === 'string' && s.includes(':');
  // In Shared IPs, we visually merge ASN nodes across steps (handled below)
  const normalizeIp = (s) => (isIPv6(s) ? s : null);

  // (rely on the top-level HIERARCHY_MASKS_V6)

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
  // (Prefix earliest-hop map removed; we now use per-path monotonic steps.)

  // When Show All Paths is selected (aggregationMode === 'none'), we must scope
  // the "earliest hop" computation to the individual run (pathId). Otherwise
  // different runs that encounter the same prefix at different hops would all be
  // forced to the earliest hop seen in any run, producing the bunched-up grid.
  // NOTE: We used to remap prefixes to the earliest hop seen (grid effect).
  // Instead, we now collapse consecutively repeated prefixes into a single
  // monotonic "step" per path (similar to ASN collapsing). This avoids
  // back-edges and preserves left-to-right progression.
  const getCollapsedPrefixKey = (prefix, step, destination, aggregationScope, pathId, aggregationMode) => {
    const base = (aggregationScope === 'cross-destination')
      ? `prefix:${prefix}@h:${step}`
      : `prefix:${prefix}@d:${destination}@h:${step}`;
    return (aggregationMode === 'none' && pathId) ? `${base}@p:${pathId}` : base;
  };

  // Pass 1: collect details and compute max hop per destination
  const pathDescriptors = []; // [{ destination, destColor, pathId, hops }]
  // (no global hop tracking needed)

  Object.entries(filteredData).forEach(([destination, destData]) => {
    const destColor = generateDestinationColor(selectedDestinations.indexOf(destination));

  // Function to aggregate consecutive timeout hops
  const aggregateConsecutiveTimeouts = (hops) => {
    const aggregatedHops = [];
    let i = 0;
    
    while (i < hops.length) {
      const hop = hops[i];
      
      // Check if this is a timeout hop
      if (!hop || hop.is_timeout || !hop.ip) {
        // Find consecutive timeout sequence
        const timeoutSequence = [];
        let j = i;
        
        while (j < hops.length) {
          const currentHop = hops[j];
          if (!currentHop || currentHop.is_timeout || !currentHop.ip) {
            timeoutSequence.push(currentHop);
            j++;
          } else {
            break;
          }
        }
        
        // Only aggregate if we have multiple consecutive timeouts
        if (timeoutSequence.length > 1) {
          // Create aggregated timeout hop that preserves all individual timeout information
          const aggregatedTimeout = {
            ...timeoutSequence[0], // Use first timeout as base
            is_timeout: true,
            is_aggregated_timeout: true,
            timeout_count: timeoutSequence.length,
            original_hop_numbers: timeoutSequence.map(h => h?.hop_number ?? (hops.indexOf(h) + 1)),
            hop_number: timeoutSequence[0]?.hop_number ?? (i + 1), // Use first hop number
            // Preserve all individual timeout data for tooltip
            aggregated_timeouts: timeoutSequence.filter(h => h !== null && h !== undefined)
          };
          aggregatedHops.push(aggregatedTimeout);
        } else {
          // Single timeout, add as-is
          aggregatedHops.push(timeoutSequence[0]);
        }
        
        i = j; // Move to next non-timeout hop
      } else {
        // Regular hop, add as-is
        aggregatedHops.push(hop);
        i++;
      }
    }
    
    return aggregatedHops;
  };

  const addPath = (pathObj, type, altIndex) => {
      if (!pathObj || !Array.isArray(pathObj.path)) return;
      // Apply consecutive timeout aggregation
      const hops = aggregateConsecutiveTimeouts(pathObj.path);
  const isSingleHopPath = Array.isArray(hops) && hops.length === 1;

  // Pre-compute collapsed step per hop for ASN aggregation:
      // - consecutive hops with the same ASN collapse into one step
      // - timeouts/non-IPv6 also take their own step
      const asnStepByIdx = [];
  const asnEnabled = (aggregationMode === 'asn' || networkHierarchy === 'asn');
  if (asnEnabled) {
        let step = 0;
        let prevType = null; // 'asn' | 'ip' | 'timeout'
        let prevAsn = null;
        for (let i = 0; i < hops.length; i++) {
          const h = hops[i];
          const hopIp = h?.ip;
          const timeoutish = !h || h.is_timeout || h.is_aggregated_timeout || !hopIp || !isIPv6(hopIp);
          if (timeoutish) {
            step += 1;
            asnStepByIdx[i] = step;
            prevType = 'timeout';
            prevAsn = null;
            continue;
          }
          const hasAsn = (typeof h?.asn === 'number' || (typeof h?.asn === 'string' && String(h.asn).trim() !== ''));
          if (hasAsn) {
            const asnGroup = String(h.asn).trim();
            if (prevType === 'asn' && prevAsn === asnGroup) {
              // same ASN run → same step
              asnStepByIdx[i] = step;
            } else {
              step += 1;
              asnStepByIdx[i] = step;
              prevType = 'asn';
              prevAsn = asnGroup;
            }
          } else {
            // IP with no ASN → its own step
            step += 1;
            asnStepByIdx[i] = step;
            prevType = 'ip';
            prevAsn = null;
          }
        }
      }

  // Deterministic but per-run-aware pathId so the graph is stable and distinct runs are not merged.
      // Cache it directly on the path object to avoid recomputing on subsequent renders.
      let pathId = pathObj._cachedPathId;
      if (!pathId) {
        const hopSig = JSON.stringify((hops || []).map(h => h?.ip || 'timeout'));
        const tsSig = String(pathObj?.timeStamp || pathObj?.timestamp || '');
        const protoSig = String(pathObj?.protocol || '');
        const sig = `${hopSig}|${tsSig}|${protoSig}`;
        let hash = 0; for (let i = 0; i < sig.length; i++) hash = ((hash << 5) - hash) + sig.charCodeAt(i) | 0;
        const inst = pathObj._instanceId ? `-inst${pathObj._instanceId}` : '';
        pathId = type === 'PRIMARY'
          ? `${destination}-PRIMARY-${hash}${inst}`
          : `${destination}-ALTERNATIVE-${altIndex}-${hash}${inst}`;
        Object.defineProperty(pathObj, '_cachedPathId', { value: pathId, enumerable: false, configurable: true });
      }

  pathDescriptors.push({ 
    destination, 
    destColor, 
    pathId, 
    hops, 
    runId: pathObj?.run_id ?? null,
    protocol: pathObj?.protocol ?? null,
    domain: filteredData[destination]?.domain?.name || null
  });
  // (max hop no longer tracked)

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

      // Pre-compute collapsed step per hop for hierarchy prefix aggregation (IPv6 only),
      // similar to ASN collapsing but based on prefixes and respecting expanded groups.
      let prefixStepByIdx = null;
  const hierarchyEnabled = (networkHierarchy !== 'none' && networkHierarchy !== 'asn');
  // reuse existing asnEnabled declared earlier in this scope
      if (hierarchyEnabled && !asnEnabled && showPrefixAggregation) {
        prefixStepByIdx = [];
        let step = 0;
        let prevType = null; // 'prefix' | 'ip' | 'timeout'
        let prevPrefix = null;
        for (let i = 0; i < hops.length; i++) {
          const h = hops[i];
          const ip = h?.ip;
          const timeoutish = !h || h.is_timeout || h.is_aggregated_timeout || !ip || !isIPv6(ip);
          if (timeoutish) {
            step += 1;
            prefixStepByIdx[i] = step;
            prevType = 'timeout';
            prevPrefix = null;
            continue;
          }
          const prefix = getHierarchyPrefix(ip, networkHierarchy, dataTransformer);
          const isExpanded = expandedPrefixes?.has(prefix);
          if (!isExpanded) {
            if (prevType === 'prefix' && prevPrefix === prefix) {
              // Same prefix run → same step
              prefixStepByIdx[i] = step;
            } else {
              step += 1;
              prefixStepByIdx[i] = step;
              prevType = 'prefix';
              prevPrefix = prefix;
            }
          } else {
            // Expanded → treat like an IP (always advances)
            step += 1;
            prefixStepByIdx[i] = step;
            prevType = 'ip';
            prevPrefix = null;
          }
        }
      }

      // Collect details keyed by the final rendering key
  hops.forEach((hop, idx) => {
        const hopNumber = hop?.hop_number ?? (idx + 1);
        let key;
        const aggregateTimeouts = (aggregationMode !== 'none') || (networkHierarchy !== 'none');

        if (!hop || hop.is_timeout || hop.is_aggregated_timeout || !hop.ip) {
          // Timeout nodes handling
          if (asnEnabled && Array.isArray(asnStepByIdx) && asnStepByIdx[idx]) {
            // place timeout at the collapsed step to preserve sequence when ASN grouping is on
            const step = asnStepByIdx[idx];
            const cross = (aggregationMode === 'shared-ips') ? false : (aggregationScope === 'cross-destination');
            const base = cross ? `timeout@h:${step}` : `timeout@d:${destination}@h:${step}`;
            // Preserve per-run identity when Show All Paths is selected
            key = (aggregationMode === 'none') ? `${base}@p:${pathId}` : base;
          } else if (prefixStepByIdx && prefixStepByIdx[idx]) {
            // With hierarchy collapsing, map timeouts to the computed step as well
            const step = prefixStepByIdx[idx];
            const cross = (aggregationMode === 'shared-ips') ? false : (aggregationScope === 'cross-destination');
            const base = cross ? `timeout@h:${step}` : `timeout@d:${destination}@h:${step}`;
            key = (aggregationMode === 'none') ? `${base}@p:${pathId}` : base;
          } else if (aggregationMode === 'none') {
            key = `timeout@d:${destination}@h:${hopNumber}@p:${pathId}`;
          } else if (aggregationMode === 'shared-ips') {
            key = `timeout@d:${destination}@h:${hopNumber}`;
          } else if (aggregateTimeouts) {
            key = `timeout@h:${hopNumber}`;
          } else {
            key = `timeout@d:${destination}@h:${hopNumber}`;
          }
        } else if (!isIPv6(hop.ip)) {
          // If anything non-IPv6 sneaks in, treat as timeout-like to avoid mixing
          const base = (aggregationScope === 'cross-destination')
            ? `timeout@h:${hopNumber}` : `timeout@d:${destination}@h:${hopNumber}`;
          if (asnEnabled && Array.isArray(asnStepByIdx) && asnStepByIdx[idx]) {
            const step = asnStepByIdx[idx];
            const cross = (aggregationMode === 'shared-ips') ? false : (aggregationScope === 'cross-destination');
            const t = cross ? `timeout@h:${step}` : `timeout@d:${destination}@h:${step}`;
            key = (aggregationMode === 'none') ? `${t}@p:${pathId}` : t;
          } else if (prefixStepByIdx && prefixStepByIdx[idx]) {
            const step = prefixStepByIdx[idx];
            const cross = (aggregationMode === 'shared-ips') ? false : (aggregationScope === 'cross-destination');
            const t = cross ? `timeout@h:${step}` : `timeout@d:${destination}@h:${step}`;
            key = (aggregationMode === 'none') ? `${t}@p:${pathId}` : t;
          } else {
            key = (aggregationMode === 'none') ? `${base}@p:${pathId}` : base;
          }
        } else {
          // Handle different aggregation modes for IP nodes
          // 1) ASN aggregation has precedence over hierarchy
          if (asnEnabled) {
            const asnVal = (typeof hop.asn === 'number' || typeof hop.asn === 'string') ? String(hop.asn).trim() : null;
            const step = (Array.isArray(asnStepByIdx) && asnStepByIdx[idx]) ? asnStepByIdx[idx] : hopNumber;
            if (asnVal) {
              const asnGroup = `AS${asnVal}`;
              const collapsed = !expandedAsnGroups?.has(asnGroup);
              if (collapsed) {
                  // Use the collapsed step in the key; ID mapping will dedupe in Shared IPs
                  const base = (aggregationScope === 'cross-destination')
                    ? `asn:${asnGroup}@h:${step}`
                    : `asn:${asnGroup}@d:${destination}@h:${step}`;
                  key = (aggregationMode === 'none') ? `${base}@p:${pathId}` : base;
              } else {
                // Expanded ASN group shows underlying IP nodes; keep per-run identity in Show All Paths
                const base = (aggregationScope === 'cross-destination')
                  ? `ip:${hop.ip}@h:${step}`
                  : `ip:${hop.ip}@d:${destination}@h:${step}`;
                key = (aggregationMode === 'none') ? `${base}@p:${pathId}` : base;
              }
            } else {
              // No ASN → treat as normal IP node at collapsed step
              const base = (aggregationScope === 'cross-destination')
                ? `ip:${hop.ip}@h:${step}`
                : `ip:${hop.ip}@d:${destination}@h:${step}`;
              key = (aggregationMode === 'none') ? `${base}@p:${pathId}` : base;
            }
          } else if (networkHierarchy !== 'none' && networkHierarchy !== 'asn') {
            const prefix = getHierarchyPrefix(hop.ip, networkHierarchy, dataTransformer);
            const isExpanded = expandedPrefixes?.has(prefix);
            const collapseByPrefix = showPrefixAggregation && !isExpanded;
            if (collapseByPrefix) {
              // Collapsed hierarchy prefix: use computed monotonic step
              const step = (prefixStepByIdx && prefixStepByIdx[idx]) ? prefixStepByIdx[idx] : hopNumber;
              const base = getCollapsedPrefixKey(prefix, step, destination, aggregationScope, pathId, aggregationMode);
              // In Show All Paths, keep collapsed prefix groups per-run (already handled inside helper)
              key = base;
            } else {
              // Expanded (or grouping disabled): keep IP nodes
              const step = (prefixStepByIdx && prefixStepByIdx[idx]) ? prefixStepByIdx[idx] : hopNumber;
              if (aggregationMode === 'none') {
                key = (aggregationScope === 'cross-destination')
                  ? `ip:${hop.ip}@h:${step}@p:${pathId}`
                  : `ip:${hop.ip}@d:${destination}@h:${step}@p:${pathId}`;
              } else {
                key = (aggregationScope === 'cross-destination')
                  ? `ip:${hop.ip}@h:${step}`
                  : `ip:${hop.ip}@d:${destination}@h:${step}`;
              }
            }
          } else if (aggregationMode === 'none') {
            key = `ip:${hop.ip}@d:${destination}@h:${hopNumber}@p:${pathId}`;
          } else if (aggregationMode === 'shared-ips') {
            key = `ip:${hop.ip}@h:${hopNumber}`;
          } else {
            // 'prefix' mode without hierarchy → treat like shared-ips keys then aggregate later
            key = (aggregationScope === 'cross-destination')
              ? `ip:${hop.ip}@h:${hopNumber}`
              : `ip:${hop.ip}@d:${destination}@h:${hopNumber}`;
          }
        }

        if (!detailsByKey.has(key)) detailsByKey.set(key, []);
        const hopDetail = {
          ip: hop?.ip ?? null,
          hostname: hop?.hostname ?? (hop?.ip ?? 'Timeout'),
          rtt_ms: hop?.rtt_ms ?? [],
          avg_rtt_ms: (hop?.avg_rtt_ms != null ? Number(hop.avg_rtt_ms) : null),
          loss_pct: (hop?.loss_pct != null ? Number(hop.loss_pct) : null),
          destination,
          domainName: pathObj?.destination_domain || destData?.domain?.name || null,
          hopNumber,
          // Total hops in this path (for drawer display)
          pathLength: Array.isArray(hops) ? hops.length : null,
          pathType: type,
          is_timeout: !hop || hop.is_timeout || !hop.ip,
          timestamp: pathObj?.timeStamp ?? null,
          pathTimestamps: Array.isArray(pathObj?.timestamps) ? pathObj.timestamps : [],
          protocol: pathObj?.protocol ?? (hop?.protocol ?? null),
          asn: (typeof hop?.asn === 'number' || typeof hop?.asn === 'string') ? hop.asn : null,
          destinationReached: isTerminalHop(idx),
          pathPercent: pathObj?.percent ?? null,
          pathAvgRtt: pathObj?.avg_rtt ?? null,
          pathCount: pathObj?.count ?? null,
          totalTraces: destData?.total_traces ?? null,
          pathId,
          // NEW: attach run id and destination address so drawer can fetch exact trace
          trace_run_id: pathObj?.run_id ?? null,
          destinationAddress: destData?.destination || destination || null,
          destinationDomain: pathObj?.destination_domain || destData?.domain?.name || null
        };

        detailsByKey.get(key).push(hopDetail);
      });
    };

    if (destData?.primary_path) addPath(destData.primary_path, 'PRIMARY', 0);
    if (!showPrimaryOnly && Array.isArray(destData?.alternatives)) {
      // Sort alternatives using advanced optimization for the current graph configuration
      const sortingConfig = {
        aggregationMode,
        aggregationScope,
        networkHierarchy,
        showPrimaryOnly,
        destinationCount: selectedDestinations.length
      };
      
      const sortedAlternatives = pathSortingService.sortForGraphDisplay(destData.alternatives, {
        primarySort: 'advanced',
        ...sortingConfig
      });
      
      sortedAlternatives.forEach((alt, i) => addPath(alt, 'ALTERNATIVE', i + 1));
    }
  });

  // Source node removed: paths now start from the first hop present in data.

  // Pass 1.5: Apply protocol filtering detection per destination
  const destinationGroups = new Map();
  
  // Group all hops by destination
  detailsByKey.forEach((hopDataList, key) => {
    if (hopDataList.length === 0) return;
    
    const destinationAddress = hopDataList[0]?.destinationAddress || hopDataList[0]?.destination;
    if (!destinationAddress) return;

    if (!destinationGroups.has(destinationAddress)) {
      destinationGroups.set(destinationAddress, []);
    }
    destinationGroups.get(destinationAddress).push(...hopDataList);
  });

  // Analyze each destination for protocol filtering
  destinationGroups.forEach((allHopsForDestination, destinationAddress) => {
    // Analyze protocol filtering for this destination
    const filteringResult = protocolFilteringService.detectEdgeFilteringForHop(allHopsForDestination, destinationAddress);
    
    // Apply filtering information to all hops for this destination
    if (filteringResult.isEdgeFiltered) {
      allHopsForDestination.forEach(hopData => {
        if (hopData.protocol === filteringResult.filteredProtocol) {
          hopData.isEdgeFiltered = true;
          hopData.edgeFilteringMessage = filteringResult.message;
          hopData.reachingProtocols = filteringResult.reachingProtocols;
        }
      });
    }
  });

  // Pass 1.6: Apply prefix aggregation if enabled (or hierarchy forces it)
  let finalDetailsByKey = new Map(detailsByKey);
  // Only apply post-pass prefix aggregation when no explicit hierarchy is selected
  // and the user enabled prefix grouping.
  if (showPrefixAggregation && networkHierarchy === 'none') {
    finalDetailsByKey = applyPrefixAggregation(detailsByKey, {
      aggregationScope,
      expandedPrefixes,
      dataTransformer,
      networkHierarchy
    });
  }

  // Determine ASN roles (first/last) per path to influence placement in Shared IPs
  const asnRoles = new Map(); // canonicalKey -> { minStep, maxStep, firstSeen: bool, lastSeen: bool }
  const asnPlacementEnabled = (aggregationMode === 'shared-ips') && (networkHierarchy === 'asn' || aggregationMode === 'asn');
  if (asnPlacementEnabled) {
    const buildAsnKey = (asnGroup, step, destination) =>
      (aggregationScope === 'cross-destination')
        ? `asn:${asnGroup}@h:${step}`
        : `asn:${asnGroup}@d:${destination}@h:${step}`;

    for (const { destination, hops } of pathDescriptors) {
      // Recompute collapsed ASN steps for this path
      let step = 0;
      let prevType = null;
      let prevAsn = null;
      const seq = []; // [{ asnGroup, step }]
      for (let i = 0; i < hops.length; i++) {
        const h = hops[i];
        const ip = h?.ip;
        const timeoutish = !h || h.is_timeout || !ip || !isIPv6(ip);
        if (timeoutish) { step += 1; prevType = 'timeout'; prevAsn = null; continue; }
        const hasAsn = (typeof h?.asn === 'number' || (typeof h?.asn === 'string' && String(h.asn).trim() !== ''));
        if (hasAsn) {
          const a = `AS${String(h.asn).trim()}`;
          if (prevType === 'asn' && prevAsn === a) {
            // same step, skip
          } else {
            step += 1; prevType = 'asn'; prevAsn = a;
            seq.push({ asnGroup: a, step });
          }
        } else { step += 1; prevType = 'ip'; prevAsn = null; }
      }
      if (seq.length) {
        const first = seq[0];
        const last = seq[seq.length - 1];
        const firstKey = canonicalizeKeyForId(buildAsnKey(first.asnGroup, first.step, destination));
        const lastKey  = canonicalizeKeyForId(buildAsnKey(last.asnGroup,  last.step,  destination));
        const upd = (canonKey, stp, role) => {
          const cur = asnRoles.get(canonKey) || { minStep: Infinity, maxStep: -Infinity, firstSeen: false, lastSeen: false };
          cur.minStep = Math.min(cur.minStep, stp);
          cur.maxStep = Math.max(cur.maxStep, stp);
          if (role === 'first') cur.firstSeen = true;
          if (role === 'last') cur.lastSeen = true;
          asnRoles.set(canonKey, cur);
        };
        upd(firstKey, first.step, 'first');
        upd(lastKey,  last.step,  'last');
      }
    }
  }

  // Special merge: In Shared IPs with ASN hierarchy, unify ASN nodes across
  // occurrences and place the node at the last (max) collapsed step so timeouts
  // and later hops appear after it.
  if (aggregationMode === 'shared-ips' && (networkHierarchy === 'asn' || aggregationMode === 'asn')) {
    const merged = new Map(); // canonicalKey -> { maxStep, lists[] } or passthrough array
    for (const [key, list] of finalDetailsByKey) {
      if (!key.startsWith('asn:')) {
        // passthrough (can collect if duplicates exist)
        if (!merged.has(key)) merged.set(key, list);
        else if (Array.isArray(merged.get(key))) merged.set(key, merged.get(key).concat(list));
        continue;
      }
      const canonical = canonicalizeKeyForId(key); // asn:*@h:0 (keeps @d if present)
      const m = key.match(/@h:(\d+)/);
      const step = m ? parseInt(m[1], 10) : 0;
      if (!merged.has(canonical)) merged.set(canonical, { maxStep: step, lists: [list] });
      else {
        const entry = merged.get(canonical);
        entry.maxStep = Math.max(entry.maxStep, step);
        entry.lists.push(list);
      }
    }

  // Rebuild details map choosing step: prefer last's maxStep, else first's minStep
    const rebuilt = new Map();
    for (const [k, v] of merged) {
      if (k.startsWith('asn:')) {
        const entry = v;
    const role = asnRoles.get(k) || { minStep: entry.maxStep, maxStep: entry.maxStep, firstSeen: false, lastSeen: false };
    const chosenStep = role.lastSeen ? role.maxStep : role.firstSeen ? role.minStep : entry.maxStep;
    const repKey = k.replace(/@h:0/, `@h:${chosenStep}`);
        rebuilt.set(repKey, entry.lists.flat());
      } else {
        rebuilt.set(k, Array.isArray(v) ? v : (v?.lists ? v.lists.flat() : []));
      }
    }
    finalDetailsByKey = rebuilt;
  }

  // Pass 2: create all nodes (so edges never point to ghosts)
  finalDetailsByKey.forEach((list, key) => {
    // Parse key
    // patterns:
    // - <type>:(value)?@d:<dest>@h:<hop>@p:<pathId> (show all paths)
    // - <type>:(value)?@d:<dest>@h:<hop> (per-destination)
    // - <type>:(value)?@h:<hop> (cross-destination/shared)
  let left, rest, hopStr;

  // Handle path ID suffix first (for "none" mode)
    let cleanKey = key;
    if (key.includes('@p:')) {
      cleanKey = key.substring(0, key.lastIndexOf('@p:'));
    }

  if (cleanKey.includes('@d:')) {
      // Per-destination format: <type>:(value)?@d:<dest>@h:<hop>
      [left, rest] = cleanKey.split('@d:');
      const [destAndHop] = rest.split('@h:');
      hopStr = rest.substring(destAndHop.length + 3);
    } else {
      // Cross-destination format: <type>:(value)?@h:<hop>
      [left, rest] = cleanKey.split('@h:');
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

  // Y positioning: computed via hierarchical layout; explicit y not used

    if (type === 'timeout') {
      addNodeOnce(key, (id) => {
        nodeDetails.set(id, list);
  list.forEach(d => addPathMapping(id, d.pathId || `${d.destination}-${d.pathType}`));
        const uniqueDestCount = new Set(list.map(d => d.destination).filter(Boolean)).size;
        const uniquePathCount = new Set(list.map(d => d.pathId).filter(Boolean)).size;
        const aggregated = uniqueDestCount > 1 || uniquePathCount > 1;
        const isAggregatedTimeout = list.some(d => d.is_aggregated_timeout);
        
        // Calculate the actual count to display
        let displayCount = 1;
        let label = '⏱️';
        
        if (isAggregatedTimeout) {
          // For aggregated timeouts, show the count of consecutive timeouts that were aggregated
          const timeoutCount = list.find(d => d.is_aggregated_timeout)?.timeout_count || 1;
          displayCount = timeoutCount;
          if (timeoutCount > 1) {
            label = `⏱️×${timeoutCount}`;
          }
        } else if (aggregated) {
          // For non-aggregated timeouts shared across multiple paths, show the number of paths
          displayCount = uniquePathCount || uniqueDestCount;
          label = `⏱️×${displayCount}`;
        }
        
        return {
          id,
          label,
          // Disable vis-network native tooltip; we use custom overlays
          title: undefined,
          color: { background: '#F44336', border: '#D32F2F' },
          font: { size: 12, color: '#FFFFF', strokeWidth: 2, strokeColor: '#fff' },
          shape: 'dot',
          size: 16,
          nodeType: 'timeout',
          timeoutKey: key,
          level: hopNumber,
          isAggregatedTimeout,
          timeoutCount: displayCount,
          
          physics: false,
          fixed: { x: false, y: false }
        };
      });
    } else if (type === 'ip') {
      const display = list[0]?.hostname || value;
      const isTerminal = list.some(d => d.destinationReached);
      
      // Get destination color for terminal hops that reached their destination
      let backgroundColor = '#71c67fff';
      let borderColor = isTerminal ? '#0c7237ff' : '#398f0aff';
      
      if (isTerminal) {
        // Find the destination for this terminal hop
        const terminalDetail = list.find(d => d.destinationReached);
        if (terminalDetail?.destination) {
          const destIndex = selectedDestinations.indexOf(terminalDetail.destination);
          if (destIndex >= 0) {
            // Use the same color generation as edges for consistency
            backgroundColor = generateDestinationColor(destIndex);
            borderColor = generateDestinationColor(destIndex, 80, 35); // Darker border
          }
        }
      }
      
      addNodeOnce(key, (id) => {
        nodeDetails.set(id, list);
  list.forEach(d => addPathMapping(id, d.pathId || `${d.destination}-${d.pathType}`));
        return {
          id,
          label: display,
          // Disable vis-network native tooltip; use custom overlays
          title: undefined,
          color: { background: backgroundColor, border: borderColor },
          font: { size: 12, color: '#333', strokeWidth: 2, strokeColor: '#fff' },
          shape: isTerminal ? 'box' : 'dot',
          size: 18,
          nodeType: 'hop',
          ip: value,
          // Provide parentPrefix so expanded hierarchy groups can be collapsed via UI / double-click
          parentPrefix: networkHierarchy !== 'none' ? getHierarchyPrefix(value, networkHierarchy, dataTransformer) : null,
          level: hopNumber,
          
          physics: false,
          fixed: { x: false, y: false }
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
          // Treat as a normal hop using the standard green styling
          const isTerminal = list.some(d => d.destinationReached);
          
          // Get destination color for terminal hops that reached their destination
          let backgroundColor = '#71c67fff';
          let borderColor = isTerminal ? '#0c7237ff' : '#398f0aff';
          
          if (isTerminal) {
            // Find the destination for this terminal hop
            const terminalDetail = list.find(d => d.destinationReached);
            if (terminalDetail?.destination) {
              const destIndex = selectedDestinations.indexOf(terminalDetail.destination);
              if (destIndex >= 0) {
                // Use the same color generation as edges for consistency
                backgroundColor = generateDestinationColor(destIndex);
                borderColor = generateDestinationColor(destIndex, 80, 35); // Darker border
              }
            }
          }
          
          return {
            id,
            label: fallbackLabel,
            // Disable vis-network native tooltip; we use custom overlays
            title: undefined,
            color: { background: backgroundColor, border: borderColor },
            font: { size: 12, color: '#333', strokeWidth: 2, strokeColor: '#fff' },
            shape: isTerminal ? 'box' : 'dot',
            size: 18,
            nodeType: 'hop',
            ip: firstDetail?.ip || null,
            level: hopNumber,
            
            physics: false,
            fixed: { x: false, y: false }
          };
        }
        // Determine if this aggregated group includes the destination (any path reached dest in this group)
        const containsDestination = list.some(d => d.destinationReached && !d.is_timeout);
        
        // Get destination color for terminal aggregated prefixes
        let backgroundColor = '#FF9800';
        let borderColor = containsDestination ? '#0c7237ff' : '#D32F2F';
        
        if (containsDestination) {
          // Find the destination for this terminal prefix
          const terminalDetail = list.find(d => d.destinationReached && !d.is_timeout);
          if (terminalDetail?.destination) {
            const destIndex = selectedDestinations.indexOf(terminalDetail.destination);
            if (destIndex >= 0) {
              // Use a lighter version of destination color for aggregated prefixes
              backgroundColor = generateDestinationColor(destIndex, 50, 70); // Lighter version
              borderColor = generateDestinationColor(destIndex, 80, 35); // Darker border
            }
          }
        }
        
        // Aggregated prefix: render as a chip with count and chevron (expand affordance)
        return {
          id,
          label: `${value} (${uniqueIps.size}) ▸`,
          // Remove default vis tooltip; use custom overlay instead
          title: undefined,
          color: { background: backgroundColor, border: borderColor },
          font: { size: 11, color: '#333', strokeWidth: 2, strokeColor: '#fff', vadjust: 0 },
          shape: 'box',
          shapeProperties: { borderRadius: 10 },
          margin: 6,
          size: 20,
          nodeType: 'prefix',
          prefix: value,
          level: hopNumber,
          
          physics: false,
          fixed: { x: false, y: false }
        };
      });
    } else if (type === 'asn') {
      addNodeOnce(key, (id) => {
        nodeDetails.set(id, list);
  list.forEach(d => addPathMapping(id, d.pathId || `${d.destination}-${d.pathType}`));
          // Use the collapsed step from the key (hopNumber parsed above) so
          // ordering aligns with ASN aggregation steps and timeout placement.
          // Original hop indices are still preserved in `list` for the drawer.
          const collapsedStep = Number.isFinite(hopNumber) ? hopNumber : 0;
        const uniqueIps = new Set(list.filter(d => d.ip && !d.is_timeout).map(d => d.ip));
        const count = uniqueIps.size || 1;
        const label = `${value} (${count}) ▸`;
        const containsDestination = list.some(d => d.destinationReached && !d.is_timeout);
        
        // Get destination color for terminal ASN nodes
        let backgroundColor = '#9C27B0';
        let borderColor = containsDestination ? '#0c7237ff' : '#D32F2F';
        
        if (containsDestination) {
          // Find the destination for this terminal ASN
          const terminalDetail = list.find(d => d.destinationReached && !d.is_timeout);
          if (terminalDetail?.destination) {
            const destIndex = selectedDestinations.indexOf(terminalDetail.destination);
            if (destIndex >= 0) {
              // Use a lighter version of destination color for ASN nodes
              backgroundColor = generateDestinationColor(destIndex, 60, 60); // Medium saturation/lightness
              borderColor = generateDestinationColor(destIndex, 80, 35); // Darker border
            }
          }
        }
        
    return {
          id,
          label: `🏢 ${label}`,
      // Remove default vis tooltip; use custom overlay instead
      title: undefined,
          color: { background: backgroundColor, border: borderColor },
          font: { size: 11, color: '#fff', strokeWidth: 2, strokeColor: '#333', vadjust: 0 },
          shape: 'box',
          shapeProperties: { borderRadius: 10 },
          margin: 6,
          size: 22,
          nodeType: 'asn',
          asnGroup: value,
            level: collapsedStep,
          
          physics: false,
          fixed: { x: false, y: false }
        };
      });
    }
  });

  // Pass 3: build edges per path using the same keys we used for nodes
  const edgeUsage = new Map(); // key -> { destinations:Set, colors:Set, paths:Set, pathColors: Map<pathId,color> }
  const addEdgeUsage = (fromId, toId, dest, color, pathId) => {
    const k = `${fromId}->${toId}`;
    if (!edgeUsage.has(k)) edgeUsage.set(k, { destinations: new Set(), colors: new Set(), paths: new Set(), pathColors: new Map() });
    const u = edgeUsage.get(k);
    u.destinations.add(dest);
    u.colors.add(color);
    u.paths.add(pathId);
    // Track the representative color for this specific path
    if (pathId) u.pathColors.set(pathId, color);
  };

  pathDescriptors.forEach(({ destination, destColor, pathId, hops }) => {
    // Pre-compute step mapping for hierarchy prefix collapsing (per-path),
    // mirroring the detail pass so nodes and edges agree.
    let prefixStepByIdx = null;
    const asnEnabled = (aggregationMode === 'asn' || networkHierarchy === 'asn');
    const hierarchyEnabled = (networkHierarchy !== 'none' && networkHierarchy !== 'asn');
    if (hierarchyEnabled && !asnEnabled && showPrefixAggregation) {
      prefixStepByIdx = [];
      let step = 0;
      let prevType = null;
      let prevPrefix = null;
      for (let i = 0; i < hops.length; i++) {
        const h = hops[i];
        const ip = h?.ip;
        const timeoutish = !h || h.is_timeout || !ip || !isIPv6(ip);
        if (timeoutish) {
          step += 1; prefixStepByIdx[i] = step; prevType = 'timeout'; prevPrefix = null; continue;
        }
        const prefix = getHierarchyPrefix(ip, networkHierarchy, dataTransformer);
        const isExpanded = expandedPrefixes?.has(prefix);
        if (!isExpanded) {
          if (prevType === 'prefix' && prevPrefix === prefix) {
            prefixStepByIdx[i] = step;
          } else {
            step += 1; prefixStepByIdx[i] = step; prevType = 'prefix'; prevPrefix = prefix;
          }
        } else {
          step += 1; prefixStepByIdx[i] = step; prevType = 'ip'; prevPrefix = null;
        }
      }
    }

    const keyForHop = (hop, idx) => {
      const hopNumber = hop?.hop_number ?? (idx + 1);

      const resolveTimeoutKey = (baseKeyWithMaybeP) => {
        if (aggregationMode === 'none') return `${baseKeyWithMaybeP}@p:${pathId}`;
        return baseKeyWithMaybeP;
      };

      // Network hierarchy first (IPv6-only), except when ASN grouping is enabled
  if (networkHierarchy !== 'none' && !asnEnabled) {
        if (!hop || hop.is_timeout || !hop.ip) {
          // Even when hierarchy is active, honor shared-ips requirement: per-destination timeout grouping
          const step = (prefixStepByIdx && prefixStepByIdx[idx]) ? prefixStepByIdx[idx] : hopNumber;
          const base = (aggregationMode === 'shared-ips')
            ? `timeout@d:${destination}@h:${step}`
            : ((aggregationScope === 'cross-destination')
                ? `timeout@h:${step}`
                : `timeout@d:${destination}@h:${step}`);
          return resolveTimeoutKey(base);
        }
        if (!isIPv6(hop.ip)) {
          const step = (prefixStepByIdx && prefixStepByIdx[idx]) ? prefixStepByIdx[idx] : hopNumber;
          const base = (aggregationScope === 'cross-destination')
            ? `timeout@h:${step}`
            : `timeout@d:${destination}@h:${step}`;
          return resolveTimeoutKey(base);
        }
        const prefix = getHierarchyPrefix(hop.ip, networkHierarchy, dataTransformer);
        const isExpanded = expandedPrefixes?.has(prefix);
        const collapseByPrefix = showPrefixAggregation && !isExpanded;
        if (collapseByPrefix) {
          // Collapsed hierarchy prefix: use step-based monotonic index
          const step = (prefixStepByIdx && prefixStepByIdx[idx]) ? prefixStepByIdx[idx] : hopNumber;
          const base = getCollapsedPrefixKey(prefix, step, destination, aggregationScope, pathId, aggregationMode);
          return base;
        }
        // Expanded (or grouping disabled): keep IP nodes
        const step = (prefixStepByIdx && prefixStepByIdx[idx]) ? prefixStepByIdx[idx] : hopNumber;
        if (aggregationMode === 'none') {
          return (aggregationScope === 'cross-destination')
            ? `ip:${hop.ip}@h:${step}@p:${pathId}`
            : `ip:${hop.ip}@d:${destination}@h:${step}@p:${pathId}`;
        } else {
          return (aggregationScope === 'cross-destination')
            ? `ip:${hop.ip}@h:${step}`
            : `ip:${hop.ip}@d:${destination}@h:${step}`;
        }
      }

  // ASN aggregation (takes precedence when selected)
  if (asnEnabled) {
        // Compute collapsed step on the fly (same as in details pass)
        let step = 0;
        let prevType = null;
        let prevAsn = null;
        for (let i = 0; i <= idx; i++) {
          const h = hops[i];
          const ip = h?.ip;
          const timeoutish = !h || h.is_timeout || !ip || !isIPv6(ip);
          if (timeoutish) { step += 1; prevType = 'timeout'; prevAsn = null; continue; }
          const hasAsn = (typeof h?.asn === 'number' || (typeof h?.asn === 'string' && String(h.asn).trim() !== ''));
          if (hasAsn) {
            const a = String(h.asn).trim();
            if (prevType === 'asn' && prevAsn === a) {
              // same step
            } else { step += 1; prevType = 'asn'; prevAsn = a; }
          } else {
            step += 1; prevType = 'ip'; prevAsn = null;
          }
        }

        // If current hop is timeout or non-IPv6, emit a timeout key at the collapsed step.
        const timeoutish = !hop || hop.is_timeout || !hop.ip || !isIPv6(hop.ip);
        if (timeoutish) {
          // In Shared IPs, timeouts remain per-destination even though IPs are cross-destination
          const perDestTimeout = (aggregationMode === 'shared-ips') || (aggregationScope !== 'cross-destination');
          const base = perDestTimeout ? `timeout@d:${destination}@h:${step}` : `timeout@h:${step}`;
          return (aggregationMode === 'none') ? `${base}@p:${pathId}` : base;
        }

        const asnVal = (typeof hop?.asn === 'number' || typeof hop?.asn === 'string') ? String(hop.asn).trim() : null;
        if (asnVal) {
          const asnGroup = `AS${asnVal}`;
          const collapsed = !expandedAsnGroups?.has(asnGroup);
          if (collapsed) {
            // Keep step in key; ID mapping dedupes for Shared IPs
            const base = (aggregationScope === 'cross-destination')
              ? `asn:${asnGroup}@h:${step}`
              : `asn:${asnGroup}@d:${destination}@h:${step}`;
            return (aggregationMode === 'none') ? `${base}@p:${pathId}` : base;
          }
          // Expanded → underlying IP nodes; keep per-run identity in Show All Paths
          const base = (aggregationScope === 'cross-destination')
            ? `ip:${hop.ip}@h:${step}`
            : `ip:${hop.ip}@d:${destination}@h:${step}`;
          return (aggregationMode === 'none') ? `${base}@p:${pathId}` : base;
        }
        // No ASN → leave as IP node at this step
        const base = (aggregationScope === 'cross-destination')
          ? `ip:${hop.ip}@h:${step}`
          : `ip:${hop.ip}@d:${destination}@h:${step}`;
        return (aggregationMode === 'none') ? `${base}@p:${pathId}` : base;
      }

      // Timeouts (non-hierarchy)
      if (!hop || hop.is_timeout || !hop.ip || !isIPv6(hop.ip)) {
        if (aggregationMode === 'none') {
          return resolveTimeoutKey(`timeout@d:${destination}@h:${hopNumber}`);
        } else if (aggregationMode === 'shared-ips') {
          // For shared-ips, timeouts are per-destination even though IP nodes are cross-destination
          return `timeout@d:${destination}@h:${hopNumber}`;
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
  }
      // 'prefix' mode without hierarchy base
      return (aggregationScope === 'cross-destination')
        ? `ip:${hop.ip}@h:${hopNumber}`
        : `ip:${hop.ip}@d:${destination}@h:${hopNumber}`;
    };

    // 1) Build raw node id sequence
  const rawIds = [];
  // (no-op flag removed)
    hops.forEach((hop, idx) => {
      const key = keyForHop(hop, idx);
      const id = getOrCreateNodeId(key);
      rawIds.push(id);
  // (no-op)
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

    // 3) Add edges along the compressed sequence (start from first hop)
    for (let i = 0; i < seq.length - 1; i++) {
      const fromId = seq[i];
      const toId = seq[i + 1];
      addEdgeUsage(fromId, toId, destination, destColor, pathId);
    }

    // If after compression there is only one node in the path, ensure it's rendered as a dot
    if (seq.length === 1) {
      const loneNodeId = seq[0];
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
    const colors = Array.from(usage.colors);
    const destinationLines = Array.from(usage.destinations).map(d => {
      const dom =
        filteredData?.[d]?.domain?.name ||
        filteredData?.[d]?.domainName ||
        null;
      return { address: d, domain: dom };
    });
  // Native tooltip removed; destination lines kept on edge object for custom UI only
  // vis native tooltip disabled; keep only custom overlays

    const straightLineStyle = { type: 'continuous', roundness: 0.0, forceDirection: 'horizontal' };
    const normalCurveStyle = { type: 'continuous', roundness: 0.4, forceDirection: 'horizontal' };

    const pathIds = Array.from(usage.paths);
    // Always emit one edge per path so rendered edge count matches path count
    pathIds.forEach((pid, idx) => {
      const eid = `edge_${edgeId++}`;
      const col = usage.pathColors.get(pid) || colors[0] || '#999';
      
      // Find protocol and domain information for this path
      const pathProtocols = [];
      const pathDestinations = [];
      const pathDomains = [];
      
      // Search through all path descriptors to find this path ID
      pathDescriptors.forEach(({ destination, destColor, pathId: descPathId, protocol, domain }) => {
        if (descPathId === pid) {
          if (protocol) {
            pathProtocols.push(protocol);
          }
          pathDestinations.push(destination);
          if (domain) {
            pathDomains.push(domain);
          }
        }
      });
      
      // Debug logging to verify data
      if (pathProtocols.length > 0 || pathDomains.length > 0) {
        console.log(`Edge ${eid} (path ${pid}):`, {
          protocols: pathProtocols,
          domains: pathDomains,
          destinations: pathDestinations
        });
      }
      
      edges.push({
        id: eid,
        from, to,
        color: { color: col, opacity: 1 },
        width: 2,
        arrows: 'to',
        // If multiple paths share the segment, apply slight curvature per index
        smooth: pathIds.length > 1 ? curvedForIndex(idx, pathIds.length) : (isAggregated ? straightLineStyle : normalCurveStyle),
        dashes: false,
        arrowStrikethrough: false,
        // Disable vis-network native tooltip; we use custom overlays
        title: undefined,
        destinations: destinationLines,
        paths: [pid],
        // Add protocol and domain information
        protocols: [...new Set(pathProtocols)], // Remove duplicates
        pathDestinations: [...new Set(pathDestinations)],
        pathDomains: [...new Set(pathDomains)]
      });
      if (!pathMapping.has(eid)) pathMapping.set(eid, new Set());
      pathMapping.get(eid).add(pid);
    });
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
