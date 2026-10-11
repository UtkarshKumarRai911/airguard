# AirGuard — Tier 2 Improvements
> These improvements change what AirGuard fundamentally IS, not just how well it works.
> Pitch all 4 in the video. Build what time allows.

---

## Overview

| # | Improvement | New AWS Services | Effort | Build or Pitch? |
|---|---|---|---|---|
| 4 | WhatsApp Bot | Lambda · API Gateway route | ~4h | Build if time, else pitch |
| 5 | School Safety Protocol | S3 · CloudFront (optional) | ~3h | Build if time, else pitch |
| 6 | Predictive Night Alert | EventBridge rule (new) | ~3h | Build if time, else pitch |
| 7 | Pollution Source Context | None (existing Bedrock) | ~2h | Build if time, else pitch |

**Core difference from Tier 1:**
- Tier 1 makes the existing product better
- Tier 2 changes what the product IS

---

## Improvement 4 — WhatsApp Bot

### The Problem

The current product requires users to come to it:
- Open browser → type URL → search city → read advice

The people who need AirGuard most — a mother in Rohini at 6:45 AM
deciding whether to put her asthmatic child on the school bus —
are not opening web apps. They are on WhatsApp before they even get out of bed.

WhatsApp has 450 million users in India.
It works on ₹3000 phones with 2G internet.
It requires zero app installation.

**AirGuard needs to go to the user, not wait for the user to come to it.**

---

### What It Looks Like (User's Perspective)

```
Parent texts AirGuard WhatsApp number:
  "Delhi AQI"

Bot replies in under 5 seconds:
  ━━━━━━━━━━━━━━━━━━━━━━━━
  🌿 AirGuard — Delhi
  ━━━━━━━━━━━━━━━━━━━━━━━━
  AQI: 287 (Very Poor)
  🏫 School: Cancel ALL outdoor activities
  😷 Mask: N95 mandatory
  ⏰ Safest time: After 6 PM

  Dominant pollutant: PM2.5

  Reply SUBSCRIBE DELHI 150
  to get alerts when AQI > 150.
  Reply HELP for all commands.
  ━━━━━━━━━━━━━━━━━━━━━━━━

Parent replies:
  "SUBSCRIBE DELHI 150"

Bot replies:
  "✅ Done. You'll get a WhatsApp
  message when Delhi AQI crosses 150.
  Reply STOP DELHI to cancel."
```

---

### Architecture

```
User sends WhatsApp message
          │
          ▼
Meta WhatsApp Business API
          │  POST webhook
          ▼
API Gateway  (new route: POST /whatsapp)
          │
          ▼
New Lambda: whatsapp-handler
          │
    ┌─────┴──────────────┐
    │                    │
    ▼                    ▼
aqi-fetcher Lambda   alert-system Lambda
(existing, reused)   (existing, reused)
    │                    │
    ▼                    ▼
DynamoDB cache       DynamoDB subscriptions
(existing)           (existing)
    │
    ▼
whatsapp-handler formats reply
          │
          ▼
Meta WhatsApp API sends message back to user
```

**What gets reused from existing code:**
- `aqi-fetcher` Lambda — called directly via Lambda invoke (same as scheduler does)
- `alert-system` Lambda — subscribe/unsubscribe logic reused
- DynamoDB `subscriptions` table — add `alertChannel: 'whatsapp'` field
- `aqi-utils.js` Lambda layer — AQI categories, advice text

**What is new:**
- Meta WhatsApp Business API account (free)
- `whatsapp-handler` Lambda (new file: `src/functions/whatsapp-handler/index.js`)
- One new API Gateway route in `template.yaml`
- Webhook verification handler (Meta requires this before sending messages)

---

### Execution — Step by Step

#### Step 1 — Meta WhatsApp Business API Setup (~30 min, external)

1. Go to [developers.facebook.com](https://developers.facebook.com)
2. Create a Meta App → choose "Business" type
3. Add "WhatsApp" product to the app
4. You get a free test phone number + 5 free test recipients
5. Note down:
   - `WHATSAPP_TOKEN` — your permanent access token
   - `WHATSAPP_PHONE_NUMBER_ID` — the ID of your test number
   - `WEBHOOK_VERIFY_TOKEN` — any string you choose (used to verify webhook)

#### Step 2 — New Lambda: whatsapp-handler

Create `backend/src/functions/whatsapp-handler/index.js`:

```js
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

// ── Send a WhatsApp message back to the user ──────────────────────────────────

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

// ── Call existing aqi-fetcher Lambda ─────────────────────────────────────────

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
  return body.data;
}

// ── Format AQI data as short WhatsApp text (<300 chars) ──────────────────────

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

// ── Parse incoming message intent ────────────────────────────────────────────

const KNOWN_CITIES = [
  "delhi", "mumbai", "kolkata", "chennai", "bangalore",
  "hyderabad", "pune", "ahmedabad", "jaipur", "lucknow",
  "patna", "kanpur", "nagpur", "surat", "noida", "gurgaon"
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

// ── Help message ──────────────────────────────────────────────────────────────

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

  // ── GET: Webhook verification (Meta one-time setup) ───────────────────────
  if (event.httpMethod === "GET") {
    const params = event.queryStringParameters || {};
    if (
      params["hub.mode"] === "subscribe" &&
      params["hub.verify_token"] === WEBHOOK_VERIFY_TOKEN
    ) {
      return { statusCode: 200, body: params["hub.challenge"] };
    }
    return { statusCode: 403, body: "Forbidden" };
  }

  // ── POST: Incoming message ────────────────────────────────────────────────
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

#### Step 3 — Add to template.yaml

```yaml
# New Lambda function
WhatsAppHandlerFunction:
  Type: AWS::Serverless::Function
  Properties:
    FunctionName:  !Sub "airguard-whatsapp-handler-${Environment}"
    CodeUri:       src/functions/whatsapp-handler/
    Handler:       index.handler
    Description:   WhatsApp Bot — handles incoming messages via Meta webhook
    Timeout:       30
    Policies:
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
```

#### Step 4 — Register Webhook with Meta

After deploying:
1. Go to Meta Developer Console → Your App → WhatsApp → Configuration
2. Webhook URL: `https://YOUR_API_GATEWAY_URL/dev/whatsapp`
3. Verify token: `airguard_verify_2026` (must match `WEBHOOK_VERIFY_TOKEN`)
4. Click Verify and Save
5. Subscribe to `messages` webhook field

#### Step 5 — Test

1. Add your personal WhatsApp number as a test recipient in Meta console
2. Send "Delhi AQI" to your test number
3. You should get a reply within 5 seconds

---

### Video Line

> "A parent texts 'Delhi AQI' to AirGuard's WhatsApp number.
> In 5 seconds they have the AQI, the school advice, and
> the option to subscribe to alerts — no app, no browser, no account.
> WhatsApp is where 450 million Indians already are.
> This is the last-mile feature that makes AirGuard a public utility."

---

---

## Improvement 5 — School Safety Protocol

### The Problem

Every other AirGuard feature talks to an individual.
But an individual parent getting the right advice still sends their child to school
because the school hasn't told them to keep the child home.

The advice never reaches the institution.
The institution has no protocol.
So nothing changes at scale.

**The solution: give institutions a tool, not just individuals.**

---

### The 3-Tier Protocol

```
┌─────────────────────────────────────────────────────────────────┐
│  AQI 0–100    →  🟢 GREEN DAY                                   │
│                  Normal school. Outdoor activities permitted.    │
│                  PE, assembly, sports — all on.                  │
├─────────────────────────────────────────────────────────────────┤
│  AQI 101–200  →  🟡 YELLOW DAY                                  │
│                  School open. Indoor precautions only.           │
│                  No outdoor PT or sports.                        │
│                  Windows closed. Air purifier on.               │
│                  Morning assembly moved indoors.                 │
├─────────────────────────────────────────────────────────────────┤
│  AQI 201+     →  🔴 RED DAY                                     │
│                  Recommend no outdoor exposure.                  │
│                  Consider online/hybrid day.                     │
│                  All outdoor activities cancelled.               │
│                  Parents notified to keep at-risk children home. │
└─────────────────────────────────────────────────────────────────┘
```

---

### The Shareable Status URL

Every city/area gets a permanent URL that auto-updates every 30 minutes:

```
https://YOUR_AMPLIFY_URL/status/delhi
https://YOUR_AMPLIFY_URL/status/mumbai
https://YOUR_AMPLIFY_URL/status/bangalore
```

When a school principal opens this URL, they see:

```
┌──────────────────────────────────────────────────┐
│                                                  │
│   🔴  RED DAY                                    │
│                                                  │
│   Delhi — Sunday, 11 Oct 2026, 7:00 AM           │
│                                                  │
│   AQI: 287 (Very Poor)                           │
│   Dominant pollutant: PM2.5                      │
│                                                  │
│   ┌──────────────────────────────────────────┐   │
│   │ Recommended for schools:                 │   │
│   │ ❌ Cancel all outdoor activities         │   │
│   │ ❌ No morning assembly outdoors          │   │
│   │ ❌ No PE or sports                       │   │
│   │ ✅ Keep students indoors                 │   │
│   │ ✅ Close windows and doors               │   │
│   └──────────────────────────────────────────┘   │
│                                                  │
│   [📱 Share on WhatsApp]   [📋 Copy Link]        │
│                                                  │
│   Updates every 30 minutes · Powered by AirGuard │
└──────────────────────────────────────────────────┘
```

Principal shares to school WhatsApp group.
**800 parents see it in 2 minutes.**
One action → 800 families protected.

---

### Execution — Step by Step

#### Option A — API Route (Simpler, ~1.5h)

Add a new route `GET /status/:city` that returns an HTML page directly.

**In `template.yaml`** — add event to `AQIFetcherFunction`:

```yaml
GetStatus:
  Type: Api
  Properties:
    RestApiId: !Ref AirGuardAPI
    Path:      /status/{city}
    Method:    GET
```

**In `aqi-fetcher/index.js`** — add route handler:

```js
// In exports.handler, add new route:
if (path.includes("/status/")) {
  const city = path.split("/status/")[1];
  const aqiData = await getOrFetchAQI(city);  // reuse existing fetch logic
  const status  = getSchoolStatus(aqiData.aqi);
  const html    = buildStatusPageHTML(aqiData, status);

  return {
    statusCode: 200,
    headers: { "Content-Type": "text/html" },
    body: html
  };
}
```

**`getSchoolStatus` function:**

```js
function getSchoolStatus(aqi) {
  if (aqi <= 100) return {
    tier:  "GREEN",
    emoji: "🟢",
    label: "Green Day",
    recommendations: [
      "✅ Normal school day",
      "✅ All outdoor activities permitted",
      "✅ PE and sports — proceed normally"
    ]
  };

  if (aqi <= 200) return {
    tier:  "YELLOW",
    emoji: "🟡",
    label: "Yellow Day",
    recommendations: [
      "⚠️ School open — indoor precautions only",
      "❌ No outdoor PE or sports",
      "❌ Move morning assembly indoors",
      "✅ Keep windows closed"
    ]
  };

  return {
    tier:  "RED",
    emoji: "🔴",
    label: "Red Day",
    recommendations: [
      "🚨 Cancel ALL outdoor activities",
      "❌ No PE, no assembly outdoors",
      "❌ No outdoor recess",
      "✅ Keep all students indoors",
      "✅ Notify parents of children with asthma"
    ]
  };
}
```

**`buildStatusPageHTML` function** returns a self-contained HTML page
(no external dependencies — works even with slow 2G):

```js
function buildStatusPageHTML(aqiData, status) {
  const colors = { GREEN: "#00b050", YELLOW: "#ffb300", RED: "#d32f2f" };
  const color  = colors[status.tier];
  const shareText = encodeURIComponent(
    `${status.emoji} ${status.label} — ${aqiData.location}\n` +
    `AQI: ${aqiData.aqi} (${aqiData.category})\n` +
    `${status.recommendations[0]}\n\n` +
    `Check: https://YOUR_API_URL/status/${aqiData.location.toLowerCase()}`
  );

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>AirGuard — ${aqiData.location} School Status</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; background: #0a0a0a; color: #fff;
           min-height: 100vh; display: flex; align-items: center;
           justify-content: center; padding: 16px; }
    .card { background: #1a1a2e; border: 3px solid ${color};
            border-radius: 16px; padding: 32px; max-width: 480px;
            width: 100%; text-align: center; }
    .tier { font-size: 72px; font-weight: 900; color: ${color};
            margin: 8px 0; line-height: 1; }
    .label { font-size: 24px; font-weight: 700; color: ${color};
             margin-bottom: 8px; }
    .location { font-size: 14px; color: #aaa; margin-bottom: 24px; }
    .aqi-box { background: rgba(255,255,255,0.05); border-radius: 8px;
               padding: 16px; margin-bottom: 24px; }
    .aqi-num { font-size: 48px; font-weight: 900; color: ${color}; }
    .aqi-cat { font-size: 18px; color: #ccc; margin-top: 4px; }
    .recs { text-align: left; margin-bottom: 24px; }
    .recs h3 { font-size: 13px; color: #888; text-transform: uppercase;
               letter-spacing: 1px; margin-bottom: 12px; }
    .rec { font-size: 14px; padding: 8px 0;
           border-bottom: 1px solid rgba(255,255,255,0.05); color: #ddd; }
    .share-btn { display: block; width: 100%;
                 background: #25D366; color: #fff; border: none;
                 border-radius: 8px; padding: 14px; font-size: 15px;
                 font-weight: 700; text-decoration: none;
                 margin-bottom: 10px; cursor: pointer; }
    .copy-btn { display: block; width: 100%; background: transparent;
                color: #aaa; border: 1px solid #333; border-radius: 8px;
                padding: 10px; font-size: 13px; cursor: pointer; }
    .footer { font-size: 11px; color: #555; margin-top: 16px; }
  </style>
</head>
<body>
  <div class="card">
    <div style="font-size:20px">${status.emoji}</div>
    <div class="tier">${status.label.split(" ")[0]}</div>
    <div class="label">${status.label}</div>
    <div class="location">📍 ${aqiData.location} · ${new Date().toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata", weekday: "short",
      day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"
    })}</div>

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
       target="_blank">
      📱 Share on WhatsApp
    </a>
    <button class="copy-btn"
            onclick="navigator.clipboard.writeText(window.location.href)
                     .then(() => this.textContent='✅ Link copied!')">
      📋 Copy Status Link
    </button>

    <div class="footer">
      Updates every 30 minutes · Based on CPCB India AQI scale<br>
      Powered by AirGuard × AWS Lambda
    </div>
  </div>
</body>
</html>`;
}
```

#### Option B — S3 Static Pages (More Impressive, ~3h)

Generate pre-rendered HTML files in S3, served via CloudFront:

1. Scheduler Lambda (already runs every 30 min) generates status HTML for all subscribed cities
2. Uploads to S3: `s3://airguard-status/delhi.html`, `s3://airguard-status/mumbai.html`
3. CloudFront serves `status.airguard.app/delhi`
4. Extremely fast load, CDN-cached, works even if Lambda is slow

**Start with Option A. Upgrade to Option B if time allows.**

---

### Video Line

> "We added one more thing. A shareable School Safety Status page
> for every city — Green Day, Yellow Day, Red Day.
> One school principal opens this link at 7 AM and shares it
> to the school WhatsApp group. 800 parents know in 2 minutes.
> That's the difference between one better decision and
> 800 children protected."

---

---

## Improvement 6 — Predictive Night Alert

### The Problem

**The decision happens the night before. The alert arrives the morning of.**

Current alert system flow:
```
AQI crosses 150 at 8:15 AM
         ↓
Scheduler runs at 8:30 AM
         ↓
Alert fires at 8:32 AM
         ↓
Parent gets email at 8:33 AM
         ↓
Child is already on the school bus
```

The alert is useless. The decision was made 90 minutes earlier.

The predictive night alert changes this:
```
9:00 PM the night before:
Scheduler analyzes trend, season, day of week
         ↓
Bedrock predicts: "Tomorrow morning will be Very Poor"
         ↓
Alert fires at 9:05 PM
         ↓
Parent reads it before bed
         ↓
Decision made tonight. Not in a rush at 7 AM.
```

---

### What the Night Alert Looks Like

Email subject:
```
⏰ Tomorrow's AQI Forecast: Delhi — Likely Very Poor
```

Email body:
```
🌿 AirGuard — Night Forecast for Delhi
Tonight: AQI 210 (Poor) and rising ↑

━━━━━━━━━━━━━━━━━━━━━━━
Tomorrow Morning (7–10 AM)
━━━━━━━━━━━━━━━━━━━━━━━
Predicted: Very Poor (280–320)
Confidence: Medium

Why: AQI is rising fast tonight (+40 pts in 3 hrs).
Tomorrow is Monday — morning traffic will add to it.
October is peak stubble burning season in Delhi.

━━━━━━━━━━━━━━━━━━━━━━━
What to do tonight:
━━━━━━━━━━━━━━━━━━━━━━━
→ Decide now about tomorrow's school run
→ Keep N95 masks ready
→ Close bedroom windows tonight

[Check live AQI at 6 AM →]
```

---

### Execution — Step by Step

#### Step 1 — New EventBridge Rule in template.yaml

```yaml
NightForecastRule:
  Type: AWS::Events::Rule
  Properties:
    Name:        !Sub "airguard-night-forecast-${Environment}"
    Description: "Trigger night forecast at 9 PM IST (15:30 UTC)"
    ScheduleExpression: "cron(30 15 * * ? *)"
    State: ENABLED
    Targets:
      - Id: SchedulerTarget
        Arn: !GetAtt SchedulerFunction.Arn

NightForecastPermission:
  Type: AWS::Lambda::Permission
  Properties:
    FunctionName: !Ref SchedulerFunction
    Action:       lambda:InvokeFunction
    Principal:    events.amazonaws.com
    SourceArn:    !GetAtt NightForecastRule.Arn
```

#### Step 2 — Seasonal Context Data

Add this to `backend/src/utils/aqi-utils.js` (or inline in scheduler):

```js
// India's pollution calendar — hardcoded knowledge
const DIWALI_DATES_2026 = ["2026-10-20", "2026-10-21"]; // update per year

function getSeasonalContext(date = new Date()) {
  const month = date.getMonth();  // 0=Jan
  const dayOfWeek = date.getDay(); // 0=Sun, 1=Mon
  const dateStr = date.toISOString().split("T")[0];

  // Check Diwali proximity
  const nearDiwali = DIWALI_DATES_2026.some(d => {
    const diff = Math.abs(new Date(d) - date) / 86400000;
    return diff <= 2;
  });

  if (nearDiwali) return {
    cause:    "Diwali firecrackers",
    risk:     "very_high",
    duration: "1-3 days",
    note:     "AQI spikes 3-5x on Diwali night. Worst 10 PM to 3 AM."
  };

  if (month >= 9 && month <= 10) return {  // Oct-Nov
    cause:    "Stubble burning in Punjab and Haryana",
    risk:     "high",
    duration: "3-4 weeks",
    note:     "Peak burning season. Northwest winds carry smoke to Delhi."
  };

  if (month === 11 || month <= 1) return {  // Dec-Feb
    cause:    "Winter temperature inversion",
    risk:     "high",
    duration: "Day-specific",
    note:     "Cold air traps pollutants near ground. Clears by afternoon."
  };

  if (month >= 5 && month <= 8) return {  // Jun-Sep
    cause:    "Pre/post monsoon — lower risk",
    risk:     "low",
    duration: "Seasonal",
    note:     "Rain washes pollutants. Lowest AQI period of year."
  };

  return {
    cause:    "Urban emissions — vehicular and industrial",
    risk:     "medium",
    duration: "Ongoing",
    note:     "Year-round urban baseline pollution."
  };
}

function isMondayMorning(date = new Date()) {
  return date.getDay() === 1; // Monday tomorrow means Sunday tonight
}
```

#### Step 3 — Update Scheduler Lambda

In `scheduler/index.js`, detect night forecast trigger and run a different path:

```js
exports.handler = async (event) => {
  // Detect if this is a night forecast run (9 PM IST)
  const istHour = parseInt(new Date().toLocaleString("en-US", {
    timeZone: "Asia/Kolkata", hour: "numeric", hour12: false
  }));

  const isNightForecastRun = istHour === 21; // 9 PM IST

  if (isNightForecastRun) {
    return await runNightForecast();
  }

  // Normal 30-min AQI refresh run (existing code below, unchanged)
  // ...existing code...
};

async function runNightForecast() {
  console.log("Night forecast run triggered:", new Date().toISOString());

  // Get all unique subscribed locations
  const subscriptions = await scanItems(TABLES.SUBSCRIPTIONS, "active = :a", { ":a": true });
  const uniqueLocations = [...new Set(subscriptions.map(s => s.location).filter(Boolean))];

  const results = [];

  for (const location of uniqueLocations) {
    try {
      // 1. Get current AQI + 3h trend from cache
      const locationKey = location.toLowerCase().replace(/\s+/g, "-");
      const recentHistory = await getHistory(locationKey); // reuse existing fn
      const currentEntry  = recentHistory[0];
      const threeHoursAgo = recentHistory.find(h => {
        const age = (Date.now() - new Date(h.timestamp).getTime()) / 3600000;
        return age >= 2.5 && age <= 3.5;
      });

      if (!currentEntry) continue;

      const currentAQI = currentEntry.aqi;
      const trendDelta  = threeHoursAgo ? currentAQI - threeHoursAgo.aqi : 0;
      const seasonal    = getSeasonalContext();
      const isMon       = isMondayMorning();

      // 2. Build Bedrock prompt for night forecast
      const prompt = `You are an air quality forecaster for India.

Current data for ${location}:
- AQI right now: ${currentAQI} (${getAQICategory(currentAQI).label})
- Trend: ${trendDelta > 0 ? "Rising" : trendDelta < 0 ? "Falling" : "Stable"} (${trendDelta > 0 ? "+" : ""}${trendDelta} pts in 3 hours)
- Time: ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}
- Tomorrow: ${isMon ? "Monday (high traffic day)" : "Weekday"}
- Season: ${seasonal.cause} — ${seasonal.note}

Based on these signals, predict tomorrow morning's AQI (7–10 AM).
Respond ONLY with valid JSON, no markdown:
{
  "predictedRange": "e.g. 250-310",
  "predictedCategory": "Poor|Very Poor|Severe",
  "confidence": "low|medium|high",
  "keyFactor": "main reason for prediction in one sentence",
  "recommendation": "one actionable sentence for a parent",
  "sendAlert": true or false
}

Set sendAlert to true only if predictedCategory is Poor, Very Poor, or Severe.`;

      const { text } = await callBedrock(prompt); // reuse existing fn from ai-recommender
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) continue;

      const forecast = JSON.parse(jsonMatch[0]);
      if (!forecast.sendAlert) {
        console.log(`${location}: forecast is ${forecast.predictedCategory} — no alert needed`);
        continue;
      }

      // 3. Invoke alert-system Lambda with night_forecast type
      await lambdaClient.send(new InvokeCommand({
        FunctionName:   ALERT_LAMBDA_ARN,
        InvocationType: "Event",
        Payload: JSON.stringify({
          source:  "airguard.scheduler.night_forecast",
          aqiData: { ...currentEntry, location, forecast }
        })
      }));

      results.push({ location, forecast, status: "alert_sent" });

    } catch (err) {
      console.error(`Night forecast failed for ${location}:`, err.message);
      results.push({ location, status: "error", error: err.message });
    }
  }

  return { statusCode: 200, body: JSON.stringify({ nightForecast: results }) };
}
```

#### Step 4 — New Alert Type in alert-system Lambda

In `alert-system/index.js`, add handler for `night_forecast` source:

```js
// In the internal invocation handler:
if (event.source === "airguard.scheduler.night_forecast") {
  const result = await processNightForecast(event.aqiData);
  return { statusCode: 200, body: JSON.stringify(result) };
}

async function processNightForecast(aqiData) {
  const locationKey = aqiData.location?.toLowerCase().replace(/\s+/g, "-");
  const subscriptions = await queryItems(
    TABLES.SUBSCRIPTIONS,
    "locationKey = :lk",
    { ":lk": locationKey },
    "LocationIndex"
  );

  let sent = 0;
  for (const sub of subscriptions.filter(s => s.active)) {
    await sendAlertEmail(sub, aqiData, "night_forecast");
    sent++;
  }
  return { sent };
}
```

Add `"night_forecast"` to the subject map in `buildAlertEmailHTML`:
```js
const subjectMap = {
  threshold_crossed: `⚠️ AQI Alert: ...`,
  category_change:   `🚨 AQI Worsened: ...`,
  daily_summary:     `📊 Daily Summary: ...`,
  night_forecast:    `⏰ Tomorrow's AQI Forecast: ${aqiData.location} — Likely ${forecast.predictedCategory}`
};
```

---

### Video Line

> "We added one more alert type — the night before forecast.
> At 9 PM, Amazon Bedrock analyses the current trend, the season,
> and tomorrow's day of the week. If it predicts a bad morning,
> it sends an alert that night.
> Parents make the decision before bed — not in a rush at 7 AM.
> That is what proactive actually means."

---

---

## Improvement 7 — Pollution Source Context

### The Problem

AirGuard says AQI is 310. But it does not say why.

Without context, users cannot assess:
- Is this temporary (Diwali night → clears in 48h) or persistent (stubble burning → lasts 3-4 weeks)?
- Should I wait it out or take long-term precautions?
- Is this normal for this time of year or unusually bad?

The same AQI number requires completely different responses depending on the cause.

---

### What It Looks Like

Appears below the AQI card when AQI is above 150:

```
┌──────────────────────────────────────────────────────┐
│ 📊 Why is AQI high today?                            │
│                                                      │
│ Stubble burning in Punjab and Haryana                │
│ (October–November peak burning season)               │
│                                                      │
│ Northwest winds are carrying smoke toward Delhi.     │
│ This typically persists 3–4 weeks.                   │
│                                                      │
│ Pollution today is seasonal — not a one-day spike.   │
│ Take ongoing precautions, not just today.            │
└──────────────────────────────────────────────────────┘
```

---

### Execution — Step by Step

#### Step 1 — Add Seasonal Context to ai-recommender Lambda

Add `getSeasonalContext()` function (same as in Improvement 6 above) to
`backend/src/utils/aqi-utils.js` so both Lambdas can use it from the shared layer.

#### Step 2 — Update buildPrompt() in ai-recommender

```js
function buildPrompt(data) {
  const seasonal = getSeasonalContext(); // new

  // Add to existing prompt:
  return `...existing prompt...

Seasonal/calendar context for India right now:
- Likely pollution cause: ${seasonal.cause}
- Expected duration: ${seasonal.duration}
- Key note: ${seasonal.note}
- Risk level: ${seasonal.risk}

Add a "whyHighToday" field to your JSON response:
  "whyHighToday": {
    "cause": "one sentence — why is AQI high today specifically",
    "duration": "how long will this last",
    "isTemporary": true or false,
    "actionNote": "one sentence — does this change what the user should do"
  }
`;
}
```

#### Step 3 — New Frontend Component: PollutionContext.jsx

Create `frontend/src/components/PollutionContext.jsx`:

```jsx
import React from "react";

export default function PollutionContext({ data }) {
  // data = recommendation.whyHighToday from Bedrock response
  if (!data) return null;

  return (
    <div style={{
      background:   "rgba(245,158,11,0.06)",
      border:       "1px solid rgba(245,158,11,0.25)",
      borderRadius: "var(--radius)",
      padding:      "16px 20px"
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
        <span style={{ fontSize: "16px" }}>📊</span>
        <span style={{ fontSize: "14px", fontWeight: "600", color: "#f59e0b" }}>
          Why is AQI high today?
        </span>
        {data.isTemporary && (
          <span style={{
            fontSize: "11px", background: "rgba(16,185,129,0.1)",
            color: "#10b981", border: "1px solid rgba(16,185,129,0.3)",
            borderRadius: "4px", padding: "1px 6px"
          }}>
            Temporary
          </span>
        )}
        {!data.isTemporary && (
          <span style={{
            fontSize: "11px", background: "rgba(239,68,68,0.1)",
            color: "#ef4444", border: "1px solid rgba(239,68,68,0.3)",
            borderRadius: "4px", padding: "1px 6px"
          }}>
            Ongoing
          </span>
        )}
      </div>

      <p style={{ fontSize: "14px", color: "var(--text-primary)", lineHeight: "1.6", marginBottom: "6px" }}>
        {data.cause}
      </p>

      <p style={{ fontSize: "13px", color: "var(--text-muted)", lineHeight: "1.5", marginBottom: "6px" }}>
        <strong>Expected duration:</strong> {data.duration}
      </p>

      {data.actionNote && (
        <p style={{
          fontSize: "13px", color: "var(--text-primary)",
          lineHeight: "1.5", paddingTop: "8px",
          borderTop: "1px solid rgba(255,255,255,0.06)"
        }}>
          💡 {data.actionNote}
        </p>
      )}
    </div>
  );
}
```

#### Step 4 — Add to App.jsx

```jsx
import PollutionContext from "./components/PollutionContext";

// Inside the main content section, after AIAdvice:
{recommendation?.recommendation?.whyHighToday && aqiData?.aqi >= 150 && (
  <PollutionContext data={recommendation.recommendation.whyHighToday} />
)}
```

---

### Video Line

> "AirGuard doesn't just show a number. It explains the world.
> Right now in Delhi it's October — stubble burning season.
> AirGuard knows this is not a one-day spike. It tells users:
> this will last 3-4 weeks. Take ongoing precautions, not just today.
> No other air quality app in this hackathon has this.
> Because no US-built template knows about Punjab's crop burning calendar."

---

---

## Combined Video Narrative (All 4 Improvements)

Use this in the last 45 seconds of the 3-minute video:

> "We made four improvements that change what AirGuard fundamentally is.
>
> First — a WhatsApp bot. Text 'Delhi AQI', get the answer in 5 seconds.
> No app. No browser. Works on 2G. 450 million Indians are already on WhatsApp.
>
> Second — a School Safety Protocol. One link per city.
> Green Day, Yellow Day, Red Day. A principal shares it in the school
> WhatsApp group — 800 parents know in 2 minutes.
>
> Third — night-before forecast. At 9 PM, Amazon Bedrock predicts
> tomorrow morning's AQI. Parents make the decision before bed,
> not in a rush at 7 AM.
>
> Fourth — we tell users why the AQI is high.
> October means stubble burning. Not a one-day spike. 3-4 weeks.
> Ongoing precautions, not just today.
>
> AirGuard is not a dashboard. It is the infrastructure for
> community air quality response in India."

---

## Implementation Order (If Short on Time)

```
1. Pollution Source Context   → 2h → pure Bedrock prompt + one new component
                                      No backend infra changes
                                      Biggest demo impact per hour of work

2. School Safety Protocol     → 3h → one new API route + HTML generation
   (Option A only)                    No new AWS services

3. Predictive Night Alert     → 3h → new EventBridge rule + scheduler path
                                      Needs careful testing

4. WhatsApp Bot               → 4h → external Meta setup adds risk
                                      Pitch if running short on time
```

---

*AirGuard — WeMakeDevs × AWS Environmental Hacks 2026 | Team: FUTURE_PROTECTOR*
