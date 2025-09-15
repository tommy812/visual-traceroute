import { useCallback } from 'react';

export default function useGraphExport({ networkInstance, graphContainerRef, graph }) {

  // Common: compute cropped bounds & capture canvas section into an offscreen canvas
  const captureCanvasRegion = useCallback((scale = 3) => {
    if (!graphContainerRef.current || !networkInstance) return null;
    const visCanvas = graphContainerRef.current.querySelector('canvas');
    if (!visCanvas) return null;

    const nodeIds = graph.nodes.map(n => n.id);
    const positions = networkInstance.getPositions(nodeIds);
    if (Object.keys(positions).length === 0) return null;

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    Object.values(positions).forEach(pos => {
      minX = Math.min(minX, pos.x);
      maxX = Math.max(maxX, pos.x);
      minY = Math.min(minY, pos.y);
      maxY = Math.max(maxY, pos.y);
    });

    const padding = 80;
    minX -= padding; maxX += padding; minY -= padding; maxY += padding;

    const viewPosition = networkInstance.getViewPosition();
    const canvasScale = networkInstance.getScale();
    const canvasWidth = visCanvas.width;
    const canvasHeight = visCanvas.height;
    const centerX = canvasWidth / 2;
    const centerY = canvasHeight / 2;

    const canvasMinX = (minX - viewPosition.x) * canvasScale + centerX;
    const canvasMinY = (minY - viewPosition.y) * canvasScale + centerY;
    const canvasMaxX = (maxX - viewPosition.x) * canvasScale + centerX;
    const canvasMaxY = (maxY - viewPosition.y) * canvasScale + centerY;

    const cropW = canvasMaxX - canvasMinX;
    const cropH = canvasMaxY - canvasMinY;

    const off = document.createElement('canvas');
    off.width = cropW * scale;
    off.height = cropH * scale;
    const ctx = off.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.scale(scale, scale);
    ctx.drawImage(
      visCanvas,
      canvasMinX, canvasMinY, cropW, cropH,
      0, 0, cropW, cropH
    );

    return { off, width: cropW * scale, height: cropH * scale };
  }, [graph, graphContainerRef, networkInstance]);

  const downloadAsPNG = useCallback(async () => {
    if (!graph || !networkInstance || !graphContainerRef.current) { alert('Graph not ready for export.'); return; }

    // compute node bounding box in world coords (reuse capture logic)
    const nodeIds = graph.nodes.map(n => n.id);
    const positions = networkInstance.getPositions(nodeIds);
    if (Object.keys(positions).length === 0) { alert('Graph not ready for export.'); return; }
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    Object.values(positions).forEach(pos => {
      minX = Math.min(minX, pos.x);
      maxX = Math.max(maxX, pos.x);
      minY = Math.min(minY, pos.y);
      maxY = Math.max(maxY, pos.y);
    });

    const padding = 80;
    minX -= padding; maxX += padding; minY -= padding; maxY += padding;

    const visCanvas = graphContainerRef.current.querySelector('canvas');
    if (!visCanvas) { alert('Graph canvas not found'); return; }

  // capture the current view (no repositioning) at higher resolution
  const capture = captureCanvasRegion(3);
    if (!capture) {
      alert('Graph not ready for export.');
      return;
    }

    const { off } = capture;
    // Optional white background (keep for now)
    const ctx = off.getContext('2d');
    ctx.globalCompositeOperation = 'destination-over';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, off.width, off.height);

    // generate blob and download
    await new Promise((resolve) => {
      off.toBlob((blob) => {
        if (!blob) { alert('Failed to generate image blob'); resolve(); return; }
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.style.display = 'none';
        link.href = url;
        link.download = `network-graph-${new Date().toISOString().slice(0,19).replace(/:/g,'-')}.png`;
        document.body.appendChild(link);
        link.click();
        setTimeout(() => {
          URL.revokeObjectURL(url);
          link.remove();
          resolve();
        }, 1000);
      }, 'image/png');
    });

  // no view restore required since we did not change the user's view
  }, [captureCanvasRegion, graph, networkInstance, graphContainerRef]);

  // True SVG exporter: builds vector SVG from graph nodes and edges using network positions
  const downloadAsSVG = useCallback(() => {
    if (!graph || !networkInstance) { alert('Graph not ready for export.'); return; }

    try {
      const nodeIds = graph.nodes.map(n => n.id);
      const positions = networkInstance.getPositions(nodeIds);
      if (!positions || Object.keys(positions).length === 0) { alert('Graph not ready for export.'); return; }

      // compute bounds
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      Object.values(positions).forEach(p => {
        minX = Math.min(minX, p.x);
        maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y);
        maxY = Math.max(maxY, p.y);
      });
      const padding = 80;
      minX -= padding; maxX += padding; minY -= padding; maxY += padding;

      const width = Math.ceil(maxX - minX);
      const height = Math.ceil(maxY - minY);

      // Helper to escape text
      const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

      // Build defs for styles and include placeholders for per-element styling
      const styles = `
        .edge { stroke-linecap: round; fill: none; }
        .node { stroke-linecap: round; }
        .label { font-family: Arial, Helvetica, sans-serif; }
      `;

      // Build edge elements with exact visual properties where available
      const edgeElements = (graph.edges || []).map(edge => {
        const from = positions[edge.from];
        const to = positions[edge.to];
        if (!from || !to) return '';
        const x1 = (from.x - minX).toFixed(2);
        const y1 = (from.y - minY).toFixed(2);
        const x2 = (to.x - minX).toFixed(2);
        const y2 = (to.y - minY).toFixed(2);
        const color = (edge.color && (edge.color.color || edge.color.background || edge.color.border)) || '#999';
        const opacity = (edge.color && (edge.color.opacity != null ? edge.color.opacity : 1)) || 1;
        const widthAttr = (edge.width != null ? edge.width : (edge.physics === false ? 2 : 1.5));
        const dash = (edge.dashes ? (Array.isArray(edge.dashes) ? edge.dashes.join(' ') : '4 3') : '');
        const cls = (edge.pathType === 'PRIMARY' || edge.isPrimary) ? 'primary' : 'alternative';
        const dashAttr = dash ? `stroke-dasharray="${dash}"` : '';
        return `<line class="edge ${cls}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-opacity="${opacity}" stroke-width="${widthAttr}" ${dashAttr} />`;
      }).join('\n');

      // Build node elements with style information and labels
      const nodeElements = (graph.nodes || []).map(node => {
        const pos = positions[node.id];
        if (!pos) return '';
        const x = (pos.x - minX).toFixed(2);
        const y = (pos.y - minY).toFixed(2);
        const r = Math.max(4, (node.size || node.scaledSize || 10) / 2);
        const fill = (node.color && (node.color.background || node.color.fill)) || (node.color && node.color.border) || '#ffffff';
        const stroke = (node.color && node.color.border) || '#333';
        const strokeWidth = (node.borderWidth != null ? node.borderWidth : 1);
        const isTimeout = node.nodeType === 'timeout' || node.nodeType === 'timeout_group';
        const labelText = esc(node.label || node.ip || node.id || '');
        const fontSize = (node.font && node.font.size) ? node.font.size : 12;
        const labelX = (parseFloat(x) + r + 4).toFixed(2);
        const labelY = (parseFloat(y) + (fontSize / 3)).toFixed(2);
        const nodeClass = isTimeout ? 'node timeout' : 'node';
        return `<g class="vg-node"><circle class="${nodeClass}" cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" /><text class="label" x="${labelX}" y="${labelY}" font-size="${fontSize}px">${labelText}</text></g>`;
      }).join('\n');

      // Add an inline script to enable basic pan & zoom on the exported SVG
      const panZoomScript = (
        '(function(){' +
        'var svg = document.documentElement;' +
        'var viewport = document.getElementById("viewport");' +
        'if(!viewport) return;' +
        'var scale = 1, tx = 0, ty = 0;' +
        'var dragging = false, lastX = 0, lastY = 0;' +
        'function setTransform(){ viewport.setAttribute("transform", "translate("+tx+" "+ty+") scale("+scale+")"); }' +
        'svg.addEventListener("wheel", function(e){ e.preventDefault(); var rect = svg.getBoundingClientRect(); var mx = e.clientX - rect.left; var my = e.clientY - rect.top; var oldScale = scale; var factor = e.deltaY > 0 ? 0.9 : 1.1; scale = Math.max(0.05, Math.min(10, scale * factor)); tx = mx - (mx - tx) * (scale/oldScale); ty = my - (my - ty) * (scale/oldScale); setTransform(); }, { passive: false });' +
        'svg.addEventListener("mousedown", function(e){ dragging = true; lastX = e.clientX; lastY = e.clientY; });' +
        'svg.addEventListener("mousemove", function(e){ if(!dragging) return; var dx = e.clientX - lastX; var dy = e.clientY - lastY; lastX = e.clientX; lastY = e.clientY; tx += dx; ty += dy; setTransform(); });' +
        'svg.addEventListener("mouseup", function(){ dragging = false; });' +
        'svg.addEventListener("mouseleave", function(){ dragging = false; });' +
        '})()'
      );

      const svg = `<?xml version="1.0" encoding="UTF-8"?>\n` +
        `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet">\n` +
        `<defs><style type="text/css"><![CDATA[${styles}]]></style></defs>\n` +
        `<rect width="100%" height="100%" fill="#ffffff" />\n` +
        `<g id="viewport">\n` +
        `${edgeElements}\n` +
        `${nodeElements}\n` +
        `</g>\n` +
  `<script type="application/ecmascript"><![CDATA[${panZoomScript}]]></script>\n` +
        `</svg>`;

      const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.style.display = 'none';
      link.href = url;
      link.download = `network-graph-${new Date().toISOString().slice(0,19).replace(/:/g,'-')}.svg`;
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        URL.revokeObjectURL(url);
        link.remove();
      }, 1000);

    } catch (err) {
      console.error('SVG export failed', err);
      alert('SVG export failed: ' + (err?.message || String(err)));
    }
  }, [graph, networkInstance]);

  return { downloadAsPNG, downloadAsSVG };
}
