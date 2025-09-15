export function buildVisOptions(layoutOptimization, graph) {
  const baseOptions = {
    nodes: {
      shape: 'dot',
      size: 10,
      borderWidth: 2,
      color: { border: '#2196F3', background: '#BBDEFB' },
      font: { color: '#333', size: 12 }
    },
    edges: {
      arrows: 'to',
      color: { color: '#90A4AE' },
      smooth: false
    },
    interaction: {
      dragNodes: true, zoomView: true, dragView: true, selectConnectedEdges: false
    },
    configure: { enabled: false },
    layout: { improvedLayout: true },
    physics: { enabled: true }
  };

  switch (layoutOptimization) {
    case 'minimal-crossings':
      return {
        ...baseOptions,
        layout: {
          hierarchical: {
            enabled: true,
            direction: 'LR',
            sortMethod: 'directed',
            shakeTowards: 'roots',
            nodeSpacing: 140,
            treeSpacing: 120,
            levelSeparation: 200,
            blockShifting: true,
            edgeMinimization: true,
            parentCentralization: true
          }
        }
      };
    case 'all-paths':
      return {
        ...baseOptions,
        layout: {
          hierarchical: {
            enabled: true,
            direction: 'LR',
            sortMethod: 'directed',
            shakeTowards: 'leaves',
            nodeSpacing: 140,
            treeSpacing: 120,
            levelSeparation: 200,
            blockShifting: true,
            edgeMinimization: true,
            parentCentralization: true
          }
        },
        edges: { ...baseOptions.edges, smooth: true, chosen: false }
      };
    case 'asn-compact':
      // Special compact layout for ASN-deduped views (Shared IPs + ASN)
      return {
        ...baseOptions,
        layout: {
          hierarchical: {
            enabled: true,
            direction: 'LR',
            sortMethod: 'directed',
            shakeTowards: 'roots',
            nodeSpacing: 70,
            treeSpacing: 20,
            levelSeparation: 140,
            blockShifting: true,
            edgeMinimization: true,
            parentCentralization: true
          }
        }
      };
    default:
      return baseOptions;
  }
}
