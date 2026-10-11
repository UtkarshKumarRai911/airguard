/**
 * API client — all calls to the AirGuard backend go through here.
 * Centralizes base URL, error handling, and retries.
 */
import axios from "axios";

const BASE_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: { "Content-Type": "application/json" }
});

// ── Request interceptor — log in dev ─────────────────────────────────────────
api.interceptors.request.use(
  (config) => {
    if (import.meta.env.DEV) {
      console.debug(`[API] ${config.method?.toUpperCase()} ${config.url}`);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ── Response interceptor — normalize errors ───────────────────────────────────
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const msg =
      error.response?.data?.error ||
      error.response?.data?.message ||
      error.message ||
      "Network error. Please check your connection.";
    const status = error.response?.status || 0;
    const normalized = new Error(msg);
    normalized.status = status;
    normalized.isApiError = true;
    return Promise.reject(normalized);
  }
);

// ── AQI endpoints ─────────────────────────────────────────────────────────────

/**
 * Fetch current AQI for a location
 * @param {string} location - City name or station name
 * @returns {Promise<object>} AQI data with category, advice, readings
 */
export async function fetchAQI(location) {
  const { data } = await api.get("/aqi", { params: { location } });
  return data.data;
}

/**
 * Search for AQI monitoring stations
 * @param {string} query - Search term
 * @returns {Promise<object[]>} List of matching stations
 */
export async function searchStations(query) {
  const { data } = await api.get("/aqi/search", { params: { q: query } });
  return data.data.stations;
}

/**
 * Fetch 24-hour AQI history for a location
 * @param {string} location - City name
 * @returns {Promise<object[]>} Array of historical readings
 */
export async function fetchHistory(location) {
  const { data } = await api.get("/aqi/history", { params: { location } });
  return data.data.history;
}

// ── Recommendation endpoint ───────────────────────────────────────────────────

/**
 * Get AI-powered health recommendations
 * @param {object} payload - { location, aqi, category, readings, userProfile }
 * @returns {Promise<object>} Recommendations object
 */
export async function getRecommendation(payload) {
  const { data } = await api.post("/recommend", payload);
  return data.data;
}

// ── Subscription endpoints ────────────────────────────────────────────────────

/**
 * Subscribe to AQI alerts
 * @param {object} payload - { email, location, threshold, userProfile }
 */
export async function subscribe(payload) {
  const { data } = await api.post("/subscribe", payload);
  return data.data;
}

/**
 * Unsubscribe from AQI alerts
 * @param {string} email
 * @param {string} location
 */
export async function unsubscribe(email, location) {
  const { data } = await api.delete("/subscribe", { data: { email, location } });
  return data.data;
}

/**
 * List all active subscriptions for an email
 * @param {string} email
 */
export async function getSubscriptions(email) {
  const { data } = await api.get("/subscriptions", { params: { email } });
  return data.data.subscriptions;
}

export default api;
