# AirGuard: How We Built a Hyperlocal Air Safety Alert System on AWS

*Published on AWS Builder Center | WeMakeDevs × AWS Hackathon 2026 | Team: FUTURE_PROTECTOR*

---

## The Problem We Chose to Solve

On October 10, 2026, Delhi's AQI crossed 380. That's "Very Poor" on the CPCB scale — a level where even healthy adults experience respiratory distress after brief outdoor exposure.

School was still open.

That's the gap we wanted to close: the space between a number on a government website and a parent deciding whether to send their child to school. Between an elderly person planning a morning walk and the invisible danger in the air outside their door.

The problem isn't data availability. India has a reasonably good network of AQI monitoring stations, and APIs like WAQI and OpenAQ surface that data publicly. The problem is **the last mile** — translating raw AQI numbers into clear, personalized, actionable decisions for the people most affected.

That's what AirGuard does.

---

## What We Built

AirGuard is a hyperlocal air quality alert system with three core capabilities:

**1. Real-time AQI lookup** — Search any city or station in India and instantly get the current AQI, pollutant breakdown (PM2.5, PM10, O₃, NO₂, SO₂, CO), and a 24-hour trend chart.

**2. AI-powered personalized advice** — Using Amazon Bedrock (Nova Lite model), we generate plain-English recommendations tailored to who you are: a parent, an elderly person, someone with asthma, a pregnant woman. Not "AQI is 210, category Poor." But "Don't send your child to school today. Keep windows closed. If they develop a cough, monitor closely."

**3. Proactive email alerts** — Subscribe your email with a threshold (e.g., "alert me when AQI exceeds 150"). Every 30 minutes, our scheduler checks the AQI for every subscribed location. If it crosses your threshold or enters a critical category, you get an email before you step outside.

---

## The Architecture

```
[User Browser]
     │  HTTPS
     ▼
[AWS Amplify Hosting]  ←── React frontend
     │
     │  API calls
     ▼
[API Gateway]  ←── 7 REST endpoints
     │
     ├── GET  /aqi          → Lambda: AQI Fetcher
     ├── GET  /aqi/search   → Lambda: AQI Fetcher
     ├── GET  /aqi/history  → Lambda: AQI Fetcher
     ├── POST /recommend    → Lambda: AI Recommender (Bedrock)
     ├── POST /subscribe    → Lambda: Alert System
     ├── DEL  /subscribe    → Lambda: Alert System
     └── GET  /subscriptions→ Lambda: Alert System

[EventBridge] ──every 30 min──► Lambda: Scheduler
                                     │
                                     ├── Fetches AQI for all subscribed locations
                                     ├── Updates DynamoDB cache
                                     └── Triggers Alert System Lambda

[DynamoDB]       ← AQI cache, subscriptions, alert log
[SNS]            ← Email dispatch
[CloudWatch]     ← Logs, alarms, X-Ray traces
```

All backend infrastructure is defined as code in a single AWS SAM template and deploys with one command.

---

## The AWS Services We Used and Why

### AWS Lambda (4 functions)
Every backend operation runs serverless. No servers to manage, and the free tier (1M requests/month) is far more than enough for this use case. We used Graviton2 (`arm64`) architecture — 20% cheaper and faster cold starts than x86.

### Amazon API Gateway
All frontend-to-backend communication goes through API Gateway. We configured throttling (50 req/sec, burst 100) to protect against abuse, X-Ray tracing for debugging, and proper CORS headers so the Amplify frontend can talk to it without issues.

### Amazon DynamoDB
Three tables:
- `airguard-aqi-cache` — caches API responses for 30 minutes (TTL auto-expires at 2 hours). This means if 1000 people search for "Delhi" in the same 30 minutes, WAQI is hit exactly once.
- `airguard-subscriptions` — stores user subscriptions with GSIs on email and locationKey for fast lookups.
- `airguard-alerts-log` — logs every alert sent, auto-expires after 30 days.

On-demand pricing means we pay per read/write, not per hour. Cost for this project: effectively zero.

### Amazon Bedrock (Nova Lite)
This is the most important differentiator. When a user looks up their city's AQI, we send a structured prompt to Amazon Bedrock:

```
Current AQI: 247 (Poor)
PM2.5: 142 µg/m³, PM10: 187 µg/m³
User profile: child, asthma
Planned activity: school run
```

Bedrock returns structured JSON with:
- Whether outdoor activity is safe
- Best time to go outside today
- Activity-specific advice ("Postpone the school run")
- Protective steps numbered in order of priority
- When to see a doctor

We built a rule-based fallback so the app keeps working if Bedrock is temporarily unavailable.

### Amazon SNS
Alert emails are sent via SNS topics. The HTML email template we built surfaces the AQI number prominently, shows category-specific school advice (because parents are a core user group), and includes pollutant readings. Every email has a one-click unsubscribe link.

### AWS Amplify Hosting
The React frontend deploys from GitHub via Amplify's CI/CD pipeline. `amplify.yml` runs `npm ci && npm run build` and serves the `dist/` folder. Zero configuration SSL, global CDN, automatic deploys on every push.

### Amazon EventBridge
A cron rule fires every 30 minutes to trigger our Scheduler Lambda. The scheduler scans all active subscriptions, deduplicates locations (so if 50 people subscribed to Delhi alerts, we fetch Delhi's AQI exactly once), and dispatches alerts asynchronously.

### AWS CloudWatch
Every Lambda logs to its own log group with 14-day retention. We added two alarms: one for Lambda error rate and one for Scheduler failures. X-Ray tracing is enabled on all functions so we can trace a slow request from API Gateway through Lambda to DynamoDB.

---

## The Data Sources

**WAQI (World Air Quality Index)** is our primary source. It aggregates data from official CPCB monitoring stations across India and has excellent city-level coverage. We use their feed API.

**OpenAQ** is our fallback. If WAQI fails or returns an error for a location, we hit OpenAQ's v2 API. OpenAQ doesn't provide composite AQI directly, so we compute it from PM2.5 and PM10 sub-indices using CPCB breakpoints.

If both APIs fail, we serve the last cached value (up to 2 hours old) with a "stale data" warning in the UI.

---

## The AQI Scale We Used

We implemented the **Indian CPCB (Central Pollution Control Board)** AQI scale — not the US EPA scale. This is important: the scales have different breakpoints. A US AQI of 150 is "Unhealthy for Sensitive Groups"; an Indian AQI of 150 is "Moderate." Using the wrong scale means wrong advice.

We calculate sub-indices for each pollutant (PM2.5, PM10) using the CPCB breakpoints and take the maximum as the overall AQI — exactly how CPCB computes it.

---

## The Edge Cases We Handled

Building something that has to work reliably required thinking through failures:

**API failures:** WAQI down → try OpenAQ → both down → serve stale cache → if no cache, return clear error message. The user always gets a response.

**Alert cooldowns:** We don't spam users. Once an alert fires, we wait 3 hours before firing again for the same location — unless AQI crosses 300, which we treat as always worth alerting.

**Stale data warnings:** If we're serving cached data that's over 30 minutes old, the UI shows a visible "stale data" badge so users don't make decisions on outdated information.

**CORS:** Every Lambda returns proper CORS headers. Every route has an OPTIONS preflight handler. API Gateway also injects CORS headers for 4xx/5xx error responses from the gateway itself (not just from Lambda).

**DynamoDB TTL:** AQI cache entries expire after 2 hours automatically. Alert log entries expire after 30 days. We don't need a cleanup job.

**Scheduler deduplication:** If 100 users subscribe to alerts for Delhi, the scheduler fetches Delhi once. We use `Promise.allSettled` so one failed city doesn't stop others from being processed.

**Input sanitization:** All user inputs (location strings, email addresses) are sanitized before use. Location strings are stripped of special characters. Emails are validated with regex before any DynamoDB write.

---

## What We Learned

**AI advice needs structure.** Our first Bedrock prompt asked for a free-text response. The output was good but inconsistent — sometimes a paragraph, sometimes a list. We switched to asking for strict JSON output with defined fields. The frontend then renders specific fields in specific UI positions. Much more reliable.

**DynamoDB key design matters early.** We needed to query subscriptions by both email (to list a user's subscriptions) and locationKey (to find all subscribers for a city). Adding GSIs to an existing table in production is painful. We designed the GSIs upfront and it paid off.

**The fallback chain is as important as the happy path.** In the first version, if WAQI returned an error, the app showed a blank screen. Users near a city with a temporarily offline monitoring station would give up. The WAQI → OpenAQ → stale cache fallback chain means the app almost never shows a dead end.

---

## What This Changes

Every morning in Delhi, parents check WhatsApp, weather apps, sometimes a government portal. None of them give a clear answer to: "Is it safe to send my child to school today?"

AirGuard does. It gives the answer in plain English, personalized to the person asking, delivered to their inbox before they need to decide.

That's the problem we picked. That's the problem we solved.

---

## Try It

- **Live demo:** [your-amplify-url.amplifyapp.com]
- **GitHub:** [your-github-repo-url]
- **Built with:** AWS Lambda · API Gateway · DynamoDB · Bedrock · SNS · Amplify · EventBridge · CloudWatch

*Team FUTURE_PROTECTOR | WeMakeDevs × AWS Environmental Hacks 2026*
