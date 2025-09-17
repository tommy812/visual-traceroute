import { useState, useCallback } from 'react';

export const useHopDrawer = () => {
  const [selectedHop, setSelectedHop] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const handleHopSelect = useCallback((hopData) => {
    // Handle null or undefined hopData
    if (!hopData) {
      setSelectedHop(null);
      setIsDrawerOpen(false);
      return;
    }

    // Check if hopData is an array (from NetworkGraph) or single object
    if (Array.isArray(hopData)) {
      // NetworkGraph passes arrays of hop data
      if (hopData.length === 0) {
        setSelectedHop(null);
        setIsDrawerOpen(false);
        return;
      }
      
      // Use the first hop as the primary data, but keep the full array
      const primaryHop = hopData[0];
      const processedHopData = {
        ...primaryHop,
        destination: primaryHop.destination || 'Unknown',
        pathType: primaryHop.pathType || 'PRIMARY',
        hop_number: primaryHop.hop_number || 0,
        is_timeout: primaryHop.is_timeout || false,
        // Store the full array for the drawer
        allHops: hopData
      };
      
      setSelectedHop(processedHopData);
      setIsDrawerOpen(true);
    } else {
      // Single hop object (fallback)
      const processedHopData = {
        ...hopData,
        destination: hopData.destination || 'Unknown',
        pathType: hopData.pathType || 'PRIMARY',
        hop_number: hopData.hop_number || 0,
        is_timeout: hopData.is_timeout || false,
        allHops: [hopData]
      };
      
      setSelectedHop(processedHopData);
      setIsDrawerOpen(true);
    }
  }, []);

  const closeDrawer = useCallback(() => {
    setIsDrawerOpen(false);
    setSelectedHop(null);
  }, []);

  return {
    selectedHop,
    isDrawerOpen,
    handleHopSelect,
    closeDrawer
  };
}; 