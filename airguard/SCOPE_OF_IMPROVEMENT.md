# AirGuard — Scope of Improvement

> Deep analysis of what can be built, what should be pitched, and what would win.
> Written for: WeMakeDevs × AWS Environmental Hacks 2026 | Team: FUTURE_PROTECTOR

---

## Current State (What AirGuard Is Right Now)

An **AQI dashboard with email alerts**. Core loop:
> User searches city → sees AQI number → gets AI-generated advice → subscribes to threshold email alerts.

Solid foundation. But the fundamental limitation is that it is **reactive** — the user has to come to it.
The only proactive feature is the email alert, which fires on a 30-minute poll.
That is not fundamentally different from a weather app.

---

## Track: Air — Judging Lens

Before improvements, understand what judges score:

| Criterion | What It Really Means |
|---|---|
| Real problem | Who specifically suffers? What specifically changes for them? |
| AWS usage | Are you using AWS deeply or just hosting a static site on Amplify? |
| Usability | Can someone who isn't you figure it out in 30 seconds? |
| It works | One feature that runs > five that almost do |
| Impact | Quantify. "3.5 crore children" beats "millions of people" |

Every improvement below is mapped to these criteria.

---

## TIER 1 — Build Today (< 2 Hours Each, High Impact)

---

### 1. Hyperlocal Station Picker

**Current problem:**
Searching "Delhi" returns one monitoring station for a city of 3.2 crore people.
AQI varies dramatically within a single city — Dwarka (west Delhi) can be AQI 180 while
Anand Vihar (east Delhi) is AQI 380 at the same time. The advice is wrong for most users.

**The fix:**
When a user searches a city, show a list of all monitoring stations within that city
with their individual AQIs. Let them pick the station closest to their home or school.
Add a "Nearest to me" option using browser Geolocation API.

**Why it matters:**
The advice becomes accurate for the user's actual neighborhood.
A parent in Dwarka and a parent in Anand Vihar should not get the same school advice.

**Implementation:**
- Data already exists in WAQI search API (already integrated)
- Pure frontend change — no backend modifications needed
- Show station list as cards instead of picking first result
- Add `navigator.geolocation` → find nearest station by lat/lon distance

**AWS services:** No new services. Uses existing WAQI search Lambda.

**Effort:** ~2 hours (frontend only)

---

### 2. AQI Trend Forecast — "Will It Get Worse?"

**Current problem:**
AirGuard tells you what the AQI is right now.
But the parent's decision is made at 7 AM.
The AQI might be fine at 7 AM and spike to 300 by 9 AM
when the child is already at school.

**The fix:**
Use the 24-hour history already stored in DynamoDB to show a trend arrow:
- 📈 Rising — AQI has increased > 20 points in last 3 hours
- 📉 Falling — AQI has decreased > 20 points in last 3 hours
- ➡️ Stable — within ±20 points

Use Amazon Bedrock to generate a one-line forecast:
"Based on the last 6 hours, AQI in Delhi is rising. Typically peaks between 8–10 AM in winter.
Expect conditions to worsen before 10 AM."

**Why it matters:**
This flips the product from reactive to predictive.
The user doesn't need to check again — the app tells them what's coming.

**Implementation:**
- History data already in DynamoDB (already built)
- Add trend calculation in `aqi-fetcher` Lambda (compare latest vs 3h-ago reading)
- Send trend data to Bedrock in the `/recommend` prompt
- Add trend arrow + forecast line to `AQICard.jsx`

**AWS services:** Existing Bedrock + DynamoDB. No new services.

**Effort:** ~2 hours (1h backend, 1h frontend)

---

### 3. SMS Alerts via SNS — No Internet Required

**Current problem:**
Email alerts require internet access.
In rural India (where stubble burning pollution is worst), many people
don't have reliable internet. SMS doesn't need internet.

**The fix:**
Add a phone number field to the alert signup form.
When subscribing, user can choose: email alert OR SMS alert.
SMS via SNS is a 3-line code change — protocol: "email" → protocol: "sms".

**Why it matters:**
Opens AirGuard to 700 million mobile users in India who don't have reliable internet.
Farmers in Punjab/Haryana — the people most affected by stubble burning —
can now get alerts on a basic phone with 2G.

**Implementation:**
- `AlertSignup.jsx` — add phone number input + email/SMS toggle
- `alert-system` Lambda — add SNS SMS publish path
- `template.yaml` — add SNS SMS permission to alert Lambda IAM policy
- Add phone number validation (Indian mobile: 10 digits, starts with 6-9)

**AWS services:** SNS SMS (already in SAM template, just unused for SMS)

**Effort:** ~1.5 hours

---

## TIER 2 — High Value, Pitch If Not Built

---

### 4. WhatsApp Bot — The Last-Mile Feature

**Why this is the most important idea in this document:**

The current WhatsApp share button is one-directional (you share a link).
But WhatsApp is bidirectional. And WhatsApp is where 450 million Indians are —
18 hours a day, on ₹3000 Android phones with 2G internet.

A parent who needs AirGuard most is not opening a progressive web app.
They're on a WhatsApp group for their child's school.

**What it does:**
Parent texts: `Delhi AQI`
Bot replies:
```
🌿 AirGuard
📍 Delhi — AQI 247 (Poor)
🏫 School: Cancel outdoor activities
😷 Wear N95 if going outside
⏰ Best time to go out: After 6 PM

Reply SUBSCRIBE DELHI to get daily alerts.
Reply HELP for more options.
```

No app install. No browser. Works offline. Works on 2G.

**Implementation:**
- WhatsApp Business API (Meta) → webhook → Lambda
- Lambda calls existing `/aqi` endpoint internally
- Bedrock generates the reply in <160 chars for SMS-friendly format
- DynamoDB stores WhatsApp subscriptions separately

**AWS services:** New Lambda + API Gateway webhook endpoint. Existing DynamoDB + Bedrock.

**Effort:** ~4 hours

**Why pitch it even if unbuilt:**
The submission video asks for impact. Saying:
"If a school principal could text 'Is it safe today?' and get a decision for 800 students"
is a more compelling impact statement than "users get an email."
The hackathon rubric says "built for where they are" — WhatsApp is exactly that.

---

### 5. School Safety Protocol — From Data to Decisions

**Current problem:**
AirGuard shows AQI and says "schools should close at AQI 200+".
But no school in India has an official protocol for this.
A parent gets the advice but the school stays open anyway.
The advice is incomplete because the institution hasn't received it.

**The fix:**
Build a **School AQI Safety Protocol** — a 3-tier system schools can adopt:

| Tier | AQI Range | Decision |
|---|---|---|
| 🟢 Green Day | 0–100 | Normal school. Outdoor activities allowed. |
| 🟡 Yellow Day | 101–200 | School open. No outdoor PT/sports. Windows closed. |
| 🔴 Red Day | 201+ | Recommend closure or indoor-only day. |

Provide a **shareable daily "Safety Status" card** per school/area —
one link that school principals can paste in their WhatsApp groups every morning.

Example: `airguard.app/status/dwarka-delhi`
Returns: "🔴 Red Day — AQI 287. Recommend no outdoor activities."

**Why it matters for judging:**
Judges ask: "What changes for the people living with it?"
A parent getting a number changes nothing.
A school principal with a protocol changes the day for 800 children.

AirGuard goes from consumer app → institutional infrastructure.

**AWS services:** S3 for static status cards, existing Lambda for data.

**Effort:** ~3 hours

---

### 6. Predictive Night Alert — "Tomorrow Will Be Bad"

**Current problem:**
Alerts fire when AQI is already bad.
The parent's decision to keep the child home is best made the night before,
not at 7 AM when they're already rushing.

**The fix:**
At 9 PM IST every night, the scheduler checks:
- Current AQI trend (rising or falling)
- Historical patterns for that location and day of week
- Whether it's a high-risk day (Diwali, Monday after weekend, post-rainfall)

If the prediction is "tomorrow morning will be Poor or worse" → send a night-before alert:

> "⚠️ Tomorrow morning in Delhi looks bad.
> AQI is currently 180 and rising. Expected to cross 250 by 8 AM.
> Consider keeping sensitive family members indoors tomorrow morning."

**Why it matters:**
This is the only air quality product in India that tells you what's coming
instead of what's already happened. That's a genuine product innovation.

**Implementation:**
- New EventBridge rule at 9 PM IST
- Trend analysis in Scheduler Lambda (already has history access)
- Bedrock generates the night-before forecast
- New `alert_type: night_forecast` in alert-system Lambda

**AWS services:** EventBridge (new rule), existing Bedrock + SNS + DynamoDB.

**Effort:** ~3 hours

---

### 7. Pollution Source Context — "Why Is AQI Bad Today?"

**Current problem:**
AirGuard says AQI is 280. But it doesn't say why.
Is it stubble burning? Festival firecrackers? Industrial accident? Unusual wind?
Without context, users can't assess whether the risk is temporary or ongoing.

**The fix:**
When AQI spikes > 50 points in 6 hours, use Bedrock to generate a context note:

"AQI jumped from 180 to 310 today. Likely cause: stubble burning in Punjab/Haryana
(Oct-Nov season) + low wind speed trapping pollutants. Conditions may persist 2-3 days."

Pull seasonal/calendar context (Diwali dates, stubble burning season, heatwave alerts)
as structured data passed into the Bedrock prompt.

**Why it matters:**
Makes AirGuard feel intelligent rather than just a data relay.
Users understand whether to wait it out or take long-term precautions.

**Implementation:**
- Add spike detection in aqi-fetcher (compare current vs last cached)
- Add calendar/seasonal context to Bedrock prompt in ai-recommender
- New "Why today?" section in `AIAdvice.jsx`

**AWS services:** Existing Bedrock + DynamoDB. No new services.

**Effort:** ~2 hours

---

## TIER 3 — Production Vision (Pitch in Blog/Video)

These are not buildable today but are the right answer to
"Where does this go?" and "How does this scale?"

---

### 8. B2B2C Model — Sell to Institutions, Not Individuals

**The insight:**
AirGuard as a consumer app reaches one family at a time.
AirGuard as an institutional tool reaches 800 families through one school.

Target customers:
- **Schools** — daily safety status, parent broadcast
- **RWAs** (Resident Welfare Associations) — neighborhood-level alerts
- **Hospitals** — patient admission prep on bad air days
- **Corporates** — work-from-home recommendations for employees with health conditions

One school principal using AirGuard = 800 parents protected.
500 schools = 4 lakh families. That's scale.

**AWS services:** Cognito for institutional accounts, SES for branded emails,
CloudFront for white-label dashboards.

---

### 9. Own Monitoring Network — Crowdsourced Sensors

**The insight:**
WAQI has 800 stations across India for 1.4 billion people.
That's 1 station per 175,000 people.
In most cities, there are large neighborhoods with zero monitoring coverage.

The vision: sell/distribute low-cost PM2.5 sensors (< ₹2000) to schools and RWAs.
Each sensor uploads to DynamoDB via IoT (AWS IoT Core).
AirGuard suddenly has hyperlocal data no government portal has.

**AWS services:** AWS IoT Core, Kinesis for sensor data streams,
Timestream for time-series sensor data.

---

### 10. Indoor Air Quality Monitoring

**The insight:**
When outdoor AQI is 300, people close windows and stay inside.
But indoor AQI can also be 200+ from cooking smoke, incense, dust.
The "stay indoors" advice is only good if indoors is actually safer.

AirGuard can expand to indoor sensors — same IoT pipeline,
but sensors placed inside homes and classrooms.

"Outdoor AQI: 280 (Very Poor). Indoor AQI: 180 (Moderate).
Your home is providing partial protection. Run your air purifier on high."

**AWS services:** Same IoT Core + Timestream stack as above.

---

### 11. API for Third-Party Integration

Expose a public API so other apps can embed AirGuard data:
- School apps can show AQI in their daily notification
- Hospital apps can flag high-risk admission days
- News apps can show AQI context in weather sections

**AWS services:** API Gateway with API key management, Usage Plans for rate limiting.

---

## The Core Insight This Document Is Built On

> AirGuard currently solves the **awareness gap** — people don't know the AQI.
> The deeper problem is the **action gap** — people know the AQI is bad
> and still send their kids to school because there's no institutional support for not doing so.

The most powerful version of AirGuard is not a consumer app.
It is the **infrastructure for community air quality response in India**.

One family with AirGuard makes one better decision.
One school with AirGuard makes 800 families safer.
One city government with AirGuard changes policy.

That is the idea worth building.

---

## Summary Table

| # | Idea | Effort | Impact | Build Today? |
|---|---|---|---|---|
| 1 | Hyperlocal station picker | 2h | High | ✅ Yes |
| 2 | AQI trend forecast | 2h | High | ✅ Yes |
| 3 | SMS alerts via SNS | 1.5h | Very High | ✅ Yes |
| 4 | WhatsApp bot | 4h | Highest | ⚡ Pitch if not built |
| 5 | School safety protocol | 3h | Very High | ⚡ Pitch if not built |
| 6 | Predictive night alert | 3h | High | ⚡ Pitch if not built |
| 7 | Pollution source context | 2h | Medium | ⚡ Pitch if not built |
| 8 | B2B2C institutional model | weeks | Highest | 📢 Pitch in video |
| 9 | Crowdsourced sensor network | weeks | Highest | 📢 Pitch in video |
| 10 | Indoor air quality | weeks | High | 📢 Pitch in video |
| 11 | Public API | days | Medium | 📢 Pitch in video |

---

*AirGuard — Built for WeMakeDevs × AWS Environmental Hacks 2026*
*Team: FUTURE_PROTECTOR | Track: Air*
