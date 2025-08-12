import { useCallback } from 'react';

export default function useGraphExport({ networkInstance, graphContainerRef, graph }) {
  const downloadAsPNG = useCallback(() => {
    if (!graphContainerRef.current || !networkInstance) return;
    const visCanvas = graphContainerRef.current.querySelector('canvas');
    if (!visCanvas) { alert('Graph not ready for export. Please try again.'); return; }

    try {
      const nodeIds = graph.nodes.map(node => node.id);
      const positions = networkInstance.getPositions(nodeIds);
      if (Object.keys(positions).length === 0) { alert('Graph layout not ready. Please wait a moment and try again.'); return; }

      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      Object.values(positions).forEach(pos => {
        minX = Math.min(minX, pos.x);
        maxX = Math.max(maxX, pos.x);
        minY = Math.min(minY, pos.y);
        maxY = Math.max(maxY, pos.y);
      });

      const padding = 80;
      minX -= padding; maxX += padding; minY -= padding; maxY += padding;

      const scale = 3; // high quality
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

      const canvasContentWidth = canvasMaxX - canvasMinX;
      const canvasContentHeight = canvasMaxY - canvasMinY;

      const exportCanvas = document.createElement('canvas');
      const ctx = exportCanvas.getContext('2d');
      exportCanvas.width = canvasContentWidth * scale;
      exportCanvas.height = canvasContentHeight * scale;

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.scale(scale, scale);

      ctx.drawImage(visCanvas, canvasMinX, canvasMinY, canvasContentWidth, canvasContentHeight, 0, 0, canvasContentWidth, canvasContentHeight);

      const link = document.createElement('a');
      link.download = `network-graph-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.png`;
      link.href = exportCanvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error('Error creating cropped PNG:', err);
      alert('Error creating PNG. Please try again.');
    }
  }, [networkInstance, graphContainerRef, graph]);

  const downloadAsSVG = useCallback(() => {
    if (!graphContainerRef.current || !networkInstance) return;
    const visCanvas = graphContainerRef.current.querySelector('canvas');
    if (!visCanvas) { alert('Graph not ready for export. Please try again.'); return; }

    try {
      const nodeIds = graph.nodes.map(node => node.id);
      const positions = networkInstance.getPositions(nodeIds);
      if (Object.keys(positions).length === 0) { alert('Graph layout not ready. Please wait a moment and try again.'); return; }

      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      Object.values(positions).forEach(pos => {
        minX = Math.min(minX, pos.x);
        maxX = Math.max(maxX, pos.x);
        minY = Math.min(minY, pos.y);
        maxY = Math.max(maxY, pos.y);
      });

      const padding = 80;
      minX -= padding; maxX += padding; minY -= padding; maxY += padding;

      const scale = 3;
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

      const canvasContentWidth = canvasMaxX - canvasMinX;
      const canvasContentHeight = canvasMaxY - canvasMinY;

      const cleanCanvas = document.createElement('canvas');
      const ctx = cleanCanvas.getContext('2d');
      cleanCanvas.width = canvasContentWidth * scale;
      cleanCanvas.height = canvasContentHeight * scale;

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, cleanCanvas.width, cleanCanvas.height);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.scale(scale, scale);
      ctx.drawImage(visCanvas, canvasMinX, canvasMinY, canvasContentWidth, canvasContentHeight, 0, 0, canvasContentWidth, canvasContentHeight);

      const svgWidth = cleanCanvas.width;
      const svgHeight = cleanCanvas.height;
      const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}"
     xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <rect width="100%" height="100%" fill="#ffffff"/>
  <image width="${svgWidth}" height="${svgHeight}" xlink:href="${cleanCanvas.toDataURL('image/png')}"/>
</svg>`;

      const blob = new Blob([svgContent], { type: 'image/svg+xml' });
      const link = document.createElement('a');
      link.download = `network-graph-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.svg`;
      link.href = URL.createObjectURL(blob);
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (err) {
      console.error('Error creating cropped SVG:', err);
      alert('Error creating SVG. Please try again.');
    }
  }, [networkInstance, graphContainerRef, graph]);

  return { downloadAsPNG, downloadAsSVG };
}