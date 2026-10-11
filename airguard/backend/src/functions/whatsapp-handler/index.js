/**
 * Lambda: WhatsApp Bot Handler (Tier 2, Improvement 4)
 *
 * Handles:
 *   GET  /whatsapp  — Meta webhook verification (one-time setup)
 *   POST /whatsapp  — Incoming messages from users
 *
 * Supported commands:
 *   "<city>"                  — Get current AQI
 *   "<city> AQI"              — Same as above
 *   "SUBSCRIBE <city> <num>"  — Subscribe to AQI alerts
 *   "STOP <city>"             — Unsubscribe from alerts
 *   "HELP"                    — List all commands
 *
 * Architecture:
 *   - Calls existing AQIFetcherFunction via Lambda invoke (reuses cache)
 *   - Calls existing AlertSystemFunction for subscribe/unsubscribe
 *   - Never duplicates business logic — only formats for WhatsApp
 */

const axios = require("axios");
const { LambdaClient, InvokeCommand } = require("@aws-sdk/client-lambda");

const lambdaClient = new LambdaClient({ region: process.env.AWS_REGION || "ap-south-1" });

const WHATSAPP_TOKEN       = process.env.WHATSAPP_TOKEN;
const WHATSAPP_PHONE_ID    = process.env.WHATSAPP_PHONE_NUMBER_ID;
const WEBHOOK_VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN;
const AQI_FETCHER_ARN      = process.env.AQI_FETCHER_ARN;
const ALERT_SYSTEM_ARN     = process.env.ALERT_SYSTEM_ARN;

// ── Send WhatsApp Text Message ────────────────────────────────────────────────

async function sendWhatsAppMessage(to, text) {
  if (!WHATSAPP_TOKEN || !WHATSAPP_PHONE_ID) {
    console.error("WhatsApp credentials not configured");
    return;
  }

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
      },
      timeout: 8000
    }
  );
}

// ── Call Existing AQI Fetcher Lambda (reuses cache) ───────────────────────────

async function getAQI(location) {
  const response = await lambdaClient.send(new InvokeCommand({
    FunctionName:   AQI_FETCHER_ARN,
    InvocationType: "RequestResponse",
    Payload: JSON.stringify({
      httpMethod:            "GET",
      path:                  "/aqi",
      queryStringParameters: { location }
    })
  }));

  const result = JSON.parse(new TextDecoder().decode(response.Payload));

  // Lambda returned an error status
  if (response.FunctionError) {
    throw new Error(`AQI Fetcher error: ${result.errorMessage || "unknown"}`);
  }

  const body = JSON.parse(result.body);
  if (!body.data) {
    throw new Error(body.message || "No AQI data returned");
  }

  return body.data;
}

// ── Format AQI as Short WhatsApp Text ────────────────────────────────────────

function formatAQIMessage(data) {
  const schoolLine = data.aqi >= 200
    ? "🏫 School: Cancel ALL outdoor activities"
    : data.aqi >= 101
    ? "🏫 School: No outdoor PE or sports"
    : "🏫 School: Normal day ✅";

  const maskLine = data.aqi >= 300
    ? "😷 Mask: N95 MANDATORY"
    : data.aqi >= 200
    ? "😷 Mask: N95 recommended"
    : data.aqi >= 101
    ? "😷 Mask: Optional for sensitive groups"
    : "😷 Mask: Not needed ✅";

  const lines = [
    "━━━━━━━━━━━━━━━━━━━━",
    `🌿 AirGuard — ${data.location}`,
    "━━━━━━━━━━━━━━━━━━━━",
    `AQI: ${data.aqi} (${data.category})`,
    "",
    schoolLine,
    maskLine,
    "",
    `Dominant: ${data.dominantPollutant || "PM2.5"}`,
    "",
    `Reply SUBSCRIBE ${data.location.toUpperCase()} 150`,
    "to get alerts when AQI > 150.",
    "Reply HELP for all commands."
  ];

  return lines.join("\n");
}

// ── Parse User Intent ─────────────────────────────────────────────────────────

const KNOWN_CITIES = [
  "delhi", "mumbai", "kolkata", "chennai", "bangalore", "bengaluru",
  "hyderabad", "pune", "ahmedabad", "jaipur", "lucknow", "patna",
  "kanpur", "nagpur", "surat", "noida", "gurgaon", "gurugram",
  "bhopal", "indore", "agra", "varanasi", "chandigarh", "amritsar"
];

function parseIntent(text) {
  const t = text.toLowerCase().trim();

  // HELP
  if (t === "help" || t === "?") {
    return { intent: "help" };
  }

  // SUBSCRIBE <city> <threshold>  e.g. "SUBSCRIBE DELHI 150"
  const subscribeMatch = t.match(/^subscribe\s+([a-z][\w\s]*?)\s+(\d+)$/);
  if (subscribeMatch) {
    return {
      intent:    "subscribe",
      city:      subscribeMatch[1].trim(),
      threshold: parseInt(subscribeMatch[2], 10)
    };
  }

  // STOP <city>  e.g. "STOP DELHI"
  const stopMatch = t.match(/^stop\s+([a-z][\w\s]*?)$/);
  if (stopMatch) {
    return { intent: "unsubscribe", city: stopMatch[1].trim() };
  }

  // Known city name or message contains "aqi"
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
Scale: CPCB India (not US EPA)
Built for WeMakeDevs × AWS Hackathon 2026`;

// ── Main Handler ──────────────────────────────────────────────────────────────

exports.handler = async (event) => {

  // ── GET: Webhook Verification (Meta one-time setup) ───────────────────────
  if (event.httpMethod === "GET") {
    const params = event.queryStringParameters || {};

    if (
      params["hub.mode"] === "subscribe" &&
      params["hub.verify_token"] === WEBHOOK_VERIFY_TOKEN
    ) {
      console.log("✅ Meta webhook verification successful");
      return { statusCode: 200, body: params["hub.challenge"] };
    }

    console.warn("Webhook verification failed — token mismatch");
    return { statusCode: 403, body: "Forbidden" };
  }

  // ── POST: Incoming Message from User ─────────────────────────────────────
  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    // Always return 200 to Meta — otherwise it retries endlessly
    return { statusCode: 200, body: "ok" };
  }

  // Extract message from Meta's webhook payload structure
  const message = body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

  if (!message || message.type !== "text") {
    return { statusCode: 200, body: "ok" };
  }

  const from = message.from;        // User's WhatsApp number e.g. "919876543210"
  const text = message.text?.body;  // Message text

  if (!from || !text) {
    return { statusCode: 200, body: "ok" };
  }

  console.log(`WhatsApp message from ${from}: "${text}"`);

  const { intent, city, threshold } = parseIntent(text);

  try {
    switch (intent) {

      case "help": {
        await sendWhatsAppMessage(from, HELP_TEXT);
        break;
      }

      case "get_aqi": {
        const aqiData = await getAQI(city);
        await sendWhatsAppMessage(from, formatAQIMessage(aqiData));
        break;
      }

      case "subscribe": {
        // Invoke alert-system Lambda to register subscription
        // Uses phone number as identifier (no email required for WhatsApp)
        await lambdaClient.send(new InvokeCommand({
          FunctionName:   ALERT_SYSTEM_ARN,
          InvocationType: "RequestResponse",
          Payload: JSON.stringify({
            httpMethod: "POST",
            path:       "/subscribe",
            body: JSON.stringify({
              email:        `wa_${from}@airguard.bot`, // synthetic email key
              phone:        from,
              alertChannel: "whatsapp",
              location:     city,
              threshold:    threshold || 150,
              userProfile:  { groups: ["general"] }
            })
          })
        }));

        await sendWhatsAppMessage(from,
          `✅ Subscribed!\n\n` +
          `You'll get a WhatsApp alert when ${city} AQI crosses ${threshold || 150}.\n\n` +
          `Reply STOP ${city.toUpperCase()} to cancel anytime.`
        );
        break;
      }

      case "unsubscribe": {
        await lambdaClient.send(new InvokeCommand({
          FunctionName:   ALERT_SYSTEM_ARN,
          InvocationType: "RequestResponse",
          Payload: JSON.stringify({
            httpMethod: "DELETE",
            path:       "/subscribe",
            body: JSON.stringify({
              email:    `wa_${from}@airguard.bot`,
              location: city
            })
          })
        }));

        await sendWhatsAppMessage(from,
          `✅ Unsubscribed from ${city} alerts.`
        );
        break;
      }

      default: {
        await sendWhatsAppMessage(from, HELP_TEXT);
      }
    }

  } catch (err) {
    console.error("WhatsApp handler error:", err.message);
    await sendWhatsAppMessage(from,
      `⚠️ Sorry, something went wrong. Please try again.\n\nReply HELP for commands.`
    ).catch(() => {}); // Swallow error — don't let sendMessage failure cause a 500
  }

  // Always return 200 — Meta marks your webhook as failed if you return anything else
  return { statusCode: 200, body: "ok" };
};
