import dataTransformer from '../../services/dataTransformer';

describe('dataTransformer.transformNetworkData', () => {
  const rawRuns = [
    {
      id: 'r1',
      destinations: { address: '2001:db8::1' },
      timestamp: '2025-09-01T12:00:00Z',
      traceroute_methods: { description: 'ICMP' },
      hops: [
        { hop_number: 1, ip: '2001:db8::a', hostname: 'h1', rtt1: 10, rtt2: 12, rtt3: 11, asn: 64500 },
        { hop_number: 2, ip: '2001:db8::b', hostname: 'h2', rtt1: 20, rtt2: 22, rtt3: 21, asn: 64500 },
        { hop_number: 3, ip: '2001:db8::c', hostname: 'h3', rtt1: 30, rtt2: 32, rtt3: 31, asn: 64501 }
      ]
    },
    {
      id: 'r2',
      destinations: { address: '2001:db8::1' },
      timestamp: '2025-09-01T13:00:00Z',
      traceroute_methods: { description: 'ICMP' },
      hops: [
        { hop_number: 1, ip: '2001:db8::a', hostname: 'h1', rtt1: 11, rtt2: 12, rtt3: 10, asn: 64500 },
        { hop_number: 2, ip: '2001:db8::b', hostname: 'h2', rtt1: 21, rtt2: 22, rtt3: 20, asn: 64500 },
        { hop_number: 3, ip: '2001:db8::c', hostname: 'h3', rtt1: 31, rtt2: 32, rtt3: 30, asn: 64501 }
      ]
    }
  ];

  it('groups by destination and emits primary_path with aggregated hops and protocol_groups', () => {
    const transformed = dataTransformer.transformNetworkData(rawRuns);
    const destKey = '2001:db8::1';
    expect(transformed[destKey]).toBeTruthy();
    const d = transformed[destKey];
    expect(d.total_traces).toBe(2);
    expect(Array.isArray(d.primary_path.path)).toBe(true);
    expect(d.primary_path.path.length).toBe(3);
    expect(d.primary_path.protocol).toBe('ICMP');
    // ASN aggregation preserved
    expect(d.primary_path.path[0].asn).toBe(64500);
    expect(d.primary_path.path[2].asn).toBe(64501);
    // protocol_groups per protocol
    expect(d.protocol_groups).toBeTruthy();
    expect(d.protocol_groups.ICMP.total_traces).toBe(2);
  });
});
