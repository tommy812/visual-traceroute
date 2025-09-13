import React from 'react';
import { render, screen } from '@testing-library/react';
import HopDrawer from '../HopDrawer';

jest.mock('../../../../services/ipGeoService', () => ({
  __esModule: true,
  default: {
    getIPInfo: jest.fn(async () => ({ status: 'success', country: 'X', countryCode: 'XX', regionName: 'R', city: 'C', lat: 0, lon: 0, isp: 'ISP', as: 'AS64500', mobile: false, proxy: false, hosting: false, fetchedAt: new Date().toISOString() })),
    formatIPInfo: (raw) => raw ? ({
      status: 'success', country: 'X', countryCode: 'XX', region: 'R', city: 'C', coordinates: { lat: 0, lon: 0 }, timezone: 'UTC', isp: 'ISP', organization: '', asn: 'AS64500', mobile: false, proxy: false, hosting: false, fetchedAt: raw?.fetchedAt
    }) : null
  }
}));

jest.mock('../../../../services/peeringDbService', () => ({
  __esModule: true,
  default: {
    parseAsnNumber: (x) => 64500,
    getNetByAsn: jest.fn(async () => ({ name: 'Net', aka: 'N', policy_general: 'Open', org_id: 1 })),
    summarizeCapabilities: (net) => ({ name: net.name, aka: net.aka, policy_general: net.policy_general, info_ipv4: true, info_ipv6: true, info_unicast: true, info_multicast: false }),
    getOrgById: jest.fn(async () => ({ logo: '/media/logo.png' })),
    getLogoUrl: () => 'https://www.peeringdb.com/media/logo.png'
  }
}));

const sampleHop = {
  ip: '2001:db8::a',
  hostname: 'h1',
  rtt_ms: [10, 12, 11],
  destination: '2001:db8::1',
  hopNumber: 1,
  pathType: 'PRIMARY',
  pathLength: 3,
  pathPercent: 100,
  pathAvgRtt: 21,
  pathCount: 2,
  totalTraces: 2,
  protocol: 'ICMP',
  asn: 64500,
  timestamp: '2025-09-01T13:00:00Z',
  pathTimestamps: ['2025-09-01T12:00:00Z', '2025-09-01T13:00:00Z'],
  is_timeout: false,
  pathId: '2001:db8::1-PRIMARY-123'
};

describe('HopDrawer', () => {
  it('renders hop details and usage metrics', async () => {
    render(<HopDrawer hopData={[sampleHop]} isOpen={true} onClose={() => {}} />);
    expect(await screen.findByText(/Network Hop Details/i)).toBeInTheDocument();
    expect(screen.getByText('📍 IP Address')).toBeInTheDocument();
    expect(screen.getByText(/Hop #1/)).toBeInTheDocument();
    expect(screen.getByText(/Usage:/)).toBeInTheDocument();
  // Verify protocol value appears somewhere
  expect(screen.getAllByText(/ICMP/).length).toBeGreaterThan(0);
  });
});
