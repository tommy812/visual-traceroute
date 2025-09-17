import { useState, useCallback, useMemo } from 'react';
import React from 'react';


export const useFilters = () => {
  const [destinationSearchTerm, setDestinationSearchTerm] = useState('');
  const [minRTT, setMinRTT] = useState('');
  const [maxRTT, setMaxRTT] = useState('');
  const [minUsagePercent, setMinUsagePercent] = useState('');
  // Path type options: MOST_USED (most common), FASTEST (lowest avg RTT), SHORTEST (fewest hops), ALTERNATIVE (other paths)
  const [selectedPathTypes, setSelectedPathTypes] = useState([]);
  const [showReachedOnly, setShowReachedOnly] = useState(false);
  const [showUnreachedOnly, setShowUnreachedOnly] = useState(false);
  const [selectedProtocols, setSelectedProtocols] = useState([]);
  // keep the external flag name for compatibility but treat it as "show most used only"
  const [showPrimaryOnly, setShowPrimaryOnly] = useState(false);
  const [hideReachedOnly, setHideReachedOnly] = useState(false); // NEW


  // Memoize the reset function to prevent unnecessary re-renders
  const resetFilters = useCallback(() => {
    setDestinationSearchTerm('');
    setMinRTT('');
    setMaxRTT('');
    setMinUsagePercent('');
  setSelectedPathTypes([]);
    setSelectedProtocols([]);
    setShowPrimaryOnly(false);
    setHideReachedOnly(false);
  setShowReachedOnly(false);
  setShowUnreachedOnly(false);
  }, []);

  // Memoize the filters object to prevent unnecessary re-renders
  const filters = useMemo(() => ({
    destinationSearchTerm,
    minRTT,
    maxRTT,
    minUsagePercent,
  selectedPathTypes,
    selectedProtocols,
    showPrimaryOnly,
  hideReachedOnly,
  showReachedOnly,
  showUnreachedOnly
  }), [
    destinationSearchTerm,
    minRTT,
    maxRTT,
    minUsagePercent,
    selectedPathTypes,
    selectedProtocols,
    showPrimaryOnly,
  hideReachedOnly,
  showReachedOnly,
  showUnreachedOnly
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
    setHideReachedOnly,
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
    clearProtocols,
    selectedPathTypes, setSelectedPathTypes,
    showReachedOnly, setShowReachedOnly,
    showUnreachedOnly, setShowUnreachedOnly
  };
}; 