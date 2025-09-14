import React, { useState, useEffect, useMemo, useCallback } from 'react';
import ipGeoService from '../../../services/ipGeoService';
import peeringDbService from '../../../services/peeringDbService';
import PeeringDbPanel from './PeeringDbPanel';

// Optimized HopDrawer component with React.memo
const HopDrawer = React.memo(({ hopData, isOpen, onClose, onHighlightPath = null }) => {
  const [ipGeoData, setIpGeoData] = useState({});
  const [destFilter, setDestFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('USAGE_DESC');
  const [showPerRun, setShowPerRun] = useState(false);

  // PeeringDB state
  const [pdbLoading, setPdbLoading] = useState(false);
  const [pdbError, setPdbError] = useState(null);
  const [pdbCaps, setPdbCaps] = useState(null);
  const [pdbAsn, setPdbAsn] = useState(null);
  // ...existing code...

  // Process hop data with memoization
  const processedHopData = useMemo(() => {
    if (!hopData || !Array.isArray(hopData) || hopData.length === 0) {
      return null;
    }

    // Get shared information from the first hop entry
    const sharedIP = hopData[0].ip;

    // Check if all entries have the same hostname
    const hostnames = [...new Set(hopData.map(h => h.hostname).filter(Boolean))];
    const sharedHostname = hostnames.length === 1 ? hostnames[0] : null;



    // Get unique destinations and path types
    const destinations = [...new Set(hopData.map(h => h.destination))];
    const pathTypes = [...new Set(hopData.map(h => h.pathType))];
    const protocols = [...new Set(hopData.map(h => (typeof h.protocol === 'string' ? h.protocol.trim() : h.protocol)).filter(Boolean))];

    // Check for IP geolocation data
    const ipGeoData = hopData.find(h => h.ipGeoInfo)?.ipGeoInfo || null;
    const hasLoadingGeoData = hopData.some(h => h.hasLoadingGeoData === true);
    const isTimeoutHop = hopData.every(h => h.is_timeout || !h.ip);
    const hasValidIP = hopData.some(h => h.ip && !h.is_timeout);



    return {
      sharedIP,
      sharedHostname,
      hostnames,
      destinations,
      pathTypes,
      hopData,
      ipGeoData,
      hasLoadingGeoData,
      isTimeoutHop,
      hasValidIP,
      protocols
    };
  }, [hopData]);

  // filter/sort computed list
  const visibleHops = useMemo(() => {
    if (!processedHopData) return [];
    let list = processedHopData.hopData;

    if (showPerRun) {
      list = list.flatMap(h => {
        const stamps = Array.isArray(h.pathTimestamps) && h.pathTimestamps.length
          ? h.pathTimestamps
          : (h.timestamp ? [h.timestamp] : []);
        return stamps.map(ts => ({ ...h, timestamp: ts, _perRun: true }));
      });
    }

    // filter by destination
    if (destFilter !== 'ALL') {
      list = list.filter(h => h.destination === destFilter);
    }

    // sort
    const cmp = (a, b) => {
      switch (sortBy) {
        case 'USAGE_DESC':
          return (b.pathPercent ?? 0) - (a.pathPercent ?? 0);
        case 'USAGE_ASC':
          return (a.pathPercent ?? 0) - (b.pathPercent ?? 0);
        case 'RTT_ASC':
          return (a.pathAvgRtt ?? Infinity) - (b.pathAvgRtt ?? Infinity);
        case 'RTT_DESC':
          return (b.pathAvgRtt ?? -Infinity) - (a.pathAvgRtt ?? -Infinity);
        case 'HOP_ASC':
          return (a.hopNumber ?? 0) - (b.hopNumber ?? 0);
        case 'HOP_DESC':
          return (b.hopNumber ?? 0) - (a.hopNumber ?? 0);
        case 'TYPE':
          // PRIMARY first, then ALTERNATIVE by index
          const order = (t) => (t === 'PRIMARY' ? 0 : 1);
          const ot = order(a.pathType) - order(b.pathType);
          if (ot !== 0) return ot;
          return String(a.pathType).localeCompare(String(b.pathType));
        case 'TIME_DESC':
          return new Date(b.timestamp || 0) - new Date(a.timestamp || 0);
        case 'TIME_ASC':
          return new Date(a.timestamp || 0) - new Date(b.timestamp || 0);
        default:
          return 0;
      }
    };

    return [...list].sort(cmp);
  }, [processedHopData, destFilter, sortBy, showPerRun]);


  const handleHighlightPath = useCallback((hop) => {
    if (!hop) return;
    // Prefer the stable hashed pathId generated in graphBuilder; fallback to legacy format
    const pathId = hop.pathId || `${hop.destination}-${hop.pathType}`;
    if (!pathId) return;
    if (typeof onHighlightPath === 'function') {
      onHighlightPath(pathId);
    } else {
      // Fallback: broadcast event (NetworkGraph listens for this custom event)
      window.dispatchEvent(new CustomEvent('graph:highlightPath', { detail: { pathId } }));
    }
  }, [onHighlightPath]);



  // Fetch IP geolocation data with optimized loading states
  const fetchIPGeoData = useCallback(async (ip) => {
    if (!ip || ip === 'Unknown' || ipGeoData[ip]) return;

    try {
  const raw = await ipGeoService.getIPInfo(ip);
  const geoData = ipGeoService.formatIPInfo(raw);
  setIpGeoData(prev => ({ ...prev, [ip]: geoData || null }));
    } catch (error) {
      console.error(`Error fetching geo data for ${ip}:`, error);
      setIpGeoData(prev => ({ ...prev, [ip]: { error: 'Failed to load location data' } }));
    }
  }, [ipGeoData]);

  // Auto-fetch geo data for valid IPs
  useEffect(() => {
    if (isOpen && processedHopData && processedHopData.sharedIP && !processedHopData.isTimeoutHop) {
      if (!ipGeoData[processedHopData.sharedIP] && !processedHopData.ipGeoData) {
        fetchIPGeoData(processedHopData.sharedIP);
      }
    }
  }, [isOpen, processedHopData, fetchIPGeoData, ipGeoData]);

  // Compute currentGeoData safely for hooks and render
  const sharedIpForGeo = processedHopData?.sharedIP;
  const existingGeoForGeo = processedHopData?.ipGeoData || null;
  const currentGeoData = existingGeoForGeo || ipGeoData[sharedIpForGeo];

  // Detect "Max TTL reached" for timeout selections
  const MAX_TTL = 30;
  const isMaxTtlReturned = useMemo(() => {
    const list = Array.isArray(processedHopData?.hopData) ? processedHopData.hopData : [];
    return list.some(h =>
      (h?.is_timeout || !h?.ip) &&
      ((h?.hopNumber ?? h?.hop_number ?? 0) >= MAX_TTL)
    );
  }, [processedHopData]);

  // Fetch PeeringDB on ASN change (prefer hop ASN, fallback to geo ASN)
  useEffect(() => {
    let cancelled = false;

    async function run() {
      setPdbError(null);
      setPdbCaps(null);
      setPdbAsn(null);

      if (!isOpen) return;

      const firstHop = Array.isArray(hopData) && hopData.length ? hopData[0] : null;
      const rawAsn = firstHop?.asn ?? currentGeoData?.asn;
      if (!rawAsn) return;

      const asnNum = peeringDbService.parseAsnNumber(rawAsn);
      if (!asnNum) return;

      setPdbLoading(true);
      setPdbAsn(asnNum);
      try {
        const net = await peeringDbService.getNetByAsn(asnNum);
        if (cancelled) return;
        const caps = peeringDbService.summarizeCapabilities(net);

        let logoUrl = null;
        if (net?.org_id) {
          const org = await peeringDbService.getOrgById(net.org_id);
          if (!cancelled) {
            logoUrl = peeringDbService.getLogoUrl({ net, org });
          }
        }

        if (!cancelled) {
          setPdbCaps(logoUrl ? { ...caps, logoUrl } : caps);
        }
      } catch {
        if (!cancelled) setPdbError('Failed to load PeeringDB data');
      } finally {
        if (!cancelled) setPdbLoading(false);
      }
    }

    run();
    return () => { cancelled = true; };
  }, [isOpen, currentGeoData?.asn, hopData]);

  // Early return if no data (after all hooks)
  if (!processedHopData) {
    return null;
  }

  const { sharedIP, sharedHostname, hostnames, destinations, protocols, pathTypes, hasLoadingGeoData, isTimeoutHop, hasValidIP } = processedHopData;

  return (
    <div
      className={`hop-drawer ${isOpen ? 'open' : ''}`}
      style={{
        position: 'fixed',
        top: 0,
        right: isOpen ? 0 : '-450px',
        width: '450px',
        height: '100vh',
        backgroundColor: '#fff',
        boxShadow: '-2px 0 20px rgba(0,0,0,0.15)',
        zIndex: 10001, // Higher than fullscreen graph (9999)
        transition: 'right 0.25s cubic-bezier(0.4, 0.0, 0.2, 1)', // Smoother easing
        overflowY: 'auto',
        borderLeft: '1px solid #e0e0e0',
        transform: 'translateZ(0)', // Force GPU acceleration
        willChange: 'transform' // Optimize for animations
      }}
    >
      {/* Header */}
      <div style={{
        padding: '20px',
        borderBottom: '1px solid #e0e0e0',
        backgroundColor: '#f8f9fa',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          <h3 style={{ margin: 0, color: '#333', fontSize: '18px' }}>
            🔗 Network Hop Details
          </h3>
          <p style={{ margin: '5px 0 0 0', fontSize: '12px', color: '#666' }}>
            Used in {new Set(visibleHops.map(h => h.destination)).size || destinations.length} destination(s), {visibleHops.length} path(s)
          </p>
        </div>
        <button
          onClick={onClose}
          style={{
            background: '#ff4757',
            color: 'white',
            border: 'none',
            borderRadius: '50%',
            width: '30px',
            height: '30px',
            cursor: 'pointer',
            fontSize: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          ×
        </button>
      </div>

      {/* Content */}
      <div style={{ padding: '20px' }}>
        {/* IP Address Section */}
        <div style={{ marginBottom: '20px' }}>
          <h4 style={{ margin: '0 0 10px 0', color: '#2c3e50', fontSize: '16px' }}>
            📍 IP Address
          </h4>
          <div style={{
            background: '#34495e',
            color: '#ecf0f1',
            padding: '12px',
            borderRadius: '6px',
            fontFamily: 'monospace',
            fontSize: '14px',
            wordBreak: 'break-all',
            border: '1px solid #2c3e50'
          }}>
            {sharedIP}
          </div>
        </div>

        {/* Hostname Section */}
        {sharedHostname && (
          <div style={{ marginBottom: '20px' }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#2c3e50', fontSize: '16px' }}>
              🏠 Hostname
            </h4>
            <div style={{
              background: '#27ae60',
              color: 'white',
              padding: '12px',
              borderRadius: '6px',
              fontFamily: 'monospace',
              fontSize: '14px',
              wordBreak: 'break-all'
            }}>
              {sharedHostname}
            </div>
          </div>
        )}


        {/* Multiple hostnames warning */}
        {hostnames.length > 1 && (
          <div style={{ marginBottom: '20px' }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#2c3e50', fontSize: '16px' }}>
              🏠 Hostnames
            </h4>
            <div style={{
              background: '#f39c12',
              color: 'white',
              padding: '12px',
              borderRadius: '6px',
              fontSize: '14px'
            }}>
              ⚠️ Multiple hostnames detected: {hostnames.join(', ')}
            </div>
          </div>
        )}


        {/* Path Usage Summary */}
        <div style={{ marginBottom: '20px' }}>
          <h4 style={{ margin: '0 0 10px 0', color: '#2c3e50', fontSize: '16px' }}>
            📊 Usage Summary
          </h4>
          <div style={{
            background: '#e8f4f8',
            padding: '15px',
            borderRadius: '6px',
            border: '1px solid #bee5eb'
          }}>
            <div style={{ marginBottom: '10px' }}>
              <strong>Destinations:</strong> {Array.from(new Set(visibleHops.map(h => h.destination))).join(', ') || destinations.join(', ')}
            </div>
            <div style={{ marginBottom: '10px' }}>
              <strong>Path Types:</strong> {pathTypes.join(', ')}
            </div>
            <div>
              <strong>Protocol:</strong> {protocols?.length ? protocols.join(', ') : 'Unknown'}
            </div>
            <div>
              <strong>Total Occurrences:</strong> {visibleHops.length} path(s)
            </div>

          </div>
        </div>

        {/* IP Geolocation Section */}
        {currentGeoData && (
          <div style={{ marginBottom: '20px' }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#2c3e50', fontSize: '16px' }}>
              🌍 IP Geolocation & ISP Info
            </h4>
            <div style={{
              background: '#2980b9',
              color: 'white',
              padding: '15px',
              borderRadius: '6px',
              fontSize: '14px'
            }}>
              {/* Location Information */}
              <div style={{ marginBottom: '12px' }}>
                <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '8px' }}>
                  📍 Location
                </div>
                <div style={{ marginBottom: '5px' }}>
                  <strong>Country:</strong> {currentGeoData.country} ({currentGeoData.countryCode})
                </div>
                <div style={{ marginBottom: '5px' }}>
                  <strong>Region:</strong> {currentGeoData.region}
                </div>
                <div style={{ marginBottom: '5px' }}>
                  <strong>City:</strong> {currentGeoData.city}
                </div>
                {currentGeoData.zip && (
                  <div style={{ marginBottom: '5px' }}>
                    <strong>ZIP:</strong> {currentGeoData.zip}
                  </div>
                )}
                <div style={{ marginBottom: '5px' }}>
                  <strong>Timezone:</strong> {currentGeoData.timezone}
                </div>
                {currentGeoData.coordinates && (
                  <div style={{ marginBottom: '5px' }}>
                    <strong>Coordinates:</strong> {currentGeoData.coordinates.lat.toFixed(4)}, {currentGeoData.coordinates.lon.toFixed(4)}
                  </div>
                )}
              </div>

              {/* ISP Information */}
              <div style={{ marginBottom: '12px' }}>
                <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '8px' }}>
                  🏢 ISP & Network
                </div>
                <div style={{ marginBottom: '5px' }}>
                  <strong>ISP:</strong> {currentGeoData.isp}
                </div>
                {currentGeoData.organization && (
                  <div style={{ marginBottom: '5px' }}>
                    <strong>Organization:</strong> {currentGeoData.organization}
                  </div>
                )}
                {currentGeoData.asn && (
                  <div style={{ marginBottom: '5px' }}>
                    <strong>ASN:</strong> {currentGeoData.asn}
                  </div>
                )}
              </div>

              {/* Service Types */}
              <div style={{ marginBottom: '8px' }}>
                <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '8px' }}>
                  🔧 Service Types
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{
                    background: currentGeoData.mobile ? '#27ae60' : '#7f8c8d',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: 'bold'
                  }}>
                    📱 Mobile: {currentGeoData.mobile ? 'Yes' : 'No'}
                  </span>
                  <span style={{
                    background: currentGeoData.proxy ? '#e74c3c' : '#27ae60',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: 'bold'
                  }}>
                    🔒 Proxy: {currentGeoData.proxy ? 'Yes' : 'No'}
                  </span>
                  <span style={{
                    background: currentGeoData.hosting ? '#9b59b6' : '#7f8c8d',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: 'bold'
                  }}>
                    🖥️ Hosting: {currentGeoData.hosting ? 'Yes' : 'No'}
                  </span>
                </div>
              </div>

              {/* Data freshness */}
              {currentGeoData.fetchedAt && (
                <div style={{
                  fontSize: '12px',
                  opacity: 0.8,
                  marginTop: '8px',
                  borderTop: '1px solid rgba(255,255,255,0.2)',
                  paddingTop: '8px'
                }}>
                  📅 Data fetched: {new Date(currentGeoData.fetchedAt).toLocaleString()}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Loading state for IP geolocation */}
        {hasLoadingGeoData && (
          <div style={{ marginBottom: '20px' }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#2c3e50', fontSize: '16px' }}>
              🌍 IP Geolocation & ISP Info
            </h4>
            <div style={{
              background: 'linear-gradient(90deg, #3498db, #2980b9)',
              color: 'white',
              padding: '15px',
              borderRadius: '8px',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              boxShadow: '0 2px 8px rgba(52, 152, 219, 0.3)',
              transform: 'translateZ(0)', // Force GPU acceleration
              willChange: 'transform' // Optimize for animations
            }}>
              <div style={{
                width: '20px',
                height: '20px',
                border: '2px solid rgba(255,255,255,0.3)',
                borderTop: '2px solid white',
                borderRadius: '50%',
                animation: 'hopDrawerSpin 0.8s linear infinite',
                transform: 'translateZ(0)', // Force GPU acceleration
                willChange: 'transform'
              }}></div>
              <span style={{ fontWeight: '500' }}>Loading geolocation data...</span>
              <style dangerouslySetInnerHTML={{
                __html: `
                  @keyframes hopDrawerSpin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                  }
                `
              }} />
            </div>
          </div>
        )}

        {/* No geolocation available for timeout hops */}
        {isTimeoutHop && (
          <div style={{ marginBottom: '20px' }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#2c3e50', fontSize: '16px' }}>
              🌍 IP Geolocation & ISP Info
            </h4>
            <div style={{
              background: '#7f8c8d',
              color: 'white',
              padding: '15px',
              borderRadius: '6px',
              fontSize: '14px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                <span style={{ fontSize: '20px' }}>⏱️</span>
                <span style={{ fontWeight: 'bold' }}>
                  {isMaxTtlReturned ? `Max TTL (${MAX_TTL}) reached` : 'Timeout Hop - No IP Response'}
                </span>
              </div>
              {isMaxTtlReturned ? (
                <p style={{ margin: 0, opacity: 0.9 }}>
                  The traceroute reached the maximum TTL without receiving a reply.
                  This usually indicates the destination was not reached or Protocol used is filtered.
                </p>
              ) : (
                <p style={{ margin: 0, opacity: 0.9 }}>
                  No geolocation data is available for this hop because it represents a network timeout.
                  The packets sent to this hop did not receive a response, so there's no IP address to analyze.
                </p>
              )}
            </div>
          </div>
        )}

        {/* No geolocation data for valid IP (private/reserved) */}
        {hasValidIP && !currentGeoData && !hasLoadingGeoData && !isTimeoutHop && (
          <div style={{ marginBottom: '20px' }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#2c3e50', fontSize: '16px' }}>
              🌍 IP Geolocation & ISP Info
            </h4>
            <div style={{
              background: '#95a5a6',
              color: 'white',
              padding: '15px',
              borderRadius: '6px',
              fontSize: '14px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                <span style={{ fontSize: '20px' }}>🔒</span>
                <span style={{ fontWeight: 'bold' }}>Geolocation Not Available</span>
              </div>
              <p style={{ margin: 0, opacity: 0.9 }}>
                This IP address ({sharedIP}) appears to be a private, reserved, or local address.
                Geolocation services typically only provide data for public IP addresses.
              </p>
            </div>
          </div>
        )}
  {/* PeeringDB Section (when ASN is available) */}
        {pdbAsn && (
          <div style={{ marginBottom: '20px' }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#2c3e50', fontSize: '16px' }}>
              🤝 Peering Information (ASN {pdbAsn})
            </h4>
            <PeeringDbPanel pdbLoading={pdbLoading} pdbError={pdbError} pdbCaps={pdbCaps} pdbAsn={pdbAsn} />
          </div>
        )}





        {/* Individual Path Details */}
        <div style={{ marginBottom: '20px' }}>
          <h4 style={{ margin: '0 0 15px 0', color: '#2c3e50', fontSize: '16px' }}>
            🛤️ Path Details ({visibleHops.length})
          </h4>
          {/* Controls for filtering/sorting + Individual Path Details */}
          <div style={{ marginBottom: '12px', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Destination filter */}
            <label style={{ fontSize: '12px', color: '#555' }}>
              Destination:&nbsp;
              <select
                value={destFilter}
                onChange={(e) => setDestFilter(e.target.value)}
                style={{ padding: '6px 8px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '12px' }}
              >
                <option value="ALL">All</option>
                {destinations.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </label>

            {/* Sorting */}
            <label style={{ fontSize: '12px', color: '#555' }}>
              Sort by:&nbsp;
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                style={{ padding: '6px 8px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '12px' }}
              >
                <option value="USAGE_DESC">Usage % (high → low)</option>
                <option value="USAGE_ASC">Usage % (low → high)</option>
                <option value="RTT_ASC">Avg RTT (low → high)</option>
                <option value="RTT_DESC">Avg RTT (high → low)</option>
                <option value="HOP_ASC">Hop number (asc)</option>
                <option value="HOP_DESC">Hop number (desc)</option>
                <option value="TYPE">Path type (PRIMARY first)</option>
                <option value="TIME_DESC">Timestamp (newest)</option>
                <option value="TIME_ASC">Timestamp (oldest)</option>
              </select>
            </label>

            {/* Per-run toggle */}
            <label style={{ fontSize: '12px', color: '#555', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <input
                type="checkbox"
                checked={showPerRun}
                onChange={(e) => setShowPerRun(e.target.checked)}
              />
              Per-run entries
            </label>
          </div>

          {visibleHops.map((hop, index) => (
            <div key={index} style={{
              background: '#f8f9fa',
              padding: '15px',
              borderRadius: '6px',
              border: '1px solid #e0e0e0',
              marginBottom: '15px'
            }}>
              {/* Path Header */}
              <div style={{
                marginBottom: '12px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                justifyContent: 'space-between',
                flexWrap: 'wrap'
              }}>
                <div style={{ flex: '1 1 auto', minWidth: 0 }}>
                  <span
                    title={hop.destination}
                    style={{
                      display: 'block',
                      fontWeight: 'bold',
                      color: '#2c3e50',
                      wordBreak: 'break-all',   // allow IPv6 to wrap
                      lineHeight: 1.2
                    }}
                  >
                    {hop.destination}
                  </span>
                </div>
                <button
                  onClick={() => handleHighlightPath(hop)}
                  title="Highlight this path in the graph"
                  style={{
                    background: '#3498db',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '6px 10px',
                    fontSize: '12px',
                    cursor: 'pointer',
                    flexShrink: 0
                  }}
                >
                  Highlight path
                </button>
              </div>

              {/* Path Details */}
              <div style={{ fontSize: '14px', color: '#666', marginBottom: '12px' }}>
                <span style={{
                  background: hop.pathType === 'PRIMARY' ? '#27ae60' : '#e67e22',
                  color: 'white',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  display: 'inline-block',
                  whiteSpace: 'nowrap'  // keep label on one line
                }}>
                  {hop.pathType}
                </span>

                <div style={{ marginBottom: '5px' }}>
                  🔢 <strong>Hop #{hop.hopNumber} / {hop.pathLength}</strong> in this path
                </div>
                <div style={{ marginBottom: '5px' }}>
                  📊 <strong>Usage:</strong> {hop.pathPercent ?? 0}%
                  {(typeof hop.pathCount === 'number' && typeof hop.totalTraces === 'number') && (
                    <> ({hop.pathCount}/{hop.totalTraces} traces)</>
                  )}
                </div>
                <div style={{ marginBottom: '5px' }}>
                  ⏱️ <strong>Path Avg RTT:</strong>{' '}
                  {Number.isFinite(hop.pathAvgRtt)
                    ? `${hop.pathAvgRtt}ms`
                    : Array.isArray(hop.rtt_ms) && hop.rtt_ms.length
                      ? `${(hop.rtt_ms.reduce((a, b) => a + b, 0) / hop.rtt_ms.length).toFixed(2)}ms`
                      : 'N/A'}
                </div>
                <div style={{ marginBottom: '5px' }}>
                  🧪 <strong>Protocol:</strong> {hop.protocol || 'Unknown'}
                </div>
                <div style={{ marginBottom: '5px' }}>
                  🏢 <strong>ASN:</strong>{' '}
                  {(() => {
                    const raw = (hop.asn != null && hop.asn !== '') ? hop.asn : currentGeoData?.asn;
                    const num = peeringDbService.parseAsnNumber(raw);
                    return num ? `AS${num}` : 'Unknown';
                  })()}
                </div>
                {(hop.timestamp || (Array.isArray(hop.pathTimestamps) && hop.pathTimestamps.length)) && (
                  <div style={{ marginBottom: '5px' }}>
                    📅 <strong>Timestamp{hop._perRun ? '' : 's'}:</strong>{' '}
                    {hop._perRun ? (
                      <span>{new Date(hop.timestamp).toLocaleString()}</span>
                    ) : (
                      <div>
                        {(() => {
                          const baseList = Array.isArray(hop.pathTimestamps) && hop.pathTimestamps.length
                            ? hop.pathTimestamps
                            : (hop.timestamp ? [hop.timestamp] : []);
                          // Deduplicate and sort ascending for stable display
                          const uniq = Array.from(new Set(baseList.filter(Boolean)));
                          uniq.sort((a, b) => new Date(a) - new Date(b));
                          return uniq.map((ts, i) => (
                            <div key={i}>{new Date(ts).toLocaleString()}</div>
                          ));
                        })()}
                      </div>
                    )}
                  </div>
                )}

              </div>



              {/* RTT Performance for this path */}
              <div style={{
                background: '#fff',
                padding: '10px',
                borderRadius: '4px',
                border: '1px solid #dee2e6'
              }}>
                <div style={{ marginBottom: '8px' }}>
                  <strong>⚡ Hop RTT:</strong>{' '}
                  {Array.isArray(hop.rtt_ms) && hop.rtt_ms.length
                    ? `${(hop.rtt_ms.reduce((a, b) => a + b, 0) / hop.rtt_ms.length).toFixed(2)}ms`
                    : 'N/A'}
                </div>
                {hop.rtt_ms && (
                  <div>
                    <strong>Measurements:</strong>
                    <div style={{ marginTop: '5px' }}>
                      {hop.rtt_ms.map((rtt, rttIndex) => (
                        <span
                          key={rttIndex}
                          style={{
                            display: 'inline-block',
                            background: '#3498db',
                            color: 'white',
                            padding: '2px 6px',
                            borderRadius: '3px',
                            fontSize: '12px',
                            marginRight: '5px',
                            marginBottom: '3px'
                          }}
                        >
                          {rtt.toFixed(2)}ms
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>



              {/* Hostname for this specific path if different */}
              {hop.hostname && hop.hostname !== sharedHostname && (
                <div style={{
                  background: '#fff3cd',
                  padding: '8px',
                  borderRadius: '4px',
                  border: '1px solid #ffeaa7',
                  marginTop: '8px',
                  fontSize: '12px'
                }}>
                  <strong>🏠 Hostname in this path:</strong> {hop.hostname}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Network Analysis Section */}
        <div style={{ marginBottom: '20px' }}>
          <h4 style={{ margin: '0 0 10px 0', color: '#2c3e50', fontSize: '16px' }}>
            📈 Network Analysis
          </h4>
          <div style={{
            background: '#fff3cd',
            padding: '15px',
            borderRadius: '6px',
            border: '1px solid #ffeaa7',
            fontSize: '14px'
          }}>
            <div style={{ marginBottom: '8px' }}>
              <strong>Strategic Position:</strong> This hop is used by {destinations.length} different destination(s)
            </div>
            <div style={{ marginBottom: '8px' }}>
              <strong>Path Diversity:</strong> Appears in {pathTypes.length} different path type(s)
            </div>
            <div style={{ marginBottom: '8px' }}>
              <strong>Traffic Distribution:</strong> Handles traffic across {visibleHops.length} path item(s)
            </div>
            <div>
              <strong>Reliability Role:</strong>

              {visibleHops.some(h => h.pathType === 'PRIMARY') ?
                ' Critical infrastructure (used in primary paths)' :
                ' Alternative routing (backup paths only)'
              }
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

HopDrawer.displayName = 'HopDrawer';

export default HopDrawer; 