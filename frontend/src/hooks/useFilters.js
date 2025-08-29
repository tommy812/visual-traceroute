import { useState, useCallback, useMemo } from 'react';
import React from 'react';


export const useFilters = () => {
  const [destinationSearchTerm, setDestinationSearchTerm] = useState('');
  const [minRTT, setMinRTT] = useState('');
  const [maxRTT, setMaxRTT] = useState('');
  const [minUsagePercent, setMinUsagePercent] = useState('');
  const [selectedPathTypes, setSelectedPathTypes] = useState(['PRIMARY', 'ALTERNATIVE']);
  const [selectedProtocols, setSelectedProtocols] = useState([]);
  const [showPrimaryOnly, setShowPrimaryOnly] = useState(false);

  // Memoize the reset function to prevent unnecessary re-renders
  const resetFilters = useCallback(() => {
    setDestinationSearchTerm('');
    setMinRTT('');
    setMaxRTT('');
    setMinUsagePercent('');
    setSelectedPathTypes(['PRIMARY', 'ALTERNATIVE']);
    setSelectedProtocols([]);
    setShowPrimaryOnly(false);
  }, []);

  // Memoize the filters object to prevent unnecessary re-renders
  const filters = useMemo(() => ({
    destinationSearchTerm,
    minRTT,
    maxRTT,
    minUsagePercent,
    selectedPathTypes,
    selectedProtocols,
    showPrimaryOnly
  }), [
    destinationSearchTerm,
    minRTT,
    maxRTT,
    minUsagePercent,
    selectedPathTypes,
    selectedProtocols,
    showPrimaryOnly
  ]);

  // Memoize the setters to provide stable references
  const setters = useMemo(() => ({
    setDestinationSearchTerm,
    setMinRTT,
    setMaxRTT,
    setMinUsagePercent,
    setSelectedPathTypes,
    setSelectedProtocols,
    setShowPrimaryOnly,
    resetFilters
  }), [resetFilters]);

    const togglePathType = React.useCallback((pathType) => {
    setSelectedPathTypes(prev =>
      prev.includes(pathType) ? prev.filter(p => p !== pathType) : [...prev, pathType]
    );
  }, []);

  const toggleProtocol = useCallback((proto) => {
    setSelectedProtocols(prev =>
      prev.includes(proto)
        ? prev.filter(p => p !== proto)
        : [...prev, proto]
    );
  }, []);

  const clearProtocols = useCallback(() => setSelectedProtocols([]), []);


  return {
    ...filters,
    ...setters,
    togglePathType,
    toggleProtocol,
    clearProtocols
  };
}; 