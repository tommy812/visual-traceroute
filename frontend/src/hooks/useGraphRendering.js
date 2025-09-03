import { useMemo, useCallback } from 'react';

export const useGraphRendering = (isFullscreen, dimensions) => {
  // Graph options configuration
  const options = useMemo(() => ({
    nodes: {
      shape: 'box',
      font: {
        size: 12,
        face: 'Arial'
      },
      borderWidth: 2,
      shadow: true
    },
    edges: {
      width: 2,
      shadow: true,
      smooth: {
        type: 'continuous',
        forceDirection: 'none'
      }
    },
    physics: {
      enabled: true,
      solver: 'forceAtlas2Based',
      forceAtlas2Based: {
        gravitationalConstant: -50,
        centralGravity: 0.01,
        springLength: 100,
        springConstant: 0.08,
        damping: 0.4,
        avoidOverlap: 0.5
      },
      stabilization: {
        enabled: true,
        iterations: 1000,
        updateInterval: 100
      }
    },
    interaction: {
      hover: true,
      tooltipDelay: 200,
      zoomView: true,
      dragView: true
    },
    layout: {
      improvedLayout: true,
      hierarchical: {
        enabled: false
      }
    }
  }), []);

  // Container style based on fullscreen state
  const containerStyle = useMemo(() => ({
    width: isFullscreen ? dimensions.width : '100%',
    height: isFullscreen ? dimensions.height : '100%',
    position: isFullscreen ? 'fixed' : 'relative',
    top: isFullscreen ? 0 : 'auto',
    left: isFullscreen ? 0 : 'auto',
    zIndex: isFullscreen ? 9999 : 'auto',
    backgroundColor: '#ffffff'
  }), [isFullscreen, dimensions]);

  // Generate node colors
  const generateNodeColor = useCallback((nodeType, index = 0) => {
    switch (nodeType) {
      case 'ip':
        return '#4CAF50'; // Green for IP nodes
      case 'timeout':
        return '#f44336'; // Red for timeout nodes
      case 'prefix':
        return '#FF9800'; // Orange for prefix nodes
      case 'asn':
        return '#9C27B0'; // Purple for ASN nodes
      case 'timeout_group':
        return '#9C27B0'; // Purple for timeout groups
      case 'destination':
        return '#2196F3'; // Blue for destinations
      default:
        // Generate color based on index for other types
        const hue = (index * 137.5) % 360;
        return `hsl(${hue}, 70%, 60%)`;
    }
  }, []);

  // Generate edge colors
  const generateEdgeColor = useCallback((fromType, toType) => {
    if (fromType === 'timeout' || toType === 'timeout') {
      return '#f44336'; // Red for timeout connections
    }
    return '#666666'; // Default gray
  }, []);

  return {
    options,
    containerStyle,
    generateNodeColor,
    generateEdgeColor
  };
}; 