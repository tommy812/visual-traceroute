import cache from '../../services/networkDataCache';

describe('networkDataCache', () => {
  beforeEach(() => cache.clear());

  it('stores and retrieves runs by destination and range', () => {
    const dest = '2001:db8::1';
    cache.addRunsForDestination(dest, [
      { id: '1', destination_id: 1, timestamp: '2025-08-15T00:00:00Z' },
      { id: '2', destination_id: 1, timestamp: '2025-09-01T00:00:00Z' }
    ]);
    const inRange = cache.getRunsInRange([dest], new Date('2025-08-31'), new Date('2025-09-10'));
    expect(inRange.map(r => r.id)).toEqual(['2']);
  });

  it('marks and checks last30Days coverage', () => {
    const dests = ['2001:db8::1', '2001:db8::2'];
    expect(cache.hasLast30DaysCoverage(dests)).toBe(false);
    cache.markCoverageLast30Days(dests);
    expect(cache.hasLast30DaysCoverage(dests)).toBe(true);
  });
});
