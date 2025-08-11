import { useState, useCallback } from 'react';

export const useHopDrawer = () => {
  const [selectedHop, setSelectedHop] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const handleHopSelect = useCallback((hopData) => {
    console.log('handleHopSelect received:', hopData);
    
    // Handle null or undefined hopData
    if (!hopData) {
      console.log('No hopData, closing drawer');
      setSelectedHop(null);
      setIsDrawerOpen(false);
      return;
    }

    // Check if hopData is an array (from NetworkGraph) or single object
    if (Array.isArray(hopData)) {
      console.log('Processing array of hop data, length:', hopData.length);
      // NetworkGraph passes arrays of hop data
      if (hopData.length === 0) {
        console.log('Empty array, closing drawer');
        setSelectedHop(null);
        setIsDrawerOpen(false);
        return;
      }
      
      // Use the first hop as the primary data, but keep the full array
      const primaryHop = hopData[0];
      console.log('Primary hop data:', primaryHop);
      const processedHopData = {
        ...primaryHop,
        destination: primaryHop.destination || 'Unknown',
        pathType: primaryHop.pathType || 'PRIMARY',
        hop_number: primaryHop.hop_number || 0,
        is_timeout: primaryHop.is_timeout || false,
        // Store the full array for the drawer
        allHops: hopData
      };
      
      console.log('Processed hop data:', processedHopData);
      setSelectedHop(processedHopData);
      setIsDrawerOpen(true);
    } else {
      console.log('Processing single hop object');
      // Single hop object (fallback)
      const processedHopData = {
        ...hopData,
        destination: hopData.destination || 'Unknown',
        pathType: hopData.pathType || 'PRIMARY',
        hop_number: hopData.hop_number || 0,
        is_timeout: hopData.is_timeout || false,
        allHops: [hopData]
      };
      
      console.log('Processed single hop data:', processedHopData);
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