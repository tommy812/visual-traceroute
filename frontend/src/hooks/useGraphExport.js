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

  const downloadAsPNG = useCallback(() => {
    const capture = captureCanvasRegion(3);
    if (!capture) { alert('Graph not ready for export.'); return; }
    const { off } = capture;

    // Optional white background (keep for now)
    const ctx = off.getContext('2d');
    ctx.globalCompositeOperation = 'destination-over';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, off.width, off.height);

    const link = document.createElement('a');
    link.download = `network-graph-${new Date().toISOString().slice(0,19).replace(/:/g,'-')}.png`;
    link.href = off.toDataURL('image/png');
    link.click();
  }, [captureCanvasRegion]);

  // New: optionally transparent SVG wrapper
  const downloadAsSVG = useCallback((transparent = false) => {
    const capture = captureCanvasRegion(3);
    if (!capture) { alert('Graph not ready for export.'); return; }
    const { off, width, height } = capture;

    if (!transparent) {
      // Paint white behind if not transparent
      const ctx = off.getContext('2d');
      ctx.globalCompositeOperation = 'destination-over';
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, off.width, off.height);
    }

    const pngData = off.toDataURL('image/png');
    const bgRect = transparent ? '' : '<rect width="100%" height="100%" fill="#ffffff"/>';
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
${bgRect}
<image width="${width}" height="${height}" xlink:href="${pngData}"/>
</svg>`;

    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const link = document.createElement('a');
    link.download = `network-graph-${new Date().toISOString().slice(0,19).replace(/:/g,'-')}.svg`;
    link.href = URL.createObjectURL(blob);
    link.click();
    URL.revokeObjectURL(link.href);
  }, [captureCanvasRegion]);

  return { downloadAsPNG, downloadAsSVG };
}