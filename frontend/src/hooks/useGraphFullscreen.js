import { useCallback, useEffect, useMemo, useState } from 'react';

export default function useGraphFullscreen() {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const update = () => setDimensions({ width: window.innerWidth, height: window.innerHeight });
    if (isFullscreen) {
      update();
      window.addEventListener('resize', update);
      return () => window.removeEventListener('resize', update);
    }
  }, [isFullscreen]);

  const toggleFullscreen = useCallback(() => setIsFullscreen(v => !v), []);
  const containerStyle = useMemo(() => ({
    border: isFullscreen ? "none" : "1px solid #ccc",
    borderRadius: isFullscreen ? "0" : "8px",
    position: isFullscreen ? "fixed" : "relative",
    top: isFullscreen ? "0" : "auto",
    left: isFullscreen ? "0" : "auto",
    width: isFullscreen ? "100vw" : "100%",
    height: isFullscreen ? "100vh" : "100%",
    zIndex: isFullscreen ? 9999 : "auto",
    backgroundColor: isFullscreen ? "#fff" : "transparent",
    margin: isFullscreen ? "0" : "auto",
    padding: isFullscreen ? "0" : "auto",
    overflow: isFullscreen ? "hidden" : "visible"
  }), [isFullscreen]);

  return { isFullscreen, dimensions, toggleFullscreen, containerStyle };
}