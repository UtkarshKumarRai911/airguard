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

// ── School Safety Status (Tier 2, Improvement 5) ──────────────────────────────

function getSchoolStatus(aqi) {
  if (aqi <= 100) return {
    tier:  "GREEN",
    emoji: "🟢",
    label: "Green Day",
    color: "#00b050",
    recommendations: [
      "✅ Normal school day",
      "✅ All outdoor activities permitted",
      "✅ PE and sports — proceed normally",
      "✅ Morning assembly can be held outdoors"
    ]
  };

  if (aqi <= 200) return {
    tier:  "YELLOW",
    emoji: "🟡",
    label: "Yellow Day",
    color: "#ffb300",
    recommendations: [
      "⚠️ School open — indoor precautions only",
      "❌ No outdoor PE or sports",
      "❌ Move morning assembly indoors",
      "✅ Keep windows closed",
      "✅ Students with asthma should carry inhalers"
    ]
  };

  return {
    tier:  "RED",
    emoji: "🔴",
    label: "Red Day",
    color: "#d32f2f",
    recommendations: [
      "🚨 Cancel ALL outdoor activities",
      "❌ No PE, no assembly outdoors",
      "❌ No outdoor recess or breaks",
      "✅ Keep all students indoors",
      "✅ Notify parents of children with asthma or heart conditions",
      "⚠️ Consider online/hybrid classes if AQI > 300"
    ]
  };
}

function buildStatusPageHTML(aqiData, status) {
  const shareText = encodeURIComponent(
    `${status.emoji} ${status.label} — ${aqiData.location}\n` +
    `AQI: ${aqiData.aqi} (${aqiData.category})\n` +
    `${status.recommendations[0]}\n\n` +
    `Check live status: ${process.env.FRONTEND_URL || "https://airguard.example.com"}`
  );

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>AirGuard School Status — ${aqiData.location}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
           background: #0a0a0a; color: #fff; min-height: 100vh;
           display: flex; align-items: center; justify-content: center;
           padding: 16px; }
    .card { background: #1a1a2e; border: 3px solid ${status.color};
            border-radius: 16px; padding: 32px; max-width: 480px;
            width: 100%; text-align: center; box-shadow: 0 8px 32px rgba(0,0,0,0.3); }
    .tier { font-size: 72px; font-weight: 900; color: ${status.color};
            margin: 8px 0; line-height: 1; }
    .label { font-size: 24px; font-weight: 700; color: ${status.color};
             margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px; }
    .location { font-size: 14px; color: #aaa; margin-bottom: 24px; }
    .aqi-box { background: rgba(255,255,255,0.05); border-radius: 8px;
               padding: 16px; margin-bottom: 24px; }
    .aqi-num { font-size: 48px; font-weight: 900; color: ${status.color}; }
    .aqi-cat { font-size: 18px; color: #ccc; margin-top: 4px; }
    .recs { text-align: left; margin-bottom: 24px; }
    .recs h3 { font-size: 13px; color: #888; text-transform: uppercase;
               letter-spacing: 1px; margin-bottom: 12px; text-align: center; }
    .rec { font-size: 14px; padding: 10px 0; color: #ddd;
           border-bottom: 1px solid rgba(255,255,255,0.05); }
    .rec:last-child { border-bottom: none; }
    .share-btn { display: block; width: 100%; background: #25D366; color: #fff;
                 border: none; border-radius: 8px; padding: 14px; font-size: 15px;
                 font-weight: 700; text-decoration: none; margin-bottom: 10px;
                 cursor: pointer; transition: background 0.2s; }
    .share-btn:hover { background: #1fb855; }
    .copy-btn { display: block; width: 100%; background: transparent;
                color: #aaa; border: 1px solid #333; border-radius: 8px;
                padding: 10px; font-size: 13px; cursor: pointer;
                transition: all 0.2s; }
    .copy-btn:hover { border-color: ${status.color}; color: ${status.color}; }
    .footer { font-size: 11px; color: #555; margin-top: 20px; line-height: 1.5; }
    @media (max-width: 480px) {
      .card { padding: 24px; }
      .tier { font-size: 56px; }
      .label { font-size: 20px; }
      .aqi-num { font-size: 40px; }
    }
  </style>
</head>
<body>
  <div class="card">
    <div style="font-size:20px">${status.emoji}</div>
    <div class="tier">${status.tier}</div>
    <div class="label">${status.label}</div>
    <div class="location">
      📍 ${aqiData.location} · ${new Date().toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit"
      })}
    </div>

    <div class="aqi-box">
      <div class="aqi-num">${aqiData.aqi}</div>
      <div class="aqi-cat">AQI — ${aqiData.category}</div>
    </div>

    <div class="recs">
      <h3>School Recommendations</h3>
      ${status.recommendations.map(r => `<div class="rec">${r}</div>`).join("")}
    </div>

    <a class="share-btn"
       href="https://wa.me/?text=${shareText}"
       target="_blank"
       rel="noopener noreferrer">
      📱 Share on WhatsApp
    </a>

    <button class="copy-btn"
            onclick="navigator.clipboard.writeText(window.location.href).then(() => this.textContent='✅ Link copied!')">
      📋 Copy Status Link
    </button>

    <div class="footer">
      Updates every 30 minutes · Based on CPCB India AQI scale<br>
      Powered by AirGuard × AWS Lambda · Built for WeMakeDevs Hackathon 2026
    </div>
  </div>
</body>
</html>`;
}

// ── Main Handler ──────────────────────────────────────────────────────────────

exports.handler = async (event) => {
  const origin = getOrigin(event);

  // Handle OPTIONS preflight
  if (event.httpMethod === "OPTIONS") return preflight(origin);

  const path   = event.path || event.rawPath || "";
  const params = event.queryStringParameters || {};

  // ── Route: School Safety Status Page ───────────────────────────────────────
  if (path.includes("/status/")) {
    const city = path.split("/status/")[1];
    if (!city || city.length < 2) {
      return error("City name required in path", 400, origin);
    }

    const location = sanitizeLocation(decodeURIComponent(city));
    if (!location) {
      return error("Invalid city name", 400, origin);
    }

    const locationKey = location.toLowerCase().replace(/\s+/g, "-");

    // Try to get AQI (check cache first, then fetch)
    const { fresh, stale } = await getCached(locationKey);
    let aqiData = fresh || stale;

    if (!aqiData) {
      // No cache — fetch fresh
      try {
        const rawData = await fetchFromWAQI(location);
        aqiData = buildAQIResponse(rawData, location);
        await setCache(locationKey, aqiData);
      } catch (err) {
        console.error(`Failed to fetch AQI for status page: ${location}`, err.message);
        return error(
          `Could not load status for "${location}". Please try again later.`,
          502,
          origin
        );
      }
    }

    const status = getSchoolStatus(aqiData.aqi);
    const html = buildStatusPageHTML(aqiData, status);

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Access-Control-Allow-Origin": origin,
        "Cache-Control": "public, max-age=1800"  // Cache for 30 min
      },
      body: html
    };
  }

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
