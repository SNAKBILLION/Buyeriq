// ─────────────────────────────────────────────
// BuyerIQ — useAPI Hook
// ─────────────────────────────────────────────
// Generic data fetching with:
//  - loading/error states
//  - automatic fallback to static data
//  - cache layer (avoids redundant fetches)
//  - refresh capability
// ─────────────────────────────────────────────
import { useState, useEffect, useRef, useCallback } from 'react';

// Simple in-memory cache
const cache = new Map();
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

/**
 * Fetch data from backend API with automatic fallback to static/hardcoded data.
 *
 * @param {Function} apiFn - Async function that calls the API (e.g., () => fetchBuyers())
 * @param {*} fallbackData - Static data to use if API is unavailable
 * @param {object} options - { cacheKey, enabled, refreshInterval }
 */
export function useAPI(apiFn, fallbackData = null, options = {}) {
  const { cacheKey, enabled = true, refreshInterval = 0 } = options;

  const [data, setData] = useState(() => {
    // Check cache first
    if (cacheKey && cache.has(cacheKey)) {
      const cached = cache.get(cacheKey);
      if (Date.now() - cached.timestamp < CACHE_TTL) return cached.data;
    }
    return fallbackData;
  });

  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState(null);
  const [source, setSource] = useState(fallbackData ? 'static' : 'none');
  const mountedRef = useRef(true);
  const apiFnRef = useRef(apiFn);

  // Keep ref in sync without triggering re-renders
  apiFnRef.current = apiFn;

  const fetchData = useCallback(async () => {
    if (!enabled) return;

    try {
      setLoading(true);
      const result = await apiFnRef.current();

      if (!mountedRef.current) return;

      // API response format: { success: true, data: [...], count: N }
      const apiData = result?.data ?? result;

      setData(apiData);
      setSource('api');
      setError(null);

      // Update cache
      if (cacheKey) {
        cache.set(cacheKey, { data: apiData, timestamp: Date.now() });
      }
    } catch (err) {
      if (!mountedRef.current) return;

      console.warn(`API call failed, using fallback:`, err.message);
      setError(err.message);
      setSource(fallbackData ? 'static' : 'error');

      // Keep fallback data (already set as initial state)
      if (fallbackData && !data) {
        setData(fallbackData);
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [enabled, cacheKey]);

  useEffect(() => {
    mountedRef.current = true;
    fetchData();

    let interval;
    if (refreshInterval > 0) {
      interval = setInterval(fetchData, refreshInterval);
    }

    return () => {
      mountedRef.current = false;
      if (interval) clearInterval(interval);
    };
  }, [fetchData, refreshInterval]);

  return {
    data,
    loading,
    error,
    source, // 'api' | 'static' | 'error' | 'none'
    refresh: fetchData,
    isLive: source === 'api',
  };
}

/**
 * Simplified hook for one-time API fetch with static fallback
 */
export function useData(apiFn, staticData, cacheKey) {
  return useAPI(apiFn, staticData, { cacheKey });
}

export default useAPI;
