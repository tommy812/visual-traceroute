import parseTraceroute from '../../utils/parseTraceroute';
import dataTransformer from '../../services/dataTransformer';
import { buildGraph } from '../../utils/graphBuilder';

function tracerouteToRun(raw, runId = 'run-test-1', address = '2001:db8::ffff') {
  const parsed = parseTraceroute(raw);
  // Build a minimal "trace run" compatible with dataTransformer
  const hops = [];
  for (const h of parsed.hops) {
    // Prefer first non-timeout response for hop ip; if all timeout, set ip null
    const resp = h.responses.find(r => !r.timeout) || null;
    const ip = resp ? resp.ip : null;
    const hostname = resp ? resp.hostname : null;
    // dataTransformer expects rtt1..rtt3
    const rtts = resp ? (resp.rtts || []) : [];
    hops.push({
      hop_number: h.hop,
      ip,
      hostname,
      rtt1: rtts[0] ?? null,
      rtt2: rtts[1] ?? null,
      rtt3: rtts[2] ?? null,
      asn: null
    });
  }
  return {
    id: runId,
    destinations: { address },
    timestamp: '2025-09-01T12:00:00Z',
    traceroute_methods: { description: 'ICMP' },
    hops
  };
}

describe('raw traceroute → graph integration', () => {
  const raw = `traceroute to example.com (2001:db8::ffff), 30 hops max, 80 byte packets\n` +
              ` 1 router1 (2001:db8::1) 1.0 ms 1.1 ms 1.2 ms\n` +
              ` 2 * * *\n` +
              ` 3 core (2001:db8::2) 10.1 ms 10.2 ms 10.3 ms\n` +
              ` 4 2001:db8::3 20.1 ms 20.2 ms 20.3 ms\n`;

  it('builds hop nodes and preserves a timeout hop at the right position', () => {
    const run = tracerouteToRun(raw);
    const transformed = dataTransformer.transformNetworkData([run]);
    const { graph, nodeDetails } = buildGraph({
      filteredData: transformed,
      selectedDestinations: ['2001:db8::ffff'],
      showPrimaryOnly: false,
      showPrefixAggregation: false,
      expandedPrefixes: new Set(),
      aggregationMode: 'none',
      aggregationScope: 'per-destination',
      networkHierarchy: 'none',
      expandedAsnGroups: new Set()
    });

    // Expect at least 3 real hop nodes (all non-timeout hops)
    const hopNodes = graph.nodes.filter(n => n.nodeType === 'hop');
    expect(hopNodes.length).toBeGreaterThanOrEqual(3);

    // Confirm hop #1 is 2001:db8::1 and hop #3 is 2001:db8::2
    const hop1 = hopNodes.find(n => nodeDetails.get(n.id)?.some(d => d.hopNumber === 1 && d.ip === '2001:db8::1'));
    const hop3 = hopNodes.find(n => nodeDetails.get(n.id)?.some(d => d.hopNumber === 3 && d.ip === '2001:db8::2'));
    expect(hop1).toBeTruthy();
    expect(hop3).toBeTruthy();

    // Find a timeout node with hopNumber 2
    const timeoutNodes = graph.nodes.filter(n => n.nodeType === 'timeout');
    const timeoutAt2 = timeoutNodes.find(n => n.level === 2);
    expect(timeoutAt2).toBeTruthy();
  });
});
