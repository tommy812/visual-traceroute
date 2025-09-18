import React, { useEffect, useRef, useState } from 'react';

// Small overlay shown when hovering aggregated nodes (prefix/ASN)
export default function AggregatedHopTooltip({ visible, x, y, items, pinned, onMove }) {
  // Drag state (only active when pinned). Hooks must be declared before any return.
  const [dragging, setDragging] = useState(false);
  const startRef = useRef({ startX: 0, startY: 0, origX: 0, origY: 0 });

  const onMouseDownHeader = (e) => {
    if (!pinned) return;
    e.preventDefault();
    e.stopPropagation();
    startRef.current = { startX: e.clientX, startY: e.clientY, origX: x, origY: y };
    setDragging(true);
  };

  useEffect(() => {
    if (!dragging) return;
    const onMoveDoc = (e) => {
      const dx = e.clientX - startRef.current.startX;
      const dy = e.clientY - startRef.current.startY;
      const nx = startRef.current.origX + dx;
      const ny = startRef.current.origY + dy;
      onMove?.(nx, ny);
    };
    const onUpDoc = () => setDragging(false);
    document.addEventListener('mousemove', onMoveDoc, { passive: true });
    document.addEventListener('mouseup', onUpDoc, { passive: true });
    return () => {
      document.removeEventListener('mousemove', onMoveDoc);
      document.removeEventListener('mouseup', onUpDoc);
    };
  }, [dragging, onMove]);

  if (!visible || !items || items.length === 0) return null;

  // Group by destination (name + address if available)
  const groups = new Map();
  const makeDestKey = (it) => {
    const addr = it.destinationAddress || it.destination || 'Unknown';
    const name = it.destinationDomain || it.domainName || null;
    return name ? `${addr} (${name})` : addr;
  };
  for (const it of items) {
    if (!it || !it.ip || it.is_timeout) continue;
    const gk = makeDestKey(it);
    if (!groups.has(gk)) groups.set(gk, new Map());
    const ipMap = groups.get(gk);
    const key = it.ip;
    const hopNumber = it.hopNumber ?? null;
    const hostname = it.hostname || it.ip;
    if (!ipMap.has(key)) {
      ipMap.set(key, {
        ip: it.ip,
        hostname,
        count: 1,
        minHop: Number.isFinite(hopNumber) ? hopNumber : null,
        maxHop: Number.isFinite(hopNumber) ? hopNumber : null,
  // track timestamps: keep earliest seen timestamp and all timestamps list (if available)
  firstSeen: it.timeStamp || it.timestamp || null,
  timestamps: Array.isArray(it.timestamps) ? [...it.timestamps] : (it.timeStamp || it.timestamp ? [it.timeStamp || it.timestamp] : []),
        // NEW aggregations for badges/summary
        protoSet: new Set(it.protocol ? [String(it.protocol)] : []),
        // Edge filtering information
        isEdgeFiltered: it.isEdgeFiltered || false,
        edgeFilteringMessage: it.edgeFilteringMessage || null,
        asnSet: new Set((it.asn != null && String(it.asn).trim() !== '') ? [String(it.asn)] : []),
        rttCount: (() => {
          if (Number.isFinite(it.avg_rtt_ms)) return 1;
          return Array.isArray(it.rtt_ms) ? it.rtt_ms.length : 0;
        })(),
        rttSum: (() => {
          if (Number.isFinite(it.avg_rtt_ms)) return Number(it.avg_rtt_ms);
          return Array.isArray(it.rtt_ms) ? it.rtt_ms.reduce((a, b) => a + b, 0) : 0;
        })(),
        rttMin: (() => {
          if (Number.isFinite(it.avg_rtt_ms)) return Number(it.avg_rtt_ms);
          return (Array.isArray(it.rtt_ms) && it.rtt_ms.length) ? Math.min(...it.rtt_ms) : Infinity;
        })(),
        rttMax: (() => {
          if (Number.isFinite(it.avg_rtt_ms)) return Number(it.avg_rtt_ms);
          return (Array.isArray(it.rtt_ms) && it.rtt_ms.length) ? Math.max(...it.rtt_ms) : -Infinity;
        })(),
        lossSet: (() => {
          return Number.isFinite(it.loss_pct) ? [Number(it.loss_pct)] : [];
        })()
      });
    } else {
      const rec = ipMap.get(key);
      rec.count += 1;
      if (Number.isFinite(hopNumber)) {
        rec.minHop = rec.minHop == null ? hopNumber : Math.min(rec.minHop, hopNumber);
        rec.maxHop = rec.maxHop == null ? hopNumber : Math.max(rec.maxHop, hopNumber);
      }
      // prefer a non-generic hostname if available
      if (hostname && rec.hostname === rec.ip) rec.hostname = hostname;
      // aggregate protocol, ASN, RTTs
      if (it.protocol) rec.protoSet.add(String(it.protocol));
      // Update edge filtering information
      if (it.isEdgeFiltered) {
        rec.isEdgeFiltered = true;
        rec.edgeFilteringMessage = it.edgeFilteringMessage;
      }
      if (it.asn != null && String(it.asn).trim() !== '') rec.asnSet.add(String(it.asn));
      if (Number.isFinite(it.avg_rtt_ms)) {
        rec.rttCount += 1;
        rec.rttSum += Number(it.avg_rtt_ms);
        rec.rttMin = Math.min(rec.rttMin, Number(it.avg_rtt_ms));
        rec.rttMax = Math.max(rec.rttMax, Number(it.avg_rtt_ms));
      } else if (Array.isArray(it.rtt_ms) && it.rtt_ms.length) {
        rec.rttCount += it.rtt_ms.length;
        rec.rttSum += it.rtt_ms.reduce((a, b) => a + b, 0);
        rec.rttMin = Math.min(rec.rttMin, Math.min(...it.rtt_ms));
        rec.rttMax = Math.max(rec.rttMax, Math.max(...it.rtt_ms));
      }
      // aggregate timestamps
      const t = it.timeStamp || it.timestamp || null;
      if (t) {
        if (!Array.isArray(rec.timestamps)) rec.timestamps = [];
        rec.timestamps.push(t);
        if (!rec.firstSeen) rec.firstSeen = t;
        else {
          const existing = new Date(rec.firstSeen);
          const candidate = new Date(t);
          if (!isNaN(candidate.getTime()) && isNaN(existing.getTime())) rec.firstSeen = t;
          else if (!isNaN(candidate.getTime()) && !isNaN(existing.getTime()) && candidate < existing) rec.firstSeen = t;
        }
      }
      if (Number.isFinite(it.loss_pct)) {
        if (!Array.isArray(rec.lossSet)) rec.lossSet = [];
        rec.lossSet.push(Number(it.loss_pct));
      }
    }
  }
  const timeoutOnly = groups.size === 0;

  // Detect shared-IP view: items covering multiple distinct destinations
  const uniqueDestinations = new Set((Array.isArray(items) ? items : []).map(it => it?.destinationAddress || it?.destination || 'Unknown'));
  const isSharedIPView = uniqueDestinations.size > 1;

  const headerText = `Paths at this hop: ${items.length}`;
  const S = {
    container: {
      position: 'absolute',
      top: y + 12,
      left: x + 12,
      maxWidth: 460,
      background: '#ffffffee',
      border: '1px solid #D6D6D6',
      borderRadius: 10,
      boxShadow: '0 12px 28px rgba(0,0,0,0.18)',
      padding: 0,
      zIndex: 20,
      pointerEvents: pinned ? 'auto' : 'none',
      cursor: pinned ? (dragging ? 'grabbing' : 'grab') : 'default',
      userSelect: dragging ? 'none' : 'auto',
      fontFamily: 'Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif',
      fontSize: 12,
      color: '#222',
      transition: 'box-shadow 120ms ease',
    },
    header: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      padding: '8px 10px',
      background: pinned ? '#f0f9ff' : '#f6f7f9',
      color: '#111',
      borderTopLeftRadius: 10,
      borderTopRightRadius: 10,
      borderBottom: '1px solid #e5e7eb',
    },
    body: { maxHeight: 300, overflowY: 'auto', padding: '8px 10px' },
    group: { marginBottom: 10, border: '1px solid #eee', borderRadius: 8, overflow: 'hidden' },
    groupTitle: { fontWeight: 700, color: '#333', padding: '8px 10px', background: '#fafafa', borderBottom: '1px solid #eee' },
    row: (alt) => ({ display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 10px', background: alt ? '#fff' : '#fcfcfd' }),
    rowTop: { display: 'flex', gap: 8, alignItems: 'baseline' },
    hopChip: {
      minWidth: 78,
      color: '#344054',
      background: '#eef2ff',
      border: '1px solid #e0e7ff',
      padding: '2px 8px',
      borderRadius: 999,
      fontSize: 11,
      fontWeight: 700,
      textAlign: 'center',
    },
    host: { flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#111827' },
    ip: { color: '#6b7280', fontVariantNumeric: 'tabular-nums' },
    count: { marginLeft: 6, color: '#6b7280' },
  badges: { display: 'flex', gap: 6, flexWrap: 'wrap', marginLeft: 78 },
    protoBadge: { background: '#e3f2fd', color: '#0b69b9', border: '1px solid #bbdefb', borderRadius: 10, padding: '2px 6px', fontSize: 10, fontWeight: 700 },
  lossBadge: { background: '#fdecea', color: '#b42318', border: '1px solid #facdcd', borderRadius: 10, padding: '2px 6px', fontSize: 10, fontWeight: 700 },
    summary: { color: '#374151', fontSize: 11, marginLeft: 78 },
  };

  // Render timeout-only fallback after styles are declared
  if (timeoutOnly) {
    const timeouts = Array.isArray(items) ? items.filter(it => it && (it.is_timeout || !it.ip)) : [];
    if (timeouts.length === 0) return null;
    
    // Check if this is an aggregated timeout
    const isAggregatedTimeout = timeouts.some(t => t.is_aggregated_timeout);
    const timeoutCount = timeouts.find(t => t.is_aggregated_timeout)?.timeout_count || 1;
    const originalHopNumbers = timeouts.find(t => t.is_aggregated_timeout)?.original_hop_numbers || [];
    const aggregatedTimeouts = timeouts.find(t => t.is_aggregated_timeout)?.aggregated_timeouts || [];
    
    const hopNums = Array.from(new Set(timeouts.map(t => t.hopNumber).filter(n => Number.isFinite(n)))).sort((a,b)=>a-b);
    const dests = Array.from(new Set(
      timeouts.map(t => {
        const addr = t.destinationAddress || t.destination || 'Unknown';
        const dom = t.destinationDomain || t.domainName || null;
        return dom ? `${addr} (${dom})` : addr;
      }).filter(Boolean)
    ));
    
    let headerText2;
    if (isAggregatedTimeout && timeoutCount > 1) {
      headerText2 = `Consecutive Timeout Hops: ${originalHopNumbers.join(', ')}`;
    } else {
      headerText2 = `Timeout hop${hopNums.length > 1 ? 's' : ''}${hopNums.length ? `: ${hopNums.join(', ')}` : ''}`;
    }
    
    return (
      <div style={S.container} onMouseDown={onMouseDownHeader}>
        <div style={S.header}>
          <div style={{ fontWeight: 600 }}>{headerText2}</div>
          <span style={{ fontSize: 10, color: '#666' }}>{pinned ? 'Click Screen to unpin' : 'Click to pin'}</span>
        </div>
        <div style={S.body}>
          <div style={{ marginBottom: 6 }}>
            <strong>Count:</strong> {isAggregatedTimeout ? `${timeoutCount} consecutive` : `${timeouts.length} occurrence${timeouts.length !== 1 ? 's' : ''}`}
          </div>
          {isAggregatedTimeout && originalHopNumbers.length > 0 && (
            <div style={{ marginBottom: 6 }}>
              <strong>Original Hops:</strong> {originalHopNumbers.join(', ')}
            </div>
          )}
          {dests.length > 0 && (
            <div style={{ marginBottom: 6 }}>
              <strong>Destinations:</strong> {dests.join(', ')}
            </div>
          )}
          
          {/* Show individual timeout details for aggregated timeouts */}
          {isAggregatedTimeout && aggregatedTimeouts.length > 0 && (
            <div style={{ marginBottom: 6 }}>
              <strong>Individual Timeouts:</strong>
              <div style={{ marginTop: 4, fontSize: 10 }}>
                {aggregatedTimeouts.map((timeout, idx) => (
                  <div key={idx} style={{ marginBottom: 2, paddingLeft: 8 }}>
                    <strong>Hop {timeout.hop_number || (idx + 1)}:</strong> 
                    {timeout.destination ? ` → ${timeout.destination}` : ''}
                    {timeout.pathType ? ` (${timeout.pathType})` : ''}
                    {timeout.destinationReached ? ' ✓' : ''}
                  </div>
                ))}
              </div>
            </div>
          )}
          
          <div style={{ color: '#555' }}>
            {isAggregatedTimeout && timeoutCount > 1 
              ? `No IP response received for ${timeoutCount} consecutive hops.`
              : 'No IP response received for these hop(s).'
            }
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={S.container} onMouseDown={onMouseDownHeader}>
      <div style={S.header}>
        {/* Do not alter the next two lines! */}
        <div style={{ fontWeight: 600 }}>{headerText}</div>
        <span style={{ fontSize: 10, color: '#666' }}>{pinned ? 'Click Screen to unpin' : 'Click to pin'}</span>
      </div>
      <div style={S.body}>
        {Array.from(groups.entries()).map(([dest, ipMap]) => {
          const rows = Array.from(ipMap.values()).sort((a, b) => (a.minHop ?? 0) - (b.minHop ?? 0));
          return (
            <div key={dest} style={S.group}>
              <div style={S.groupTitle}>{dest}</div>
              {rows.map((r, i) => (
                <div key={`${dest}-${r.ip}-${i}`} style={S.row(i % 2 === 1)}>
                  <div style={S.rowTop}>
                    <span style={S.hopChip}>
                      {r.minHop != null && r.maxHop != null && r.minHop !== r.maxHop
                        ? `Hops ${r.minHop}-${r.maxHop}`
                        : `Hop ${r.minHop ?? r.maxHop ?? '?'}`}
                    </span>
                    <span style={S.host}>{r.hostname}</span>
                    <span style={S.ip}>({r.ip})</span>
                    {r.count > 1 && <span style={S.count}>×{r.count}</span>}
                  </div>
                  {(r.protoSet && r.protoSet.size > 0) || (Array.isArray(r.lossSet) && r.lossSet.length > 0) ? (
                    
                    <div style={S.badges}>
                      {r.protoSet && Array.from(r.protoSet).map((p) => (
                        <span key={`${dest}-${r.ip}-p-${p}`} style={S.protoBadge}>{p}</span>
                      ))}
                      {Array.isArray(r.lossSet) && r.lossSet.length > 0 && (() => {
                        const avgLoss = r.lossSet.reduce((a,b)=>a+b,0)/r.lossSet.length;
                        const rounded = Math.round(avgLoss);
                        const color = rounded === 100 ? '#b42318' : (rounded === 50 ? '#ba992dff' : undefined);
                        return (
                          <span key={`${dest}-${r.ip}-loss`} style={{ color }}>
                            Loss ~ {rounded}%
                          </span>
                        );
                      })()}
                    </div>
                  ) : null}
                  <div style={S.summary}>
                    {(() => {
                      const parts = [];
                      if (r.rttCount > 0) {
                        const avg = (r.rttSum / r.rttCount).toFixed(2);
                        const mn = (r.rttMin).toFixed(2);
                        const mx = (r.rttMax).toFixed(2);
                        parts.push(`RTT avg ${avg}ms (${mn}–${mx})`);
                      }
                      if (r.asnSet && r.asnSet.size > 0) {
                        const labels = Array.from(r.asnSet).map(a => {
                          const m = String(a).match(/\d+/);
                          return m ? `AS${m[0]}` : `AS ${a}`;
                        }).slice(0, 3);
                        const more = r.asnSet.size > 3 ? ` +${r.asnSet.size - 3}` : '';
                        parts.push(`ASN: ${labels.join(', ')}${more}`);
                      }
                      // show a representative seen timestamp (earliest) if present
                      // but hide timestamps when the tooltip is for a shared-IP view
                      if (!isSharedIPView && r.firstSeen) {
                        try {
                          const d = new Date(r.firstSeen);
                          if (!isNaN(d.getTime())) {
                            parts.push(`Seen: ${d.toLocaleString()}`);
                          }
                        } catch (e) { /* ignore bad dates */ }
                      }
                      return parts.length ? parts.join(' • ') : null;
                    })()}
                  </div>
                  {/* Edge filtering message */}
                  {r.isEdgeFiltered && r.edgeFilteringMessage && (
                    <div style={{ 
                      marginTop: 4, 
                      padding: '4px 6px', 
                      backgroundColor: '#fff3cd', 
                      border: '1px solid #ffeaa7', 
                      borderRadius: 3, 
                      fontSize: 10, 
                      color: '#856404' 
                    }}>
                      ⚠️ {r.edgeFilteringMessage}
                    </div>
                  )}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
