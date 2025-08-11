import { useState, useCallback, useMemo } from 'react';
import React from 'react';


export const useFilters = () => {
  const [destinationSearchTerm, setDestinationSearchTerm] = useState('');
  const [minRTT, setMinRTT] = useState('');
  const [maxRTT, setMaxRTT] = useState('');
  const [minUsagePercent, setMinUsagePercent] = useState('');
  const [selectedPathTypes, setSelectedPathTypes] = useState(['PRIMARY', 'ALTERNATIVE']);
  const [selectedProtocol, setSelectedProtocol] = useState('');
  const [showPrimaryOnly, setShowPrimaryOnly] = useState(false);

  // Memoize the reset function to prevent unnecessary re-renders
  const resetFilters = useCallback(() => {
    setDestinationSearchTerm('');
    setMinRTT('');
    setMaxRTT('');
    setMinUsagePercent('');
    setSelectedPathTypes(['PRIMARY', 'ALTERNATIVE']);
    setSelectedProtocol('');
    setShowPrimaryOnly(false);
  }, []);

  // Memoize the filters object to prevent unnecessary re-renders
  const filters = useMemo(() => ({
    destinationSearchTerm,
    minRTT,
    maxRTT,
    minUsagePercent,
    selectedPathTypes,
    selectedProtocol,
    showPrimaryOnly
  }), [
    destinationSearchTerm,
    minRTT,
    maxRTT,
    minUsagePercent,
    selectedPathTypes,
    selectedProtocol,
    showPrimaryOnly
  ]);

  // Memoize the setters to provide stable references
  const setters = useMemo(() => ({
    setDestinationSearchTerm,
    setMinRTT,
    setMaxRTT,
    setMinUsagePercent,
    setSelectedPathTypes,
    setSelectedProtocol,
    setShowPrimaryOnly,
    resetFilters
  }), [resetFilters]);

    const togglePathType = React.useCallback((pathType) => {
    setSelectedPathTypes(prev =>
      prev.includes(pathType) ? prev.filter(p => p !== pathType) : [...prev, pathType]
    );
  }, []);

  return {
    ...filters,
    ...setters,
    togglePathType
  };
}; 