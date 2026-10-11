/**
 * Lambda #4: Scheduler
 *
 * Triggered by EventBridge every 30 minutes.
 * 
 * Responsibilities:
 *   1. Scan all active subscriptions for unique locations
 *   2. Fetch fresh AQI for each location (refresh cache)
 *   3. Invoke Alert System Lambda for each location to dispatch emails
 *   4. Log metrics to CloudWatch
 *
 * Design decisions:
 *   - Processes locations in parallel (Promise.allSettled — one failure won't stop others)
 *   - Deduplicates locations so we don't fetch the same city N times for N subscribers
 *   - Invokes alert-system Lambda directly (internal invocation) to avoid HTTP overhead
 */

const { LambdaClient, InvokeCommand } = require("@aws-sdk/client-lambda");
const axios = require("axios");
const { buildAQIResponse } = require("/opt/nodejs/utils/aqi-utils");
const { getItem, putItem, scanItems, TABLES } = require("/opt/nodejs/utils/db-utils");

const lambdaClient = new LambdaClient({ region: process.env.AWS_REGION || "ap-south-1" });

const WAQI_TOKEN       = process.env.WAQI_TOKEN;
const ALERT_LAMBDA_ARN = process.env.ALERT_LAMBDA_ARN;
const MAX_CONCURRENT   = parseInt(process.env.MAX_CONCURRENT_FETCHES || "10", 10);

// ── Fetch AQI (simplified — mirrors aqi-fetcher logic for internal use) ───────

async function fetchAQI(location) {
  if (!WAQI_TOKEN) throw new Error("WAQI_TOKEN not set");

  const url = `https://api.waqi.info/feed/${encodeURIComponent(location)}/?token=${WAQI_TOKEN}`;
  const response = await axios.get(url, { timeout: 10000 });

  if (response.data?.status !== "ok" || !response.data?.data) {
    throw new Error(`WAQI returned: ${response.data?.status}`);
  }

  const d = response.data.data;
  const iaqi = d.iaqi || {};

  const readings = {
    pm25: iaqi.pm25?.v ?? null,
    pm10: iaqi.pm10?.v ?? null,
    o3:   iaqi.o3?.v   ?? null,
    no2:  iaqi.no2?.v  ?? null,
    so2:  iaqi.so2?.v  ?? null,
    co:   iaqi.co?.v   ?? null
  };

  // WAQI sometimes returns "-" for AQI when the station's composite value
  // is unavailable. Compute from sub-indices using CPCB breakpoints instead.
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
      throw new Error(`WAQI returned no valid AQI or pollutant data for "${location}"`);
    }
  }

  return buildAQIResponse({
    aqi:         Number(aqiValue),
    stationName: d.city?.name || location,
    source:      "WAQI",
    timestamp:   d.time?.iso || new Date().toISOString(),
    readings
  }, location);
}

// ── Update DynamoDB cache ─────────────────────────────────────────────────────

async function updateCache(locationKey, aqiData) {
  await putItem(TABLES.AQI_CACHE, {
    locationKey,
    ...aqiData,
    fetchedAt: new Date().toISOString(),
    ttl: Math.floor(Date.now() / 1000) + 7200
  });
}

// ── Invoke Alert Lambda ───────────────────────────────────────────────────────

async function invokeAlertLambda(aqiData) {
  if (!ALERT_LAMBDA_ARN) {
    console.warn("ALERT_LAMBDA_ARN not set — skipping alert dispatch");
    return;
  }

  const payload = {
    source: "airguard.scheduler",
    aqiData
  };

  await lambdaClient.send(new InvokeCommand({
    FunctionName:   ALERT_LAMBDA_ARN,
    InvocationType: "Event",           // async — don't wait for response
    Payload:        JSON.stringify(payload)
  }));
}

// ── Process a single location ─────────────────────────────────────────────────

async function processLocation(location) {
  const locationKey = location.toLowerCase().replace(/\s+/g, "-");

  try {
    // Check if we fetched this within last 25 min (to avoid double-fetching near edges)
    const cached = await getItem(TABLES.AQI_CACHE, { locationKey });
    if (cached?.fetchedAt) {
      const age = Date.now() - new Date(cached.fetchedAt).getTime();
      if (age < 25 * 60 * 1000) {
        console.log(`Skipping ${location} — recently fetched (${Math.round(age / 60000)}min ago)`);
        return { location, status: "skipped", reason: "recently_cached" };
      }
    }

    const aqiData = await fetchAQI(location);
    await updateCache(locationKey, aqiData);
    await invokeAlertLambda(aqiData);

    console.log(`Processed ${location}: AQI=${aqiData.aqi} (${aqiData.category})`);
    return { location, status: "success", aqi: aqiData.aqi, category: aqiData.category };

  } catch (err) {
    console.error(`Failed to process ${location}:`, err.message);
    return { location, status: "error", error: err.message };
  }
}

// ── Batch processing with concurrency limit ───────────────────────────────────

async function processBatch(locations) {
  const results = [];

  // Process in chunks of MAX_CONCURRENT to avoid API rate limits
  for (let i = 0; i < locations.length; i += MAX_CONCURRENT) {
    const chunk = locations.slice(i, i + MAX_CONCURRENT);
    const settled = await Promise.allSettled(chunk.map(loc => processLocation(loc)));

    for (const result of settled) {
      if (result.status === "fulfilled") {
        results.push(result.value);
      } else {
        results.push({ status: "error", error: result.reason?.message });
      }
    }

    // Small delay between batches to be kind to WAQI API
    if (i + MAX_CONCURRENT < locations.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  return results;
}

// ── Main Handler ──────────────────────────────────────────────────────────────

exports.handler = async (event) => {
  const startTime = Date.now();
  console.log("Scheduler triggered:", new Date().toISOString());

  try {
    // Get all active subscriptions
    const subscriptions = await scanItems(
      TABLES.SUBSCRIPTIONS,
      "active = :a",
      { ":a": true }
    );

    if (subscriptions.length === 0) {
      console.log("No active subscriptions — nothing to do");
      return { statusCode: 200, body: "No subscriptions" };
    }

    // Deduplicate locations
    const uniqueLocations = [...new Set(
      subscriptions.map(s => s.location).filter(Boolean)
    )];

    console.log(`Processing ${uniqueLocations.length} unique locations for ${subscriptions.length} subscribers`);

    const results = await processBatch(uniqueLocations);

    const summary = {
      total:   results.length,
      success: results.filter(r => r.status === "success").length,
      skipped: results.filter(r => r.status === "skipped").length,
      errors:  results.filter(r => r.status === "error").length,
      durationMs: Date.now() - startTime
    };

    console.log("Scheduler run complete:", JSON.stringify(summary));
    return { statusCode: 200, body: JSON.stringify(summary) };

  } catch (err) {
    console.error("Scheduler fatal error:", err);
    return { statusCode: 500, body: `Scheduler failed: ${err.message}` };
  }
};
