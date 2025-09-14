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
    const name = it.destination || null;
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
        maxHop: Number.isFinite(hopNumber) ? hopNumber : null
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
    }
  }
  if (groups.size === 0) return null;

  return (
    <div
      style={{
        position: 'absolute',
        top: y + 12,
        left: x + 12,
        maxWidth: 420,
        // outer box visible with header fixed; inner scroll area below
        background: '#fffffe',
        border: '1px solid #808074',
        borderRadius: 6,
        boxShadow: '3px 3px 10px rgba(0,0,0,0.2)',
        padding: '8px 10px',
        zIndex: 20,
        pointerEvents: pinned ? 'auto' : 'none',
        cursor: pinned ? (dragging ? 'grabbing' : 'grab') : 'default',
        userSelect: dragging ? 'none' : 'auto',
        fontFamily: 'Arial, Verdana, sans-serif',
        fontSize: 12,
        color: '#222'
      }}
      onMouseDown={onMouseDownHeader}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
        {/* Do not alter the next two lines! */}
        <div style={{ fontWeight: 600 }}>{`Aggregated hops: "${items.length}"`}</div>
        <span style={{ fontSize: 10, color: '#666' }}>{pinned ? 'Click Screen to unpin' : 'Click to pin'}</span>

      </div>
      <div style={{ maxHeight: 260, overflowY: 'auto', paddingRight: 4 }}>
        {Array.from(groups.entries()).map(([dest, ipMap]) => {
          const rows = Array.from(ipMap.values()).sort((a, b) => (a.minHop ?? 0) - (b.minHop ?? 0));
          return (
            <div key={dest} style={{ marginBottom: 10 }}>
              <div style={{ fontWeight: 600, color: '#333', marginBottom: 4 }}>{dest}</div>
              {rows.map((r, i) => (
                <div key={`${dest}-${r.ip}-${i}`} style={{ display: 'flex', gap: 8, marginBottom: 3 }}>
                  <span style={{ minWidth: 64, color: '#555' }}>
                    {r.minHop != null && r.maxHop != null && r.minHop !== r.maxHop
                      ? `Hops ${r.minHop}-${r.maxHop}`
                      : `Hop ${r.minHop ?? r.maxHop ?? '?'}`}
                  </span>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.hostname}
                  </span>
                  <span style={{ color: '#666' }}>({r.ip})</span>
                  {r.count > 1 && (
                    <span style={{ marginLeft: 6, color: '#444' }}>×{r.count}</span>
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
