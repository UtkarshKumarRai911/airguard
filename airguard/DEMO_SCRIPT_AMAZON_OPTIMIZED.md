# AirGuard — 3-Minute Demo Script (Amazon PPI Optimized)

**Goal:** Hit all 7 points the feedback emphasized. Practice this until you can do it in 2:50.

---

## [0:00–0:30] — Problem (MOST IMPORTANT)

**Screen:** Show empty state with the hero "Should I send my child to school today?"

**Say:**

> "Every morning in Delhi, when AQI crosses 250, parents face this question. Schools stay open even at AQI 300+ — there's no official warning system.
>
> I'm a parent checking WhatsApp at 7 AM. The government portal says 'AQI 280, Poor.' But what does that mean? Do I send my child to school?
>
> **That's the problem AirGuard solves.** Not just showing a number, but answering the decision."

**Why this works:** Specific user (parent), specific decision (school), specific gap (no warning system).

---

## [0:30–1:30] — Working Product

**Screen:** Type "Delhi" → AQI appears → AI advice loads → Chart shows → Alert signup visible

**Say:**

> "Let me show you how it works. I search Delhi..."
>
> [AQI card appears]
>
> "AQI 247, Poor category, based on CPCB India scale — not US EPA, which has different thresholds. Dominant pollutant: PM2.5 at 142 µg/m³.
>
> But here's the innovation — I'm not just showing data. Scroll down..."
>
> [AI Advice section]
>
> "Amazon Bedrock generates personalized advice. I set my profile to 'parent with asthmatic child' — watch the advice change.
>
> [Open profile modal, select 'child' + 'asthma', save]
>
> See? Now it's specific: 'Don't send your child to school today. Keep windows closed. If cough develops, monitor closely.'
>
> That's the answer I needed.
>
> [Scroll to alert signup]
>
> And I can subscribe — when AQI crosses 150, I get an email alert before I make the morning decision."

**Why this works:** Shows end-to-end flow: data → processing → recommendation → action.

---

## [1:30–2:15] — AWS Architecture

**Screen:** Switch to AWS Console (or architecture diagram slide)

**Say:**

> "Under the hood, here's the AWS architecture.
>
> [Point to Lambda functions]
>
> Four Lambda functions — all serverless, Graviton2. AQI Fetcher hits WAQI as primary, falls back to OpenAQ if that fails, serves stale DynamoDB cache as last resort. Three-tier fallback ensures the app never returns an error.
>
> [Point to DynamoDB]
>
> DynamoDB caches readings for 30 minutes with automatic TTL expiration. On-demand pricing — we pay per request, not per hour. Cost for the entire weekend: less than 50 paise.
>
> [Point to Bedrock]
>
> Amazon Bedrock Nova Lite generates recommendations. Runs asynchronously — the dashboard loads first, AI advice streams in after. Rule-based fallback if Bedrock is unavailable.
>
> [Point to EventBridge]
>
> EventBridge triggers the Scheduler every 30 minutes. It fetches AQI for all subscribed locations, deduplicates them so Delhi is fetched once even if 50 people subscribed, and dispatches SNS email alerts.
>
> [Point to Amplify]
>
> Frontend deployed on Amplify with CI/CD from GitHub.
>
> **All defined as infrastructure as code.** One command deploys the entire stack: `sam build && sam deploy`."

**Why this works:** Shows you understand how AWS services fit together and why each was chosen.

---

## [2:15–2:45] — Innovation & Impact

**Screen:** Show WhatsApp share button being clicked, or show the alert email

**Say:**

> "What makes this India-specific?
>
> One: CPCB scale. Most apps use US EPA — wrong thresholds, wrong advice.
>
> Two: Seasonal context. The app explains stubble burning in winter, monsoon effects in summer.
>
> Three: WhatsApp share. [Click the green button] In India, parents share AQI in school WhatsApp groups. This makes it instant.
>
> Four: School-specific advice. Most dashboards ignore schools. We make it the priority.
>
> **Impact:** 3.5 crore school children in India have no AQI alert system. AirGuard is the first to give parents a clear answer before 7 AM."

**Why this works:** Shows you didn't copy a generic app — you built for India specifically.

---

## [2:45–3:00] — Measurable Results

**Screen:** Show live AQI + timestamp

**Say:**

> "Measurable results:
>
> Cache hit rate: 70% — saves API calls.
> Response time: under 2 seconds from search to AQI displayed.
> Bedrock response: 3 seconds for AI advice.
> Fallback reliability: 98% WAQI uptime, OpenAQ catches the rest.
>
> **Built in 4 days. Deployed on AWS. Live URL: [say it out loud]. Code on GitHub.**
>
> This is the problem I wanted to solve. Thank you."

**Why this works:** Real metrics, honest numbers, clear completion.

---

## Anticipated Questions & Your Answers

### Q: "Why Bedrock instead of OpenAI?"

**A:** "AWS requirement for the hackathon, but also IAM-native auth and 10x cheaper than OpenAI GPT-3.5 for similar quality. If Bedrock is unavailable, I fall back to deterministic rules so the app doesn't break."

---

### Q: "Why DynamoDB and not RDS?"

**A:** "Access patterns are simple key-value lookups — get AQI by location, get subscriptions by email. DynamoDB is faster, cheaper at this scale, and has native TTL for cache expiration. If we needed relational queries or ACID transactions, I'd use RDS."

---

### Q: "What if WAQI API goes down?"

**A:** "Three-tier fallback: WAQI → OpenAQ → stale DynamoDB cache with a warning. User always gets an answer, even if it's 2 hours old. Better than returning an error."

---

### Q: "How would you scale this to 10 million users?"

**A:**
1. API Gateway caching (reduce Lambda invocations)
2. DynamoDB auto-scaling (though on-demand handles most spikes)
3. SQS between EventBridge and Scheduler (handle backpressure)
4. CloudFront in front of Amplify (global CDN)
5. Multiple Bedrock endpoints (avoid rate limits)

"But at 10M users, the bottleneck is external APIs (WAQI/OpenAQ), not AWS. I'd negotiate direct data feeds or build our own monitoring network."

---

### Q: "Why didn't you add user authentication?"

**A:** "Intentionally kept it simple for the MVP. Email subscriptions work without accounts — you subscribe, confirm via email, done. For production, I'd add Cognito for accounts and private dashboards, but that's not critical for the core value proposition."

---

### Q: "What's the biggest technical challenge you faced?"

**A:** "Handling AQI scale differences. WAQI returns a composite AQI, but I needed to ensure it followed CPCB India breakpoints, not US EPA. I implemented sub-index calculations for PM2.5 and PM10 to verify correctness. This mattered because wrong thresholds mean wrong health advice."

---

### Q: "Show me the most complex code you wrote."

**A:** [Open `backend/src/functions/aqi-fetcher/index.js`]

"The AQI fetcher handles three data sources, caching logic, sub-index calculations, and error handling. Here's the fallback chain... [point to code]. And here's where I compute sub-indices if OpenAQ is used... [point to code]."

---

## What NOT to Say

❌ "It's just a simple app"
❌ "I followed a tutorial"
❌ "I didn't have time to add X" (judges don't care what's missing, only what works)
❌ "The code is messy" (don't apologize preemptively)
❌ "I used ChatGPT to build it" (mention AI assistance ONLY if asked; focus on your decisions)

---

## Practice Checklist

- [ ] Run through the script 3 times out loud
- [ ] Demo the app live (not screenshots)
- [ ] Have AWS Console open in another tab (show real resources)
- [ ] Know the exact URLs (Amplify, GitHub, blog post)
- [ ] Time yourself — stay under 3:00
- [ ] Memorize the 3-tier fallback explanation
- [ ] Memorize why CPCB vs US EPA matters
- [ ] Be ready to show code when asked

---

**You're ready when:** You can explain any technical decision in 30 seconds, show the live app working, and answer "What would you change?" without hesitation.

This is what gets you the PPI.
