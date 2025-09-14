import React, { useEffect, useMemo, useState, useCallback } from 'react';
import api from '../../../services/api';
import parseTraceroute from '../../../utils/parseTraceroute';

/**
 * FullTraceroutePanel
 * Props:
 * - traceRunId: number (optional) — if provided, fetch that run's raw_output
 * - rawOutput: string (optional) — if provided, parse directly
 * - title: string (optional)
 * - compact: boolean (optional) — tighter spacing for embedding
 * - onHoverHop: (hopNumber, responseIdx) => void (optional)
 * - onLeave: () => void (optional)
 */
export default function FullTraceroutePanel({ traceRunId = null, destinationAddress = null, rawOutput = null, title = 'Complete Traceroute', compact = false, onHoverHop, onLeave }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [raw, setRaw] = useState(rawOutput || null);

  useEffect(() => {
    let cancelled = false;
    async function fetchRun() {
      if (rawOutput) return;
      setLoading(true); setError(null);
      try {
        let output = null;
        if (traceRunId) {
          const res = await api.getTraceRunById(traceRunId);
          if (cancelled) return;
          output = res?.data?.raw_output || res?.data?.data?.raw_output || null;
        } else if (destinationAddress) {
          const runs = await api.getTraceRuns({ destination: destinationAddress, limit: 1, offset: 0 });
          if (cancelled) return;
          const first = Array.isArray(runs?.data) ? runs.data[0] : null;
          output = first?.raw_output || null;
        }
        setRaw(output);
      } catch (e) {
        if (!cancelled) setError('Failed to load raw traceroute');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchRun();
    return () => { cancelled = true; };
  }, [traceRunId, destinationAddress, rawOutput]);

  const parsed = useMemo(() => parseTraceroute(raw || ''), [raw]);

  const handleHover = useCallback((hopIndex, respIndex, resp) => {
    if (typeof onHoverHop === 'function') onHoverHop(hopIndex, respIndex);
    // Also broadcast a UI event so graph can react (highlight path segments)
    window.dispatchEvent(new CustomEvent('traceroute:hover-hop', {
      detail: {
        hopIndex,
        respIndex,
        ip: resp?.ip || null,
        hostname: resp?.hostname || null,
        isTimeout: !!resp?.timeout,
        rtts: Array.isArray(resp?.rtts) ? resp.rtts : [],
        destinationAddress: destinationAddress || null,
        traceRunId: traceRunId || null
      }
    }));
  }, [onHoverHop, destinationAddress, traceRunId]);

  const handleLeave = useCallback(() => {
    if (typeof onLeave === 'function') onLeave();
    window.dispatchEvent(new CustomEvent('traceroute:leave')); // clear highlight
  }, [onLeave]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <h4 style={{ margin: 0, color: '#2c3e50', fontSize: 14 }}>{title}</h4>
        {parsed?.maxHops ? (
          <span style={{ fontSize: 12, color: '#666' }}>{parsed.maxHops} hops max</span>
        ) : null}
      </div>

      {loading && (
        <div style={{ background: '#eef5ff', border: '1px solid #cfe2ff', padding: 10, borderRadius: 6, color: '#2c3e50' }}>
          Loading traceroute...
        </div>
      )}
      {error && (
        <div style={{ background: '#fdecea', border: '1px solid #f5c2c7', padding: 10, borderRadius: 6, color: '#842029' }}>
          {error}
        </div>
      )}
      {!loading && !error && parsed?.hops?.length === 0 && (
        <div style={{ background: '#fff3cd', border: '1px solid #ffe69c', padding: 10, borderRadius: 6, color: '#664d03' }}>
          No traceroute data available.
        </div>
      )}

      {parsed?.hops?.length > 0 && (
        <div onMouseLeave={handleLeave} style={{ border: '1px solid #e0e0e0', borderRadius: 6, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '50px 1fr', background: '#f8f9fa', borderBottom: '1px solid #e0e0e0', fontWeight: 600, fontSize: 12, color: '#333' }}>
            <div style={{ padding: compact ? '6px 8px' : '8px 12px' }}>Hop</div>
            <div style={{ padding: compact ? '6px 8px' : '8px 12px' }}>IP / Hostname • RTT (ms)</div>
          </div>
          {parsed.hops.map((h, i) => (
            <div key={i} style={{ borderBottom: '1px solid #eee', display: 'grid', gridTemplateColumns: '50px 1fr' }}>
              <div style={{ padding: compact ? '6px 8px' : '8px 12px', fontFamily: 'monospace', color: '#444' }}>{h.hop}</div>
              <div style={{ padding: compact ? '6px 8px' : '8px 12px' }}>
                {h.responses.length === 0 ? (
                  <span style={{ color: '#999' }}>*</span>
                ) : (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {h.responses.map((r, j) => (
                      <div
                        key={j}
            onMouseEnter={() => handleHover(h.hop, j, r)}
                        style={{
                          background: r.timeout ? '#fbe9e7' : '#eef9f1',
                          border: r.timeout ? '1px solid #f8d7da' : '1px solid #bee5eb',
                          borderRadius: 6,
                          padding: compact ? '4px 6px' : '6px 8px',
                          fontSize: 12,
                          color: '#333'
                        }}
                        title={r.timeout ? 'Timeout' : `${r.hostname ? r.hostname + ' ' : ''}${r.ip || ''}`}
                      >
                        {r.timeout ? (
                          <span>*</span>
                        ) : (
                          <span style={{ fontFamily: 'monospace' }}>
                            {r.ip}
                            {r.hostname ? ` (${r.hostname})` : ''}
                          </span>
                        )}
                        {!r.timeout && r.rtts?.length ? (
                          <>
                            {' '}•{' '}
                            {r.rtts.map((v, idx) => (
                              <span key={idx} style={{ marginRight: 4 }}>{Number.isFinite(v) ? v.toFixed(2) : v}</span>
                            ))}
                          </>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
