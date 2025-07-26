import React, { useMemo } from "react";

const HopDrawer = React.memo(({ hopData, isOpen, onClose }) => {
  // Memoize the processed hop data to prevent unnecessary calculations
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
      hasValidIP
    };
  }, [hopData]);

  // Early return if no data
  if (!processedHopData) {
    return null;
  }

  const { sharedIP, sharedHostname, hostnames, destinations, pathTypes, hopData: processedHops, ipGeoData, hasLoadingGeoData, isTimeoutHop, hasValidIP } = processedHopData;

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
            Used in {destinations.length} destination(s), {processedHops.length} path(s)
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

        {/* IP Geolocation Section */}
        {ipGeoData && (
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
                  <strong>Country:</strong> {ipGeoData.country} ({ipGeoData.countryCode})
                </div>
                <div style={{ marginBottom: '5px' }}>
                  <strong>Region:</strong> {ipGeoData.region}
                </div>
                <div style={{ marginBottom: '5px' }}>
                  <strong>City:</strong> {ipGeoData.city}
                </div>
                {ipGeoData.zip && (
                  <div style={{ marginBottom: '5px' }}>
                    <strong>ZIP:</strong> {ipGeoData.zip}
                  </div>
                )}
                <div style={{ marginBottom: '5px' }}>
                  <strong>Timezone:</strong> {ipGeoData.timezone}
                </div>
                {ipGeoData.coordinates && (
                  <div style={{ marginBottom: '5px' }}>
                    <strong>Coordinates:</strong> {ipGeoData.coordinates.lat.toFixed(4)}, {ipGeoData.coordinates.lon.toFixed(4)}
                  </div>
                )}
              </div>

              {/* ISP Information */}
              <div style={{ marginBottom: '12px' }}>
                <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '8px' }}>
                  🏢 ISP & Network
                </div>
                <div style={{ marginBottom: '5px' }}>
                  <strong>ISP:</strong> {ipGeoData.isp}
                </div>
                {ipGeoData.organization && (
                  <div style={{ marginBottom: '5px' }}>
                    <strong>Organization:</strong> {ipGeoData.organization}
                  </div>
                )}
                {ipGeoData.asn && (
                  <div style={{ marginBottom: '5px' }}>
                    <strong>ASN:</strong> {ipGeoData.asn}
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
                    background: ipGeoData.mobile ? '#27ae60' : '#7f8c8d',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: 'bold'
                  }}>
                    📱 Mobile: {ipGeoData.mobile ? 'Yes' : 'No'}
                  </span>
                  <span style={{
                    background: ipGeoData.proxy ? '#e74c3c' : '#27ae60',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: 'bold'
                  }}>
                    🔒 Proxy: {ipGeoData.proxy ? 'Yes' : 'No'}
                  </span>
                  <span style={{
                    background: ipGeoData.hosting ? '#9b59b6' : '#7f8c8d',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: 'bold'
                  }}>
                    🖥️ Hosting: {ipGeoData.hosting ? 'Yes' : 'No'}
                  </span>
                </div>
              </div>

              {/* Data freshness */}
              {ipGeoData.fetchedAt && (
                <div style={{ 
                  fontSize: '12px', 
                  opacity: 0.8, 
                  marginTop: '8px',
                  borderTop: '1px solid rgba(255,255,255,0.2)',
                  paddingTop: '8px'
                }}>
                  📅 Data fetched: {new Date(ipGeoData.fetchedAt).toLocaleString()}
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
                <span style={{ fontWeight: 'bold' }}>Timeout Hop - No IP Response</span>
              </div>
              <p style={{ margin: 0, opacity: 0.9 }}>
                No geolocation data is available for this hop because it represents a network timeout. 
                The packets sent to this hop did not receive a response, so there's no IP address to analyze.
              </p>
            </div>
          </div>
        )}

        {/* No geolocation data for valid IP (private/reserved) */}
        {hasValidIP && !ipGeoData && !hasLoadingGeoData && !isTimeoutHop && (
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
              <strong>Destinations:</strong> {destinations.join(', ')}
            </div>
            <div style={{ marginBottom: '10px' }}>
              <strong>Path Types:</strong> {pathTypes.join(', ')}
            </div>
            <div>
              <strong>Total Occurrences:</strong> {processedHops.length} path(s)
            </div>
          </div>
        </div>

        {/* Individual Path Details */}
        <div style={{ marginBottom: '20px' }}>
          <h4 style={{ margin: '0 0 15px 0', color: '#2c3e50', fontSize: '16px' }}>
            🛤️ Path Details
          </h4>
          {processedHops.map((hop, index) => (
            <div key={index} style={{
              background: '#f8f9fa',
              padding: '15px',
              borderRadius: '6px',
              border: '1px solid #e0e0e0',
              marginBottom: '15px'
            }}>
              {/* Path Header */}
              <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{
                  background: hop.pathType === 'PRIMARY' ? '#27ae60' : '#e67e22',
                  color: 'white',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontWeight: 'bold'
                }}>
                  {hop.pathType}
                </span>
                <span style={{ fontWeight: 'bold', color: '#2c3e50' }}>
                  → {hop.destination}
                </span>
              </div>

              {/* Path Details */}
              <div style={{ fontSize: '14px', color: '#666', marginBottom: '12px' }}>
                <div style={{ marginBottom: '5px' }}>
                  🔢 <strong>Hop #{hop.hopNumber}</strong> in this path
                </div>
                <div style={{ marginBottom: '5px' }}>
                  📊 <strong>Usage:</strong> {hop.pathPercent}% ({hop.pathCount}/{hop.totalTraces} traces)
                </div>
                <div style={{ marginBottom: '5px' }}>
                  ⏱️ <strong>Path Avg RTT:</strong> {hop.pathAvgRtt}ms
                </div>
                {hop.timestamp && (
                  <div style={{ marginBottom: '5px' }}>
                    📅 <strong>Timestamp:</strong> {new Date(hop.timestamp).toLocaleString()}
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
                  <strong>⚡ RTT for this path:</strong> {hop.avgRtt}ms average
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
              <strong>Traffic Distribution:</strong> Handles traffic across {processedHops.length} different path configuration(s)
            </div>
            <div>
              <strong>Reliability Role:</strong> 
              {processedHops.some(h => h.pathType === 'PRIMARY') ? 
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