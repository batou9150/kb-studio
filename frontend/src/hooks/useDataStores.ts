import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import type { DataStoreOption } from '../components/DataStoreSelector';

export function useDataStores(storageKey: string) {
  const [dataStores, setDataStores] = useState<DataStoreOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataStoreId, setDataStoreId] = useState('');
  const [location, setLocation] = useState('global');

  const fetchDataStores = useCallback(async () => {
    setLoading(true);
    try {
      const list = await api.listDataStores();
      setDataStores(list);
      return list;
    } catch {
      setDataStores([]);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // Load list + restore last selection from localStorage
  useEffect(() => {
    fetchDataStores().then(list => {
      const saved = localStorage.getItem(storageKey);
      if (saved && list.length > 0) {
        try {
          const { dataStoreId: savedId, location: savedLoc } = JSON.parse(saved);
          if (list.some(ds => ds.dataStoreId === savedId && ds.location === savedLoc)) {
            setDataStoreId(savedId);
            setLocation(savedLoc);
          }
        } catch {}
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist selection
  useEffect(() => {
    if (dataStoreId) {
      localStorage.setItem(storageKey, JSON.stringify({ dataStoreId, location }));
    }
  }, [dataStoreId, location, storageKey]);

  const selectDataStore = useCallback((key: string, list?: DataStoreOption[]) => {
    const source = list ?? dataStores;
    const ds = source.find(d => `${d.location}/${d.dataStoreId}` === key);
    if (ds) {
      setDataStoreId(ds.dataStoreId);
      setLocation(ds.location);
      return ds;
    }
    return null;
  }, [dataStores]);

  const clearSelection = useCallback(() => {
    setDataStoreId('');
    setLocation('global');
    localStorage.removeItem(storageKey);
  }, [storageKey]);

  const selectedKey = dataStoreId ? `${location}/${dataStoreId}` : '';

  return {
    dataStores,
    loading,
    dataStoreId,
    location,
    selectedKey,
    fetchDataStores,
    selectDataStore,
    setDataStoreId,
    setLocation,
    clearSelection,
  };
}
