/**
 * Custom hook: manages AQI fetch lifecycle
 * Handles loading, error, caching, and auto-refresh
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { fetchAQI, fetchHistory, getRecommendation } from "../utils/api";
import toast from "react-hot-toast";

const REFRESH_INTERVAL_MS = 10 * 60 * 1000; // Refresh every 10 min in-app

export function useAQI(initialLocation = null) {
  const [location,       setLocation]       = useState(initialLocation);
  const [aqiData,        setAqiData]        = useState(null);
  const [history,        setHistory]        = useState([]);
  const [recommendation, setRecommendation] = useState(null);
  const [loading,        setLoading]        = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [aiLoading,      setAiLoading]      = useState(false);
  const [error,          setError]          = useState(null);
  const [lastUpdated,    setLastUpdated]    = useState(null);

  const refreshTimer = useRef(null);
  const currentLocation = useRef(location);
  currentLocation.current = location;

  const loadAQI = useCallback(async (loc, userProfile = null, silent = false) => {
    if (!loc || loc.trim().length < 2) return;

    if (!silent) setLoading(true);
    setError(null);

    try {
      const data = await fetchAQI(loc.trim());
      setAqiData(data);
      setLastUpdated(new Date());

      if (!silent) {
        // Load history and AI recommendation in parallel
        setHistoryLoading(true);
        setAiLoading(true);

        fetchHistory(loc.trim())
          .then(setHistory)
          .catch(e => console.warn("History load failed:", e.message))
          .finally(() => setHistoryLoading(false));

        getRecommendation({
          location:    data.location || loc,
          aqi:         data.aqi,
          category:    data.category,
          readings:    data.readings,
          userProfile: userProfile || { groups: ["general"] }
        })
          .then(rec => setRecommendation(rec))
          .catch(e => console.warn("AI recommendation failed:", e.message))
          .finally(() => setAiLoading(false));
      }
    } catch (err) {
      setError(err.message || "Failed to fetch AQI data");
      if (!silent) toast.error(`Could not find AQI data for "${loc}"`);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  // Auto-refresh when location changes
  useEffect(() => {
    if (!location) return;

    loadAQI(location);

    // Set up background refresh
    clearInterval(refreshTimer.current);
    refreshTimer.current = setInterval(() => {
      loadAQI(currentLocation.current, null, true); // silent refresh
    }, REFRESH_INTERVAL_MS);

    return () => clearInterval(refreshTimer.current);
  }, [location, loadAQI]);

  const search = useCallback((newLocation, userProfile) => {
    setLocation(newLocation);
    setAqiData(null);
    setHistory([]);
    setRecommendation(null);
    loadAQI(newLocation, userProfile);
  }, [loadAQI]);

  const refresh = useCallback((userProfile) => {
    if (location) loadAQI(location, userProfile, false);
  }, [location, loadAQI]);

  return {
    location,
    aqiData,
    history,
    recommendation,
    loading,
    historyLoading,
    aiLoading,
    error,
    lastUpdated,
    search,
    refresh
  };
}
