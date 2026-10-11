# AirGuard — Step-by-Step Deployment Guide

This is the exact sequence of commands to go from zero to live. Follow in order.

---

## Prerequisites Check

```powershell
node --version          # Should be 20.x
aws --version           # Should be 2.x
sam --version           # Should be 1.x
```

If any are missing, install them before continuing.

---

## Step 1 — Clone and setup

```powershell
# Navigate to project
cd C:\visual_searh_project\airguard

# Install Lambda layer dependencies
cd backend\src\layers\common\nodejs
npm install
cd ..\..\..\..\..\..
```

---

## Step 2 — Configure AWS

```powershell
aws configure
```

Enter:
- AWS Access Key ID: (from IAM → Users → Security credentials)
- AWS Secret Access Key: (from same place)
- Default region: `ap-south-1`
- Default output format: `json`

---

## Step 3 — Enable Bedrock Models

1. Go to [AWS Console → Bedrock → Model access](https://ap-south-1.console.aws.amazon.com/bedrock/home?region=ap-south-1#/modelaccess)
2. Click **Manage model access**
3. Check: **Amazon Nova Lite**, **Amazon Nova Micro**
4. Click **Save changes**
5. Wait ~2 minutes for approval (it's automatic)

---

## Step 4 — Get WAQI Token

1. Go to [aqicn.org/data-platform/token](https://aqicn.org/data-platform/token/)
2. Enter your email
3. Check inbox — token arrives within 1 minute
4. Copy the token (looks like: `a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4`)

---

## Step 5 — Deploy Backend

```powershell
cd C:\visual_searh_project\airguard\backend

# Build
sam build

# First-time deploy (guided — answers questions once, saves to samconfig.toml)
sam deploy --guided
```

When prompted:
- Stack Name: `airguard`
- AWS Region: `ap-south-1`
- Parameter WAQIToken: paste your WAQI token
- Parameter Environment: `dev`
- Parameter FrontendURL: leave blank for now (update after Amplify deploy)
- Confirm changes before deploy: `Y`
- Allow SAM CLI IAM role creation: `Y`
- Save arguments to samconfig.toml: `Y`

After deploy completes, **copy the APIEndpoint output value**. It looks like:
```
https://abc123xyz.execute-api.ap-south-1.amazonaws.com/dev
```

---

## Step 6 — Test the Backend

```powershell
# Replace with your actual API URL
$API = "https://abc123xyz.execute-api.ap-south-1.amazonaws.com/dev"

# Test AQI fetch
Invoke-WebRequest -Uri "$API/aqi?location=Delhi" | Select-Object -Expand Content

# Should return JSON with aqi, category, readings, advice
```

If you get a 200 response with AQI data — backend is working.

---

## Step 7 — Deploy Frontend to Amplify

### Option A: Via AWS Console (recommended)

1. Push `airguard/frontend` to a **new public GitHub repo**
2. Go to [AWS Amplify Console](https://ap-south-1.console.aws.amazon.com/amplify)
3. Click **New app** → **Host web app**
4. Choose **GitHub** → authorize → select your repo → select `main` branch
5. On **Build settings** page — Amplify auto-detects `amplify.yml`
6. Click **Advanced settings** → Add environment variable:
   - Key: `VITE_API_URL`
   - Value: your API Gateway URL from Step 5
7. Click **Save and deploy**
8. Wait ~3 minutes. Copy your Amplify URL.

### Option B: Via Amplify CLI

```powershell
cd C:\visual_searh_project\airguard\frontend

# Create .env.local
Copy-Item .env.example .env.local
# Edit .env.local — set VITE_API_URL to your API Gateway URL

# Build locally first to verify
npm install
npm run build
# If build succeeds, you're ready to push
```

---

## Step 8 — Update Frontend URL in Backend

After you have the Amplify URL, update the SAM parameter so SNS unsubscribe links work:

```powershell
cd C:\visual_searh_project\airguard\backend

sam deploy --parameter-overrides "FrontendURL=https://main.d1234.amplifyapp.com Environment=dev WAQIToken=YOUR_TOKEN"
```

---

## Step 9 — Subscribe to SNS Topic for Testing

```powershell
# Get your SNS topic ARN
aws sns list-topics --region ap-south-1

# Subscribe your email
aws sns subscribe `
  --region ap-south-1 `
  --topic-arn "arn:aws:sns:ap-south-1:YOUR_ACCOUNT_ID:airguard-alerts-dev" `
  --protocol email `
  --notification-endpoint "your@email.com"
```

Check inbox and click **Confirm subscription**.

---

## Step 10 — End-to-End Test

1. Open your Amplify URL in a browser
2. Search "Delhi"
3. Verify: AQI loads, pollutant grid shows, AI advice generates
4. Go to alert signup, enter your email, threshold 100, click Enable
5. Wait up to 30 minutes for the scheduler to run (or trigger manually in Lambda console)
6. Check inbox for an alert email

If all steps pass — you're live.

---

## Useful Commands

```powershell
# Re-deploy after code changes
sam build && sam deploy

# View Lambda logs in real-time
aws logs tail /aws/lambda/airguard-aqi-fetcher-dev --follow --region ap-south-1

# Trigger scheduler manually for testing
aws lambda invoke `
  --function-name airguard-scheduler-dev `
  --region ap-south-1 `
  output.json
Get-Content output.json

# Delete all resources when done (be careful!)
# sam delete --stack-name airguard
```

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `sam build` fails | Make sure Node 20 is installed and `npm install` ran in the layers folder |
| API returns 500 | Check Lambda logs: `aws logs tail /aws/lambda/airguard-aqi-fetcher-dev` |
| AQI returns empty | Verify WAQI token is set correctly in SSM/SAM parameters |
| Bedrock returns error | Confirm model access was enabled in Step 3 |
| Frontend CORS error | Make sure `VITE_API_URL` doesn't have a trailing slash |
| SNS emails not arriving | Check the subscription is in "Confirmed" state in SNS console |
| Amplify build fails | Check build logs in Amplify console; usually a missing env variable |
