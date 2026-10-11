# 🌿 AirGuard — Know Before You Breathe

> Hyperlocal air quality alerts for schools, families, and vulnerable groups across India.
> Built at **WeMakeDevs × AWS Environmental Hacks 2026** | Team: **FUTURE_PROTECTOR**

[![Live Demo](https://img.shields.io/badge/Live%20Demo-Amplify-orange?logo=amazonaws)](https://your-amplify-url.amplifyapp.com)
[![Track](https://img.shields.io/badge/Track-Air-blue)](https://wemakedevs.org/aws/env)
[![AWS](https://img.shields.io/badge/Deployed%20on-AWS-FF9900?logo=amazonaws)](https://aws.amazon.com)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

---

## The Problem

On any given winter morning in Delhi, the AQI is in the "Poor" or "Very Poor" range. School is open. Parents have no reliable way to know if it's safe to send their child outside.

The problem isn't data. India has 800+ CPCB monitoring stations. The problem is **the last mile** — turning a raw number into a clear decision for a parent, an elderly person, someone with asthma.

AirGuard closes that gap.

---

## What It Does

| Feature | Description |
|---|---|
| 🔍 **Real-time AQI** | Search any city or station in India. WAQI primary source, OpenAQ fallback, stale cache as last resort. |
| 🤖 **AI Health Advice** | Amazon Bedrock (Nova Lite) generates plain-English, personalized recommendations based on who you are — child, elderly, asthmatic, pregnant. |
| 📊 **24h History** | Area chart showing AQI trend over the last 24 hours with CPCB threshold reference lines. |
| 🧪 **Pollutant Breakdown** | PM2.5, PM10, O₃, NO₂, SO₂, CO — each with a progress bar against safe limits. |
| 🔔 **Email Alerts** | Subscribe with your email and a threshold. Get alerted when AQI crosses it — before you step outside. |
| 🏫 **School Advice** | Specific guidance for parents on whether outdoor school activities are safe. |
| ⏰ **Daily Summary** | 7 AM IST email every morning with that day's AQI outlook. |

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│          AWS Amplify Hosting (Frontend)          │
│              React + Vite + Recharts             │
└─────────────────┬───────────────────────────────┘
                  │ HTTPS
┌─────────────────▼───────────────────────────────┐
│          Amazon API Gateway                      │
│   Throttled · CORS · X-Ray · Access Logs         │
└──┬──────────┬──────────┬──────────┬─────────────┘
   │          │          │          │
┌──▼───┐ ┌───▼──┐ ┌─────▼───┐ ┌───▼──────────┐
│ AQI  │ │  AI  │ │  Alert  │ │  Scheduler   │
│Fetch │ │ Rec. │ │ System  │ │(EventBridge) │
│ λ    │ │  λ   │ │   λ     │ │     λ        │
└──┬───┘ └───┬──┘ └──┬──┬───┘ └──────────────┘
   │         │       │  │
   │    ┌────┘       │  │
   ▼    ▼            ▼  ▼
┌──────────────┐  ┌──────┐
│   DynamoDB   │  │ SNS  │
│ 3 tables     │  │Email │
│ TTL + GSIs   │  └──────┘
└──────────────┘
       │
┌──────▼──────────────────┐
│    CloudWatch            │
│ Logs · Alarms · X-Ray   │
└──────────────────────────┘
```

**AWS Services Used:**
`Lambda` · `API Gateway` · `DynamoDB` · `SNS` · `Bedrock` · `Amplify` · `EventBridge` · `CloudWatch` · `IAM` · `SAM`

---

## Project Structure

```
airguard/
├── backend/
│   ├── template.yaml              # SAM/CloudFormation — ALL infrastructure as code
│   ├── samconfig.toml             # Deploy configuration
│   └── src/
│       ├── functions/
│       │   ├── aqi-fetcher/       # Lambda #1: AQI fetch + cache
│       │   ├── ai-recommender/    # Lambda #2: Bedrock AI advice
│       │   ├── alert-system/      # Lambda #3: Subscribe + SNS dispatch
│       │   └── scheduler/         # Lambda #4: EventBridge 30-min refresh
│       ├── layers/
│       │   └── common/nodejs/     # Shared Lambda layer (AWS SDK, axios)
│       └── utils/
│           ├── aqi-utils.js       # CPCB AQI scale, categories, sub-indices
│           ├── db-utils.js        # DynamoDB wrapper
│           └── response-utils.js  # Standardized HTTP responses + CORS
├── frontend/
│   ├── amplify.yml                # Amplify CI/CD build spec
│   ├── src/
│   │   ├── App.jsx
│   │   ├── components/
│   │   │   ├── AQICard.jsx        # Main AQI display with skeleton loading
│   │   │   ├── SearchBar.jsx      # Search with autocomplete + quick cities
│   │   │   ├── AIAdvice.jsx       # AI recommendations accordion
│   │   │   ├── PollutantGrid.jsx  # Pollutant breakdown with progress bars
│   │   │   ├── HistoryChart.jsx   # 24h Recharts area chart
│   │   │   ├── AlertSignup.jsx    # Email alert subscription form
│   │   │   ├── UserProfileModal.jsx # Health profile (groups + air purifier)
│   │   │   ├── Header.jsx
│   │   │   └── EmptyState.jsx
│   │   ├── hooks/
│   │   │   └── useAQI.js          # AQI fetch lifecycle + auto-refresh
│   │   └── utils/
│   │       ├── api.js             # Axios API client
│   │       └── aqi-colors.js      # AQI level → color mapping
└── docs/
    └── blog-post.md               # AWS Builder Center blog post
```

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | 20.x | [nodejs.org](https://nodejs.org) |
| AWS CLI | v2 | [aws.amazon.com/cli](https://aws.amazon.com/cli) |
| AWS SAM CLI | latest | [docs.aws.amazon.com/serverless-application-model](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html) |
| AWS Account | — | [aws.amazon.com/free](https://aws.amazon.com/free) |
| WAQI Token | — | [aqicn.org/data-platform/token](https://aqicn.org/data-platform/token) |

---

## Deployment Guide

### Step 1 — Configure AWS credentials

```bash
aws configure
# Enter your Access Key ID, Secret Access Key, region (ap-south-1), output format (json)
```

### Step 2 — Get your WAQI API token

Go to [aqicn.org/data-platform/token](https://aqicn.org/data-platform/token), enter your email, and check your inbox. The token arrives instantly and is free.

### Step 3 — Enable Amazon Bedrock models

In your AWS Console:
1. Go to **Amazon Bedrock** → **Model access**
2. Request access to **Amazon Nova Lite** (`amazon.nova-lite-v1:0`)
3. Also request **Amazon Nova Micro** as fallback
4. Access is granted within a few minutes

### Step 4 — Deploy the backend

```bash
cd airguard/backend

# Install layer dependencies
cd src/layers/common/nodejs
npm install
cd ../../../..

# Build and deploy (first time — guided setup)
sam build
sam deploy --guided \
  --parameter-overrides "WAQIToken=YOUR_WAQI_TOKEN_HERE Environment=dev"

# After guided setup, subsequent deploys:
sam build && sam deploy
```

After deploy, the terminal shows outputs including your **API Gateway URL**. Copy it — you need it for the frontend.

```
Outputs:
  APIEndpoint  = https://abc123xyz.execute-api.ap-south-1.amazonaws.com/dev
```

### Step 5 — Configure and deploy the frontend

```bash
cd airguard/frontend

# Copy env template
cp .env.example .env.local

# Edit .env.local — paste your API Gateway URL
# VITE_API_URL=https://abc123xyz.execute-api.ap-south-1.amazonaws.com/dev

npm install
npm run build    # Verify it builds cleanly before pushing
```

**Deploy to AWS Amplify:**

1. Push the `airguard/frontend` folder to a GitHub repository
2. Go to **AWS Amplify Console** → **New app** → **Host web app**
3. Connect your GitHub repo
4. Set build settings (or let Amplify detect from `amplify.yml`)
5. Add environment variable: `VITE_API_URL` = your API Gateway URL
6. Deploy

Amplify gives you a live URL like `https://main.d1234.amplifyapp.com`.

### Step 6 — Subscribe an SNS email for testing

Alerts are sent via SNS. For testing, subscribe your email to the SNS topic:

```bash
# Get the topic ARN from SAM deploy outputs
aws sns subscribe \
  --topic-arn arn:aws:sns:ap-south-1:YOUR_ACCOUNT:airguard-alerts-dev \
  --protocol email \
  --notification-endpoint your@email.com
```

Check your inbox and confirm the subscription. Now alerts will arrive at your email when AQI thresholds are crossed.

---

## Local Development

```bash
# Backend — run Lambda locally with SAM
cd airguard/backend
sam local start-api --env-vars env.json
# Starts local API at http://localhost:3000

# Frontend — run dev server
cd airguard/frontend
npm run dev
# Starts at http://localhost:3000 (proxies /api to localhost:3001 via vite config)
```

Create `backend/env.json` for local Lambda env vars:

```json
{
  "AQIFetcherFunction": {
    "WAQI_TOKEN": "your_token_here",
    "AQI_CACHE_TABLE": "airguard-aqi-cache-dev",
    "NODE_ENV": "development"
  }
}
```

---

## API Reference

All endpoints return:
```json
{
  "success": true,
  "data": { ... },
  "timestamp": "2026-10-08T14:30:00.000Z"
}
```

### `GET /aqi?location={city}`

Fetch current AQI for a city.

```bash
curl "https://YOUR_API_URL/aqi?location=Delhi"
```

**Response:**
```json
{
  "location": "Delhi",
  "aqi": 210,
  "category": "Poor",
  "color": "#ff7e00",
  "riskLevel": 4,
  "dominantPollutant": "PM2.5",
  "readings": { "pm25": 142, "pm10": 187, "o3": 45, "no2": 67 },
  "advice": {
    "healthImplication": "Breathing discomfort to most people...",
    "schools": "⚠️ Cancel outdoor activities. Keep students indoors.",
    "generalPublic": "Avoid outdoor exertion. Wear N95 mask if going outside.",
    "sensitiveGroups": "Stay indoors. Keep windows closed."
  },
  "source": "WAQI",
  "timestamp": "2026-10-08T14:00:00+05:30",
  "cached": false
}
```

### `GET /aqi/search?q={query}`

Search for monitoring stations.

### `GET /aqi/history?location={city}`

Last 24 hours of cached AQI readings.

### `POST /recommend`

Get AI-powered health recommendations.

```json
{
  "location": "Delhi",
  "aqi": 210,
  "category": "Poor",
  "readings": { "pm25": 142, "pm10": 187 },
  "userProfile": {
    "groups": ["child", "asthma"],
    "hasAirPurifier": true,
    "activityPlanned": "school run"
  }
}
```

### `POST /subscribe`

Subscribe to AQI alerts.

```json
{
  "email": "parent@example.com",
  "location": "Delhi",
  "threshold": 150,
  "userProfile": { "groups": ["child"] }
}
```

### `DELETE /subscribe`

Unsubscribe.

```json
{ "email": "parent@example.com", "location": "Delhi" }
```

### `GET /subscriptions?email={email}`

List all active subscriptions for an email.

---

## AQI Scale Reference (CPCB India)

| AQI Range | Category    | Health Impact |
|-----------|-------------|---------------|
| 0–50      | Good        | Minimal impact |
| 51–100    | Satisfactory| Minor discomfort to sensitive groups |
| 101–200   | Moderate    | Discomfort to sensitive people on prolonged exposure |
| 201–300   | Poor        | Discomfort to most on prolonged exposure |
| 301–400   | Very Poor   | Respiratory illness possible; effects on healthy people |
| 401–500   | Severe      | Health emergency; affects everyone |

We use the **Indian CPCB scale** (not US EPA), which has different breakpoints. This matters — advice calibrated to the wrong scale is wrong advice.

---

## Edge Cases & Reliability

| Scenario | Handling |
|---|---|
| WAQI API down | Automatic fallback to OpenAQ |
| Both APIs down | Serve stale DynamoDB cache (up to 2h) with warning |
| Stale data served | UI shows visible "⚠️ Stale data" badge |
| Alert spam | 3-hour cooldown per location (overridden for AQI ≥ 300) |
| Bedrock unavailable | Rule-based fallback recommendation engine |
| Same city, many subscribers | Scheduler deduplicates — fetches each location once |
| Expired cache entries | DynamoDB TTL auto-removes after 2 hours |
| Invalid email input | Regex validation before any DynamoDB write |
| Malformed location strings | Sanitized, truncated, special characters stripped |
| CORS errors | Every route has OPTIONS handler; API GW injects headers on 4xx/5xx |
| Lambda cold starts | Graviton2 + Lambda Layer reduces cold start time |

---

## Cost Estimate (Free Tier)

| Service | Free Tier | Expected Usage | Cost |
|---|---|---|---|
| Lambda | 1M req/month | ~50K req | $0 |
| API Gateway | 1M req/month | ~50K req | $0 |
| DynamoDB | 25GB + 25 WCU/RCU | <1GB, minimal ops | $0 |
| SNS | 1000 email notifications | <500 | $0 |
| Amplify | 1000 build minutes | <100 | $0 |
| CloudWatch | 5GB logs | <1GB | $0 |
| Bedrock | Pay per token | ~$0.50 for 1000 calls | ~$0.50 |
| **Total** | | | **~$0.50** |

The entire project runs within AWS Free Tier except Bedrock, which costs fractions of a cent per call.

---

## Judging Criteria Mapping

| Criterion | What We Built |
|---|---|
| **Real problem** | Parents in Delhi have no reliable air quality alert for schools. 3.5 crore school children have no warning system. |
| **AWS usage** | 8 AWS services. Fully deployed on AWS. Infrastructure as code. |
| **Usability** | Search any city in 2 seconds. Advice in plain English. Email requires no app install. |
| **It works** | Every feature functional. Dual API fallback. Stale cache fallback. Rule-based AI fallback. |
| **3-min video** | See `docs/video-script.md` |

---

## Team

**FUTURE_PROTECTOR** | WeMakeDevs × AWS Environmental Hacks 2026

- Utkarsh Kumar Rai ([@utkarsh27](https://github.com/utkarsh27)) — Team Leader

---

## License

MIT — see [LICENSE](LICENSE)

---

*Built with ❤️ and too much coffee during the WeMakeDevs × AWS Environmental Hacks hackathon.*
*Powered by AWS Lambda · API Gateway · DynamoDB · Bedrock · SNS · Amplify · EventBridge*
