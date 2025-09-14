import parseTraceroute from '../../utils/parseTraceroute';

describe('parseTraceroute', () => {
  const raw = `traceroute to example.com (2001:db8::ffff), 30 hops max, 80 byte packets\n` +
              ` 1 router1 (2001:db8::1) 1.123 ms 1.234 ms 1.345 ms\n` +
              ` 2 * * *\n` +
              ` 3 core (2001:db8::2) 10.1 ms 10.2 ms 10.3 ms\n` +
              ` 4 2001:db8::3 20.1 ms 20.2 ms 20.3 ms\n`;

  it('parses header and preserves hops/responses including timeouts', () => {
    const parsed = parseTraceroute(raw);
    expect(parsed.destination).toContain('example.com');
    expect(parsed.destination).toContain('2001:db8::ffff');
    expect(parsed.maxHops).toBe(30);
    expect(parsed.hops.length).toBe(4);

    // Hop 1: one response, three RTTs
    const h1 = parsed.hops[0];
    expect(h1.hop).toBe(1);
    expect(h1.responses.length).toBe(1);
    expect(h1.responses[0].timeout).toBe(false);
    expect(h1.responses[0].ip).toBe('2001:db8::1');
    expect(h1.responses[0].hostname).toBe('router1');
    expect(h1.responses[0].rtts.length).toBe(3);

    // Hop 2: three timeout probes preserved
    const h2 = parsed.hops[1];
    expect(h2.hop).toBe(2);
    expect(h2.responses.length).toBe(3);
    h2.responses.forEach(r => expect(r.timeout).toBe(true));

    // Hop 3: hostname + IP with RTTs
    const h3 = parsed.hops[2];
    expect(h3.responses.length).toBe(1);
    expect(h3.responses[0].ip).toBe('2001:db8::2');
    expect(h3.responses[0].hostname).toBe('core');
    expect(h3.responses[0].rtts.length).toBe(3);

    // Hop 4: bare IP with RTTs
    const h4 = parsed.hops[3];
    expect(h4.responses[0].ip).toBe('2001:db8::3');
    expect(h4.responses[0].hostname).toBe(null);
    expect(h4.responses[0].rtts.length).toBe(3);
  });
});
