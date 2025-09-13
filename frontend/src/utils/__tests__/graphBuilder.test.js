import { buildGraph } from '../../utils/graphBuilder';

function makeTransformed() {
  // mimic dataTransformer output shape for a single destination
  return {
    '2001:db8::1': {
      total_traces: 2,
      primary_path: {
        path: [
          { hop_number: 1, ip: '2001:db8::a', hostname: 'h1', rtt_ms: [10, 11, 12], protocol: 'ICMP', asn: 64500 },
          { hop_number: 2, ip: '2001:db8::b', hostname: 'h2', rtt_ms: [20, 21, 22], protocol: 'ICMP', asn: 64500 },
          { hop_number: 3, ip: '2001:db8::c', hostname: 'h3', rtt_ms: [30, 31, 32], protocol: 'ICMP', asn: 64501 }
        ],
        timestamps: ['2025-09-01T12:00:00Z', '2025-09-01T13:00:00Z'],
        timeStamp: '2025-09-01T13:00:00Z',
        count: 2,
        percent: 100,
        avg_rtt: 21,
        protocol: 'ICMP'
      },
      alternatives: []
    }
  };
}

describe('graphBuilder.buildGraph', () => {
  it('emits nodeDetails with expected fields and stable pathId', () => {
    const filteredData = makeTransformed();
    const { graph, nodeDetails, pathMapping } = buildGraph({
      filteredData,
      selectedDestinations: ['2001:db8::1'],
      showPrimaryOnly: false,
      showPrefixAggregation: false,
      expandedPrefixes: new Set(),
      aggregationMode: 'none',
      aggregationScope: 'per-destination',
      networkHierarchy: 'none',
      expandedAsnGroups: new Set()
    });
    expect(graph.nodes.length).toBeGreaterThan(0);
    // find a hop node
    const hopNode = graph.nodes.find(n => n.nodeType === 'hop');
    expect(hopNode).toBeTruthy();
    const details = nodeDetails.get(hopNode.id);
    expect(Array.isArray(details)).toBe(true);
    const d = details[0];
    // critical fields for HopDrawer
    expect(d).toMatchObject({
      ip: expect.any(String),
      hostname: expect.any(String),
      destination: '2001:db8::1',
      hopNumber: expect.any(Number),
      pathType: 'PRIMARY',
      protocol: 'ICMP',
      pathPercent: 100,
      pathAvgRtt: expect.any(Number),
      totalTraces: 2
    });
    // pathLength present
    expect(d.pathLength).toBe(3);
    // stable pathId present and pathMapping knows it
    expect(typeof d.pathId).toBe('string');
    let found = false;
    pathMapping.forEach(set => { if (set.has(d.pathId)) found = true; });
    expect(found).toBe(true);
  });

  it('aggregates by ASN when Show All Paths + ASN hierarchy is selected (per-run)', () => {
    const filteredData = makeTransformed();
    const { graph } = buildGraph({
      filteredData,
      selectedDestinations: ['2001:db8::1'],
      showPrimaryOnly: false,
      showPrefixAggregation: false,
      expandedPrefixes: new Set(),
      aggregationMode: 'none', // Show All Paths
      aggregationScope: 'per-destination',
      networkHierarchy: 'asn',
      expandedAsnGroups: new Set()
    });
    const asnNodes = graph.nodes.filter(n => n.nodeType === 'asn');
    // Expect collapsed steps for AS64500 (hops 1-2) and AS64501 (hop 3)
    expect(asnNodes.length).toBeGreaterThanOrEqual(2);
    const groups = new Set(asnNodes.map(n => n.asnGroup));
    expect(groups.has('AS64500')).toBe(true);
    expect(groups.has('AS64501')).toBe(true);
    // No plain hop nodes when collapsed
    expect(graph.nodes.find(n => n.nodeType === 'hop')).toBeFalsy();
  });

  it('aggregates shared IPs by ASN when Shared IPs + ASN hierarchy is selected', () => {
    const filteredData = makeTransformed();
    const { graph } = buildGraph({
      filteredData,
      selectedDestinations: ['2001:db8::1'],
      showPrimaryOnly: false,
      showPrefixAggregation: false,
      expandedPrefixes: new Set(),
      aggregationMode: 'shared-ips', // Shared IPs
      aggregationScope: 'cross-destination',
      networkHierarchy: 'asn',
      expandedAsnGroups: new Set()
    });
    const asnNodes = graph.nodes.filter(n => n.nodeType === 'asn');
    expect(asnNodes.length).toBeGreaterThanOrEqual(2);
    // Still per-run: edges per path preserved
    expect(graph.edges.length).toBeGreaterThan(0);
  });

  it('expands a specific ASN group into IP nodes when toggled', () => {
    const filteredData = makeTransformed();
    const { graph } = buildGraph({
      filteredData,
      selectedDestinations: ['2001:db8::1'],
      showPrimaryOnly: false,
      showPrefixAggregation: false,
      expandedPrefixes: new Set(),
      aggregationMode: 'none',
      aggregationScope: 'per-destination',
      networkHierarchy: 'asn',
      expandedAsnGroups: new Set(['AS64500'])
    });
    // With AS64500 expanded, there should be at least one IP hop node
    const ipNodes = graph.nodes.filter(n => n.nodeType === 'hop');
    expect(ipNodes.length).toBeGreaterThan(0);
    // And still at least one ASN node for other groups
    const asnNodes = graph.nodes.filter(n => n.nodeType === 'asn');
    expect(asnNodes.length).toBeGreaterThan(0);
  });
});
