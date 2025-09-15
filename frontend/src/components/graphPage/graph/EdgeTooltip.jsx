import React, { useEffect, useRef, useState } from 'react';

export default function EdgeTooltip({ visible, x, y, edge, getNodeLabel, onMove }) {
  const [dragging, setDragging] = useState(false);
  const startRef = useRef({ startX: 0, startY: 0, origX: 0, origY: 0 });

  const fromLabel = edge ? (getNodeLabel?.(edge.from) || String(edge.from)) : '';
  const toLabel = edge ? (getNodeLabel?.(edge.to) || String(edge.to)) : '';
  const destinations = edge && Array.isArray(edge.destinations)
    ? edge.destinations
        .map((d) => {
          // If already a formatted string, keep as-is
          if (typeof d === 'string') return d;
          if (d && typeof d === 'object') {
            const addr = d.destinationAddress || d.destination || d.address || d.dest || d.addr || '';
            const dom = d.destinationDomain || d.domainName || d.domain || d.name || '';
            const base = addr || (typeof d.toString === 'function' ? d.toString() : '');
            return dom ? `${base} (${dom})` : base;
          }
          return String(d);
        })
        .filter(Boolean)
    : [];
  const paths = edge && Array.isArray(edge.paths) ? edge.paths : (edge?.paths ? edge.paths : []);

  const onMouseDownHeader = (e) => {
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

  const S = {
    container: {
      position: 'absolute',
      top: y + 12,
      left: x + 12,
      maxWidth: 440,
      background: '#ffffffee',
      border: '1px solid #D6D6D6',
      borderRadius: 10,
      boxShadow: '0 12px 28px rgba(0,0,0,0.18)',
      padding: 0,
      zIndex: 20,
      fontFamily: 'Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif',
      fontSize: 12,
      color: '#222'
    },
    header: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      padding: '8px 10px',
      background: dragging ? '#f0f9ff' : '#f6f7f9',
      color: '#111',
      borderTopLeftRadius: 10,
      borderTopRightRadius: 10,
      borderBottom: '1px solid #e5e7eb',
      cursor: dragging ? 'grabbing' : 'grab',
      userSelect: dragging ? 'none' : 'auto'
    },
    body: { maxHeight: 280, overflowY: 'auto', padding: '8px 10px' },
    list: { margin: 0, paddingLeft: 16 }
  };

  if (!visible || !edge) return null;

  return (
    <div style={S.container}>
      <div style={S.header} onMouseDown={onMouseDownHeader}>
        <div style={{ fontWeight: 600 }}>Segment</div>
      </div>
      <div style={S.body}>
        <div style={{ marginBottom: 6 }}>
          <strong>From:</strong> {fromLabel}
        </div>
        <div style={{ marginBottom: 6 }}>
          <strong>To:</strong> {toLabel}
        </div>
        {destinations.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <strong>Destinations:</strong>
            <ul style={S.list}>
              {destinations.map((d, i) => <li key={i}>{d}</li>)}
            </ul>
          </div>
        )}
        <div style={{ marginTop: 8 }}>
          <strong>Path count:</strong> {paths.length || (edge.paths ? edge.paths.length : 0)}
        </div>
      </div>
    </div>
  );
}
