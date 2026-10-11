/**
 * Lambda #1: AQI Data Fetcher
 *
 * Handles:
 *   GET /aqi?location={city}         — fetch current AQI for a city/station
 *   GET /aqi/search?q={query}        — search for stations
 *   GET /aqi/history?location={city} — last 24h readings from cache
 *
 * Data flow:
 *   1. Check DynamoDB cache (< 30 min old) → return immediately
 *   2. Try WAQI API (primary, best India coverage)
 *   3. On WAQI failure → fallback to OpenAQ API
 *   4. On both failure → return stale cache if available, else error
 *   5. Store fresh data in DynamoDB cache
 */

const axios = require("axios");
const { buildAQIResponse, sanitizeLocation } = require("/opt/nodejs/utils/aqi-utils");
const { success, error, preflight, getOrigin } = require("/opt/nodejs/utils/response-utils");
const { getItem, putItem, queryItems, TABLES } = require("/opt/nodejs/utils/db-utils");

// ── Environment variables (set via SAM template / SSM) ──────────────────────
const WAQI_TOKEN   = process.env.WAQI_TOKEN;
const CACHE_TTL_MS = parseInt(process.env.CACHE_TTL_MS || "1800000", 10); // 30 min default
const STALE_TTL_MS = parseInt(process.env.STALE_TTL_MS || "7200000",  10); // 2 hr stale fallback

// ── WAQI API ─────────────────────────────────────────────────────────────────

async function fetchFromWAQI(location) {
  if (!WAQI_TOKEN) throw new Error("WAQI_TOKEN not configured");

  const encoded = encodeURIComponent(location);
  const url = `https://api.waqi.info/feed/${encoded}/?token=${WAQI_TOKEN}`;

  const response = await axios.get(url, { timeout: 8000 });
  const body = response.data;

  if (!body || body.status !== "ok" || !body.data) {
    throw new Error(`WAQI returned status: ${body?.status || "unknown"}`);
  }

  const d = body.data;
  const iaqi = d.iaqi || {};

  const readings = {
    pm25: iaqi.pm25?.v ?? null,
    pm10: iaqi.pm10?.v ?? null,
    o3:   iaqi.o3?.v   ?? null,
    no2:  iaqi.no2?.v  ?? null,
    so2:  iaqi.so2?.v  ?? null,
    co:   iaqi.co?.v   ?? null
  };

  // WAQI sometimes returns "-" (a dash string) for AQI when the station's
  // composite value is unavailable (stale data, offline sensor, etc.).
  // In that case, compute AQI from the pollutant sub-indices ourselves
  // using CPCB India breakpoints — same method CPCB officially uses.
  let aqiValue = d.aqi;
  const isInvalidAQI = aqiValue == null || aqiValue === "-" || isNaN(Number(aqiValue));

  if (isInvalidAQI) {
    const { calculateSubIndex, PM25_BREAKPOINTS, PM10_BREAKPOINTS } = require("/opt/nodejs/utils/aqi-utils");
    const candidates = [];
    if (readings.pm25 != null) candidates.push(calculateSubIndex(readings.pm25, PM25_BREAKPOINTS));
    if (readings.pm10 != null) candidates.push(calculateSubIndex(readings.pm10, PM10_BREAKPOINTS));

    if (candidates.length > 0) {
      aqiValue = Math.max(...candidates);
      console.log(`WAQI returned invalid AQI ("-") for "${location}". Computed from sub-indices: ${aqiValue}`);
    } else {
      // No pollutant data either — nothing we can do
      throw new Error(`WAQI returned no valid AQI or pollutant data for "${location}"`);
    }
  }

  return {
    aqi:         Number(aqiValue),
    stationName: d.city?.name || location,
    lat:         d.city?.geo?.[0] || null,
    lon:         d.city?.geo?.[1] || null,
    source:      "WAQI",
    timestamp:   d.time?.iso || new Date().toISOString(),
    readings
  };
}

// ── OpenAQ API (fallback) ─────────────────────────────────────────────────────

async function fetchFromOpenAQ(location) {
  // Step 1: Find closest location in India
  const searchUrl = `https://api.openaq.org/v2/locations?country=IN&limit=5&city=${encodeURIComponent(location)}`;
  const searchRes = await axios.get(searchUrl, {
    timeout: 8000,
    headers: { "X-API-Key": process.env.OPENAQ_API_KEY || "" }
  });

  const locations = searchRes.data?.results;
  if (!locations || locations.length === 0) {
    throw new Error(`OpenAQ: No stations found for "${location}"`);
  }

  const station = locations[0];

  // Step 2: Get latest measurements for that location
  const measUrl = `https://api.openaq.org/v2/latest/${station.id}`;
  const measRes = await axios.get(measUrl, {
    timeout: 8000,
    headers: { "X-API-Key": process.env.OPENAQ_API_KEY || "" }
  });

  const measurements = measRes.data?.results?.[0]?.measurements || [];

  const readings = {};
  for (const m of measurements) {
    const param = m.parameter?.toLowerCase();
    const value = m.value;
    if (param === "pm25")  readings.pm25 = value;
    if (param === "pm10")  readings.pm10 = value;
    if (param === "o3")    readings.o3   = value;
    if (param === "no2")   readings.no2  = value;
    if (param === "so2")   readings.so2  = value;
    if (param === "co")    readings.co   = value;
  }

  // OpenAQ doesn't give a composite AQI — compute from PM2.5 sub-index
  const { calculateSubIndex, PM25_BREAKPOINTS, PM10_BREAKPOINTS } = require("/opt/nodejs/utils/aqi-utils");
  let computedAQI = null;
  const candidates = [];
  if (readings.pm25 != null) candidates.push(calculateSubIndex(readings.pm25, PM25_BREAKPOINTS));
  if (readings.pm10 != null) candidates.push(calculateSubIndex(readings.pm10, PM10_BREAKPOINTS));
  if (candidates.length > 0) computedAQI = Math.max(...candidates);

  return {
    aqi:         computedAQI,
    stationName: station.name || location,
    lat:         station.coordinates?.latitude  || null,
    lon:         station.coordinates?.longitude || null,
    source:      "OpenAQ",
    timestamp:   new Date().toISOString(),
    readings
  };
}

// ── Station Search ────────────────────────────────────────────────────────────

async function searchStations(query) {
  if (!WAQI_TOKEN) throw new Error("WAQI_TOKEN not configured");

  const url = `https://api.waqi.info/search/?token=${WAQI_TOKEN}&keyword=${encodeURIComponent(query)}`;
  const response = await axios.get(url, { timeout: 8000 });

  if (response.data?.status !== "ok") {
    throw new Error("WAQI search failed");
  }

  return (response.data.data || [])
    .filter(s => s.station?.name)
    .slice(0, 10)
    .map(s => ({
      uid:     s.uid,
      name:    s.station.name,
      aqi:     s.aqi,
      lat:     s.station.geo?.[0] || null,
      lon:     s.station.geo?.[1] || null,
      url:     s.station.url || null,
      country: s.station.country || null
    }));
}

// ── DynamoDB Cache ────────────────────────────────────────────────────────────

async function getCached(locationKey) {
  try {
    const item = await getItem(TABLES.AQI_CACHE, { locationKey });
    if (!item) return { fresh: null, stale: null };

    const age = Date.now() - new Date(item.fetchedAt).getTime();
    if (age < CACHE_TTL_MS)  return { fresh: item, stale: null };
    if (age < STALE_TTL_MS)  return { fresh: null, stale: item };
    return { fresh: null, stale: null };
  } catch (err) {
    console.warn("Cache read failed:", err.message);
    return { fresh: null, stale: null };
  }
}

async function setCache(locationKey, data) {
  try {
    await putItem(TABLES.AQI_CACHE, {
      locationKey,
      ...data,
      fetchedAt: new Date().toISOString(),
      // DynamoDB TTL: expire in 2 hours
      ttl: Math.floor(Date.now() / 1000) + 7200
    });
  } catch (err) {
    console.warn("Cache write failed:", err.message);
    // Non-fatal — we still return the data
  }
}

// ── History from Cache ────────────────────────────────────────────────────────

async function getHistory(locationKey) {
  try {
    const items = await queryItems(
      TABLES.AQI_CACHE,
      "locationKey = :lk",
      { ":lk": locationKey },
      "LocationFetchedAtIndex"  // GSI: locationKey (PK) + fetchedAt (SK)
    );
    // Return last 24 data points sorted by time
    return items
      .sort((a, b) => new Date(b.fetchedAt) - new Date(a.fetchedAt))
      .slice(0, 48)  // 48 × 30min = 24 hours
      .map(i => ({
        aqi:       i.aqi,
        category:  i.category,
        timestamp: i.fetchedAt,
        pm25:      i.readings?.pm25 ?? null
      }));
  } catch (err) {
    console.warn("History fetch failed:", err.message);
    return [];
  }
}

// ── Main Handler ──────────────────────────────────────────────────────────────

exports.handler = async (event) => {
  const origin = getOrigin(event);

  // Handle OPTIONS preflight
  if (event.httpMethod === "OPTIONS") return preflight(origin);

  const path   = event.path || event.rawPath || "";
  const params = event.queryStringParameters || {};

  // ── Route: Search stations ─────────────────────────────────────────────────
  if (path.endsWith("/aqi/search")) {
    const q = sanitizeLocation(params.q);
    if (!q || q.length < 2) {
      return error("Query must be at least 2 characters", 400, origin);
    }
    try {
      const stations = await searchStations(q);
      return success({ stations, query: q }, 200, origin);
    } catch (err) {
      console.error("Search error:", err);
      return error("Station search failed", 502, origin);
    }
  }

  // ── Route: History ─────────────────────────────────────────────────────────
  if (path.endsWith("/aqi/history")) {
    const location = sanitizeLocation(params.location);
    if (!location) return error("location parameter required", 400, origin);

    const locationKey = location.toLowerCase().replace(/\s+/g, "-");
    const history = await getHistory(locationKey);
    return success({ location, history }, 200, origin);
  }

  // ── Route: Current AQI ────────────────────────────────────────────────────
  const location = sanitizeLocation(params.location);
  if (!location) {
    return error("location parameter is required", 400, origin);
  }

  const locationKey = location.toLowerCase().replace(/\s+/g, "-");

  // 1. Try fresh cache
  const { fresh, stale } = await getCached(locationKey);
  if (fresh) {
    console.log(`Cache HIT (fresh) for: ${locationKey}`);
    return success({ ...fresh, cached: true }, 200, origin);
  }

  let rawData = null;
  let fetchError = null;

  // 2. Try WAQI
  try {
    rawData = await fetchFromWAQI(location);
    console.log(`WAQI success for: ${location}`);
  } catch (waqiErr) {
    console.warn(`WAQI failed for "${location}":`, waqiErr.message);
    fetchError = waqiErr.message;

    // 3. Fallback to OpenAQ
    try {
      rawData = await fetchFromOpenAQ(location);
      console.log(`OpenAQ fallback success for: ${location}`);
    } catch (openaqErr) {
      console.error(`OpenAQ also failed for "${location}":`, openaqErr.message);
      fetchError = `WAQI: ${waqiErr.message} | OpenAQ: ${openaqErr.message}`;
    }
  }

  // 4. Both APIs failed — serve stale if available
  if (!rawData) {
    if (stale) {
      console.warn(`Serving stale cache for: ${locationKey}`);
      return success(
        { ...stale, cached: true, stale: true, fetchError },
        200,
        origin
      );
    }
    console.error(`All sources failed for "${location}":`, fetchError);
    return error(
      `Could not fetch AQI data for "${location}". Please try a nearby city name.`,
      502,
      origin
    );
  }

  // 5. Build structured response and cache it
  const structured = buildAQIResponse(rawData, location);
  await setCache(locationKey, structured);

  return success({ ...structured, cached: false }, 200, origin);
};
