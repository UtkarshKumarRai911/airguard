# Submission Checklist — AirGuard

Submissions open: **Oct 11, 2026 at 8:00 AM IST**
Deadline: **Oct 11, 2026 (end of day)**

---

## Before Submitting

### Code & Deploy
- [ ] `sam build && sam deploy` ran successfully — no CloudFormation errors
- [ ] API Gateway URL is live — `curl YOUR_API_URL/aqi?location=Delhi` returns data
- [ ] Amplify URL is live — app loads in browser, search works end-to-end
- [ ] SNS topic has at least one confirmed email subscription
- [ ] Run a full test: search a city → see AQI → see AI advice → subscribe alerts
- [ ] Push all code to GitHub (public repo)

### Video
- [ ] 3-minute video recorded and exported as MP4
- [ ] Duration verified ≤ 3:00
- [ ] Uploaded to YouTube (unlisted) or Luma — get the share URL
- [ ] Video shows: problem → demo → AWS console → impact

### Blog Post
- [ ] Blog post published on **AWS Builder Center** (builder.aws/posts or similar)
- [ ] Blog post URL copied — you'll paste it in the submission form
- [ ] Blog covers: problem, stack, what was difficult, AWS services

### Final checks
- [ ] GitHub repo has a proper README.md (already done)
- [ ] `.env.local` is in `.gitignore` — NOT committed
- [ ] No API keys in any committed file

---

## Submission Form — What to Fill

| Field | What to Enter |
|---|---|
| **Project name** | AirGuard |
| **Track** | Air |
| **Build type** | Ship It (deployed on AWS) |
| **One-line description** | Hyperlocal AQI alerts for schools and families, powered by AWS Bedrock AI |
| **Demo URL** | Your Amplify URL |
| **GitHub URL** | Your repo URL |
| **Video URL** | YouTube/Luma link |
| **Blog post URL** | AWS Builder Center post URL |
| **AWS services used** | Lambda, API Gateway, DynamoDB, Bedrock, SNS, Amplify, EventBridge, CloudWatch |
| **Team** | FUTURE_PROTECTOR |

---

## Problem Description (paste this)

> Delhi's AQI crosses 250 on 300+ days a year. Parents have no reliable way to know if it's safe to send their child to school. 3.5 crore school children in India have no air quality warning system.
>
> AirGuard gives them one. Search your city, get a real-time AQI with personalized AI-powered health advice (Amazon Bedrock), and subscribe for email alerts when air quality drops below your threshold — before you step outside.

---

## What AWS Services You Used (for the form)

- **Amazon Lambda** — 4 serverless functions (AQI fetch, AI recommendation, alerts, scheduler)
- **Amazon API Gateway** — REST API with throttling, CORS, X-Ray tracing
- **Amazon DynamoDB** — AQI cache, subscriptions, alert log (TTL, on-demand pricing)
- **Amazon Bedrock (Nova Lite)** — AI-generated personalized health recommendations
- **Amazon SNS** — Email alert dispatch
- **AWS Amplify** — Frontend hosting with CI/CD from GitHub
- **Amazon EventBridge** — 30-minute cron scheduler
- **Amazon CloudWatch** — Logs, alarms, X-Ray traces
