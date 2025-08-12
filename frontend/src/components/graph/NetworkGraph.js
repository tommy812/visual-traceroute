import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Graph from 'react-graph-vis';
import dataTransformer from '../../services/dataTransformer';
import ipGeoService from '../../services/ipGeoService';
import GraphControls from './GraphControls';

import { useGraphData } from '../../hooks/useGraphData';
import { usePathHighlighting, useGraphFullscreen, useGraphExport } from '../../hooks';
import { minimizeCrossings } from '../../utils/minimizeCrossingsUtils';
import { generateDestinationColor } from '../../utils/colorUtils';
import { curvedForIndex } from '../../utils/edges';


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
  selectedProtocol = ''
}) => {
  // Store network instance for zoom controls
  const [networkInstance, setNetworkInstance] = useState(null);
  const [expandedPrefixes, setExpandedPrefixes] = useState(new Set()); // Track expanded prefix groups
  const [showPrefixAggregation, setShowPrefixAggregation] = useState(false); // Toggle prefix aggregation
  const graphContainerRef = useRef(null); // Ref for capturing the graph
  const { isFullscreen, dimensions, toggleFullscreen, containerStyle } = useGraphFullscreen();
  const networkRef = useRef(null);
  const { filteredData: filteredByHook } = useGraphData(pathData, {
    minRTT,
    maxRTT,
    minUsagePercent,
    selectedPathTypes,
    showPrimaryOnly,
    selectedProtocol
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
      selectedProtocol || '',           // ADD: ensure remount on protocol change
      // Remove highlightedPaths from key to prevent remounting on selection
      isFullscreen.toString(),
      `${dimensions.width}x${dimensions.height}`,
      Array.from(expandedPrefixes).sort().join(','),
      showPrefixAggregation.toString()
    ];
    return keyParts.join('|');
  }, [selectedDestinations, dateRange, showPrimaryOnly, minRTT, maxRTT, minUsagePercent, selectedPathTypes, selectedProtocol, isFullscreen, dimensions, expandedPrefixes, showPrefixAggregation]);



  // Memoize the graph data creation to prevent unnecessary re-renders
  const { graph, nodeDetails, pathMapping } = useMemo(() => {
    console.log('Creating graph with key:', graphKey);

    // Filter data based on selected destinations, date range, and other filters
    const getFilteredData = () => {
      if (!filteredByHook || !selectedDestinations || selectedDestinations.length === 0) {
        return {};
      }

      const filtered = {};
      Object.entries(filteredByHook).forEach(([destination, data]) => {
        if (selectedDestinations.includes(destination)) {
          // Apply only date-window filtering here (protocol/RTT/usage/path-types already applied in hook)
          let filteredData = { ...data };

          // Primary path: require existence and date match
          let includePrimary = false;
          if (data.primary_path) {
            includePrimary = true;
            if (dateRange.start && dateRange.end) {
              const ts = new Date(data.primary_path.timeStamp).getTime?.() || new Date(data.primary_path.timeStamp).valueOf();
              const startTime = dateRange.start.getTime();
              const endTime = dateRange.end.getTime();
              includePrimary = ts >= startTime && ts <= endTime;
            }
          }

          // Alternatives: date-window filter only; default to []
          const validAlternatives = (Array.isArray(data.alternatives) ? data.alternatives : []).filter(altPath => {
            if (!(dateRange.start && dateRange.end)) return true;
            const ts = new Date(altPath.timeStamp).getTime?.() || new Date(altPath.timeStamp).valueOf();
            const startTime = dateRange.start.getTime();
            const endTime = dateRange.end.getTime();
            return ts >= startTime && ts <= endTime;
          });

          // Include destination if primary is in-window or any alternative remains
          if (includePrimary || validAlternatives.length > 0) {
            filteredData.alternatives = validAlternatives;
            filteredData.includePrimary = includePrimary;
            filtered[destination] = filteredData;
          }
        }
      });

      return filtered;
    };

    // Function to create graph data from filtered path data
    const createGraphData = () => {
      const filteredData = getFilteredData();

      if (Object.keys(filteredData).length === 0) {
        console.log('No filtered data available');
        return { nodes: [], edges: [], nodeDetails: new Map(), pathMapping: new Map() };
      }

      const nodes = [];
      const edges = [];
      const nodeDetails = new Map();
      const pathMapping = new Map(); // Maps nodes/edges to paths they belong to
      const edgeUsage = new Map(); // Track which destinations use each edge

      // Use a deterministic ID generation system based on content
      const nodeIdMap = new Map();
      let nodeIdCounter = 1;

      // Track all hop details for each IP across all paths
      const ipToHopDetails = new Map();

      console.log('Creating graph data for destinations:', Object.keys(filteredData));

      // Helper function to get or create a unique node ID based on content
      const getOrCreateNodeId = (key) => {
        if (nodeIdMap.has(key)) {
          return nodeIdMap.get(key);
        }
        const id = nodeIdCounter++;
        nodeIdMap.set(key, id);
        return id;
      };

      // Helper function to create edge key for tracking usage
      const createEdgeKey = (from, to) => `${from}->${to}`;

      // Add source node with a fixed ID
      const sourceId = getOrCreateNodeId('source');
      nodes.push({
        id: sourceId,
        label: "Source",
        title: "Starting point for all network paths",
        color: {
          background: "#97C2FC",
          border: "#2B7CE9"
        },
        font: {
          size: 12,
          color: '#333333',
          strokeWidth: 2,
          strokeColor: '#ffffff'
        },
        shape: "dot",
        size: 20,
        nodeType: "source",
        level: 0, // Assign explicit level for better layout
        x: 0, // Starting position
        physics: false // Fix source position
      });

      // First pass: Collect all unique IPs and their hop details from all paths, including null hops
      const allUniqueIPs = new Set();
      const allTimeouts = new Set(); // Track timeout hops
      const ipLevelMap = new Map(); // Track the level (hop position) for each IP

      Object.entries(filteredData).forEach(([destination, destData]) => {
        // Primary path IPs (only if included)
        if (destData.includePrimary !== false) {
          destData.primary_path.path.forEach((hopObj, hopIndex) => {
            if (hopObj.is_timeout || !hopObj.ip || hopObj.ip === 'null' || hopObj.ip === null) {
              // Handle timeout hops
              const timeoutKey = `timeout_${hopObj.hop_number || (hopIndex + 1)}_${destination}_primary`;
              allTimeouts.add(timeoutKey);

              if (!ipToHopDetails.has(timeoutKey)) {
                ipToHopDetails.set(timeoutKey, []);
              }

              ipToHopDetails.get(timeoutKey).push({
                ip: null,
                hostname: hopObj.hostname,
                rtt_ms: hopObj.rtt_ms,
                avgRtt: hopObj.rtt_ms && hopObj.rtt_ms.length > 0 ? (hopObj.rtt_ms.reduce((a, b) => a + b, 0) / hopObj.rtt_ms.length).toFixed(2) : 'N/A',
                destination: destination,
                hopNumber: hopObj.hop_number || (hopIndex + 1),
                pathType: "PRIMARY",
                pathPercent: destData.primary_path.percent,
                pathCount: destData.primary_path.count,
                totalTraces: destData.total_traces,
                pathAvgRtt: destData.primary_path.avg_rtt,
                timestamp: destData.primary_path.timeStamp,
                protocol: destData.primary_path?.protocol || null,
                is_timeout: true
              });

              // Track the minimum level for this timeout
              const currentLevel = hopIndex + 1;
              if (!ipLevelMap.has(timeoutKey) || ipLevelMap.get(timeoutKey) > currentLevel) {
                ipLevelMap.set(timeoutKey, currentLevel);
              }
            } else {
              // Handle regular hops
              allUniqueIPs.add(hopObj.ip);

              // Track the minimum level (earliest appearance) for this IP
              const currentLevel = hopIndex + 1;
              if (!ipLevelMap.has(hopObj.ip) || ipLevelMap.get(hopObj.ip) > currentLevel) {
                ipLevelMap.set(hopObj.ip, currentLevel);
              }

              // Store hop details for this specific occurrence
              if (!ipToHopDetails.has(hopObj.ip)) {
                ipToHopDetails.set(hopObj.ip, []);
              }

              ipToHopDetails.get(hopObj.ip).push({
                ip: hopObj.ip,
                hostname: hopObj.hostname,
                rtt_ms: hopObj.rtt_ms,
                avgRtt: hopObj.rtt_ms && hopObj.rtt_ms.length > 0 ? (hopObj.rtt_ms.reduce((a, b) => a + b, 0) / hopObj.rtt_ms.length).toFixed(2) : 'N/A',
                destination: destination,
                hopNumber: hopObj.hop_number || (hopIndex + 1),
                pathType: "PRIMARY",
                pathPercent: destData.primary_path.percent,
                pathCount: destData.primary_path.count,
                totalTraces: destData.total_traces,
                pathAvgRtt: destData.primary_path.avg_rtt,
                timestamp: destData.primary_path.timeStamp,
                protocol: destData.primary_path?.protocol || null
              });
            }
          });
        }

        // Alternative path IPs (if not showPrimaryOnly)
        if (!showPrimaryOnly) {
          destData.alternatives.forEach((altPath, altIndex) => {
            altPath.path.forEach((hopObj, hopIndex) => {
              if (hopObj.is_timeout || !hopObj.ip || hopObj.ip === 'null' || hopObj.ip === null) {
                // Handle timeout hops
                const timeoutKey = `timeout_${hopObj.hop_number || (hopIndex + 1)}_${destination}_alt${altIndex}`;
                allTimeouts.add(timeoutKey);

                if (!ipToHopDetails.has(timeoutKey)) {
                  ipToHopDetails.set(timeoutKey, []);
                }

                ipToHopDetails.get(timeoutKey).push({
                  ip: null,
                  hostname: hopObj.hostname,
                  rtt_ms: hopObj.rtt_ms,
                  avgRtt: hopObj.rtt_ms && hopObj.rtt_ms.length > 0 ? (hopObj.rtt_ms.reduce((a, b) => a + b, 0) / hopObj.rtt_ms.length).toFixed(2) : 'N/A',
                  destination: destination,
                  hopNumber: hopObj.hop_number || (hopIndex + 1),
                  pathType: `ALTERNATIVE ${altIndex + 1}`,
                  pathPercent: altPath.percent,
                  pathCount: altPath.count,
                  totalTraces: destData.total_traces,
                  pathAvgRtt: altPath.avg_rtt,
                  timestamp: altPath.timeStamp,
                  protocol: altPath?.protocol || null,
                  is_timeout: true

                });

                // Track the minimum level for this timeout
                const currentLevel = hopIndex + 1;
                if (!ipLevelMap.has(timeoutKey) || ipLevelMap.get(timeoutKey) > currentLevel) {
                  ipLevelMap.set(timeoutKey, currentLevel);
                }
              } else {
                // Handle regular hops
                allUniqueIPs.add(hopObj.ip);

                // Track the minimum level (earliest appearance) for this IP
                const currentLevel = hopIndex + 1;
                if (!ipLevelMap.has(hopObj.ip) || ipLevelMap.get(hopObj.ip) > currentLevel) {
                  ipLevelMap.set(hopObj.ip, currentLevel);
                }

                if (!ipToHopDetails.has(hopObj.ip)) {
                  ipToHopDetails.set(hopObj.ip, []);
                }

                ipToHopDetails.get(hopObj.ip).push({
                  ip: hopObj.ip,
                  hostname: hopObj.hostname,
                  rtt_ms: hopObj.rtt_ms,
                  avgRtt: hopObj.rtt_ms && hopObj.rtt_ms.length > 0 ? (hopObj.rtt_ms.reduce((a, b) => a + b, 0) / hopObj.rtt_ms.length).toFixed(2) : 'N/A',
                  destination: destination,
                  hopNumber: hopObj.hop_number || (hopIndex + 1),
                  pathType: `ALTERNATIVE ${altIndex + 1}`,
                  pathPercent: altPath.percent,
                  pathCount: altPath.count,
                  totalTraces: destData.total_traces,
                  pathAvgRtt: altPath.avg_rtt,
                  timestamp: altPath.timeStamp,
                  protocol: altPath?.protocol || null,
                });
              }
            });
          });
        }
      });

      console.log('Found unique IPs:', Array.from(allUniqueIPs));
      console.log('Found timeout hops:', Array.from(allTimeouts));

      // Group IPs by network prefix if aggregation is enabled
      let ipGroups = {};
      let prefixGroups = {};
      let timeoutGroups = new Map(); // Track grouped consecutive timeouts

      if (showPrefixAggregation && allUniqueIPs.size > 0) {
        const ipsArray = Array.from(allUniqueIPs);
        prefixGroups = dataTransformer.groupByNetworkPrefix(ipsArray);

        // Create IP groups based on prefixes and expansion state
        Object.entries(prefixGroups).forEach(([prefix, ips]) => {
          if (ips.length > 1 && !expandedPrefixes.has(prefix)) {
            // Create prefix group node
            ipGroups[prefix] = {
              type: 'prefix',
              ips: ips,
              expanded: false
            };
          } else {
            // Show individual IPs (either single IP prefix or expanded)
            ips.forEach(ip => {
              ipGroups[ip] = {
                type: 'individual',
                ip: ip,
                prefix: prefix
              };
            });
          }
        });
      } else {
        // No aggregation - show all IPs individually
        allUniqueIPs.forEach(ip => {
          ipGroups[ip] = {
            type: 'individual',
            ip: ip
          };
        });
      }

      // Group consecutive timeouts if aggregation is enabled
      if (showPrefixAggregation) {
        // Group consecutive timeouts by path
        Object.entries(filteredData).forEach(([destination, destData]) => {
          // Process primary path
          if (destData.includePrimary !== false) {
            const timeouts = [];

            destData.primary_path.path.forEach((hopObj, hopIndex) => {
              if (hopObj.is_timeout || !hopObj.ip || hopObj.ip === 'null' || hopObj.ip === null) {
                const timeoutKey = `timeout_${hopObj.hop_number || (hopIndex + 1)}_${destination}_primary`;
                timeouts.push({
                  key: timeoutKey,
                  hopNumber: hopObj.hop_number || (hopIndex + 1),
                  level: hopIndex + 1,
                  hopObj: hopObj,
                  destination: destination,
                  pathType: "PRIMARY"
                });
              } else if (timeouts.length > 0) {
                // End of consecutive timeouts, create group if more than 1
                if (timeouts.length > 1) {
                  const groupKey = `timeout_group_${timeouts[0].hopNumber}_${timeouts[timeouts.length - 1].hopNumber}_${destination}_primary`;
                  timeoutGroups.set(groupKey, {
                    type: 'timeout_group',
                    timeouts: timeouts,
                    startHop: timeouts[0].hopNumber,
                    endHop: timeouts[timeouts.length - 1].hopNumber,
                    level: timeouts[0].level,
                    destination: destination,
                    pathType: "PRIMARY",
                    expanded: expandedPrefixes.has(groupKey)
                  });

                  // Remove individual timeouts from allTimeouts if they're grouped
                  timeouts.forEach(t => allTimeouts.delete(t.key));
                }
                timeouts.length = 0; // Reset
              }
            });

            // Handle timeouts at the end of path
            if (timeouts.length > 1) {
              const groupKey = `timeout_group_${timeouts[0].hopNumber}_${timeouts[timeouts.length - 1].hopNumber}_${destination}_primary`;
              timeoutGroups.set(groupKey, {
                type: 'timeout_group',
                timeouts: timeouts,
                startHop: timeouts[0].hopNumber,
                endHop: timeouts[timeouts.length - 1].hopNumber,
                level: timeouts[0].level,
                destination: destination,
                pathType: "PRIMARY",
                expanded: expandedPrefixes.has(groupKey)
              });

              timeouts.forEach(t => allTimeouts.delete(t.key));
            }
          }

          // Process alternative paths
          if (!showPrimaryOnly) {
            (destData.alternatives || []).forEach((altPath, altIndex) => {
              const timeouts = [];

              altPath.path.forEach((hopObj, hopIndex) => {
                if (hopObj.is_timeout || !hopObj.ip || hopObj.ip === 'null' || hopObj.ip === null) {
                  const timeoutKey = `timeout_${hopObj.hop_number || (hopIndex + 1)}_${destination}_alt${altIndex}`;
                  timeouts.push({
                    key: timeoutKey,
                    hopNumber: hopObj.hop_number || (hopIndex + 1),
                    level: hopIndex + 1,
                    hopObj: hopObj,
                    destination: destination,
                    pathType: `ALTERNATIVE ${altIndex + 1}`
                  });
                } else if (timeouts.length > 0) {
                  // End of consecutive timeouts, create group if more than 1
                  if (timeouts.length > 1) {
                    const groupKey = `timeout_group_${timeouts[0].hopNumber}_${timeouts[timeouts.length - 1].hopNumber}_${destination}_alt${altIndex}`;
                    timeoutGroups.set(groupKey, {
                      type: 'timeout_group',
                      timeouts: timeouts,
                      startHop: timeouts[0].hopNumber,
                      endHop: timeouts[timeouts.length - 1].hopNumber,
                      level: timeouts[0].level,
                      destination: destination,
                      pathType: `ALTERNATIVE ${altIndex + 1}`,
                      expanded: expandedPrefixes.has(groupKey)
                    });

                    timeouts.forEach(t => allTimeouts.delete(t.key));
                  }
                  timeouts.length = 0; // Reset
                }
              });

              // Handle timeouts at the end of path
              if (timeouts.length > 1) {
                const groupKey = `timeout_group_${timeouts[0].hopNumber}_${timeouts[timeouts.length - 1].hopNumber}_${destination}_alt${altIndex}`;
                timeoutGroups.set(groupKey, {
                  type: 'timeout_group',
                  timeouts: timeouts,
                  startHop: timeouts[0].hopNumber,
                  endHop: timeouts[timeouts.length - 1].hopNumber,
                  level: timeouts[0].level,
                  destination: destination,
                  pathType: `ALTERNATIVE ${altIndex + 1}`,
                  expanded: expandedPrefixes.has(groupKey)
                });

                timeouts.forEach(t => allTimeouts.delete(t.key));
              }
            });
          }
        });
      }

      // Advanced crossing minimization algorithm


      const optimizedPositions = minimizeCrossings({ ipLevelMap, ipToHopDetails, filteredData, expandedPrefixes });


      // Create nodes for IP groups and timeout nodes
      Object.entries(ipGroups).forEach(([key, groupInfo]) => {
        if (groupInfo.type === 'prefix') {
          // Create prefix group node
          const nodeId = getOrCreateNodeId(`prefix:${key}`);
          const nodeLevel = Math.min(...groupInfo.ips.map(ip => ipLevelMap.get(ip) || 1));

          // Aggregate details from all IPs in prefix
          const allDetails = [];
          groupInfo.ips.forEach(ip => {
            if (ipToHopDetails.has(ip)) {
              allDetails.push(...ipToHopDetails.get(ip));
            }
          });

          const destinations = new Set(allDetails.map(d => d.destination));
          const pathTypes = new Set(allDetails.map(d => d.pathType));

          nodes.push({
            id: nodeId,
            label: `${key}\n(${groupInfo.ips.length} IPs)`,
            title: `Network Prefix: ${key}\nContains ${groupInfo.ips.length} IP addresses\nUsed in ${destinations.size} destination(s), ${pathTypes.size} path type(s)\nClick to expand`,
            color: {
              background: "#FF9800",
              border: "#F57C00"
            },
            font: {
              size: 11,
              color: '#333333',
              strokeWidth: 2,
              strokeColor: '#ffffff'
            },
            shape: "box",
            size: 25,
            nodeType: "prefix",
            prefix: key,
            ips: groupInfo.ips,
            level: nodeLevel,
            physics: false
          });

          // Store aggregated details for this prefix node
          nodeDetails.set(nodeId, allDetails);

          // Map node to paths it belongs to
          allDetails.forEach(detail => {
            const pathId = `${detail.destination}-${detail.pathType}`;
            if (!pathMapping.has(nodeId)) {
              pathMapping.set(nodeId, new Set());
            }
            pathMapping.get(nodeId).add(pathId);
          });

        } else {
          // Create individual IP node
          const ip = groupInfo.ip;
          const nodeId = getOrCreateNodeId(`ip:${ip}`);
          const allHopDetails = ipToHopDetails.get(ip) || [];
          const nodeLevel = ipLevelMap.get(ip) || 1;

          const destinations = new Set(allHopDetails.map(h => h.destination));
          const pathTypes = new Set(allHopDetails.map(h => h.pathType));
          const firstHopDetails = allHopDetails[0];

          // Determine display label for the IP
          const displayLabel = firstHopDetails?.hostname || ip;

          nodes.push({
            id: nodeId,
            label: displayLabel,
            title: `IP: ${ip}\n${firstHopDetails?.hostname ? `Hostname: ${firstHopDetails.hostname}\n` : ''}Used in ${destinations.size} destination(s), ${pathTypes.size} path type(s)\nClick for detailed information`,
            color: {
              background: "#FFA726",
              border: "#FF8F00"
            },
            font: {
              size: 12,
              color: '#333333',
              strokeWidth: 2,
              strokeColor: '#ffffff'
            },
            shape: "dot",
            size: 20,
            nodeType: "hop",
            ip: ip,
            level: nodeLevel,
            physics: false
          });

          // Store all hop details for this node
          nodeDetails.set(nodeId, allHopDetails);

          // Map node to paths it belongs to
          allHopDetails.forEach(hopDetail => {
            const pathId = `${hopDetail.destination}-${hopDetail.pathType}`;
            if (!pathMapping.has(nodeId)) {
              pathMapping.set(nodeId, new Set());
            }
            pathMapping.get(nodeId).add(pathId);
          });
        }
      });

      // Create timeout group nodes
      timeoutGroups.forEach((groupInfo, groupKey) => {
        if (!groupInfo.expanded) {
          // Create grouped timeout node
          const nodeId = getOrCreateNodeId(`timeout_group:${groupKey}`);

          // Aggregate details from all timeouts in group
          const allDetails = [];
          groupInfo.timeouts.forEach(timeout => {
            if (ipToHopDetails.has(timeout.key)) {
              allDetails.push(...ipToHopDetails.get(timeout.key));
            }
          });

          const destinations = new Set(allDetails.map(d => d.destination));
          const pathTypes = new Set(allDetails.map(d => d.pathType));

          nodes.push({
            id: nodeId,
            label: `⏱️ ${groupInfo.timeouts.length} Timeouts`,
            title: `Consecutive Timeout Hops #${groupInfo.startHop}-${groupInfo.endHop}\n${groupInfo.timeouts.length} consecutive timeouts\nNo response from these ${groupInfo.timeouts.length} hops\nUsed in ${destinations.size} destination(s), ${pathTypes.size} path type(s)\nClick to expand or see details`,
            color: {
              background: "#D32F2F",
              border: "#8B0000"
            },
            font: {
              size: 11,
              color: '#FFFFFF',
              strokeWidth: 2,
              strokeColor: '#ffffff'
            },
            shape: "box",
            size: 25,
            nodeType: "timeout_group",
            timeoutGroup: groupKey,
            timeouts: groupInfo.timeouts,
            level: groupInfo.level,
            physics: false
          });

          // Store aggregated details for this timeout group
          nodeDetails.set(nodeId, allDetails);

          // Map node to paths it belongs to
          allDetails.forEach(detail => {
            const pathId = `${detail.destination}-${detail.pathType}`;
            if (!pathMapping.has(nodeId)) {
              pathMapping.set(nodeId, new Set());
            }
            pathMapping.get(nodeId).add(pathId);
          });
        } else {
          // Create individual timeout nodes when expanded
          groupInfo.timeouts.forEach(timeout => {
            const nodeId = getOrCreateNodeId(`timeout:${timeout.key}`);
            const allHopDetails = ipToHopDetails.get(timeout.key) || [];

            const destinations = new Set(allHopDetails.map(h => h.destination));
            const pathTypes = new Set(allHopDetails.map(h => h.pathType));

            nodes.push({
              id: nodeId,
              label: "⏱️ Timeout",
              title: `Timeout Hop #${timeout.hopNumber}\nNo response from this hop\nUsed in ${destinations.size} destination(s), ${pathTypes.size} path type(s)\nClick for detailed information`,
              color: {
                background: "#F44336",
                border: "#D32F2F"
              },
              font: {
                size: 12,
                color: '#FFFFFF',
                strokeWidth: 2,
                strokeColor: '#ffffff'
              },
              shape: "dot",
              size: 18,
              nodeType: "timeout",
              timeoutKey: timeout.key,
              level: timeout.level,
              physics: false
            });

            // Store hop details for this timeout node
            nodeDetails.set(nodeId, allHopDetails);

            // Map node to paths it belongs to
            allHopDetails.forEach(hopDetail => {
              const pathId = `${hopDetail.destination}-${hopDetail.pathType}`;
              if (!pathMapping.has(nodeId)) {
                pathMapping.set(nodeId, new Set());
              }
              pathMapping.get(nodeId).add(pathId);
            });
          });
        }
      });

      // Create timeout nodes
      allTimeouts.forEach(timeoutKey => {
        const nodeId = getOrCreateNodeId(`timeout:${timeoutKey}`);
        const allHopDetails = ipToHopDetails.get(timeoutKey) || [];
        const nodeLevel = ipLevelMap.get(timeoutKey) || 1;

        const destinations = new Set(allHopDetails.map(h => h.destination));
        const pathTypes = new Set(allHopDetails.map(h => h.pathType));
        const firstHopDetails = allHopDetails[0];

        nodes.push({
          id: nodeId,
          label: "⏱️ Timeout",
          title: `Timeout Hop #${firstHopDetails?.hopNumber || '?'}\nNo response from this hop\nUsed in ${destinations.size} destination(s), ${pathTypes.size} path type(s)\nClick for detailed information`,
          color: {
            background: "#F44336",
            border: "#D32F2F"
          },
          font: {
            size: 12,
            color: '#FFFFFF',
            strokeWidth: 2,
            strokeColor: '#ffffff'
          },
          shape: "dot",
          size: 18,
          nodeType: "timeout",
          timeoutKey: timeoutKey,
          level: nodeLevel,
          physics: false
        });

        // Store all hop details for this timeout node
        nodeDetails.set(nodeId, allHopDetails);

        // Map node to paths it belongs to
        allHopDetails.forEach(hopDetail => {
          const pathId = `${hopDetail.destination}-${hopDetail.pathType}`;
          if (!pathMapping.has(nodeId)) {
            pathMapping.set(nodeId, new Set());
          }
          pathMapping.get(nodeId).add(pathId);
        });
      });

      // Create destination nodes with proper level assignment
      const maxHopLevel = Math.max(...Array.from(ipLevelMap.values()), 0);
      const destinationLevel = maxHopLevel + 1;

      Object.keys(filteredData).forEach((destination, index) => {
        const nodeId = getOrCreateNodeId(`dest:${destination}`);
        const destData = filteredData[destination];

        const optimizedPosition = optimizedPositions.get(`dest:${destination}`) || index;

        //   id: nodeId,
        //   label: destination,
        //   title:
        //     `Destination: ${destination}\n` +
        //     `Total traces: ${destData.total_traces ?? 'N/A'}\n` +
        //     `Total paths: ${totalPaths}\n` +
        //     `Primary: ${destData.primary_path
        //       ? `${destData.primary_path.percent}% (${destData.primary_path.count} traces, avg ${destData.primary_path.avg_rtt}ms)`
        //       : 'N/A'}\n` +
        //     `Alternatives: ${showPrimaryOnly ? 'Hidden' : (destData.alternatives?.length || 0)}`,
        //   color: {
        //     background: destColor,
        //     border: "#333"
        //   },
        //   font: {
        //     size: 14,
        //     color: '#333333',
        //     strokeWidth: 2,
        //     strokeColor: '#ffffff'
        //   },
        //   shape: "box",
        //   size: 30,
        //   nodeType: "destination",
        //   level: destinationLevel,
        //   y: yPosition,
        //   physics: false,
        //   fixed: { x: false, y: true }
        // });

        // Map destination node to its paths

        const primaryPathId = `${destination}-PRIMARY`;
        if (!pathMapping.has(nodeId)) {
          pathMapping.set(nodeId, new Set());
        }
        if (destData.includePrimary !== false && destData.primary_path) {
          pathMapping.get(nodeId).add(primaryPathId);
        }

        (destData.alternatives || []).forEach((altPath, altIndex) => {
          const altPathId = `${destination}-ALTERNATIVE ${altIndex + 1}`;
          pathMapping.get(nodeId).add(altPathId);
        });

        console.log(`Created destination node for ${destination} with ID: ${nodeId}, level: ${destinationLevel}, position: ${optimizedPosition}`);
      });

      // Verify no duplicate IDs
      const nodeIds = nodes.map(n => n.id);
      const uniqueNodeIds = new Set(nodeIds);

      if (nodeIds.length !== uniqueNodeIds.size) {
        console.error('DUPLICATE NODE IDs DETECTED!');
        console.error('All node IDs:', nodeIds);
        console.error('Unique node IDs:', Array.from(uniqueNodeIds));

        // Find duplicates
        const duplicates = nodeIds.filter((id, index) => nodeIds.indexOf(id) !== index);
        console.error('Duplicate IDs:', duplicates);

        // Return empty graph to prevent vis.js error
        return { nodes: [], edges: [], nodeDetails: new Map(), pathMapping: new Map() };
      }

      console.log('All nodes created successfully. Total nodes:', nodes.length);

      // Create edges with multi-path color support
      Object.entries(filteredData).forEach(([destination, destData], destIndex) => {
        const destColorIndex = selectedDestinations.indexOf(destination);
        const destColor = generateDestinationColor(destColorIndex);

        // Primary path edges (only if included)
        if (destData.includePrimary !== false) {
          const primaryPath = destData.primary_path;
          const pathId = `${destination}-PRIMARY`;
          let lastNodeId = sourceId;

          primaryPath.path.forEach((hopObj, hopIndex) => {
            let currentNodeId;

            if (hopObj.is_timeout || !hopObj.ip || hopObj.ip === 'null' || hopObj.ip === null) {
              // Handle timeout hop - check if it's part of a group
              const timeoutKey = `timeout_${hopObj.hop_number || (hopIndex + 1)}_${destination}_primary`;

              // Check if this timeout is part of a grouped timeout
              let isGrouped = false;
              for (const [groupKey, groupInfo] of timeoutGroups) {
                if (groupInfo.timeouts.some(t => t.key === timeoutKey)) {
                  if (!groupInfo.expanded) {
                    // Use the group node
                    currentNodeId = getOrCreateNodeId(`timeout_group:${groupKey}`);
                    isGrouped = true;
                    break;
                  }
                }
              }

              if (!isGrouped) {
                // Use individual timeout node
                currentNodeId = getOrCreateNodeId(`timeout:${timeoutKey}`);
              }
            } else {
              // Handle regular hop - check if using prefix aggregation
              if (showPrefixAggregation) {
                const prefix = dataTransformer.getNetworkPrefix(hopObj.ip);
                const prefixIps = prefixGroups[prefix] || [hopObj.ip];

                if (prefixIps.length > 1 && !expandedPrefixes.has(prefix)) {
                  // Use prefix node
                  currentNodeId = getOrCreateNodeId(`prefix:${prefix}`);
                } else {
                  // Use individual IP node
                  currentNodeId = getOrCreateNodeId(`ip:${hopObj.ip}`);
                }
              } else {
                currentNodeId = getOrCreateNodeId(`ip:${hopObj.ip}`);
              }
            }

            const edgeKey = createEdgeKey(lastNodeId, currentNodeId);

            // Track edge usage by destination
            if (!edgeUsage.has(edgeKey)) {
              edgeUsage.set(edgeKey, { destinations: new Set(), colors: [], paths: new Set() });
            }

            const usage = edgeUsage.get(edgeKey);
            usage.destinations.add(destination);
            usage.colors.push(destColor);
            usage.paths.add(pathId);

            lastNodeId = currentNodeId;
          });
        }
        if (!showPrimaryOnly) {
          (destData.alternatives || []).forEach((altPath, altIndex) => {

            const pathId = `${destination}-ALTERNATIVE ${altIndex + 1}`;
            let lastNodeId = sourceId;

            altPath.path.forEach((hopObj, hopIndex) => {
              let currentNodeId;

              if (hopObj.is_timeout || !hopObj.ip || hopObj.ip === 'null' || hopObj.ip === null) {
                // Handle timeout hop - check if it's part of a group
                const timeoutKey = `timeout_${hopObj.hop_number || (hopIndex + 1)}_${destination}_alt${altIndex}`;

                // Check if this timeout is part of a grouped timeout
                let isGrouped = false;
                for (const [groupKey, groupInfo] of timeoutGroups) {
                  if (groupInfo.timeouts.some(t => t.key === timeoutKey)) {
                    if (!groupInfo.expanded) {
                      // Use the group node
                      currentNodeId = getOrCreateNodeId(`timeout_group:${groupKey}`);
                      isGrouped = true;
                      break;
                    }
                  }
                }

                if (!isGrouped) {
                  // Use individual timeout node
                  currentNodeId = getOrCreateNodeId(`timeout:${timeoutKey}`);
                }
              } else {
                // Handle regular hop - check if using prefix aggregation
                if (showPrefixAggregation) {
                  const prefix = dataTransformer.getNetworkPrefix(hopObj.ip);
                  const prefixIps = prefixGroups[prefix] || [hopObj.ip];

                  if (prefixIps.length > 1 && !expandedPrefixes.has(prefix)) {
                    // Use prefix node
                    currentNodeId = getOrCreateNodeId(`prefix:${prefix}`);
                  } else {
                    // Use individual IP node
                    currentNodeId = getOrCreateNodeId(`ip:${hopObj.ip}`);
                  }
                } else {
                  currentNodeId = getOrCreateNodeId(`ip:${hopObj.ip}`);
                }
              }

              const edgeKey = createEdgeKey(lastNodeId, currentNodeId);

              // Track edge usage by destination
              if (!edgeUsage.has(edgeKey)) {
                edgeUsage.set(edgeKey, { destinations: new Set(), colors: [], paths: new Set() });
              }

              const usage = edgeUsage.get(edgeKey);
              usage.destinations.add(destination);
              usage.colors.push(destColor);
              usage.paths.add(pathId);

              lastNodeId = currentNodeId;
            });


          });
        };
      });

      // Now create actual edges with proper multi-path coloring
      let edgeId = 1;
      edgeUsage.forEach((usage, edgeKey) => {
        const [fromStr, toStr] = edgeKey.split('->');
        const fromId = parseInt(fromStr);
        const toId = parseInt(toStr);

        const uniqueColors = [...new Set(usage.colors)];
        const tooltip = `Used by: ${Array.from(usage.destinations).join(', ')}\nPaths: ${usage.paths.size}\nClick to highlight path`;


        if (uniqueColors.length <= 1) {
          // Single-color edge
          const edge = {
            id: `edge_${edgeId++}`,
            from: fromId,
            to: toId,
            color: { color: uniqueColors[0] || '#999', opacity: 1.0 },
            width: 2,
            arrows: "to",
            smooth: { type: "continuous", roundness: 0.0, forceDirection: "horizontal" },
            dashes: false,
            arrowStrikethrough: false, // keeps arrow visible on curved edges
            title: tooltip,
            paths: Array.from(usage.paths)
          };
          edges.push(edge);
          usage.paths.forEach(pathId => {
            const eid = edge.id;
            if (!pathMapping.has(eid)) pathMapping.set(eid, new Set());
            pathMapping.get(eid).add(pathId);
          });
        } else {
          // Multi-color: one parallel curved edge per color
          uniqueColors.forEach((col, idx) => {
            const eid = `edge_${edgeId++}`;
            const edge = {
              id: eid,
              from: fromId,
              to: toId,
              color: { color: col, opacity: 1.0 },
              width: 2,
              arrows: "to",
              smooth: curvedForIndex(idx, uniqueColors.length),
              dashes: false,
              arrowStrikethrough: false,
              title: tooltip,
              paths: Array.from(usage.paths)
            };
            edges.push(edge);

            usage.paths.forEach(pathId => {
              if (!pathMapping.has(eid)) pathMapping.set(eid, new Set());
              pathMapping.get(eid).add(pathId);
            });
          });
        }
      });

      console.log('Graph creation completed. Edges:', edges.length);
      return { nodes, edges, nodeDetails, pathMapping };
    };

    const { nodes, edges, nodeDetails, pathMapping } = createGraphData();
    return {
      graph: { nodes, edges },
      nodeDetails,
      pathMapping
    };
  }, [graphKey, filteredByHook, showPrimaryOnly, selectedDestinations, dateRange, expandedPrefixes, showPrefixAggregation]);

  const { highlightedGraph, highlightedPaths, highlightPath, clearHighlight } =
    usePathHighlighting({ graph, pathMapping });



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
        fixed: true,
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
      configure: { enabled: false }
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
              blockShifting: true,
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
              blockShifting: true,
              edgeMinimization: true,
              parentCentralization: false
            }
          },
          physics: { enabled: false },
          edges: {
            smooth: false, // Straight lines only
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
      event.preventDefault?.(); // Prevent default browser behavior
      const { nodes, edges } = event;
      if (nodes.length > 0) {
        const nodeId = nodes[0];
        const nodeData = nodeDetails.get(nodeId);

        // Handle prefix node clicks
        const node = graph.nodes.find(n => n.id === nodeId);
        if (node?.nodeType === 'prefix') {
          handlePrefixToggle(node.prefix);
          return;
        }

        // Handle timeout group node clicks
        if (node?.nodeType === 'timeout_group') {
          handlePrefixToggle(node.timeoutGroup);
          return;
        }

        if (nodeData && Array.isArray(nodeData)) {
          handleHopSelection(nodeData); // Use enhanced handler
          highlightPath(nodeId, 'node');
        }
      } else if (edges.length > 0) {
        const edgeId = edges[0];
        highlightPath(edgeId, 'edge');
      } else {
        // Clicked on background - clear selection
        onHopSelect(null);
        clearHighlight();
      }
    },
    click: function (event) {
      event.preventDefault?.(); // Prevent default browser behavior
      if (event.nodes.length === 0 && event.edges.length === 0) {
        onHopSelect(null);
        clearHighlight();
      }
    },
    hoverNode: function (event) {
      // Custom hover behavior if needed
    },
    hoverEdge: function (event) {
      // Show edge information on hover
    }
  }), [nodeDetails, handleHopSelection, clearHighlight, graph, handlePrefixToggle, highlightPath, onHopSelect]);

  // Memoize the getNetwork callback
  const getNetwork = useCallback((network) => {
    networkRef.current = network;
    setNetworkInstance(network);
  }, []);



  const { downloadAsPNG, downloadAsSVG } = useGraphExport({ networkInstance, graphContainerRef, graph });


  return (
    <div style={containerStyle} ref={graphContainerRef}>
      <GraphErrorBoundary>
        <Graph
          key={graphKey}
          graph={highlightedGraph}
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
        showPrefixAggregation={showPrefixAggregation}
        onTogglePrefixAggregation={handlePrefixAggregationToggle}
        expandedCount={expandedPrefixes.size}
        highlightedPaths={highlightedPaths}      // added
        onClearHighlight={clearHighlight}        // added
      />
    </div>
  );
});

NetworkGraph.displayName = 'NetworkGraph';

export default NetworkGraph;