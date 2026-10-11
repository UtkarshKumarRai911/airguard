/**
 * Lambda #2: AI Recommendation Engine
 *
 * Handles:
 *   POST /recommend
 *   Body: {
 *     location: string,
 *     aqi: number,
 *     category: string,
 *     readings: { pm25, pm10, o3, no2, so2, co },
 *     userProfile: {
 *       groups: ["general"|"child"|"elderly"|"asthma"|"heart"|"pregnant"],
 *       hasAirPurifier: boolean,
 *       activityPlanned: string  // e.g. "school run", "morning jog", "commute"
 *     }
 *   }
 *
 * Uses Amazon Bedrock (Claude / Nova) to generate:
 *   - Personalized health recommendations
 *   - Activity-specific advice
 *   - When/if it's safe to go outside today
 *   - Indoor air quality tips
 *   - What to tell children
 *
 * Falls back to rule-based recommendations if Bedrock fails.
 */

const {
  BedrockRuntimeClient,
  InvokeModelCommand
} = require("@aws-sdk/client-bedrock-runtime");
const { getAQICategory } = require("/opt/nodejs/utils/aqi-utils");
const { success, error, preflight, parseBody, getOrigin } = require("/opt/nodejs/utils/response-utils");

const bedrockClient = new BedrockRuntimeClient({
  region: process.env.BEDROCK_REGION || process.env.AWS_REGION || "ap-south-1"
});

// Model preference order — tries each until one works (region/access may vary)
const MODEL_IDS = [
  "amazon.nova-lite-v1:0",         // Amazon Nova Lite — fastest, cheapest
  "amazon.nova-micro-v1:0",        // Amazon Nova Micro — ultra-fast
  "anthropic.claude-instant-v1",   // Claude Instant — fallback
];

// ── Bedrock Invocation ────────────────────────────────────────────────────────

async function invokeBedrockModel(modelId, prompt) {
  let body;

  if (modelId.startsWith("amazon.nova")) {
    body = JSON.stringify({
      messages: [{ role: "user", content: [{ text: prompt }] }],
      inferenceConfig: { maxTokens: 600, temperature: 0.3, topP: 0.9 }
    });
  } else if (modelId.startsWith("anthropic.claude")) {
    body = JSON.stringify({
      prompt:       `\n\nHuman: ${prompt}\n\nAssistant:`,
      max_tokens_to_sample: 600,
      temperature:  0.3,
      top_p:        0.9
    });
  } else {
    throw new Error(`Unknown model family: ${modelId}`);
  }

  const command = new InvokeModelCommand({
    modelId,
    contentType: "application/json",
    accept:      "application/json",
    body
  });

  const response = await bedrockClient.send(command);
  const responseBody = JSON.parse(new TextDecoder().decode(response.body));

  if (modelId.startsWith("amazon.nova")) {
    return responseBody.output?.message?.content?.[0]?.text || "";
  } else if (modelId.startsWith("anthropic.claude")) {
    return responseBody.completion || "";
  }
  return "";
}

async function callBedrock(prompt) {
  for (const modelId of MODEL_IDS) {
    try {
      const result = await invokeBedrockModel(modelId, prompt);
      if (result && result.trim().length > 10) {
        return { text: result.trim(), model: modelId };
      }
    } catch (err) {
      console.warn(`Model ${modelId} failed:`, err.message);
    }
  }
  throw new Error("All Bedrock models failed");
}

// ── Prompt Builder ────────────────────────────────────────────────────────────

function buildPrompt(data) {
  const { location, aqi, category, readings, userProfile, currentTime } = data;
  const groups = userProfile?.groups || ["general"];
  const activity = userProfile?.activityPlanned || "general outdoor activity";
  const hasPurifier = userProfile?.hasAirPurifier || false;

  const pollutantsInfo = [];
  if (readings?.pm25 != null) pollutantsInfo.push(`PM2.5: ${readings.pm25} µg/m³`);
  if (readings?.pm10 != null) pollutantsInfo.push(`PM10: ${readings.pm10} µg/m³`);
  if (readings?.o3   != null) pollutantsInfo.push(`Ozone (O₃): ${readings.o3} µg/m³`);
  if (readings?.no2  != null) pollutantsInfo.push(`NO₂: ${readings.no2} µg/m³`);
  if (readings?.so2  != null) pollutantsInfo.push(`SO₂: ${readings.so2} µg/m³`);

  const groupDescriptions = {
    child:    "children (school-age)",
    elderly:  "elderly people (60+)",
    asthma:   "people with asthma or respiratory conditions",
    heart:    "people with heart conditions",
    pregnant: "pregnant women",
    general:  "general healthy adults"
  };

  const groupText = groups
    .map(g => groupDescriptions[g] || g)
    .join(", ");

  return `You are an air quality health advisor for India. Provide clear, practical, empathetic advice.

Current air quality data for ${location}:
- AQI: ${aqi} (${category} — Indian CPCB scale)
- Pollutants: ${pollutantsInfo.length > 0 ? pollutantsInfo.join(", ") : "No detailed data"}
- Time: ${currentTime || "unknown"}

Person profile:
- Vulnerable groups: ${groupText}
- Planned activity: ${activity}
- Has air purifier at home: ${hasPurifier ? "Yes" : "No"}

Please provide a response in this EXACT JSON format (no markdown, just JSON):
{
  "summary": "2-sentence plain English summary of current conditions",
  "immediateAction": "One clear sentence: what should this person do RIGHT NOW",
  "isOutdoorSafe": true or false,
  "safestTimeToGoOut": "e.g. 'After 6 PM when AQI typically drops' or 'Not today'",
  "activityAdvice": "Specific advice for their planned activity: ${activity}",
  "protectiveSteps": ["step 1", "step 2", "step 3"],
  "indoorTips": ["tip 1", "tip 2"],
  "childrenAdvice": "Specific one-sentence advice for parents about sending children outside",
  "maskAdvice": "Whether and what type of mask is needed",
  "whenToSeeDoctor": "Symptoms that should prompt a doctor visit"
}`;
}

// ── Rule-based Fallback ───────────────────────────────────────────────────────

function getRuleBasedRecommendation(aqi, category, userProfile) {
  const riskLevel = getAQICategory(aqi).riskLevel;
  const groups = userProfile?.groups || ["general"];
  const isSensitive = groups.some(g => ["child", "elderly", "asthma", "heart", "pregnant"].includes(g));

  const isOutdoorSafe = riskLevel <= 2 || (riskLevel === 3 && !isSensitive);

  const protectiveSteps = ["Stay updated with AQI hourly", "Keep windows closed when AQI > 150"];
  if (riskLevel >= 3) protectiveSteps.push("Wear N95 mask if going outside");
  if (riskLevel >= 4) protectiveSteps.push("Run air purifier continuously");
  if (riskLevel >= 5) protectiveSteps.push("Avoid all outdoor activities");

  const indoorTips = ["Keep indoor plants like money plant to absorb pollutants"];
  if (riskLevel >= 3) indoorTips.push("Seal gaps in windows and doors");
  if (riskLevel >= 4) indoorTips.push("Avoid cooking on high smoke indoors");

  return {
    summary: `AQI is ${aqi} (${category}). ${
      riskLevel <= 2 ? "Air quality is acceptable for most activities." :
      riskLevel <= 3 ? "Sensitive groups should limit outdoor exposure." :
      riskLevel <= 4 ? "Everyone should reduce outdoor time significantly." :
      "Health emergency conditions. Avoid all outdoor exposure."
    }`,
    immediateAction: riskLevel <= 2
      ? "No immediate action needed — conditions are acceptable."
      : riskLevel <= 3
      ? "Reduce prolonged outdoor activity, especially if you're in a sensitive group."
      : "Stay indoors with windows closed.",
    isOutdoorSafe,
    safestTimeToGoOut: riskLevel <= 2
      ? "Any time during the day"
      : riskLevel <= 3
      ? "Early morning (5–7 AM) when AQI is typically lowest"
      : "Check AQI updates — avoid going out until it improves",
    activityAdvice: isOutdoorSafe
      ? "Proceed with planned activity but keep duration short if AQI > 100."
      : "Postpone outdoor activity until AQI improves below 150.",
    protectiveSteps,
    indoorTips,
    childrenAdvice: riskLevel <= 2
      ? "Children can play outdoors normally."
      : riskLevel <= 3
      ? "Limit outdoor play to 30 minutes; avoid strenuous activity."
      : "Keep children indoors. Cancel outdoor school activities.",
    maskAdvice: riskLevel <= 2
      ? "No mask needed."
      : riskLevel === 3
      ? "N95 mask recommended for sensitive groups."
      : "N95 mask mandatory for everyone going outside.",
    whenToSeeDoctor: "Persistent cough, wheezing, chest tightness, shortness of breath, or eye irritation that doesn't improve indoors.",
    source: "rule-based"
  };
}

// ── Input Validation ──────────────────────────────────────────────────────────

function validateInput(body) {
  const errors = [];

  if (!body.location || typeof body.location !== "string") {
    errors.push("location is required (string)");
  }
  if (body.aqi == null || isNaN(Number(body.aqi))) {
    errors.push("aqi is required (number)");
  }
  if (body.aqi < 0 || body.aqi > 500) {
    errors.push("aqi must be between 0 and 500");
  }

  const validGroups = ["general", "child", "elderly", "asthma", "heart", "pregnant"];
  if (body.userProfile?.groups) {
    const invalid = body.userProfile.groups.filter(g => !validGroups.includes(g));
    if (invalid.length > 0) {
      errors.push(`Invalid user groups: ${invalid.join(", ")}. Valid: ${validGroups.join(", ")}`);
    }
  }

  return errors;
}

// ── Main Handler ──────────────────────────────────────────────────────────────

exports.handler = async (event) => {
  const origin = getOrigin(event);

  if (event.httpMethod === "OPTIONS") return preflight(origin);

  let body;
  try {
    body = parseBody(event);
  } catch {
    return error("Invalid JSON body", 400, origin);
  }

  const validationErrors = validateInput(body);
  if (validationErrors.length > 0) {
    return error(`Validation failed: ${validationErrors.join("; ")}`, 400, origin);
  }

  const aqi         = Math.round(Number(body.aqi));
  const category    = body.category || getAQICategory(aqi).label;
  const location    = body.location.trim().substring(0, 100);
  const userProfile = body.userProfile || { groups: ["general"] };
  const readings    = body.readings || {};

  const currentTime = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit", minute: "2-digit", weekday: "long"
  }).format(new Date());

  // Try Bedrock AI first
  let recommendation = null;
  let aiUsed = false;

  try {
    const prompt = buildPrompt({ location, aqi, category, readings, userProfile, currentTime });
    const { text, model } = await callBedrock(prompt);

    // Parse JSON from Bedrock response — handle cases where model adds extra text
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Bedrock response did not contain valid JSON");

    recommendation = JSON.parse(jsonMatch[0]);
    recommendation.model = model;
    aiUsed = true;
    console.log(`Bedrock AI recommendation generated using ${model}`);
  } catch (bedrockErr) {
    console.warn("Bedrock failed, using rule-based fallback:", bedrockErr.message);
    recommendation = getRuleBasedRecommendation(aqi, category, userProfile);
  }

  return success({
    location,
    aqi,
    category,
    recommendation,
    aiPowered: aiUsed,
    generatedAt: new Date().toISOString()
  }, 200, origin);
};
