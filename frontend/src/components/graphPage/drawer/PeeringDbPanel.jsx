import React from 'react';

export default function PeeringDbPanel({ pdbLoading, pdbError, pdbCaps, pdbAsn }) {
  if (pdbLoading) {
    return (
      <div style={{
        background: 'linear-gradient(90deg, #3498db, #2980b9)',
        color: 'white',
        padding: '15px',
        borderRadius: '8px',
        fontSize: '14px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        boxShadow: '0 2px 8px rgba(52, 152, 219, 0.3)'
      }}>
        <div style={{
          width: '20px',
          height: '20px',
          border: '2px solid rgba(255,255,255,0.3)',
          borderTop: '2px solid white',
          borderRadius: '50%',
          animation: 'hopDrawerSpin 0.8s linear infinite'
        }}></div>
        <span style={{ fontWeight: '500' }}>Loading PeeringDB data...</span>
        <style dangerouslySetInnerHTML={{
          __html: `
            @keyframes hopDrawerSpin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `
        }} />
      </div>
    );
  }
  if (pdbError) {
    return (
      <div style={{
        background: '#fdecea',
        color: '#c0392b',
        padding: '12px',
        borderRadius: '6px',
        fontSize: '14px',
        border: '1px solid #f5c6cb'
      }}>
        {pdbError}
      </div>
    );
  }
  if (!pdbCaps || !pdbAsn) return null;

  return (
    <div
      style={{
        background: '#2980b9',
        color: 'white',
        padding: '15px',
        borderRadius: '6px',
        fontSize: '14px'
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '10px',
          fontSize: '16px',
          fontWeight: 'bold'
        }}
      >
        {pdbCaps.logoUrl ? (
          <img
            src={pdbCaps.logoUrl}
            alt={`${pdbCaps.name || 'Network'} logo`}
            width={16}
            height={16}
            style={{ width: 16, height: 16, objectFit: 'contain', borderRadius: 2, background: 'white', padding: 1 }}
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.src = '/images/fallback-building.png';
            }}
          />
        ) : (
          <span role="img" aria-label="building" style={{ fontSize: 16 }}>🏢</span>
        )}
        <span>
          {pdbCaps.name || 'Unknown network'} {pdbCaps.aka ? `(${pdbCaps.aka})` : ''}
        </span>
      </div>

      {pdbCaps.irr_as_set && (
        <div style={{ marginBottom: '5px' }}>
          <strong>IRR AS-SET:</strong> {pdbCaps.irr_as_set}
        </div>
      )}
      {pdbCaps.policy_general && (
        <div style={{ marginBottom: '5px' }}>
          <strong>Peering Policy:</strong> {pdbCaps.policy_general}
        </div>
      )}
      {pdbCaps.policy_contracts && (
        <div style={{ marginBottom: '5px' }}>
          <strong>Contracts:</strong> {pdbCaps.policy_contracts}
        </div>
      )}

      {(pdbCaps.info_traffic || pdbCaps.info_ratio || pdbCaps.info_scope || pdbCaps.info_type) && (
        <div style={{ marginBottom: '8px' }}>
          {pdbCaps.info_traffic && (
            <div style={{ marginBottom: '5px' }}>
              <strong>Traffic Level:</strong> {pdbCaps.info_traffic}
            </div>
          )}
          {pdbCaps.info_ratio && (
            <div style={{ marginBottom: '5px' }}>
              <strong>Traffic Ratio:</strong> {pdbCaps.info_ratio}
            </div>
          )}
          {pdbCaps.info_scope && (
            <div style={{ marginBottom: '5px' }}>
              <strong>Scope:</strong> {pdbCaps.info_scope}
            </div>
          )}
          {pdbCaps.info_type && (
            <div style={{ marginBottom: '5px' }}>
              <strong>Network Type:</strong> {pdbCaps.info_type}
            </div>
          )}
        </div>
      )}

      {(pdbCaps.info_prefixes4 != null || pdbCaps.info_prefixes6 != null) && (
        <div style={{ marginBottom: '5px' }}>
          <strong>Advertised Prefixes:</strong>{' '}
          {pdbCaps.info_prefixes4 != null ? `${pdbCaps.info_prefixes4} IPv4` : ''}
          {pdbCaps.info_prefixes4 != null && pdbCaps.info_prefixes6 != null ? ' • ' : ''}
          {pdbCaps.info_prefixes6 != null ? `${pdbCaps.info_prefixes6} IPv6` : ''}
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
        <span style={{ background: pdbCaps.info_ipv4 ? '#27ae60' : '#7f8c8d', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' }}>IPv4: {pdbCaps.info_ipv4 ? 'Yes' : 'No'}</span>
        <span style={{ background: pdbCaps.info_ipv6 ? '#27ae60' : '#7f8c8d', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' }}>IPv6: {pdbCaps.info_ipv6 ? 'Yes' : 'No'}</span>
        <span style={{ background: pdbCaps.info_unicast ? '#27ae60' : '#7f8c8d', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' }}>Unicast: {pdbCaps.info_unicast ? 'Yes' : 'No'}</span>
        <span style={{ background: pdbCaps.info_multicast ? '#27ae60' : '#7f8c8d', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' }}>Multicast: {pdbCaps.info_multicast ? 'Yes' : 'No'}</span>
      </div>
      <div style={{ marginTop: '6px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        {pdbCaps.policy_url && (
          <a href={pdbCaps.policy_url} target="_blank" rel="noreferrer" style={{ color: 'white', textDecoration: 'underline' }}>
            View Peering Policy
          </a>
        )}
        {pdbCaps.website && (
          <a href={pdbCaps.website} target="_blank" rel="noreferrer" style={{ color: 'white', textDecoration: 'underline' }}>
            Website
          </a>
        )}
      </div>
    </div>
  );
}
