import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Graph from 'react-graph-vis';
import dataTransformer from '../../services/dataTransformer';
import ipGeoService from '../../services/ipGeoService';

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
  const [highlightedPaths, setHighlightedPaths] = useState([]); // Changed to array for multiple paths
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [expandedPrefixes, setExpandedPrefixes] = useState(new Set()); // Track expanded prefix groups
  const [showPrefixAggregation, setShowPrefixAggregation] = useState(false); // Toggle prefix aggregation
  const graphContainerRef = useRef(null); // Ref for capturing the graph

  // Get viewport dimensions for fullscreen
  useEffect(() => {
    const updateDimensions = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight
      });
    };

    if (isFullscreen) {
      updateDimensions();
      window.addEventListener('resize', updateDimensions);
      return () => window.removeEventListener('resize', updateDimensions);
    }
  }, [isFullscreen]);

  // Define distinct colors for different highlighted paths
  const pathHighlightColors = useMemo(() => [
    "#FF6B35", // Vibrant Orange
    "#004E89", // Deep Blue
    "#009639", // Green
    "#7209B7", // Purple
    "#FF1654", // Red-Pink
    "#FF8500", // Orange
    "#0FA3B1", // Teal
    "#B5179E", // Magenta
    "#F72585", // Hot Pink
    "#4361EE"  // Blue-Purple
  ], []);

  // Helper function to adjust color intensity for alternative paths
  const adjustColorIntensity = useCallback((hexColor, intensity) => {
    // Convert hex to RGB
    const r = parseInt(hexColor.slice(1, 3), 16);
    const g = parseInt(hexColor.slice(3, 5), 16);
    const b = parseInt(hexColor.slice(5, 7), 16);
    
    // Mix with white to create lighter version
    const mixedR = Math.round(r * intensity + 255 * (1 - intensity));
    const mixedG = Math.round(g * intensity + 255 * (1 - intensity));
    const mixedB = Math.round(b * intensity + 255 * (1 - intensity));
    
    // Convert back to hex
    const toHex = (n) => n.toString(16).padStart(2, '0');
    return `#${toHex(mixedR)}${toHex(mixedG)}${toHex(mixedB)}`;
  }, []);

  // Memoize color generator to prevent recreation
  const generateDestinationColor = useCallback((index) => {
    const hue = (index * 137.5) % 360;
    const saturation = 65;
    const lightness = 55;
    
    const hslToHex = (h, s, l) => {
      l /= 100;
      const a = s * Math.min(l, 1 - l) / 100;
      const f = n => {
        const k = (n + h / 30) % 12;
        const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
        return Math.round(255 * color).toString(16).padStart(2, '0');
      };
      return `#${f(0)}${f(8)}${f(4)}`;
    };
    
    return hslToHex(hue, saturation, lightness);
  }, []);

  // Function to create multi-path edge color (gradient or pattern)
  const createMultiPathColor = useCallback((colors) => {
    if (colors.length === 1) {
      return { color: colors[0], opacity: 1.0 };
    }
    
    // For multiple colors, create a gradient effect by using the first color as primary
    // and indicating multiple paths through styling
    return {
      color: colors[0],
      opacity: 0.8,
      highlight: colors[1] || colors[0], // Different color on highlight
      hover: colors[colors.length - 1] || colors[0] // Another color on hover
    };
  }, []);

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
      // Remove highlightedPaths from key to prevent remounting on selection
      isFullscreen.toString(),
      `${dimensions.width}x${dimensions.height}`,
      Array.from(expandedPrefixes).sort().join(','),
      showPrefixAggregation.toString()
    ];
    return keyParts.join('|');
  }, [selectedDestinations, dateRange, showPrimaryOnly, minRTT, maxRTT, minUsagePercent, selectedPathTypes, isFullscreen, dimensions, expandedPrefixes, showPrefixAggregation]);

  // Enhanced highlighting logic - MOVED BEFORE GRAPH DATA CREATION
  const getNodeHighlightStyle = useCallback((nodeId) => {
    if (highlightedPaths.length === 0) return { isHighlighted: false, isDimmed: false, color: null };

    // Check if this node is in any highlighted path
    const relevantPaths = highlightedPaths.filter(p => p.nodes.includes(nodeId));
    
    if (relevantPaths.length > 0) {
      // Use the color of the first relevant path
      return {
        isHighlighted: true,
        isDimmed: false,
        color: relevantPaths[0].highlightColor
      };
    }

    // Check if there are any highlighted paths (for dimming)
    const hasHighlightedPaths = highlightedPaths.length > 0;
    return {
      isHighlighted: false,
      isDimmed: hasHighlightedPaths,
      color: null
    };
  }, [highlightedPaths]);

  const getEdgeHighlightStyle = useCallback((fromId, toId) => {
    if (highlightedPaths.length === 0) return { isHighlighted: false, isDimmed: false, colors: [], lineStyles: [] };

    // Check if this edge is in any highlighted path
    const relevantPaths = highlightedPaths.filter(p => 
      p.edges.some(e => e.from === fromId && e.to === toId)
    );
    
    if (relevantPaths.length > 0) {
      return {
        isHighlighted: true,
        isDimmed: false,
        colors: relevantPaths.map(p => p.highlightColor),
        lineStyles: relevantPaths.map(p => p.lineStyle),
        paths: relevantPaths
      };
    }

    // Check if there are any highlighted paths (for dimming)
    const hasHighlightedPaths = highlightedPaths.length > 0;
    return {
      isHighlighted: false,
      isDimmed: hasHighlightedPaths,
      colors: [],
      lineStyles: [],
      paths: []
    };
  }, [highlightedPaths]);

  // Memoize the graph data creation to prevent unnecessary re-renders
  const { graph, nodeDetails, pathMapping } = useMemo(() => {
    console.log('Creating graph with key:', graphKey);

    // Filter data based on selected destinations, date range, and other filters
    const getFilteredData = () => {
      if (!pathData || !selectedDestinations || selectedDestinations.length === 0) {
        console.log('No valid data or destinations selected');
        return {};
      }
      
      const filtered = {};
      Object.entries(pathData).forEach(([destination, data]) => {
        if (selectedDestinations.includes(destination)) {
          // Apply filters to the destination data
          let filteredData = { ...data };
          
          // Check if primary path meets criteria
          let includePrimary = true;
          if (dateRange.start && dateRange.end) {
            const primaryTimestamp = new Date(data.primary_path.timeStamp).getTime();
            const startTime = dateRange.start.getTime();
            const endTime = dateRange.end.getTime();
            includePrimary = primaryTimestamp >= startTime && primaryTimestamp <= endTime;
          }
          
          if (includePrimary) {
            const primaryMeetsRTT = (!minRTT || data.primary_path.avg_rtt >= parseFloat(minRTT)) &&
                                  (!maxRTT || data.primary_path.avg_rtt <= parseFloat(maxRTT));
            const primaryMeetsUsage = !minUsagePercent || data.primary_path.percent >= parseFloat(minUsagePercent);
            const primaryPathAllowed = selectedPathTypes.includes('PRIMARY');
            
            includePrimary = primaryMeetsRTT && primaryMeetsUsage && primaryPathAllowed;
          }
          
          // Filter alternative paths
          const validAlternatives = data.alternatives.filter(altPath => {
            let includeAlt = true;
            
            if (dateRange.start && dateRange.end) {
              const altTimestamp = new Date(altPath.timeStamp).getTime();
              const startTime = dateRange.start.getTime();
              const endTime = dateRange.end.getTime();
              includeAlt = altTimestamp >= startTime && altTimestamp <= endTime;
            }
            
            if (includeAlt) {
              const rttMeets = (!minRTT || altPath.avg_rtt >= parseFloat(minRTT)) &&
                              (!maxRTT || altPath.avg_rtt <= parseFloat(maxRTT));
              const usageMeets = !minUsagePercent || altPath.percent >= parseFloat(minUsagePercent);
              const pathTypeAllowed = selectedPathTypes.includes('ALTERNATIVE');
              
              includeAlt = rttMeets && usageMeets && pathTypeAllowed;
            }
            
            return includeAlt;
          });
          
          // Include destination if primary path is valid OR there are valid alternatives
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
              timestamp: destData.primary_path.timeStamp
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
                  timestamp: altPath.timeStamp
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
                timestamp: altPath.timeStamp
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
            destData.alternatives.forEach((altPath, altIndex) => {
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
      const minimizeCrossings = () => {
        // Step 1: Group nodes by level
        const levelGroups = new Map();
        ipLevelMap.forEach((level, ip) => {
          if (!levelGroups.has(level)) {
            levelGroups.set(level, []);
          }
          levelGroups.get(level).push(ip);
        });

        // Step 2: Analyze actual path connections
        const optimizedPositions = new Map();
        const maxLevel = Math.max(...Array.from(ipLevelMap.values()));
        const destinations = Object.keys(filteredData).sort();
        
        // Position destinations first
        destinations.forEach((dest, index) => {
          optimizedPositions.set(`dest:${dest}`, index);
        });

        // Work backwards through levels to minimize crossings
        for (let level = maxLevel; level >= 1; level--) {
          const currentLevelIPs = levelGroups.get(level) || [];
          if (currentLevelIPs.length === 0) continue;

          // Calculate optimal position for each IP based on its connections
          const ipWithPositions = currentLevelIPs.map(ip => {
            const hopDetails = ipToHopDetails.get(ip);
            let totalScore = 0;
            let connectionCount = 0;

            if (level === maxLevel) {
              // Connect to destinations - check which destinations this IP serves
              destinations.forEach((dest, destIndex) => {
                const connectsToDestination = hopDetails.some(detail => detail.destination === dest);
                if (connectsToDestination) {
                  totalScore += destIndex;
                  connectionCount += 1;
                }
              });
            } else {
              // Connect to next level - find which next-level nodes this connects to
              const nextLevelIPs = levelGroups.get(level + 1) || [];
              nextLevelIPs.forEach(nextIP => {
                // Check if there's a direct path connection
                const connects = hopDetails.some(detail => {
                  const destPaths = filteredData[detail.destination];
                  
                  // Check primary path
                  if (destPaths.includePrimary !== false) {
                    const pathHops = destPaths.primary_path.path;
                    const currentIndex = pathHops.findIndex(hop => hop.ip === ip);
                    const nextIndex = pathHops.findIndex(hop => hop.ip === nextIP);
                    if (currentIndex >= 0 && nextIndex === currentIndex + 1) return true;
                  }
                  
                  // Check alternative paths
                  return destPaths.alternatives.some(altPath => {
                    const pathHops = altPath.path;
                    const currentIndex = pathHops.findIndex(hop => hop.ip === ip);
                    const nextIndex = pathHops.findIndex(hop => hop.ip === nextIP);
                    return currentIndex >= 0 && nextIndex === currentIndex + 1;
                  });
                });
                
                if (connects) {
                  const nextIPPosition = optimizedPositions.get(`ip:${nextIP}`) || 0;
                  totalScore += nextIPPosition;
                  connectionCount += 1;
                }
              });
            }

            return {
              ip,
              averagePosition: connectionCount > 0 ? totalScore / connectionCount : currentLevelIPs.length / 2,
              connectionCount
            };
          });

          // Sort by average connection position
          ipWithPositions.sort((a, b) => a.averagePosition - b.averagePosition);

          // Assign positions
          ipWithPositions.forEach((item, index) => {
            optimizedPositions.set(`ip:${item.ip}`, index);
          });
        }

        return optimizedPositions;
      };

      const optimizedPositions = minimizeCrossings();

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
        // Use the index from selectedDestinations to match the list colors
        const destColorIndex = selectedDestinations.indexOf(destination);
        const destColor = generateDestinationColor(destColorIndex);
        const totalPaths = showPrimaryOnly ? 1 : (1 + destData.alternatives.length);

        // Use optimized position for destinations
        const optimizedPosition = optimizedPositions.get(`dest:${destination}`) || index;
        const spacing = 80;
        const yPosition = optimizedPosition * spacing - ((Object.keys(filteredData).length - 1) * spacing / 2);

        nodes.push({
          id: nodeId,
          label: destination,
          title: `Destination: ${destination}\nTotal traces: ${destData.total_traces}\nTotal paths: ${totalPaths}\nPrimary: ${destData.primary_path.percent}% (${destData.primary_path.count} traces)\nAlternatives: ${showPrimaryOnly ? 'Hidden' : destData.alternatives.length}`,
          color: { 
            background: destColor, 
            border: "#333"
          },
          font: {
            size: 14,
            color: '#333333',
            strokeWidth: 2,
            strokeColor: '#ffffff'
          },
          shape: "box",
          size: 30,
          nodeType: "destination",
          level: destinationLevel,
          y: yPosition,
          physics: false,
          fixed: { x: false, y: true }
        });

        // Map destination node to its paths
        const primaryPathId = `${destination}-PRIMARY`;
        if (!pathMapping.has(nodeId)) {
          pathMapping.set(nodeId, new Set());
        }
        pathMapping.get(nodeId).add(primaryPathId);
        
        destData.alternatives.forEach((altPath, altIndex) => {
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
        // Use the index from selectedDestinations to match the list colors
        const destColorIndex = selectedDestinations.indexOf(destination);
        const destColor = generateDestinationColor(destColorIndex);
        const destNodeId = getOrCreateNodeId(`dest:${destination}`);

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

          // Connect last hop to destination
          const finalEdgeKey = createEdgeKey(lastNodeId, destNodeId);
          if (!edgeUsage.has(finalEdgeKey)) {
            edgeUsage.set(finalEdgeKey, { destinations: new Set(), colors: [], paths: new Set() });
          }
          const finalUsage = edgeUsage.get(finalEdgeKey);
          finalUsage.destinations.add(destination);
          finalUsage.colors.push(destColor);
          finalUsage.paths.add(pathId);
        }

        // Alternative path edges (if not showPrimaryOnly)
        if (!showPrimaryOnly) {
          destData.alternatives.forEach((altPath, altIndex) => {
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

            // Connect last hop to destination
            const finalEdgeKey = createEdgeKey(lastNodeId, destNodeId);
            if (!edgeUsage.has(finalEdgeKey)) {
              edgeUsage.set(finalEdgeKey, { destinations: new Set(), colors: [], paths: new Set() });
            }
            const finalUsage = edgeUsage.get(finalEdgeKey);
            finalUsage.destinations.add(destination);
            finalUsage.colors.push(destColor);
            finalUsage.paths.add(pathId);
          });
        }
      });

      // Now create actual edges with proper multi-path coloring
      let edgeId = 1;
      edgeUsage.forEach((usage, edgeKey) => {
        const [fromStr, toStr] = edgeKey.split('->');
        const fromId = parseInt(fromStr);
        const toId = parseInt(toStr);
        
        const uniqueColors = [...new Set(usage.colors)];

        // Use normal edge styling (highlighting will be applied separately)
          const edgeColorObj = createMultiPathColor(uniqueColors);
        const edgeColor = edgeColorObj.color;
        const edgeDashes = uniqueColors.length > 1 ? [5, 5] : false;
        const edgeWidth = 2;

        // Create tooltip
        const tooltip = `Used by: ${Array.from(usage.destinations).join(', ')}\nPaths: ${usage.paths.size}\nClick to highlight path`;
        
        const edge = {
          id: `edge_${edgeId++}`,
          from: fromId,
          to: toId,
          color: {
            color: edgeColor,
            opacity: 1.0
          },
          width: edgeWidth,
          arrows: "to",
          smooth: { type: "continuous" },
          dashes: edgeDashes,
          title: tooltip,
          paths: Array.from(usage.paths)
        };

        edges.push(edge);

        // Map edge to paths
        usage.paths.forEach(pathId => {
          if (!pathMapping.has(`edge_${edgeId - 1}`)) {
            pathMapping.set(`edge_${edgeId - 1}`, new Set());
          }
          pathMapping.get(`edge_${edgeId - 1}`).add(pathId);
        });
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
  }, [graphKey, pathData, generateDestinationColor, showPrimaryOnly, createMultiPathColor, selectedDestinations, dateRange, minRTT, maxRTT, minUsagePercent, selectedPathTypes, expandedPrefixes, showPrefixAggregation]);

  // Function to trace ALL paths from a node/edge
  const traceAllPaths = useCallback((elementId, elementType) => {
    // Use the pathMapping from the main useMemo, not the local one
    if (!pathMapping || pathMapping.size === 0) return [];

    const paths = pathMapping.get(elementId);
    if (!paths || paths.size === 0) return [];

    // Get ALL paths that pass through this element
    const allTracedPaths = [];
    let colorIndex = 0;

    paths.forEach(pathId => {
      const [destination, pathType] = pathId.split('-', 2);
      const isPrimary = pathType === 'PRIMARY';
      
      // Find all nodes and edges that belong to this specific path
      const pathNodes = [];
      const pathEdges = [];

      // Collect all elements that belong to this specific path
      pathMapping.forEach((elementPaths, elementId) => {
        if (elementPaths.has(pathId)) {
          if (typeof elementId === 'string' && elementId.startsWith('edge_')) {
            // Find the actual edge object
            const edge = graph.edges.find(e => e.id === elementId);
            if (edge) {
              pathEdges.push({ from: edge.from, to: edge.to, id: edge.id });
            }
          } else {
            pathNodes.push(elementId);
          }
        }
      });

      // Assign a base color to this path
      const baseColor = pathHighlightColors[colorIndex % pathHighlightColors.length];
      
      // Adjust color intensity based on path type
      let highlightColor;
      if (isPrimary) {
        // Primary paths: use full intensity (stronger)
        highlightColor = baseColor;
      } else {
        // Alternative paths: use lighter version (reduce opacity/saturation)
        highlightColor = adjustColorIntensity(baseColor, 0.6); // 60% intensity
      }
      
      colorIndex++;

      // Ensure all required properties are present
      const pathObject = {
        id: pathId,
        destination: destination || "Unknown",
        pathType: pathType || "UNKNOWN",
        isPrimary,
        nodes: pathNodes || [],
        edges: pathEdges || [],
        highlightColor,
        lineStyle: isPrimary ? 'solid' : 'dashed'
      };

      allTracedPaths.push(pathObject);
    });

    return allTracedPaths;
  }, [pathMapping, graph, pathHighlightColors, adjustColorIntensity]);

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

  // Clear path highlighting
  const clearHighlight = useCallback(() => {
    setHighlightedPaths([]); // Clear all highlighted paths
  }, []);

  // Function to highlight paths based on element interaction
  const highlightPath = useCallback((elementId, elementType) => {
    const tracedPaths = traceAllPaths(elementId, elementType);
    // Ensure we only set valid paths
    const validPaths = tracedPaths.filter(path => path && typeof path === 'object');
    setHighlightedPaths(validPaths);
    console.log('Highlighting paths:', validPaths);
  }, [traceAllPaths]);

  // Toggle fullscreen
  const toggleFullscreen = useCallback(() => {
    setIsFullscreen(prev => !prev);
  }, []);

  // Download graph as PNG
  const downloadAsPNG = useCallback(() => {
    if (!graphContainerRef.current || !networkInstance) return;
    
    // Find the vis.js canvas element specifically
    const visCanvas = graphContainerRef.current.querySelector('canvas');
    if (!visCanvas) {
      alert('Graph not ready for export. Please try again.');
      return;
    }
    
    try {
      // Get all node positions to calculate bounds
      const nodeIds = graph.nodes.map(node => node.id);
      const positions = networkInstance.getPositions(nodeIds);
      
      if (Object.keys(positions).length === 0) {
        alert('Graph layout not ready. Please wait a moment and try again.');
        return;
      }
      
      // Calculate the bounding box of all nodes
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      
      Object.values(positions).forEach(pos => {
        minX = Math.min(minX, pos.x);
        maxX = Math.max(maxX, pos.x);
        minY = Math.min(minY, pos.y);
        maxY = Math.max(maxY, pos.y);
      });
      
      // Add padding around the content (node sizes + margin)
      const padding = 80;
      minX -= padding;
      maxX += padding;
      minY -= padding;
      maxY += padding;
      
      // High quality scale factor
      const scale = 3;
      
      // Get the network's current view
      const viewPosition = networkInstance.getViewPosition();
      const canvasScale = networkInstance.getScale();
      
      // Calculate the transform to center the content
      const canvasWidth = visCanvas.width;
      const canvasHeight = visCanvas.height;
      const centerX = canvasWidth / 2;
      const centerY = canvasHeight / 2;
      
      // Transform coordinates from network space to canvas space
      const canvasMinX = (minX - viewPosition.x) * canvasScale + centerX;
      const canvasMinY = (minY - viewPosition.y) * canvasScale + centerY;
      const canvasMaxX = (maxX - viewPosition.x) * canvasScale + centerX;
      const canvasMaxY = (maxY - viewPosition.y) * canvasScale + centerY;
      
      const canvasContentWidth = canvasMaxX - canvasMinX;
      const canvasContentHeight = canvasMaxY - canvasMinY;
      
      // Create high-resolution export canvas
      const exportCanvas = document.createElement('canvas');
      const ctx = exportCanvas.getContext('2d');
      
      exportCanvas.width = canvasContentWidth * scale;
      exportCanvas.height = canvasContentHeight * scale;
      
      // Fill with white background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
      
      // Enable high-quality rendering
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      
      // Scale and draw the cropped portion
      ctx.scale(scale, scale);
      ctx.drawImage(
        visCanvas,
        canvasMinX, canvasMinY, canvasContentWidth, canvasContentHeight, // Source crop
        0, 0, canvasContentWidth, canvasContentHeight // Destination
      );
      
      // Download the high-quality cropped image
      const link = document.createElement('a');
      link.download = `network-graph-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.png`;
      link.href = exportCanvas.toDataURL('image/png');
      link.click();
      
    } catch (error) {
      console.error('Error creating cropped PNG:', error);
      alert('Error creating PNG. Please try again.');
    }
  }, [networkInstance, graph]);

  // Download graph as SVG
  const downloadAsSVG = useCallback(() => {
    if (!graphContainerRef.current || !networkInstance) return;
    
    // Find the vis.js canvas element specifically
    const visCanvas = graphContainerRef.current.querySelector('canvas');
    if (!visCanvas) {
      alert('Graph not ready for export. Please try again.');
      return;
    }
    
    try {
      // Get all node positions to calculate bounds
      const nodeIds = graph.nodes.map(node => node.id);
      const positions = networkInstance.getPositions(nodeIds);
      
      if (Object.keys(positions).length === 0) {
        alert('Graph layout not ready. Please wait a moment and try again.');
        return;
      }
      
      // Calculate the bounding box of all nodes
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      
      Object.values(positions).forEach(pos => {
        minX = Math.min(minX, pos.x);
        maxX = Math.max(maxX, pos.x);
        minY = Math.min(minY, pos.y);
        maxY = Math.max(maxY, pos.y);
      });
      
      // Add padding around the content
      const padding = 80;
      minX -= padding;
      maxX += padding;
      minY -= padding;
      maxY += padding;
      
      // High quality scale factor
      const scale = 3;
      
      // Get the network's current view
      const viewPosition = networkInstance.getViewPosition();
      const canvasScale = networkInstance.getScale();
      
      // Calculate canvas coordinates
      const canvasWidth = visCanvas.width;
      const canvasHeight = visCanvas.height;
      const centerX = canvasWidth / 2;
      const centerY = canvasHeight / 2;
      
      const canvasMinX = (minX - viewPosition.x) * canvasScale + centerX;
      const canvasMinY = (minY - viewPosition.y) * canvasScale + centerY;
      const canvasMaxX = (maxX - viewPosition.x) * canvasScale + centerX;
      const canvasMaxY = (maxY - viewPosition.y) * canvasScale + centerY;
      
      const canvasContentWidth = canvasMaxX - canvasMinX;
      const canvasContentHeight = canvasMaxY - canvasMinY;
      
      // Create high-resolution cropped canvas
      const cleanCanvas = document.createElement('canvas');
      const ctx = cleanCanvas.getContext('2d');
      
      cleanCanvas.width = canvasContentWidth * scale;
      cleanCanvas.height = canvasContentHeight * scale;
      
      // Fill with white background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, cleanCanvas.width, cleanCanvas.height);
      
      // Enable high-quality rendering
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      
      // Scale and draw the cropped portion
      ctx.scale(scale, scale);
      ctx.drawImage(
        visCanvas,
        canvasMinX, canvasMinY, canvasContentWidth, canvasContentHeight,
        0, 0, canvasContentWidth, canvasContentHeight
      );
      
      // Create SVG with exact cropped dimensions
      const svgWidth = cleanCanvas.width;
      const svgHeight = cleanCanvas.height;
      const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}" 
     xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <rect width="100%" height="100%" fill="#ffffff"/>
  <image width="${svgWidth}" height="${svgHeight}" xlink:href="${cleanCanvas.toDataURL('image/png')}"/>
</svg>`;

      const blob = new Blob([svgContent], { type: 'image/svg+xml' });
      const link = document.createElement('a');
      link.download = `network-graph-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.svg`;
      link.href = URL.createObjectURL(blob);
      link.click();
      URL.revokeObjectURL(link.href);
      
    } catch (error) {
      console.error('Error creating cropped SVG:', error);
      alert('Error creating SVG. Please try again.');
    }
  }, [networkInstance, graph]);

  // Handle ESC key to exit fullscreen
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

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
      fixed:true,
      chosen: {
        node: function(values, id, selected, hovering) {
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

  switch(layoutOptimization) {
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
    select: function(event) {
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
    click: function(event) {
      event.preventDefault?.(); // Prevent default browser behavior
      if (event.nodes.length === 0 && event.edges.length === 0) {
        onHopSelect(null);
        clearHighlight();
      }
    },
    hoverNode: function(event) {
      // Custom hover behavior if needed
    },
    hoverEdge: function(event) {
      // Show edge information on hover
    }
  }), [nodeDetails, handleHopSelection, clearHighlight, graph, handlePrefixToggle, highlightPath, onHopSelect]);

  // Memoize the getNetwork callback
  const getNetwork = useCallback((network) => {
    setNetworkInstance(network);
  }, []);

  // Container style based on fullscreen state
  const containerStyle = useMemo(() => ({
    border: isFullscreen ? "none" : "1px solid #ccc",
    borderRadius: isFullscreen ? "0" : "8px",
    position: isFullscreen ? "fixed" : "relative",
    top: isFullscreen ? "0" : "auto",
    left: isFullscreen ? "0" : "auto",
    width: isFullscreen ? "100vw" : "100%",
    height: isFullscreen ? "100vh" : "100%",
    zIndex: isFullscreen ? 9999 : "auto",
    backgroundColor: isFullscreen ? "#fff" : "transparent",
    margin: isFullscreen ? "0" : "auto",
    padding: isFullscreen ? "0" : "auto",
    overflow: isFullscreen ? "hidden" : "visible"
  }), [isFullscreen]);

  // Apply highlighting to the graph without recreating it
  const highlightedGraph = useMemo(() => {
    if (!graph || !graph.nodes || !graph.edges) {
      return graph;
    }

    // If no highlighting, return original graph
    if (highlightedPaths.length === 0) {
      console.log('No highlighting active - using original graph');
      return graph;
    }

    console.log('Applying highlighting to existing graph (no recreation)');

    // Apply highlighting styles to nodes
    const highlightedNodes = graph.nodes.map(node => {
      const nodeHighlight = getNodeHighlightStyle(node.id);
      
      if (nodeHighlight.isHighlighted) {
        return {
          ...node,
          color: {
            ...node.color,
            background: nodeHighlight.color,
            border: "#333"
          },
          font: {
            ...node.font,
            background: '#FFFFFF'
          }
        };
      } else if (nodeHighlight.isDimmed) {
        return {
          ...node,
          color: {
            ...node.color,
            background: "#E0E0E0",
            border: "#CCCCCC"
          },
          opacity: 0.3
        };
      }
      
      return node;
    });

    // Apply highlighting styles to edges
    const highlightedEdges = graph.edges.map(edge => {
      const edgeHighlight = getEdgeHighlightStyle(edge.from, edge.to);
      
      if (edgeHighlight.isHighlighted) {
        // Use the first highlighted path's color
        const edgeColor = edgeHighlight.colors[0];
        
        // Determine line style
        const hasSolid = edgeHighlight.lineStyles.some(style => style === 'solid');
        const hasDashed = edgeHighlight.lineStyles.some(style => style === 'dashed');
        
        let edgeDashes, edgeWidth;
        if (hasSolid && hasDashed) {
          // Mixed: use dashed but thicker to indicate both
          edgeDashes = [8, 4];
          edgeWidth = 3;
        } else if (hasDashed) {
          // Only alternative paths
          edgeDashes = [5, 5];
          edgeWidth = 2;
        } else {
          // Only primary paths
          edgeDashes = false;
          edgeWidth = 3;
        }

        return {
          ...edge,
          color: {
            ...edge.color,
            color: edgeColor
          },
          width: edgeWidth,
          dashes: edgeDashes
        };
      } else if (edgeHighlight.isDimmed) {
        return {
          ...edge,
          color: {
            ...edge.color,
            color: "#E0E0E0",
            opacity: 0.2
          }
        };
      }
      
      return edge;
    });

    return {
      nodes: highlightedNodes,
      edges: highlightedEdges
    };
  }, [graph, highlightedPaths, getNodeHighlightStyle, getEdgeHighlightStyle]);

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
      
      {/* Path Highlighting Controls */}
      {highlightedPaths.length > 0 && (
        <div style={{
          position: "absolute",
          top: "10px",
          right: "10px",
          background: "rgba(255, 255, 255, 0.95)",
          padding: "10px 15px",
          borderRadius: "6px",
          border: "2px solid #FFD700",
          backdropFilter: "blur(5px)",
          zIndex: 10,
          maxWidth: "280px",
          maxHeight: "300px",
          overflowY: "auto"
        }}>
          <div style={{
            fontSize: "14px",
            fontWeight: "bold",
            color: "#333",
            marginBottom: "8px"
          }}>
            🔍 {highlightedPaths.length > 1 ? `${highlightedPaths.length} Paths` : 'Path'} Highlighted
          </div>
          
          {highlightedPaths.map((path, index) => (
            <div key={path?.id || index} style={{
              marginBottom: index < highlightedPaths.length - 1 ? "10px" : "0",
              paddingBottom: index < highlightedPaths.length - 1 ? "8px" : "0",
              borderBottom: index < highlightedPaths.length - 1 ? "1px solid #eee" : "none"
            }}>
              <div style={{
                display: "flex",
                alignItems: "center",
                marginBottom: "4px"
              }}>
                <div style={{
                  width: "12px",
                  height: "12px",
                  backgroundColor: path?.highlightColor || "#ccc",
                  marginRight: "8px",
                  borderRadius: "2px",
                  border: "1px solid #333"
                }}></div>
                <div style={{
                  fontSize: "12px",
                  fontWeight: "bold",
                  color: "#333"
                }}>
                  {path?.destination || "Unknown"}
                </div>
              </div>
              
              <div style={{ fontSize: "11px", color: "#666", marginLeft: "20px" }}>
                <strong>Type:</strong> {path?.pathType || "Unknown"} 
                {path?.isPrimary ? 
                  <span style={{ color: "#28a745", marginLeft: "4px" }}>●</span> : 
                  <span style={{ color: "#6c757d", marginLeft: "4px" }}>⋯</span>
                }<br/>
                <strong>Nodes:</strong> {path?.nodes?.length || 0} | <strong>Edges:</strong> {path?.edges?.length || 0}
              </div>
            </div>
          ))}
          
          <div style={{ marginTop: "10px", paddingTop: "8px", borderTop: "1px solid #eee" }}>
            <button
              onClick={clearHighlight}
              style={{
                padding: "4px 8px",
                backgroundColor: "#dc3545",
                color: "white",
                border: "none",
                borderRadius: "3px",
                cursor: "pointer",
                fontSize: "11px",
                width: "100%"
              }}
            >
              Clear All Highlights
            </button>
          </div>
        </div>
      )}
      
      {/* Instructions */}
      {!isFullscreen && (
        <div style={{
          position: "absolute",
          bottom: "10px",
          right: "10px",
          background: "rgba(255, 255, 255, 0.9)",
          padding: "8px 12px",
          borderRadius: "4px",
          fontSize: "12px",
          border: "1px solid #ccc",
          maxWidth: "220px"
        }}>
          💡 <strong>Click:</strong> Node/edge to highlight all paths<br/>
          🎨 <strong>Colors:</strong> Different paths shown in unique colors<br/>
          📍 <strong>Lines:</strong> Solid (primary) ⋯ Dashed (alternative)<br/>
          🎯 <strong>Empty space:</strong> Clear highlighting
        </div>
      )}
      
      {/* Zoom Controls */}

      <div className="zoom-controls">
        <button
          onClick={toggleFullscreen}
          title={isFullscreen ? "Exit Fullscreen (ESC)" : "Enter Fullscreen"}
          className="zoom-button fullscreen"
        >
          {isFullscreen ? "➡" : "⬅" }
        </button>
        <button
          onClick={handleZoomIn}
          title="Zoom In"
          className="zoom-button zoom-in"
        >
          +
        </button>
        
        <button
          onClick={handleZoomOut}
          title="Zoom Out"
          className="zoom-button zoom-out"
        >
          −
        </button>
        
        
        
        <button
          onClick={handleResetZoom}
          title="Fit to Screen"
          className="zoom-button fit-screen"
        >
          ◎
        </button>
        
        {/* Download Controls */}
        <div style={{ height: "8px" }}></div>
        
        <button
          onClick={downloadAsPNG}
          title="Download as PNG"
          className="zoom-button download-png"
          disabled={!networkInstance}
        >
          PNG
        </button>
        
        <button
          onClick={downloadAsSVG}
          title="Download as SVG"
          className="zoom-button download-svg"
          disabled={!networkInstance}
        >
          SVG
        </button>
      </div>

      {/* Prefix Aggregation Controls */}
      <div style={{
        position: "absolute",
        bottom: isFullscreen ? "20px" : "10px",
        left: isFullscreen ? "20px" : "10px",
        background: "rgba(255, 255, 255, 0.95)",
        padding: "10px 15px",
        borderRadius: "6px",
        border: "1px solid #ccc",
        backdropFilter: "blur(5px)",
        zIndex: 10,
        fontSize: isFullscreen ? "14px" : "12px"
      }}>
        <label style={{ fontSize: isFullscreen ? '14px' : '12px', fontWeight: 'bold', marginBottom: '8px', display: 'block' }}>
          🌐 Network View
        </label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: isFullscreen ? '12px' : '11px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={showPrefixAggregation}
              onChange={handlePrefixAggregationToggle}
              style={{ margin: 0, cursor: 'pointer' }}
            />
            Prefix & Timeout Aggregation
          </label>
          {showPrefixAggregation && expandedPrefixes.size > 0 && (
            <div style={{ fontSize: isFullscreen ? '11px' : '10px', color: '#666', marginLeft: '24px' }}>
              Expanded: {Array.from(expandedPrefixes).length} group(s)
            </div>
          )}
          {showPrefixAggregation && (
            <div style={{ fontSize: isFullscreen ? '10px' : '9px', color: '#888', marginLeft: '24px', fontStyle: 'italic' }}>
              Click grouped nodes to expand/collapse
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

NetworkGraph.displayName = 'NetworkGraph';

export default NetworkGraph;