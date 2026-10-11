# AirGuard — Tier 1 Improvements
> Build today. < 2 hours each. No new AWS services. High judging impact.

---

## Overview

| # | Improvement | Files Changed | Effort | New AWS Service? |
|---|---|---|---|---|
| 1 | Hyperlocal Station Picker | `SearchBar.jsx` | ~2h | ❌ No |
| 2 | AQI Trend Forecast | `aqi-fetcher/index.js` · `ai-recommender/index.js` · `AQICard.jsx` · `AIAdvice.jsx` | ~2h | ❌ No |
| 3 | SMS Alerts via SNS | `alert-system/index.js` · `template.yaml` · `AlertSignup.jsx` | ~1.5h | ❌ No |

All 3 use only existing AWS infrastructure. Zero additional cost.

---

## Improvement 1 — Hyperlocal Station Picker

### Problem

Searching "Delhi" returns ONE monitoring station for a city of 3.2 crore people.
AQI varies dramatically within a single city:
- Anand Vihar (east Delhi): AQI 312
- Dwarka (west Delhi): AQI 145

Same city. Same time. 167 point difference. A parent in Dwarka is getting
Anand Vihar's data and making the wrong school decision.

### Root Cause

In `SearchBar.jsx`, the autocomplete already fetches multiple stations via `/aqi/search`:

```js
const results = await searchStations(q);
setSuggestions(results.slice(0, 6));
```

And `aqi-fetcher/index.js` already returns AQI per station in search results:

```json
{
  "uid": 123,
  "name": "Delhi - Anand Vihar",
  "aqi": 312,
  "lat": 28.6469,
  "lon": 77.3151
}
```

The AQI per station is already there. It is just not being surfaced usefully.
Right now the dropdown closes the moment a user picks one — they never see alternatives.

### What to Build

After searching a city, show a **station selector panel** before loading the main AQI:

```
┌─────────────────────────────────────────────────┐
│  📍 5 stations found in Delhi                   │
├─────────────────────────────────────────────────┤
│  ● Delhi - Anand Vihar       AQI 312   🔴 Poor  │
│  ○ Delhi - Lodhi Road        AQI 178   🟠 Mod   │
│  ○ Delhi - Dwarka            AQI 145   🟠 Mod   │
│  ○ Delhi - RK Puram          AQI 201   🔴 Poor  │
│  ○ Delhi - IGI Airport       AQI 167   🟠 Mod   │
├─────────────────────────────────────────────────┤
│  [📍 Use My Location — Auto-select Nearest]     │
└─────────────────────────────────────────────────┘
```

User picks the station closest to their home or school.
AQI advice is now accurate for their actual neighborhood.

### Geolocation (Use My Location button)

```js
navigator.geolocation.getCurrentPosition((pos) => {
  const { latitude, longitude } = pos.coords;

  // Haversine formula — calculate distance to each station
  function distanceKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  // Find nearest station
  const nearest = stations.reduce((prev, curr) =>
    distanceKm(latitude, longitude, curr.lat, curr.lon) <
    distanceKm(latitude, longitude, prev.lat, prev.lon) ? curr : prev
  );

  onSearch(nearest.name);
});
```

### Files to Change

**`frontend/src/components/SearchBar.jsx`**

1. When suggestions load, instead of a small dropdown — show a full station panel
2. Each station card shows: name, AQI number, color-coded category badge
3. Add "Use My Location" button at the bottom of the panel
4. On station select → call `onSearch(station.name)` with the specific station name

### Backend Changes

**None.** Zero. The `/aqi/search` endpoint already returns everything needed.
This is a pure frontend change.

### Why This Wins Points

Judging criterion: **"Usability — built for where they are"**

A parent in Dwarka and a parent in Anand Vihar are in the same city
but face completely different air quality realities.
This makes the advice actually correct for the user's street.
No other air quality app at this hackathon will have neighborhood-level accuracy.

---

## Improvement 2 — AQI Trend Forecast

### Problem

AirGuard is currently a **photograph** — it shows the AQI at this exact moment.
But a parent deciding at 7 AM needs to know what it will be at 9 AM
when their child reaches school.

Delhi's winter morning pattern:
- 5–6 AM: AQI relatively lower (overnight settling)
- 8–10 AM: AQI spikes (morning traffic + cold air trapping pollutants)
- Afternoon: slight improvement

If AirGuard only shows the 6 AM reading, the parent sends the child into
worsening air with no warning.

### What to Build

**Part A — Trend Detection**

Add a `trend` field to the `/aqi` API response by comparing current reading
to the 3-hours-ago reading already stored in DynamoDB cache.

New response fields:
```json
{
  "aqi": 210,
  "trend": "rising",
  "trendDelta": 50,
  "trendPeriodHours": 3,
  "trendMessage": "AQI has risen 50 points in the last 3 hours"
}
```

Trend logic:
```
trendDelta > +30  →  "rising"    (📈 red arrow)
trendDelta < -30  →  "falling"   (📉 green arrow)
otherwise         →  "stable"    (➡️ grey arrow)
```

**Part B — Bedrock Forecast**

Pass the trend into the existing Bedrock prompt in `ai-recommender/index.js`.

Add to the prompt:
```
AQI Trend: Rising +50 points in the last 3 hours
Time: 6:30 AM, Monday, October (winter smog season, Delhi)
```

Bedrock then adds a forecast to its JSON response:
```json
{
  "forecast": "AQI is rising fast this morning. Conditions will likely 
               worsen before 10 AM. The school run window (8–9 AM) will 
               be in Poor to Very Poor range. Consider going out before 
               7 AM or after 6 PM.",
  "forecastConfidence": "medium"
}
```

**Part C — Frontend Display**

In `AQICard.jsx` — add trend arrow next to the AQI number:

```
  247 📈
  Poor
  Rising fast · +50 pts in 3h
```

In `AIAdvice.jsx` — add a "Forecast" block at the top of the advice section:

```
┌─────────────────────────────────────────────┐
│ 📈 Forecast: Worsening before 10 AM         │
│ AQI rising fast. School run window (8–9 AM) │
│ expected to be Very Poor. Go before 7 AM    │
│ or postpone until afternoon.                │
└─────────────────────────────────────────────┘
```

### Files to Change

**`backend/src/functions/aqi-fetcher/index.js`**
- After fetching current AQI, query DynamoDB for the reading from 3 hours ago
- Calculate `trendDelta = currentAQI - aqi3HoursAgo`
- Add `trend`, `trendDelta`, `trendPeriodHours` to the response object

**`backend/src/functions/ai-recommender/index.js`**
- In `buildPrompt()`, add trend info to the prompt string
- Add `"forecast"` and `"forecastConfidence"` to the expected JSON schema

**`frontend/src/components/AQICard.jsx`**
- Import trend arrow icons (Lucide has `TrendingUp`, `TrendingDown`, `Minus`)
- Render trend arrow + delta text below the AQI number

**`frontend/src/components/AIAdvice.jsx`**
- Add a `Forecast` block at the top if `data.forecast` exists
- Style it with a clock/forecast icon

### Backend Change Detail (aqi-fetcher)

```js
// After fetching current AQI, before returning response:

async function getTrend(locationKey, currentAQI) {
  try {
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
    
    // Query history for reading ~3h ago
    const history = await queryItems(
      TABLES.AQI_CACHE,
      "locationKey = :lk",
      { ":lk": locationKey },
      "LocationFetchedAtIndex"
    );

    // Find the reading closest to 3 hours ago
    const older = history
      .filter(h => h.fetchedAt < threeHoursAgo)
      .sort((a, b) => new Date(b.fetchedAt) - new Date(a.fetchedAt))[0];

    if (!older || !older.aqi) return { trend: "stable", trendDelta: 0 };

    const delta = currentAQI - older.aqi;
    const trend = delta > 30 ? "rising" : delta < -30 ? "falling" : "stable";

    return {
      trend,
      trendDelta: delta,
      trendPeriodHours: Math.round(
        (Date.now() - new Date(older.fetchedAt).getTime()) / 3600000
      )
    };
  } catch (err) {
    console.warn("Trend calculation failed:", err.message);
    return { trend: "stable", trendDelta: 0 };
  }
}
```

### Why This Wins Points

Judging criterion: **"Real problem + AWS usage"**

This is the only moment in the demo where the app predicts the future instead
of describing the present. The Bedrock badge here is meaningful —
it is doing genuine time-aware reasoning, not just formatting static advice.

In the video you can say:
> "Other apps show you a number. AirGuard tells you what's coming.
> Amazon Bedrock sees that AQI is rising fast at 6 AM and warns the parent
> before the school run window."

That line wins the demo.

---

## Improvement 3 — SMS Alerts via SNS

### Problem

Email alerts only work if you have internet access and check your email.

The people who need AirGuard most:
- Farmers and rural residents in Punjab / Haryana — source of stubble burning
- Low-income families in Delhi's peripheral areas — most exposed, least resourced
- Elderly people managing their own schedules — often not email users

These people are on basic phones with 2G. They are not checking email.
They have SMS. SMS works without internet. It works on every phone.

### What to Build

**The code change is tiny. The impact is massive.**

SNS already handles SMS. You are literally changing:
```js
// Current (email)
TopicArn: SNS_TOPIC_ARN,
Message: htmlBody

// New (SMS)  
PhoneNumber: "+91" + subscription.phone,
Message: buildSMSText(aqiData)
```

That is the entire backend change.

### SMS Message Format

Must be under 160 characters for single SMS:

```
AirGuard - Delhi
AQI: 287 (Very Poor)
School: NO outdoor activities
Mask: N95 mandatory
Reply STOP to unsubscribe
```

```js
function buildSMSText(aqiData) {
  const lines = [
    `AirGuard - ${aqiData.location}`,
    `AQI: ${aqiData.aqi} (${aqiData.category})`,
    aqiData.aqi >= 200
      ? `School: NO outdoor activities`
      : `School: Limit outdoor exposure`,
    aqiData.aqi >= 300
      ? `Mask: N95 mandatory`
      : `Mask: Recommended`,
    `Reply STOP to unsubscribe`
  ];
  return lines.join('\n');
}
```

### Files to Change

**`backend/src/functions/alert-system/index.js`**

1. In `handleSubscribe` — accept `phone` field alongside `email`
2. Store `alertChannel: 'email' | 'sms'` in DynamoDB subscription record
3. In `sendAlertEmail` (rename to `sendAlert`) — branch on `alertChannel`:
   - `email` → existing SNS topic publish (unchanged)
   - `sms` → SNS direct SMS publish to phone number

```js
async function sendAlert(subscription, aqiData, alertType) {
  if (subscription.alertChannel === 'sms') {
    // SMS path
    await snsClient.send(new PublishCommand({
      PhoneNumber: `+91${subscription.phone}`,
      Message: buildSMSText(aqiData),
      MessageAttributes: {
        'AWS.SNS.SMS.SMSType': {
          DataType: 'String',
          StringValue: 'Transactional'  // priority delivery
        }
      }
    }));
    return true;
  }

  // Email path (existing code, unchanged)
  await snsClient.send(new PublishCommand({
    TopicArn: SNS_TOPIC_ARN,
    Subject: subjectMap[alertType],
    Message: buildAlertEmailHTML(subscription, aqiData, alertType)
  }));
  return true;
}
```

**`backend/template.yaml`**

Add SMS permission to AlertSystemFunction IAM policy:

```yaml
- Statement:
    - Effect: Allow
      Action:
        - sns:Publish
      Resource: "*"
      # SNS SMS requires Resource: "*" — cannot scope to a topic ARN
```

**`frontend/src/components/AlertSignup.jsx`**

Add alert channel toggle and phone number field:

```
Alert me via:
  [● Email]  [○ SMS]

[Email field]          ← shown when Email selected
[+91 Phone field]      ← shown when SMS selected

Phone validation: /^[6-9]\d{9}$/
```

### Indian Phone Validation

```js
function validateIndianPhone(num) {
  const cleaned = num.replace(/[\s\-\(\)]/g, '');
  return /^[6-9]\d{9}$/.test(cleaned);
}
```

Indian mobile numbers:
- 10 digits
- Start with 6, 7, 8, or 9
- Do not start with 0 or 1

### Cost

SNS SMS in India: $0.0019 per message.
For a hackathon demo with < 100 test SMS: **less than ₹16 total.**

### Why This Wins Points

Judging criterion: **"Real problem — what changes for the people living with it"**

The people most affected by Delhi's AQI spike are not the tech-savvy
urban professionals who will open a web app. They are the daily wage workers,
school parents in underserved areas, and elderly residents
who are on WhatsApp and SMS all day.

SMS makes AirGuard accessible to the full population that needs it —
not just the ones with reliable internet.

In the video:
> "We made one more change. Email requires internet. The families most
> exposed to bad air in Delhi's peripheral areas are not checking email.
> They have SMS. We added SMS alerts — same threshold system,
> delivered to a basic phone. Three lines of code.
> Now AirGuard reaches everyone."

---

## Combined Demo Narrative (All 3 Improvements)

Use this in the video after showing the base product:

> "We made three improvements. First — instead of showing one station for
> all of Delhi, we now show every monitoring station with its AQI.
> A parent in Dwarka gets Dwarka's number. Not Anand Vihar's.
>
> Second — we added trend forecasting. AirGuard now tells you not just
> what the AQI is, but where it's going. Amazon Bedrock sees that AQI
> is rising fast at 6 AM and warns you before the school run window.
>
> Third — SMS alerts. Email requires internet. SMS doesn't.
> Now AirGuard works on a ₹3000 phone with 2G.
> The families who need this most can finally use it."

---

## Implementation Order (Fastest to Ship)

```
1. SMS alerts         → 1.5h → largest real-world impact, smallest code change
2. Trend forecast     → 2h   → biggest demo wow moment  
3. Station picker     → 2h   → most technically interesting, pure frontend
```

Start with SMS. It ships fastest and has the strongest story for judges.

---

*AirGuard — WeMakeDevs × AWS Environmental Hacks 2026 | Team: FUTURE_PROTECTOR*
