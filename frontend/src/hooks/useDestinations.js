import { useState, useCallback, useEffect, useMemo } from 'react';
import apiService from '../services/api';

export const useDestinations = () => {
  const [selectedDestinationIds, setSelectedDestinationIds] = useState([]);
  const [availableDestinations, setAvailableDestinations] = useState([]);
  const [availableProtocols, setAvailableProtocols] = useState([]);
  const [selectedDomainNames, setSelectedDomainNames] = useState([]);
  const [domainGroups, setDomainGroups] = useState({});

  const loadAvailableDestinations = useCallback(async () => {
    try {
      const { flat, grouped } = await apiService.getDestinations();
      setAvailableDestinations(flat);
      setDomainGroups(grouped);
    } catch (err) {
      console.error('Error loading destinations:', err);
      setAvailableDestinations([]);
    }
  }, []);

  const loadAvailableProtocols = useCallback(async () => {
    try {
      const response = await apiService.getProtocols();
      const protocols = Array.isArray(response?.data) ? response.data : [];
      setAvailableProtocols(protocols);
    } catch (err) {
      console.error('Error loading protocols:', err);
      setAvailableProtocols([]);
      setDomainGroups({});
    }
  }, []);

  // Load available data on mount
  useEffect(() => {
    loadAvailableDestinations();
    loadAvailableProtocols();
  }, [loadAvailableDestinations, loadAvailableProtocols]);

  const resetDestinations = useCallback(() => {
    setSelectedDestinationIds([]);
    setSelectedDomainNames([]);
  }, []);

  // Derive selected objects from IDs
  const selectedDestinations = useMemo(() => {
    if (!availableDestinations.length || !selectedDestinationIds.length) return [];
    const byId = new Map(availableDestinations.map(d => [d.id, d]));
    return selectedDestinationIds.map(id => byId.get(id)).filter(Boolean);
  }, [availableDestinations, selectedDestinationIds]);

  // Derived: addresses for API/Graph
  const selectedDestinationAddresses = useMemo(() => {
    const addrSet = new Set(selectedDestinations.map(d => d.address));
    selectedDomainNames.forEach(dom => {
      const group = domainGroups[dom];
      if (group) group.destinations.forEach(d => addrSet.add(d.address));
    });
   return Array.from(addrSet).map(a => (typeof a === 'string' ? a.toLowerCase() : a));
  }, [selectedDestinations, selectedDomainNames, domainGroups]);

  // Helpers
  const toggleDestination = useCallback((id, domainName) => {
    setSelectedDestinationIds(prev => {
      const exists = prev.includes(id);
      const next = exists ? prev.filter(x => x !== id) : [...prev, id];

      // If this destination belonged to a domain that was "fully selected" remove that domain tag (becomes partial)
      if (domainName && selectedDomainNames.includes(domainName)) {
        setSelectedDomainNames(dPrev => dPrev.filter(d => d !== domainName));
      }
      return next;
    });
  }, [selectedDomainNames]);

  // Toggle full domain
  const toggleDomain = useCallback((domainName) => {
    const group = domainGroups[domainName];
    if (!group) return;
    const ids = group.destinations.map(d => d.id);

    setSelectedDomainNames(prev => {
      const isActive = prev.includes(domainName);
      if (isActive) {
        // Deselect domain: remove its name and its ids (unless some remain individually selected later)
        setSelectedDestinationIds(prevIds => prevIds.filter(id => !ids.includes(id)));
        return prev.filter(d => d !== domainName);
      } else {
        // Select domain: add its name AND add all ids (avoid duplicates)
        setSelectedDestinationIds(prevIds => {
          const set = new Set(prevIds);
            ids.forEach(i => set.add(i));
          return Array.from(set);
        });
        return [...prev, domainName];
      }
    });
  }, [domainGroups]);

  const selectAll = useCallback((ids) => {
    setSelectedDestinationIds(Array.from(new Set(ids)));
    setSelectedDomainNames([]);
  }, []);

  const clearAll = useCallback(() => {
    setSelectedDestinationIds([]);
    setSelectedDomainNames([]);
  }, []);


  const getFilteredDestinations = useCallback((searchTerm, filters = {}) => {
    const q = (searchTerm || '').toLowerCase();
    let filtered = availableDestinations;

    // Filter by search term
    if (q) {
      filtered = filtered.filter(d => (d.address || '').toLowerCase().includes(q));
    }

    // Filter by protocol
   if (Array.isArray(filters.selectedProtocols) && filters.selectedProtocols.length > 0) {
     const selSet = new Set(filters.selectedProtocols.map(p => String(p).toUpperCase()));
     filtered = filtered.filter(d => d.protocol && selSet.has(String(d.protocol).toUpperCase()));
   }

    // Add other filters here if needed

    return filtered;
  }, [availableDestinations]);

    // Helpers for tri-state in UI
  const getDomainSelectionState = useCallback((domainName) => {
    const group = domainGroups[domainName];
    if (!group) return 'none';
    const ids = group.destinations.map(d => d.id);
    const allSelectedViaDomain = selectedDomainNames.includes(domainName);
    if (allSelectedViaDomain) return 'all'; // entire domain forced
    const selectedCount = ids.filter(id => selectedDestinationIds.includes(id)).length;
    if (selectedCount === 0) return 'none';
    if (selectedCount === ids.length) return 'all';
    return 'partial';
  }, [domainGroups, selectedDestinationIds, selectedDomainNames]);

  return {
    // ids
    selectedDestinationIds,
    setSelectedDestinationIds,
    resetDestinations,
    // derived
    selectedDestinations,              // [{ id, address }]
    selectedDestinationAddresses,      // [address]
    selectedDomainNames,
    // lists
    availableDestinations,             // [{ id, address }]
    availableProtocols,
    domainGroups,
    // loaders
    loadAvailableDestinations,
    loadAvailableProtocols,
    // helpers
    toggleDomain,
    toggleDestination,
    selectAll,
    clearAll,
    getFilteredDestinations,
    getDomainSelectionState
  };
};