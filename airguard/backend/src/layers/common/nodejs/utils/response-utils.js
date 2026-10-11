/**
 * Standardized HTTP response builders for Lambda functions
 * Ensures consistent CORS headers and response shape across all endpoints
 */

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "").split(",").filter(Boolean);

/**
 * Get CORS headers based on request origin
 */
function getCORSHeaders(requestOrigin) {
  const origin =
    ALLOWED_ORIGINS.length === 0
      ? "*"
      : ALLOWED_ORIGINS.includes(requestOrigin)
      ? requestOrigin
      : ALLOWED_ORIGINS[0];

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,X-Api-Key,Authorization",
    "Access-Control-Max-Age": "86400"
  };
}

/**
 * Success response
 */
function success(data, statusCode = 200, requestOrigin = "*") {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      ...getCORSHeaders(requestOrigin)
    },
    body: JSON.stringify({
      success: true,
      data,
      timestamp: new Date().toISOString()
    })
  };
}

/**
 * Error response
 */
function error(message, statusCode = 500, requestOrigin = "*", details = null) {
  const body = {
    success: false,
    error: message,
    timestamp: new Date().toISOString()
  };
  if (details && process.env.NODE_ENV !== "production") {
    body.details = details;
  }
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      ...getCORSHeaders(requestOrigin)
    },
    body: JSON.stringify(body)
  };
}

/**
 * Preflight OPTIONS response
 */
function preflight(requestOrigin = "*") {
  return {
    statusCode: 204,
    headers: getCORSHeaders(requestOrigin),
    body: ""
  };
}

/**
 * Parse and validate request body safely
 */
function parseBody(event) {
  try {
    if (!event.body) return {};
    return typeof event.body === "string" ? JSON.parse(event.body) : event.body;
  } catch {
    throw new Error("Invalid JSON body");
  }
}

/**
 * Get origin from event headers (case-insensitive)
 */
function getOrigin(event) {
  const headers = event.headers || {};
  return headers.origin || headers.Origin || "*";
}

module.exports = { success, error, preflight, parseBody, getOrigin };
