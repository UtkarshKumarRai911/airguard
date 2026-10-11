# AirGuard — 3-Minute Demo Video Script

> **Format:** Screen recording with voiceover. No live presentation needed.
> **Target:** 2:45–3:00 minutes. Do NOT go over 3:00.
> **Tools:** OBS Studio (free) or Loom for recording.

---

## Pre-recording Checklist

- [ ] App is live on Amplify with a working URL
- [ ] Have Delhi (AQI > 200 ideally) ready to search — or use a cached high-AQI demo
- [ ] AWS Console open in another tab — Lambda, DynamoDB, Bedrock
- [ ] Email inbox open to show an alert email arriving
- [ ] Microphone tested, background noise removed
- [ ] Browser zoom at 110% so UI is clear in recording

---

## Script (line by line with timestamps)

---

### [0:00–0:30] — THE PROBLEM (don't skip this, judges care most)

**Screen:** Show a map of India or a headline about Delhi AQI. Or just the app's empty state with the statistics.

**Say:**
> "Every winter morning in Delhi, the AQI crosses 250 — that's 'Poor' on India's CPCB scale. School is open. Parents have no alert. No one tells them: don't send your child outside today.
>
> 140 million people in India breathe hazardous air daily. 3.5 crore school children have no warning system. That's the problem we built AirGuard to solve."

---

### [0:30–1:30] — THE DEMO (the core 60 seconds)

**Screen:** App homepage

**Say:**
> "AirGuard is a hyperlocal air quality alert system. Let me show you how it works."

**Action:** Type "Delhi" in the search bar. Hit Check AQI.

**Say:**
> "In under 2 seconds, we have Delhi's current AQI — [read the number]. That's [category]. Here's what that means: [read the health implication]."

**Action:** Point to the school advice box if AQI > 200.

**Say:**
> "Critically — we show specific school advice. Parents don't have to interpret a number. The answer is right here."

**Action:** Scroll to the AI Advice section.

**Say:**
> "This is where Amazon Bedrock comes in. We send the AQI, the pollutant readings, and the user's health profile to Amazon Nova Lite. It generates plain-English advice: is it safe to go outside? What mask should you wear? What time is safest today?
>
> This isn't a static FAQ. It's personalized. Click the profile button..."

**Action:** Open UserProfile modal. Select "child" and "asthma". Save.

**Say:**
> "...and the advice changes immediately. Now it's written for a parent with an asthmatic child."

**Action:** Scroll to pollutant grid.

**Say:**
> "We also break down individual pollutants — PM2.5, PM10, ozone — with progress bars against safe limits so you know which pollutant is driving the danger."

**Action:** Scroll to the chart.

**Say:**
> "And a 24-hour trend chart showing whether air quality is improving or getting worse."

---

### [1:30–2:30] — THE TECH (show AWS, impress the judges)

**Screen:** Switch to AWS Console

**Say:**
> "Under the hood, here's the architecture."

**Action:** Show Lambda console — 4 functions visible.

**Say:**
> "Four Lambda functions — serverless, Graviton2 architecture. AQI fetcher hits WAQI as primary source, falls back to OpenAQ if that fails, and serves a DynamoDB cache as last resort. Nothing ever returns a blank screen."

**Action:** Click on DynamoDB → Tables — show the 3 tables.

**Say:**
> "Three DynamoDB tables — AQI cache with 30-minute TTL, subscriptions, and an alert log. On-demand pricing. Cost for the entire weekend: essentially zero."

**Action:** Show API Gateway — 7 routes visible.

**Say:**
> "All routed through API Gateway with throttling and X-Ray tracing. The frontend is deployed on AWS Amplify — auto-deploys from GitHub, global CDN, zero config SSL."

**Action:** Show EventBridge rule.

**Say:**
> "An EventBridge cron rule fires every 30 minutes, refreshes AQI for all subscribed locations, and dispatches alerts via SNS."

---

### [2:30–3:00] — ALERTS + IMPACT

**Screen:** Show email inbox with an AirGuard alert email (or the subscribe form on the app)

**Say:**
> "Alerts come as rich HTML emails — AQI number, category, school advice, pollutant readings — sent the moment AQI crosses your threshold. With a 3-hour cooldown so you're not spammed."

**Action:** Briefly show the subscribe form or an alert email if available.

**Say:**
> "AirGuard is live. It uses CPCB's official Indian AQI scale — not the US EPA scale, because the breakpoints are different and wrong advice is dangerous.
>
> The infrastructure deploys with one command. The code is all open-source. And the entire backend costs less than 50 paise per day to run.
>
> We built this for the parent in Delhi who just wants to know: is it safe today?
>
> Now they have an answer."

**[End recording]**

---

## Post-recording Checklist

- [ ] Trim silence at start and end
- [ ] Verify total duration is under 3:00
- [ ] Check audio is clear throughout
- [ ] Export as MP4, 1080p
- [ ] Upload to YouTube (unlisted) or provide direct link in submission
- [ ] In submission form: link the Amplify live URL + GitHub repo + video + blog post URL

---

## Pro Tips for Recording

1. **Rehearse twice** before recording. The script is 2:50 at normal speaking pace.
2. **Speak slower than normal** — recordings always feel faster than practice.
3. **Record in one take if possible** — cuts are fine but seamless is better.
4. **Make sure the AQI is actually live** — if Delhi has a good/high AQI on recording day, lead with that real number. It's more compelling than a staged demo.
5. **Show the AWS Console briefly** — judges need to see that this is actually deployed, not just running locally.
