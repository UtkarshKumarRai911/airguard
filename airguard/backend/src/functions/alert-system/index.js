/**
 * Lambda #3: Alert System
 *
 * Handles:
 *   POST /subscribe    — subscribe email to AQI alerts for a location
 *   DELETE /subscribe  — unsubscribe
 *   GET /subscriptions — list subscriptions for an email
 *
 * Also invoked internally by the Scheduler Lambda when AQI crosses thresholds.
 *
 * Alert logic:
 *   - User sets a threshold (default: 150 / Moderate boundary)
 *   - Alert sent when AQI crosses that threshold (not on every check)
 *   - Category change alerts: always notify on Poor (200+), Very Poor (300+), Severe (400+)
 *   - Daily summary email at 7 AM IST regardless of threshold
 *   - Cooldown: no repeat alerts within 3 hours for same location
 */

const { SNSClient, PublishCommand } = require("@aws-sdk/client-sns");
const { getAQICategory } = require("/opt/nodejs/utils/aqi-utils");
const { success, error, preflight, parseBody, getOrigin } = require("/opt/nodejs/utils/response-utils");
const { getItem, putItem, queryItems, deleteItem, updateItem, TABLES } = require("/opt/nodejs/utils/db-utils");

const snsClient = new SNSClient({ region: process.env.AWS_REGION || "ap-south-1" });
const SNS_TOPIC_ARN = process.env.SNS_TOPIC_ARN;
const ALERT_COOLDOWN_MS = parseInt(process.env.ALERT_COOLDOWN_MS || "10800000", 10); // 3 hours

// ── Email Templates ───────────────────────────────────────────────────────────

function buildAlertEmailHTML(subscription, aqiData, alertType) {
  const category = getAQICategory(aqiData.aqi);
  const isCritical = aqiData.aqi >= 300;

  const colorBar = `background-color: ${category.color};`;
  const borderColor = isCritical ? "#c0392b" : category.color;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AirGuard Alert — ${aqiData.location}</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:20px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;border:2px solid ${borderColor};">

          <!-- Header -->
          <tr>
            <td style="background:#1a1a2e;padding:20px 30px;text-align:center;">
              <h1 style="color:#ffffff;margin:0;font-size:24px;">🌿 AirGuard</h1>
              <p style="color:#aaaaaa;margin:5px 0 0;font-size:13px;">Air Quality Alert System</p>
            </td>
          </tr>

          <!-- AQI Banner -->
          <tr>
            <td style="${colorBar}padding:25px 30px;text-align:center;">
              <p style="margin:0;font-size:14px;color:#ffffff;font-weight:bold;text-transform:uppercase;letter-spacing:2px;">${alertType === "daily_summary" ? "Daily Summary" : "⚠️ ALERT"}</p>
              <p style="margin:8px 0 0;font-size:64px;font-weight:900;color:#ffffff;line-height:1;">${aqiData.aqi}</p>
              <p style="margin:4px 0 0;font-size:22px;font-weight:bold;color:#ffffff;">${category.label}</p>
              <p style="margin:6px 0 0;font-size:15px;color:rgba(255,255,255,0.85);">📍 ${aqiData.location}</p>
            </td>
          </tr>

          <!-- Health Implication -->
          <tr>
            <td style="padding:20px 30px;border-bottom:1px solid #eeeeee;">
              <h3 style="color:#333333;margin:0 0 8px;font-size:16px;">What this means</h3>
              <p style="color:#555555;margin:0;line-height:1.6;font-size:14px;">${category.healthImplication}</p>
            </td>
          </tr>

          <!-- Advice Grid -->
          <tr>
            <td style="padding:20px 30px;border-bottom:1px solid #eeeeee;">
              <h3 style="color:#333333;margin:0 0 12px;font-size:16px;">What to do</h3>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="50%" style="padding:8px 8px 8px 0;vertical-align:top;">
                    <div style="background:#f8f9fa;border-radius:6px;padding:12px;">
                      <p style="margin:0 0 4px;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:1px;">General Public</p>
                      <p style="margin:0;font-size:13px;color:#333;line-height:1.5;">${category.generalPublicAdvice}</p>
                    </div>
                  </td>
                  <td width="50%" style="padding:8px 0 8px 8px;vertical-align:top;">
                    <div style="background:#f8f9fa;border-radius:6px;padding:12px;">
                      <p style="margin:0 0 4px;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:1px;">Sensitive Groups</p>
                      <p style="margin:0;font-size:13px;color:#333;line-height:1.5;">${category.sensitiveGroupsAdvice}</p>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- School Advice (highlighted if critical) -->
          <tr>
            <td style="padding:16px 30px;background:${aqiData.aqi >= 200 ? "#fff5f5" : "#f9fff9"};border-bottom:1px solid #eeeeee;">
              <p style="margin:0;font-size:13px;color:#555;"><strong>🏫 School Advice:</strong> ${category.schoolAdvice}</p>
            </td>
          </tr>

          <!-- Pollutant Readings -->
          ${aqiData.readings && Object.values(aqiData.readings).some(v => v != null) ? `
          <tr>
            <td style="padding:20px 30px;border-bottom:1px solid #eeeeee;">
              <h3 style="color:#333333;margin:0 0 12px;font-size:16px;">Pollutant Levels</h3>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  ${aqiData.readings.pm25 != null ? `<td style="text-align:center;padding:8px;"><div style="background:#f8f9fa;border-radius:6px;padding:8px;"><p style="margin:0;font-size:18px;font-weight:bold;color:#333;">${aqiData.readings.pm25}</p><p style="margin:2px 0 0;font-size:11px;color:#888;">PM2.5 µg/m³</p></div></td>` : ""}
                  ${aqiData.readings.pm10 != null ? `<td style="text-align:center;padding:8px;"><div style="background:#f8f9fa;border-radius:6px;padding:8px;"><p style="margin:0;font-size:18px;font-weight:bold;color:#333;">${aqiData.readings.pm10}</p><p style="margin:2px 0 0;font-size:11px;color:#888;">PM10 µg/m³</p></div></td>` : ""}
                  ${aqiData.readings.o3   != null ? `<td style="text-align:center;padding:8px;"><div style="background:#f8f9fa;border-radius:6px;padding:8px;"><p style="margin:0;font-size:18px;font-weight:bold;color:#333;">${aqiData.readings.o3}</p><p style="margin:2px 0 0;font-size:11px;color:#888;">O₃ µg/m³</p></div></td>` : ""}
                  ${aqiData.readings.no2  != null ? `<td style="text-align:center;padding:8px;"><div style="background:#f8f9fa;border-radius:6px;padding:8px;"><p style="margin:0;font-size:18px;font-weight:bold;color:#333;">${aqiData.readings.no2}</p><p style="margin:2px 0 0;font-size:11px;color:#888;">NO₂ µg/m³</p></div></td>` : ""}
                </tr>
              </table>
            </td>
          </tr>` : ""}

          <!-- Unsubscribe Footer -->
          <tr>
            <td style="padding:16px 30px;text-align:center;background:#f8f9fa;">
              <p style="margin:0;font-size:12px;color:#999;">
                You're receiving this because you subscribed to alerts for <strong>${aqiData.location}</strong>.<br>
                <a href="${process.env.FRONTEND_URL || "https://airguard.example.com"}/unsubscribe?email=${encodeURIComponent(subscription.email)}&location=${encodeURIComponent(aqiData.location)}" style="color:#666;text-decoration:underline;">Unsubscribe from these alerts</a>
              </p>
              <p style="margin:8px 0 0;font-size:11px;color:#bbb;">Data from WAQI / OpenAQ. AirGuard © 2026 — Built at WeMakeDevs × AWS Hackathon</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ── SNS Publisher ─────────────────────────────────────────────────────────────

async function sendAlertEmail(subscription, aqiData, alertType) {
  if (!SNS_TOPIC_ARN) {
    console.warn("SNS_TOPIC_ARN not set — skipping email");
    return false;
  }

  const category = getAQICategory(aqiData.aqi);
  const subjectMap = {
    threshold_crossed: `⚠️ AQI Alert: ${aqiData.location} is now ${category.label} (${aqiData.aqi})`,
    category_change:   `🚨 AQI Worsened: ${aqiData.location} — ${category.label} (${aqiData.aqi})`,
    daily_summary:     `📊 Daily AQI Summary: ${aqiData.location} — ${category.label} (${aqiData.aqi})`
  };

  const subject = subjectMap[alertType] || `AirGuard Alert — ${aqiData.location}`;
  const htmlBody = buildAlertEmailHTML(subscription, aqiData, alertType);

  await snsClient.send(new PublishCommand({
    TopicArn: SNS_TOPIC_ARN,
    Subject:  subject,
    Message:  htmlBody,
    MessageAttributes: {
      email: {
        DataType:    "String",
        StringValue: subscription.email
      }
    }
  }));

  return true;
}

// ── Subscription Management ───────────────────────────────────────────────────

function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(String(email).toLowerCase());
}

async function handleSubscribe(body, origin) {
  const { email, location, threshold, userProfile } = body;

  if (!email || !validateEmail(email)) {
    return error("Valid email address is required", 400, origin);
  }
  if (!location || typeof location !== "string" || location.trim().length < 2) {
    return error("Valid location is required", 400, origin);
  }

  const cleanEmail = email.toLowerCase().trim();
  const cleanLocation = location.trim().substring(0, 100);
  const alertThreshold = Math.min(500, Math.max(50, parseInt(threshold || "150", 10)));
  const subscriptionId = `${cleanEmail}#${cleanLocation.toLowerCase().replace(/\s+/g, "-")}`;

  // Check if already subscribed
  const existing = await getItem(TABLES.SUBSCRIPTIONS, { subscriptionId });
  if (existing && existing.active) {
    return success({
      message: "Already subscribed. Your preferences have been updated.",
      subscriptionId
    }, 200, origin);
  }

  const subscription = {
    subscriptionId,
    email:        cleanEmail,
    location:     cleanLocation,
    locationKey:  cleanLocation.toLowerCase().replace(/\s+/g, "-"),
    threshold:    alertThreshold,
    userProfile:  userProfile || { groups: ["general"] },
    active:       true,
    createdAt:    new Date().toISOString(),
    lastAlertAt:  null,
    alertCount:   0
  };

  await putItem(TABLES.SUBSCRIPTIONS, subscription);

  console.log(`New subscription: ${cleanEmail} → ${cleanLocation} (threshold: ${alertThreshold})`);

  return success({
    message: `Subscribed! You'll receive alerts when AQI in ${cleanLocation} exceeds ${alertThreshold}.`,
    subscriptionId,
    threshold: alertThreshold
  }, 201, origin);
}

async function handleUnsubscribe(body, origin) {
  const { email, location } = body;

  if (!email || !validateEmail(email)) {
    return error("Valid email address is required", 400, origin);
  }
  if (!location || typeof location !== "string") {
    return error("location is required", 400, origin);
  }

  const subscriptionId = `${email.toLowerCase().trim()}#${location.trim().toLowerCase().replace(/\s+/g, "-")}`;

  const existing = await getItem(TABLES.SUBSCRIPTIONS, { subscriptionId });
  if (!existing) {
    return error("Subscription not found", 404, origin);
  }

  await updateItem(TABLES.SUBSCRIPTIONS, { subscriptionId }, {
    active: false,
    unsubscribedAt: new Date().toISOString()
  });

  return success({ message: "Unsubscribed successfully." }, 200, origin);
}

async function handleListSubscriptions(queryParams, origin) {
  const email = queryParams?.email;
  if (!email || !validateEmail(email)) {
    return error("Valid email parameter is required", 400, origin);
  }

  const items = await queryItems(
    TABLES.SUBSCRIPTIONS,
    "email = :e",
    { ":e": email.toLowerCase().trim() },
    "EmailIndex"
  );

  const active = items
    .filter(i => i.active)
    .map(i => ({
      location:  i.location,
      threshold: i.threshold,
      createdAt: i.createdAt,
      alertCount: i.alertCount || 0
    }));

  return success({ email, subscriptions: active }, 200, origin);
}

// ── Internal: Process AQI update (called by Scheduler) ───────────────────────

async function processAQIUpdate(aqiData) {
  const locationKey = aqiData.location?.toLowerCase().replace(/\s+/g, "-");
  if (!locationKey) return { sent: 0, skipped: 0 };

  // Get all active subscriptions for this location
  const subscriptions = await queryItems(
    TABLES.SUBSCRIPTIONS,
    "locationKey = :lk",
    { ":lk": locationKey },
    "LocationIndex"
  );

  const activeSubscriptions = subscriptions.filter(s => s.active);
  let sent = 0, skipped = 0;

  for (const sub of activeSubscriptions) {
    try {
      // Cooldown check
      if (sub.lastAlertAt) {
        const timeSinceLastAlert = Date.now() - new Date(sub.lastAlertAt).getTime();
        if (timeSinceLastAlert < ALERT_COOLDOWN_MS && aqiData.aqi < 300) {
          // Skip if within cooldown, UNLESS it's a severe condition (300+)
          skipped++;
          continue;
        }
      }

      // Determine if we should alert
      let alertType = null;
      const prevAQI = sub.lastKnownAQI || 0;

      if (aqiData.aqi >= sub.threshold && prevAQI < sub.threshold) {
        alertType = "threshold_crossed";
      } else if (aqiData.aqi >= 401 && prevAQI < 401) {
        alertType = "category_change";
      } else if (aqiData.aqi >= 301 && prevAQI < 301) {
        alertType = "category_change";
      } else if (aqiData.aqi >= 201 && prevAQI < 201) {
        alertType = "category_change";
      }

      // Daily summary: check if it's 7 AM IST and no alert sent today
      const istHour = new Date().toLocaleString("en-US", {
        timeZone: "Asia/Kolkata", hour: "numeric", hour12: false
      });
      if (parseInt(istHour) === 7 && (!sub.lastAlertAt ||
        new Date(sub.lastAlertAt).toDateString() !== new Date().toDateString())) {
        alertType = alertType || "daily_summary";
      }

      if (!alertType) {
        skipped++;
        continue;
      }

      await sendAlertEmail(sub, aqiData, alertType);

      // Update subscription record
      await updateItem(TABLES.SUBSCRIPTIONS, { subscriptionId: sub.subscriptionId }, {
        lastAlertAt:   new Date().toISOString(),
        lastKnownAQI:  aqiData.aqi,
        alertCount:    (sub.alertCount || 0) + 1
      });

      // Log the alert
      await putItem(TABLES.ALERTS_LOG, {
        alertId:    `${sub.subscriptionId}#${Date.now()}`,
        email:      sub.email,
        location:   aqiData.location,
        aqi:        aqiData.aqi,
        alertType,
        sentAt:     new Date().toISOString(),
        ttl:        Math.floor(Date.now() / 1000) + 2592000 // 30 days
      });

      sent++;
    } catch (err) {
      console.error(`Failed to process alert for ${sub.email}:`, err.message);
      skipped++;
    }
  }

  return { sent, skipped, total: activeSubscriptions.length };
}

// ── Main Handler ──────────────────────────────────────────────────────────────

exports.handler = async (event) => {
  const origin = getOrigin(event);

  if (event.httpMethod === "OPTIONS") return preflight(origin);

  // Internal invocation from Scheduler (no HTTP context)
  if (event.source === "airguard.scheduler") {
    const result = await processAQIUpdate(event.aqiData);
    return { statusCode: 200, body: JSON.stringify(result) };
  }

  const method = event.httpMethod;
  const path = event.path || event.rawPath || "";

  let body;
  try {
    body = parseBody(event);
  } catch {
    return error("Invalid JSON body", 400, origin);
  }

  if (method === "POST" && path.endsWith("/subscribe")) {
    return handleSubscribe(body, origin);
  }

  if (method === "DELETE" && path.endsWith("/subscribe")) {
    return handleUnsubscribe(body, origin);
  }

  if (method === "GET" && path.endsWith("/subscriptions")) {
    return handleListSubscriptions(event.queryStringParameters, origin);
  }

  return error("Not found", 404, origin);
};

// Export for internal use by Scheduler
exports.processAQIUpdate = processAQIUpdate;
