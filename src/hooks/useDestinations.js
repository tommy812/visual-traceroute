import { useState, useCallback, useEffect, useMemo } from 'react';
import apiService from '../services/api';

export const useDestinations = () => {
  const [selectedDestinationIds, setSelectedDestinationIds] = useState([]);
  const [availableDestinations, setAvailableDestinations] = useState([]);
  const [availableProtocols, setAvailableProtocols] = useState([]);

  const loadAvailableDestinations = useCallback(async () => {
    try {
      const response = await apiService.getDestinations();
      const destinations = Array.isArray(response?.data) ? response.data : [];
      // Expecting [{ id: number, address: string }]
      setAvailableDestinations(destinations);
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
    }
  }, []);

  // Load available data on mount
  useEffect(() => {
    loadAvailableDestinations();
    loadAvailableProtocols();
  }, [loadAvailableDestinations, loadAvailableProtocols]);

  const resetDestinations = useCallback(() => {
    setSelectedDestinationIds([]);
  }, []);

  // Derive selected objects from IDs
  const selectedDestinations = useMemo(() => {
    if (!availableDestinations.length || !selectedDestinationIds.length) return [];
    const byId = new Map(availableDestinations.map(d => [d.id, d]));
    return selectedDestinationIds.map(id => byId.get(id)).filter(Boolean);
  }, [availableDestinations, selectedDestinationIds]);

  return {
    // ids
    selectedDestinationIds,
    setSelectedDestinationIds,
    resetDestinations,
    // derived
    selectedDestinations, // [{ id, address }]
    // lists
    availableDestinations, // [{ id, address }]
    availableProtocols,
    // loaders
    loadAvailableDestinations,
    loadAvailableProtocols
  };
};