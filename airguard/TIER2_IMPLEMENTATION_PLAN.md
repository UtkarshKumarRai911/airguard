# Tier 2 Implementation Plan — Step-by-Step

**Goal:** Implement all 4 Tier 2 improvements independently of Tier 1 (which your friend is building in parallel).

**Total Estimated Time:** 10–12 hours  
**Implementation Order:** Fastest impact first → Most complex last

---

## Pre-Implementation Checklist

- [ ] Confirm your friend is working on Tier 1 in a **separate branch** (not `main`)
- [ ] Create your own branch: `git checkout -b tier2-improvements`
- [ ] All dependencies already installed (`npm install` completed in both frontend and backend layer)
- [ ] Have AWS credentials configured locally for testing (optional, but recommended)

---

## Improvement 7: Pollution Source Context (START HERE)
**Effort:** 2 hours | **New AWS Services:** None  
**Why first:** Pure Bedrock prompt enhancement + one new component. Highest demo impact per hour.

### Backend Changes

#### Step 1: Add `getSeasonalContext()` to `aqi-utils.js`
**File:** `backend/src/layers/common/nodejs/utils/aqi-utils.js`

✅ **ALREADY DONE** (from earlier work)

**Location:** After `getTrendDescription()`, before `sanitizeLocation()`

```javascript
// ── India Pollution Calendar ──────────────────────────────────────────────────

// Diwali dates (update each year) — fireworks cause 3-5x AQI spikes
const DIWALI_DATES = ["2026-10-20", "2026-10-21"];

/**
 * Returns context about the most likely pollution cause for the current
 * date in India. Used by both AI Recommender and Scheduler (night forecast).
 */
function getSeasonalContext(date) {
  const d = date || new Date();
  const month = d.getMonth(); // 0 = Jan

  // Check proximity to Diwali (within ±2 days)
  const dateStr = d.toISOString().split("T")[0];
  const nearDiwali = DIWALI_DATES.some(diwali => {
    const diffDays = Math.abs(
      (new Date(diwali).getTime() - d.getTime()) / 86400000
    );
    return diffDays <= 2;
  });

  if (nearDiwali) {
    return {
      cause:       "Diwali firecrackers",
      risk:        "very_high",
      duration:    "1–3 days",
      isTemporary: true,
      note:        "AQI spikes 3–5× on Diwali night. Worst between 10 PM and 3 AM. Clears within 48 hours."
    };
  }

  // October–November: peak stubble burning season
  if (month === 9 || month === 10) {
    return {
      cause:       "Stubble burning in Punjab and Haryana",
      risk:        "high",
      duration:    "3–4 weeks",
      isTemporary: false,
      note:        "Peak burning season. Northwest winds carry smoke toward Delhi and the IGP belt. Ongoing precautions needed."
    };
  }

  // December–February: winter temperature inversion
  if (month === 11 || month === 0 || month === 1) {
    return {
      cause:       "Winter temperature inversion",
      risk:        "high",
      duration:    "Day-specific (clears by afternoon)",
      isTemporary: true,
      note:        "Cold air traps pollutants near the ground during early morning hours. AQI typically improves after 11 AM as air warms."
    };
  }

  // March–May: pre-monsoon heat and dust
  if (month >= 2 && month <= 4) {
    return {
      cause:       "Pre-monsoon dust and vehicular emissions",
      risk:        "medium",
      duration:    "Seasonal (until monsoon arrives)",
      isTemporary: false,
      note:        "Dry, hot conditions lift road dust. Urban traffic emissions accumulate with low wind speeds."
    };
  }

  // June–September: monsoon season — best air quality
  if (month >= 5 && month <= 8) {
    return {
      cause:       "Urban emissions — reduced by monsoon rainfall",
      risk:        "low",
      duration:    "Seasonal (through monsoon)",
      isTemporary: false,
      note:        "Rain washes pollutants from the air. This is the lowest-AQI period of the year in most Indian cities."
    };
  }

  // Fallback (shouldn't reach here, but safe default)
  return {
    cause:       "Urban vehicular and industrial emissions",
    risk:        "medium",
    duration:    "Ongoing",
    isTemporary: false,
    note:        "Year-round urban baseline pollution from traffic and industry."
  };
}
```

**Then export it:**

At the bottom of `aqi-utils.js`, change:
```javascript
module.exports = {
  getAQICategory,
  getAlertThreshold,
  getDominantPollutant,
  getTrendDescription,
  sanitizeLocation,
  buildAQIResponse,
  calculateSubIndex,
  getSeasonalContext,  // ← ADD THIS LINE
  PM25_BREAKPOINTS,
  PM10_BREAKPOINTS,
  AQI_CATEGORIES
};
```

---

#### Step 2: Update `ai-recommender/index.js` to use seasonal context

**File:** `backend/src/functions/ai-recommender/index.js`

✅ **ALREADY DONE** (from earlier work)

**Change 1:** Import `getSeasonalContext`
```javascript
const { getAQICategory, getSeasonalContext } = require("/opt/nodejs/utils/aqi-utils");
```

**Change 2:** Update `buildPrompt()` function (lines ~105–150)

Find this section in `buildPrompt()`:
```javascript
  const groupText = groups
    .map(g => groupDescriptions[g] || g)
    .join(", ");

  return `You are an air quality health advisor for India...
```

**Replace with:**
```javascript
  const groupText = groups
    .map(g => groupDescriptions[g] || g)
    .join(", ");

  // Get India-specific seasonal context for pollution source explanation
  const seasonal = getSeasonalContext();

  return `You are an air quality health advisor for India. Provide clear, practical, empathetic advice.

Current air quality data for ${location}:
- AQI: ${aqi} (${category} — Indian CPCB scale)
- Pollutants: ${pollutantsInfo.length > 0 ? pollutantsInfo.join(", ") : "No detailed data"}
- Time: ${currentTime || "unknown"}

Person profile:
- Vulnerable groups: ${groupText}
- Planned activity: ${activity}
- Has air purifier at home: ${hasPurifier ? "Yes" : "No"}

Seasonal/calendar context for India right now:
- Likely pollution cause: ${seasonal.cause}
- Expected duration: ${seasonal.duration}
- Is it temporary: ${seasonal.isTemporary ? "Yes" : "No — ongoing"}
- Key note: ${seasonal.note}

Please provide a response in this EXACT JSON format (no markdown, just JSON):
{
  "summary": "2-sentence plain English summary of current conditions",
  "immediateAction": "One clear sentence: what should this person do RIGHT NOW",
  "isOutdoorSafe": true or false,
  "safestTimeToGoOut": "e.g. 'After 6 PM when AQI typically drops' or 'Not today'",
  "activityAdvice": "Specific advice for their planned activity: ${activity}",
  "protectiveSteps": ["step 1", "step 2", "step 3"],
  "indoorTips": ["tip 1", "tip 2"],
  "childrenAdvice": "Specific one-sentence advice for parents about sending children outside",
  "maskAdvice": "Whether and what type of mask is needed",
  "whenToSeeDoctor": "Symptoms that should prompt a doctor visit",
  "whyHighToday": {
    "cause": "One sentence explaining the specific reason AQI is elevated today",
    "duration": "How long this situation is expected to last",
    "isTemporary": true or false,
    "actionNote": "One sentence on whether users should change long-term plans, not just today"
  }
}`;
```

**Change 3:** Add `whyHighToday` to rule-based fallback (lines ~175–210)

Find the end of `getRuleBasedRecommendation()` where it returns the object:
```javascript
    maskAdvice: riskLevel <= 2
      ? "No mask needed."
      : riskLevel === 3
      ? "N95 mask recommended for sensitive groups."
      : "N95 mask mandatory for everyone going outside.",
    whenToSeeDoctor: "Persistent cough, wheezing, chest tightness, shortness of breath, or eye irritation that doesn't improve indoors.",
    source: "rule-based"
  };
```

**Add before `source: "rule-based"`:**
```javascript
    whenToSeeDoctor: "Persistent cough, wheezing, chest tightness, shortness of breath, or eye irritation that doesn't improve indoors.",
    whyHighToday: (() => {
      const seasonal = getSeasonalContext();
      return {
        cause:       seasonal.cause,
        duration:    seasonal.duration,
        isTemporary: seasonal.isTemporary,
        actionNote:  seasonal.note
      };
    })(),
    source: "rule-based"
  };
```

---

### Frontend Changes

#### Step 3: Create `PollutionContext.jsx` component

✅ **ALREADY DONE**

**File:** `frontend/src/components/PollutionContext.jsx`

This file displays the "Why is AQI high today?" panel.

---

#### Step 4: Wire `PollutionContext` into `App.jsx`

**File:** `frontend/src/App.jsx`

✅ **PARTIALLY DONE** (import added earlier)

**Change 1:** Import the component (add at top with other imports):
```javascript
import PollutionContext from "./components/PollutionContext";
```

**Change 2:** Add to the render tree

Find this section (around line 80–95):
```jsx
            {/* AI Advice */}
            {(aqiData || aiLoading) && (
              <AIAdvice
                data={recommendation}
                loading={aiLoading}
                aqi={aqiData?.aqi}
              />
            )}

            {/* 24h History Chart */}
```

**Add AFTER `AIAdvice` and BEFORE `HistoryChart`:**
```jsx
            {/* AI Advice */}
            {(aqiData || aiLoading) && (
              <AIAdvice
                data={recommendation}
                loading={aiLoading}
                aqi={aqiData?.aqi}
              />
            )}

            {/* Pollution Source Context — shown when AQI ≥ 150 */}
            {recommendation?.recommendation?.whyHighToday && aqiData?.aqi >= 150 && (
              <PollutionContext data={recommendation.recommendation.whyHighToday} />
            )}

            {/* 24h History Chart */}
```

---

### Testing Improvement 7

1. Run frontend: `npm run dev` (in `frontend/` directory)
2. Search for a city (e.g., "Delhi")
3. Wait for AI advice to load
4. If AQI ≥ 150, you should see the "Why is AQI high today?" panel appear below AI advice
5. Check that it shows:
   - Cause (e.g., "Stubble burning in Punjab and Haryana")
   - Duration
   - Temporary/Ongoing badge
   - Action note

**Expected output:** Panel with orange border, seasonal context, temporary/ongoing badge.

---

## Improvement 5: School Safety Protocol (Option A)
**Effort:** 3 hours | **New AWS Services:** None (just a new API route)  
**Why second:** Clean backend feature. No external dependencies. High demo value.

### Backend Changes

#### Step 5: Add school status helper functions to `aqi-fetcher/index.js`

**File:** `backend/src/functions/aqi-fetcher/index.js`

**Location:** After the `getHistory()` function (around line 180), BEFORE `exports.handler`

Add these three new functions:

```javascript
// ── School Safety Status ──────────────────────────────────────────────────────

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
```

---

#### Step 6: Add `/status/{city}` route handler to `exports.handler`

**File:** `backend/src/functions/aqi-fetcher/index.js`

**Location:** Inside `exports.handler`, AFTER the OPTIONS preflight check, BEFORE the `/aqi/search` route

Find this:
```javascript
exports.handler = async (event) => {
  const origin = getOrigin(event);

  // Handle OPTIONS preflight
  if (event.httpMethod === "OPTIONS") return preflight(origin);

  const path   = event.path || event.rawPath || "";
  const params = event.queryStringParameters || {};

  // ── Route: Search stations ─────────────────────────────────────────────────
  if (path.endsWith("/aqi/search")) {
```

**Add this NEW route handler BEFORE the search route:**

```javascript
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
```

---

#### Step 7: Add API Gateway route to `template.yaml`

**File:** `backend/template.yaml`

**Location:** Find the `AQIFetcherFunction` Events section (around line 150–180)

Find this:
```yaml
      Events:
        # Current AQI
        GetAQI:
          Type: Api
          Properties:
            RestApiId: !Ref AirGuardAPI
            Path:      /aqi
            Method:    GET
        # Station search
        SearchAQI:
```

**Add this NEW event BEFORE `OptionsAQI`:**

```yaml
        # School Safety Status Page
        GetStatus:
          Type: Api
          Properties:
            RestApiId: !Ref AirGuardAPI
            Path:      /status/{city}
            Method:    GET
        # CORS preflight
        OptionsAQI:
```

---

### Testing Improvement 5

After deploying:

1. Get your API Gateway URL from `sam deploy` output
2. Test in browser: `https://YOUR_API_URL/dev/status/delhi`
3. Should see a full-page school status card:
   - Big colored number (Green/Yellow/Red)
   - AQI value
   - School recommendations list
   - WhatsApp share button
   - Copy link button

**Try different cities:** `/status/mumbai`, `/status/bangalore`, `/status/kolkata`

---

## Improvement 6: Predictive Night Alert
**Effort:** 3–4 hours | **New AWS Services:** EventBridge cron rule  
**Why third:** Needs careful testing. Scheduler runs only at 9 PM IST.

### Backend Changes

#### Step 8: Add EventBridge night forecast rule to `template.yaml`

**File:** `backend/template.yaml`

**Location:** After the `SchedulerFunction` resource definition (around line 320), BEFORE `# ── DynamoDB:` section

Add these TWO new resources:

```yaml
  # ── EventBridge: Night Forecast Rule (9 PM IST = 15:30 UTC) ──────────────
  NightForecastRule:
    Type: AWS::Events::Rule
    Properties:
      Name:        !Sub "airguard-night-forecast-${Environment}"
      Description: "Trigger night forecast at 9 PM IST (15:30 UTC)"
      ScheduleExpression: "cron(30 15 * * ? *)"
      State: ENABLED
      Targets:
        - Id:  SchedulerTarget
          Arn: !GetAtt SchedulerFunction.Arn
          Input: '{"source":"airguard.night_forecast"}'

  NightForecastPermission:
    Type: AWS::Lambda::Permission
    Properties:
      FunctionName: !Ref SchedulerFunction
      Action:       lambda:InvokeFunction
      Principal:    events.amazonaws.com
      SourceArn:    !GetAtt NightForecastRule.Arn
```

---

#### Step 9: Update `scheduler/index.js` for night forecast path

**File:** `backend/src/functions/scheduler/index.js`

**Change 1:** Add helper to detect night forecast run

**Location:** After the imports, BEFORE `async function fetchAQI()` (around line 10)

Add:
```javascript
// ── Check if this is a night forecast run (9 PM IST) ──────────────────────────
function isNightForecastRun(event) {
  // EventBridge sends { source: "airguard.night_forecast" } in Input
  if (event?.source === "airguard.night_forecast") return true;

  // Also check time-based (backup detection)
  const istHour = parseInt(
    new Date().toLocaleString("en-US", {
      timeZone: "Asia/Kolkata",
      hour:     "numeric",
      hour12:   false
    }),
    10
  );
  return istHour === 21; // 9 PM IST
}
```

**Change 2:** Add night forecast handler function

**Location:** After `processBatch()`, BEFORE `exports.handler`

Add this large function:

```javascript
// ── Night Forecast Handler (runs at 9 PM IST) ─────────────────────────────────

async function runNightForecast() {
  console.log("🌙 Night forecast run triggered:", new Date().toISOString());

  const { getSeasonalContext } = require("/opt/nodejs/utils/aqi-utils");

  try {
    // Get all active subscriptions
    const subscriptions = await scanItems(
      TABLES.SUBSCRIPTIONS,
      "active = :a",
      { ":a": true }
    );

    if (subscriptions.length === 0) {
      console.log("No active subscriptions — skipping night forecast");
      return { statusCode: 200, body: "No subscriptions" };
    }

    // Deduplicate locations
    const uniqueLocations = [...new Set(
      subscriptions.map(s => s.location).filter(Boolean)
    )];

    console.log(`Running night forecast for ${uniqueLocations.length} locations`);

    const results = [];

    for (const location of uniqueLocations) {
      try {
        const locationKey = location.toLowerCase().replace(/\s+/g, "-");

        // Get current AQI + recent history
        const cached = await getItem(TABLES.AQI_CACHE, { locationKey });
        if (!cached || !cached.aqi) {
          console.log(`Skipping ${location} — no cached AQI data`);
          continue;
        }

        const currentAQI = cached.aqi;

        // Get 3-hour-ago reading for trend
        const history = await queryItems(
          TABLES.AQI_CACHE,
          "locationKey = :lk",
          { ":lk": locationKey },
          "LocationFetchedAtIndex"
        );

        const threeHoursAgo = history
          .filter(h => {
            const age = (Date.now() - new Date(h.fetchedAt).getTime()) / 3600000;
            return age >= 2.5 && age <= 3.5;
          })
          .sort((a, b) => new Date(b.fetchedAt) - new Date(a.fetchedAt))[0];

        const trendDelta = threeHoursAgo ? currentAQI - threeHoursAgo.aqi : 0;
        const seasonal = getSeasonalContext();
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const isMondayTomorrow = tomorrow.getDay() === 1;

        // Build Bedrock prompt for night forecast
        const prompt = `You are an air quality forecaster for India.

Current data for ${location}:
- AQI right now: ${currentAQI} (${cached.category})
- Trend: ${trendDelta > 0 ? "Rising" : trendDelta < 0 ? "Falling" : "Stable"} (${trendDelta > 0 ? "+" : ""}${trendDelta} pts in 3 hours)
- Time: ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}
- Tomorrow: ${isMondayTomorrow ? "Monday (high traffic day)" : "Weekday"}
- Season: ${seasonal.cause} — ${seasonal.note}

Based on these signals, predict tomorrow morning's AQI (7–10 AM).
Respond ONLY with valid JSON, no markdown:
{
  "predictedRange": "e.g. 250-310",
  "predictedCategory": "Good|Satisfactory|Moderate|Poor|Very Poor|Severe",
  "confidence": "low|medium|high",
  "keyFactor": "main reason for prediction in one sentence",
  "recommendation": "one actionable sentence for a parent",
  "sendAlert": true or false
}

Set sendAlert to true only if predictedCategory is Poor, Very Poor, or Severe.`;

        // Call Bedrock (reuse from ai-recommender logic if available, or inline)
        const { BedrockRuntimeClient, InvokeModelCommand } = require("@aws-sdk/client-bedrock-runtime");
        const bedrockClient = new BedrockRuntimeClient({
          region: process.env.BEDROCK_REGION || process.env.AWS_REGION
        });

        const bedrockCommand = new InvokeModelCommand({
          modelId:     "amazon.nova-lite-v1:0",
          contentType: "application/json",
          accept:      "application/json",
          body:        JSON.stringify({
            messages: [{ role: "user", content: [{ text: prompt }] }],
            inferenceConfig: { maxTokens: 400, temperature: 0.3, topP: 0.9 }
          })
        });

        const bedrockResponse = await bedrockClient.send(bedrockCommand);
        const responseBody = JSON.parse(new TextDecoder().decode(bedrockResponse.body));
        const text = responseBody.output?.message?.content?.[0]?.text || "";

        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          console.warn(`Bedrock returned no JSON for ${location}`);
          continue;
        }

        const forecast = JSON.parse(jsonMatch[0]);

        if (!forecast.sendAlert) {
          console.log(`${location}: forecast is ${forecast.predictedCategory} — no alert needed`);
          results.push({ location, forecast, status: "no_alert" });
          continue;
        }

        // Invoke alert-system Lambda with night_forecast type
        await lambdaClient.send(new InvokeCommand({
          FunctionName:   ALERT_LAMBDA_ARN,
          InvocationType: "Event",
          Payload: JSON.stringify({
            source:  "airguard.scheduler.night_forecast",
            aqiData: {
              ...cached,
              location,
              forecast
            }
          })
        }));

        console.log(`✅ Night forecast alert sent for ${location}: ${forecast.predictedCategory}`);
        results.push({ location, forecast, status: "alert_sent" });

      } catch (err) {
        console.error(`Night forecast failed for ${location}:`, err.message);
        results.push({ location, status: "error", error: err.message });
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ nightForecast: results, total: results.length })
    };

  } catch (err) {
    console.error("Night forecast fatal error:", err);
    return { statusCode: 500, body: `Night forecast failed: ${err.message}` };
  }
}
```

**Change 3:** Update main handler to route to night forecast

**Location:** Top of `exports.handler` function

Find:
```javascript
exports.handler = async (event) => {
  const startTime = Date.now();
  console.log("Scheduler triggered:", new Date().toISOString());

  try {
```

**Replace with:**
```javascript
exports.handler = async (event) => {
  const startTime = Date.now();
  console.log("Scheduler triggered:", new Date().toISOString());

  // Detect if this is a night forecast run (9 PM IST)
  if (isNightForecastRun(event)) {
    return await runNightForecast();
  }

  // Regular 30-min AQI refresh run below
  try {
```

---

#### Step 10: Update `alert-system/index.js` for night forecast alert type

**File:** `backend/src/functions/alert-system/index.js`

**Change 1:** Add handler for night_forecast source

**Location:** Inside `exports.handler`, after OPTIONS check, BEFORE HTTP method routing

Find:
```javascript
  // Internal invocation from Scheduler (no HTTP context)
  if (event.source === "airguard.scheduler") {
    const result = await processAQIUpdate(event.aqiData);
    return { statusCode: 200, body: JSON.stringify(result) };
  }
```

**Add AFTER this block:**
```javascript
  // Night forecast invocation from Scheduler
  if (event.source === "airguard.scheduler.night_forecast") {
    const result = await processNightForecast(event.aqiData);
    return { statusCode: 200, body: JSON.stringify(result) };
  }
```

**Change 2:** Add `processNightForecast` function

**Location:** After `processAQIUpdate()`, BEFORE `exports.handler`

Add:
```javascript
// ── Process Night Forecast (called by Scheduler at 9 PM) ──────────────────────

async function processNightForecast(aqiData) {
  const locationKey = aqiData.location?.toLowerCase().replace(/\s+/g, "-");
  if (!locationKey) return { sent: 0, error: "No location" };

  // Get all active subscriptions for this location
  const subscriptions = await queryItems(
    TABLES.SUBSCRIPTIONS,
    "locationKey = :lk",
    { ":lk": locationKey },
    "LocationIndex"
  );

  const activeSubscriptions = subscriptions.filter(s => s.active);
  let sent = 0;

  for (const sub of activeSubscriptions) {
    try {
      await sendNightForecastEmail(sub, aqiData);

      // Log the alert
      await putItem(TABLES.ALERTS_LOG, {
        alertId:    `${sub.subscriptionId}#${Date.now()}`,
        email:      sub.email,
        location:   aqiData.location,
        aqi:        aqiData.aqi,
        alertType:  "night_forecast",
        forecast:   aqiData.forecast,
        sentAt:     new Date().toISOString(),
        ttl:        Math.floor(Date.now() / 1000) + 2592000 // 30 days
      });

      sent++;
    } catch (err) {
      console.error(`Failed to send night forecast to ${sub.email}:`, err.message);
    }
  }

  return { sent, total: activeSubscriptions.length };
}
```

**Change 3:** Add night forecast email template

**Location:** After `buildAlertEmailHTML()`, BEFORE `sendAlertEmail()`

Add:
```javascript
// ── Night Forecast Email Template ─────────────────────────────────────────────

function buildNightForecastEmailHTML(subscription, aqiData) {
  const forecast = aqiData.forecast;
  const category = getAQICategory(aqiData.aqi);

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tomorrow's AQI Forecast — ${aqiData.location}</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:20px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;border:2px solid #f59e0b;">

          <!-- Header -->
          <tr>
            <td style="background:#1a1a2e;padding:20px 30px;text-align:center;">
              <h1 style="color:#ffffff;margin:0;font-size:24px;">🌿 AirGuard Night Forecast</h1>
              <p style="color:#aaaaaa;margin:5px 0 0;font-size:13px;">Predict tomorrow, decide tonight</p>
            </td>
          </tr>

          <!-- Forecast Banner -->
          <tr>
            <td style="background:#fff8e1;padding:25px 30px;text-align:center;border-bottom:3px solid #f59e0b;">
              <p style="margin:0;font-size:14px;color:#f59e0b;font-weight:bold;text-transform:uppercase;letter-spacing:2px;">⏰ Tomorrow Morning Forecast</p>
              <p style="margin:8px 0 0;font-size:48px;font-weight:900;color:#f59e0b;line-height:1;">${forecast.predictedRange}</p>
              <p style="margin:4px 0 0;font-size:20px;font-weight:bold;color:#333;">${forecast.predictedCategory}</p>
              <p style="margin:6px 0 0;font-size:15px;color:#666;">📍 ${aqiData.location}</p>
            </td>
          </tr>

          <!-- Current Conditions -->
          <tr>
            <td style="padding:20px 30px;border-bottom:1px solid #eeeeee;">
              <h3 style="color:#333333;margin:0 0 12px;font-size:16px;">Tonight (right now)</h3>
              <p style="margin:0;font-size:32px;font-weight:bold;color:#666;">${aqiData.aqi}</p>
              <p style="margin:4px 0 0;font-size:14px;color:#888;">${category.label} — ${forecast.keyFactor}</p>
            </td>
          </tr>

          <!-- Recommendation -->
          <tr>
            <td style="padding:20px 30px;border-bottom:1px solid #eeeeee;background:#f9fafb;">
              <h3 style="color:#333333;margin:0 0 8px;font-size:16px;">What to do tonight</h3>
              <p style="color:#555555;margin:0;line-height:1.6;font-size:14px;">${forecast.recommendation}</p>
            </td>
          </tr>

          <!-- Confidence -->
          <tr>
            <td style="padding:16px 30px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#999;">Confidence: <strong style="color:#333;text-transform:capitalize;">${forecast.confidence}</strong></p>
              <p style="margin:6px 0 0;font-size:11px;color:#bbb;">Forecast generated at 9 PM IST using Amazon Bedrock</p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:16px 30px;text-align:center;background:#f8f9fa;">
              <p style="margin:0;font-size:12px;color:#999;">
                <a href="${process.env.FRONTEND_URL || "https://airguard.example.com"}" style="color:#f59e0b;text-decoration:none;">Check live AQI at 6 AM →</a>
              </p>
              <p style="margin:8px 0 0;font-size:11px;color:#bbb;">
                You're receiving forecasts for <strong>${aqiData.location}</strong>.<br>
                <a href="${process.env.FRONTEND_URL}/unsubscribe?email=${encodeURIComponent(subscription.email)}" style="color:#999;text-decoration:underline;">Unsubscribe</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

async function sendNightForecastEmail(subscription, aqiData) {
  if (!SNS_TOPIC_ARN) {
    console.warn("SNS_TOPIC_ARN not set — skipping email");
    return false;
  }

  const subject = `⏰ Tomorrow's AQI Forecast: ${aqiData.location} — Likely ${aqiData.forecast.predictedCategory}`;
  const htmlBody = buildNightForecastEmailHTML(subscription, aqiData);

  await snsClient.send(new PublishCommand({
    TopicArn: SNS_TOPIC_ARN,
    Subject:  subject,
    Message:  htmlBody,
    MessageAttributes: {
      email: {
        DataType:    "String",
        StringValue: subscription.email
      }
    }
  }));

  return true;
}
```

---

### Testing Improvement 6

Night forecast runs **only at 9 PM IST (15:30 UTC)**. To test:

**Option A — Wait for 9 PM IST**
1. Deploy with `sam build && sam deploy`
2. Subscribe to alerts for a city
3. Wait until 9 PM IST
4. Check email for night forecast

**Option B — Manual Lambda invoke (testing)**
```bash
aws lambda invoke \
  --function-name airguard-scheduler-dev \
  --payload '{"source":"airguard.night_forecast"}' \
  response.json
```

Check CloudWatch logs for `🌙 Night forecast run triggered`

---

## Improvement 4: WhatsApp Bot
**Effort:** 4 hours | **New AWS Services:** None (uses existing Lambda, but Meta setup required)  
**Why last:** Requires external Meta Developer account setup. Highest friction.

### External Setup (Meta WhatsApp Business API)

#### Step 11: Create Meta App

1. Go to [developers.facebook.com](https://developers.facebook.com)
2. Click "My Apps" → "Create App"
3. Choose "Business" type
4. Add "WhatsApp" product
5. You get:
   - **Test phone number** (starts with +1)
   - **5 test recipient slots** (add your personal WhatsApp number)
   - **Access token** (long string starting with `EAA...`)
   - **Phone Number ID** (numeric ID)

**Note down:**
- `WHATSAPP_TOKEN` = your access token
- `WHATSAPP_PHONE_NUMBER_ID` = phone number ID
- `WEBHOOK_VERIFY_TOKEN` = any string you choose (e.g., `airguard_verify_2026`)

---

### Backend Changes

#### Step 12: Create `whatsapp-handler/index.js` Lambda

**File:** `backend/src/functions/whatsapp-handler/index.js` (NEW FILE)

Create this entire new file:

```javascript
/**
 * Lambda: WhatsApp Bot Handler
 *
 * Handles:
 *   GET  /whatsapp  — Meta webhook verification (one-time setup)
 *   POST /whatsapp  — Incoming messages from users
 *
 * Supported commands:
 *   "<city> AQI"              — Get current AQI
 *   "<city>"                  — Same as above
 *   "SUBSCRIBE <city> <num>"  — Subscribe to alerts
 *   "STOP <city>"             — Unsubscribe
 *   "HELP"                    — List commands
 */

const axios = require("axios");
const { LambdaClient, InvokeCommand } = require("@aws-sdk/client-lambda");

const lambdaClient = new LambdaClient({ region: process.env.AWS_REGION });

const WHATSAPP_TOKEN         = process.env.WHATSAPP_TOKEN;
const WHATSAPP_PHONE_ID      = process.env.WHATSAPP_PHONE_NUMBER_ID;
const WEBHOOK_VERIFY_TOKEN   = process.env.WEBHOOK_VERIFY_TOKEN;
const AQI_FETCHER_ARN        = process.env.AQI_FETCHER_ARN;
const ALERT_SYSTEM_ARN       = process.env.ALERT_SYSTEM_ARN;

// ── Send WhatsApp Message ─────────────────────────────────────────────────────

async function sendWhatsAppMessage(to, text) {
  await axios.post(
    `https://graph.facebook.com/v18.0/${WHATSAPP_PHONE_ID}/messages`,
    {
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: text }
    },
    {
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        "Content-Type": "application/json"
      }
    }
  );
}

// ── Call Existing AQI Fetcher Lambda ──────────────────────────────────────────

async function getAQI(location) {
  const response = await lambdaClient.send(new InvokeCommand({
    FunctionName:   AQI_FETCHER_ARN,
    InvocationType: "RequestResponse",
    Payload: JSON.stringify({
      httpMethod: "GET",
      path: "/aqi",
      queryStringParameters: { location }
    })
  }));

  const result = JSON.parse(new TextDecoder().decode(response.Payload));
  const body   = JSON.parse(result.body);
  return body.data || body;
}

// ── Format AQI as WhatsApp Text (<300 chars) ──────────────────────────────────

function formatAQIMessage(data) {
  const schoolLine = data.aqi >= 200
    ? "🏫 School: Cancel ALL outdoor activities"
    : data.aqi >= 100
    ? "🏫 School: No outdoor PT or sports"
    : "🏫 School: Normal day ✅";

  const maskLine = data.aqi >= 300
    ? "😷 Mask: N95 MANDATORY"
    : data.aqi >= 200
    ? "😷 Mask: N95 recommended"
    : data.aqi >= 100
    ? "😷 Mask: Optional for sensitive groups"
    : "😷 Mask: Not needed ✅";

  return [
    `━━━━━━━━━━━━━━━━━━━━`,
    `🌿 AirGuard — ${data.location}`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `AQI: ${data.aqi} (${data.category})`,
    ``,
    schoolLine,
    maskLine,
    ``,
    `Dominant: ${data.dominantPollutant || "PM2.5"}`,
    ``,
    `Reply SUBSCRIBE ${data.location.toUpperCase()} 150`,
    `to get alerts when AQI > 150.`,
    `Reply HELP for all commands.`
  ].join("\n");
}

// ── Parse User Intent ─────────────────────────────────────────────────────────

const KNOWN_CITIES = [
  "delhi", "mumbai", "kolkata", "chennai", "bangalore", "bengaluru",
  "hyderabad", "pune", "ahmedabad", "jaipur", "lucknow",
  "patna", "kanpur", "nagpur", "surat", "noida", "gurgaon", "gurugram"
];

function parseIntent(text) {
  const t = text.toLowerCase().trim();

  if (t === "help" || t === "?") return { intent: "help" };

  // SUBSCRIBE DELHI 150
  const subscribeMatch = t.match(/^subscribe\s+(\w[\w\s]*?)\s+(\d+)$/);
  if (subscribeMatch) return {
    intent: "subscribe",
    city: subscribeMatch[1].trim(),
    threshold: parseInt(subscribeMatch[2])
  };

  // STOP DELHI
  const stopMatch = t.match(/^stop\s+(\w[\w\s]*?)$/);
  if (stopMatch) return {
    intent: "unsubscribe",
    city: stopMatch[1].trim()
  };

  // "DELHI AQI" or just "DELHI" or any known city
  const cityMatch = KNOWN_CITIES.find(c => t.includes(c));
  if (cityMatch || t.includes("aqi")) {
    const city = cityMatch
      ? text.trim().replace(/aqi/i, "").trim()
      : text.trim();
    return { intent: "get_aqi", city: city || "Delhi" };
  }

  // Default: treat the whole message as a city name
  return { intent: "get_aqi", city: text.trim() };
}

// ── Help Message ──────────────────────────────────────────────────────────────

const HELP_TEXT = `🌿 AirGuard — Air Quality Bot

Commands:
• Type any city name → get AQI
  e.g. "Delhi" or "Mumbai AQI"

• SUBSCRIBE <city> <number>
  Get alerts when AQI crosses threshold
  e.g. "SUBSCRIBE DELHI 150"

• STOP <city>
  Cancel alerts for a city
  e.g. "STOP DELHI"

• HELP → show this message

Data: WAQI + OpenAQ
Scale: CPCB India (not US EPA)`;

// ── Main Handler ──────────────────────────────────────────────────────────────

exports.handler = async (event) => {

  // ── GET: Webhook Verification (Meta one-time setup) ───────────────────────
  if (event.httpMethod === "GET") {
    const params = event.queryStringParameters || {};
    if (
      params["hub.mode"] === "subscribe" &&
      params["hub.verify_token"] === WEBHOOK_VERIFY_TOKEN
    ) {
      console.log("✅ Webhook verified by Meta");
      return { statusCode: 200, body: params["hub.challenge"] };
    }
    return { statusCode: 403, body: "Forbidden" };
  }

  // ── POST: Incoming Message ────────────────────────────────────────────────
  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 200, body: "ok" }; // Always return 200 to Meta
  }

  // Extract message from Meta's payload structure
  const entry   = body?.entry?.[0];
  const changes = entry?.changes?.[0];
  const message = changes?.value?.messages?.[0];

  if (!message || message.type !== "text") {
    return { statusCode: 200, body: "ok" };
  }

  const from = message.from;          // User's WhatsApp number
  const text = message.text?.body;    // Message text

  if (!from || !text) return { statusCode: 200, body: "ok" };

  console.log(`WhatsApp message from ${from}: "${text}"`);

  const { intent, city, threshold } = parseIntent(text);

  try {
    if (intent === "help") {
      await sendWhatsAppMessage(from, HELP_TEXT);

    } else if (intent === "get_aqi") {
      const aqi = await getAQI(city);
      await sendWhatsAppMessage(from, formatAQIMessage(aqi));

    } else if (intent === "subscribe") {
      // Store subscription with alertChannel: 'whatsapp', phone: from
      await lambdaClient.send(new InvokeCommand({
        FunctionName:   ALERT_SYSTEM_ARN,
        InvocationType: "RequestResponse",
        Payload: JSON.stringify({
          httpMethod: "POST",
          path: "/subscribe",
          body: JSON.stringify({
            phone:        from,
            alertChannel: "whatsapp",
            location:     city,
            threshold:    threshold || 150,
            userProfile:  { groups: ["general"] }
          })
        })
      }));
      await sendWhatsAppMessage(from,
        `✅ Subscribed!\n\nYou'll get a WhatsApp message when ` +
        `${city} AQI crosses ${threshold || 150}.\n\n` +
        `Reply STOP ${city.toUpperCase()} to cancel anytime.`
      );

    } else if (intent === "unsubscribe") {
      await lambdaClient.send(new InvokeCommand({
        FunctionName:   ALERT_SYSTEM_ARN,
        InvocationType: "RequestResponse",
        Payload: JSON.stringify({
          httpMethod: "DELETE",
          path: "/subscribe",
          body: JSON.stringify({ phone: from, location: city })
        })
      }));
      await sendWhatsAppMessage(from,
        `✅ Unsubscribed from ${city} alerts.`
      );
    }
  } catch (err) {
    console.error("WhatsApp handler error:", err);
    await sendWhatsAppMessage(from,
      `⚠️ Sorry, something went wrong. Please try again in a moment.\n\nReply HELP for commands.`
    );
  }

  // Always return 200 — Meta marks your webhook as failed if you return anything else
  return { statusCode: 200, body: "ok" };
};
```

---

#### Step 13: Add `WhatsAppHandlerFunction` to `template.yaml`

**File:** `backend/template.yaml`

**Location:** After `SchedulerFunction`, BEFORE `NightForecastRule`

Add this complete new Lambda function resource:

```yaml
  # ── Lambda: WhatsApp Bot Handler ──────────────────────────────────────────
  WhatsAppHandlerFunction:
    Type: AWS::Serverless::Function
    Properties:
      FunctionName:  !Sub "airguard-whatsapp-handler-${Environment}"
      CodeUri:       src/functions/whatsapp-handler/
      Handler:       index.handler
      Description:   WhatsApp Bot — handles incoming messages via Meta webhook
      Timeout:       30
      Tracing:       Active
      Policies:
        - CloudWatchLogsFullAccess
        - Statement:
            - Effect: Allow
              Action: lambda:InvokeFunction
              Resource:
                - !GetAtt AQIFetcherFunction.Arn
                - !GetAtt AlertSystemFunction.Arn
      Environment:
        Variables:
          WHATSAPP_TOKEN:          "YOUR_META_TOKEN_HERE"
          WHATSAPP_PHONE_NUMBER_ID: "YOUR_PHONE_NUMBER_ID"
          WEBHOOK_VERIFY_TOKEN:    "airguard_verify_2026"
          AQI_FETCHER_ARN:         !GetAtt AQIFetcherFunction.Arn
          ALERT_SYSTEM_ARN:        !GetAtt AlertSystemFunction.Arn
      Events:
        WhatsAppWebhookPost:
          Type: Api
          Properties:
            RestApiId: !Ref AirGuardAPI
            Path:      /whatsapp
            Method:    POST
        WhatsAppWebhookGet:
          Type: Api
          Properties:
            RestApiId: !Ref AirGuardAPI
            Path:      /whatsapp
            Method:    GET

  WhatsAppHandlerLogGroup:
    Type: AWS::Logs::LogGroup
    Properties:
      LogGroupName:    !Sub "/aws/lambda/airguard-whatsapp-handler-${Environment}"
      RetentionInDays: 14
```

**IMPORTANT:** Replace `YOUR_META_TOKEN_HERE` and `YOUR_PHONE_NUMBER_ID` with your actual values from Meta Developer Console.

---

#### Step 14: Register Webhook with Meta

After deploying:

1. Go to Meta Developer Console → Your App → WhatsApp → Configuration
2. **Webhook URL:** `https://YOUR_API_GATEWAY_URL/dev/whatsapp`
3. **Verify Token:** `airguard_verify_2026` (must match `WEBHOOK_VERIFY_TOKEN` in template.yaml)
4. Click "Verify and Save"
5. Subscribe to `messages` webhook field

---

### Testing Improvement 4

1. Add your personal WhatsApp number as a test recipient in Meta console
2. Send a message to the Meta test number: `Delhi AQI`
3. You should get a reply in < 5 seconds with:
   - AQI number
   - Category
   - School advice
   - Mask advice
   - Subscribe instruction

**Test commands:**
- `Mumbai AQI`
- `SUBSCRIBE DELHI 150`
- `HELP`
- `STOP DELHI`

---

## Deployment Plan

### Step 15: Build and Deploy Backend

```bash
cd backend
sam build
sam deploy
```

**Expected output:**
- 5 Lambda functions (4 existing + 1 new WhatsApp handler)
- 2 EventBridge rules (30-min scheduler + 9 PM night forecast)
- New `/status/{city}` route
- New `/whatsapp` route

**Save the API Gateway URL** from output for frontend config.

---

### Step 16: Update Frontend Environment Variable

**File:** `frontend/.env.local`

Make sure `VITE_API_URL` matches your API Gateway URL:
```
VITE_API_URL=https://YOUR_API_ID.execute-api.ap-south-1.amazonaws.com/dev
```

---

### Step 17: Test Frontend Locally

```bash
cd frontend
npm run dev
```

Open `http://localhost:5173`

**Test checklist:**
- [ ] Search for a city with AQI ≥ 150
- [ ] Wait for AI advice to load
- [ ] "Why is AQI high today?" panel should appear below AI advice
- [ ] Check that seasonal cause is displayed correctly
- [ ] Temporary/Ongoing badge shows correctly

---

### Step 18: Deploy Frontend to Amplify

```bash
cd frontend
npm run build
```

Push to GitHub — Amplify will auto-deploy.

---

## Verification Checklist

### Improvement 7: Pollution Source Context
- [ ] `getSeasonalContext()` added to `aqi-utils.js` and exported
- [ ] `ai-recommender/index.js` imports `getSeasonalContext`
- [ ] Bedrock prompt includes seasonal context
- [ ] Rule-based fallback includes `whyHighToday`
- [ ] `PollutionContext.jsx` component created
- [ ] Component wired into `App.jsx`
- [ ] Panel appears when AQI ≥ 150
- [ ] Shows correct seasonal cause for October (stubble burning)

### Improvement 5: School Safety Protocol
- [ ] `getSchoolStatus()` function added to `aqi-fetcher/index.js`
- [ ] `buildStatusPageHTML()` function added
- [ ] `/status/{city}` route handler added to `exports.handler`
- [ ] API Gateway route added in `template.yaml`
- [ ] Deployed and accessible at `https://YOUR_API/dev/status/delhi`
- [ ] Shows Green/Yellow/Red day correctly based on AQI
- [ ] WhatsApp share button works
- [ ] Copy link button works

### Improvement 6: Predictive Night Alert
- [ ] `NightForecastRule` EventBridge rule added to `template.yaml`
- [ ] `NightForecastPermission` added
- [ ] `isNightForecastRun()` helper added to `scheduler/index.js`
- [ ] `runNightForecast()` function added
- [ ] Main handler routes to night forecast at 9 PM IST
- [ ] `processNightForecast()` added to `alert-system/index.js`
- [ ] `buildNightForecastEmailHTML()` added
- [ ] Bedrock forecast prompt works
- [ ] Night forecast emails sent correctly (test at 9 PM or manual invoke)

### Improvement 4: WhatsApp Bot
- [ ] Meta Developer app created
- [ ] Test phone number obtained
- [ ] `whatsapp-handler/index.js` Lambda created
- [ ] `WhatsAppHandlerFunction` added to `template.yaml`
- [ ] Environment variables set (token, phone ID)
- [ ] Deployed
- [ ] Webhook registered with Meta
- [ ] Test message sent: bot replies correctly
- [ ] `SUBSCRIBE` command works
- [ ] `HELP` command works
- [ ] `STOP` command works

---

## Merge Strategy with Tier 1

Your friend is building Tier 1 in parallel. Here's how to merge cleanly:

### Before Merge
1. **You:** Complete all Tier 2 work in branch `tier2-improvements`
2. **Friend:** Completes all Tier 1 work in branch `tier1-improvements`
3. Both push to GitHub

### Merge Order
```bash
# 1. Merge Tier 1 into main first
git checkout main
git merge tier1-improvements

# 2. Then merge Tier 2 into main
git merge tier2-improvements
```

### Expected Conflicts (and how to resolve)

| File | Conflict Reason | Resolution |
|------|-----------------|------------|
| `ai-recommender/index.js` | Tier 1 adds trend to prompt, Tier 2 adds seasonal context | Keep BOTH — prompt should have both trend AND seasonal |
| `aqi-fetcher/index.js` | Tier 1 adds trend calculation, Tier 2 adds `/status` route | Keep BOTH — separate functions |
| `alert-system/index.js` | Tier 1 adds SMS path, Tier 2 adds night forecast | Keep BOTH — separate alert types |
| `template.yaml` | Both add new events/functions | Keep BOTH — merge event lists |
| `App.jsx` | Tier 1 adds new components, Tier 2 adds `PollutionContext` | Keep BOTH — stack components |

**Git will auto-merge most changes.** Only manual conflict will be in `ai-recommender/index.js` prompt — combine both additions.

---

## Time Estimate Summary

| Improvement | Time | Risk |
|-------------|------|------|
| **#7 Pollution Context** | 2h | Low — pure Bedrock + component |
| **#5 School Status** | 3h | Low — backend route + HTML |
| **#6 Night Forecast** | 3-4h | Medium — Bedrock + timing logic |
| **#4 WhatsApp Bot** | 4h | High — external Meta setup |
| **Testing + Deploy** | 2h | - |
| **TOTAL** | 14-16h | - |

---

## Success Criteria

✅ **Improvement 7:** Panel appears below AI advice when AQI ≥ 150, shows seasonal cause  
✅ **Improvement 5:** `/status/delhi` returns full-page status card with WhatsApp share  
✅ **Improvement 6:** 9 PM IST triggers night forecast emails with tomorrow's predicted AQI  
✅ **Improvement 4:** WhatsApp bot replies to "Delhi AQI" in < 5 seconds

---

**You're ready to build. Start with Improvement 7 (easiest) and work your way down.**

Good luck! 🚀
