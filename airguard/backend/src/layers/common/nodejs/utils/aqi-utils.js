/**
 * AQI Utility Functions
 * Covers Indian AQI scale (CPCB) and WHO/US AQI scale
 * All thresholds based on official CPCB India standards
 */

// Indian AQI categories (CPCB standard)
const AQI_CATEGORIES = [
  {
    min: 0, max: 50,
    label: "Good",
    color: "#00b050",
    emoji: "🟢",
    healthImplication: "Air quality is satisfactory and poses little or no risk.",
    cautionaryStatement: "None required.",
    sensitiveGroupsAdvice: "Enjoy outdoor activities.",
    generalPublicAdvice: "Ideal for all outdoor activities.",
    schoolAdvice: "Safe for all school activities including sports.",
    riskLevel: 1
  },
  {
    min: 51, max: 100,
    label: "Satisfactory",
    color: "#92d050",
    emoji: "🟡",
    healthImplication: "Minor breathing discomfort to sensitive people.",
    cautionaryStatement: "Unusually sensitive individuals should consider reducing prolonged outdoor exertion.",
    sensitiveGroupsAdvice: "Limit prolonged outdoor exertion if you experience symptoms.",
    generalPublicAdvice: "Outdoor activities are fine for most people.",
    schoolAdvice: "Safe for school activities. Asthmatic students should carry inhalers.",
    riskLevel: 2
  },
  {
    min: 101, max: 200,
    label: "Moderate",
    color: "#ffff00",
    emoji: "🟠",
    healthImplication: "Breathing discomfort to people with lung disease, asthma, heart disease, children and older adults.",
    cautionaryStatement: "People with respiratory or heart disease, the elderly and children should limit prolonged outdoor exertion.",
    sensitiveGroupsAdvice: "Avoid prolonged outdoor exertion. Keep medications handy.",
    generalPublicAdvice: "Reduce prolonged or heavy outdoor exertion.",
    schoolAdvice: "Limit outdoor sports. Asthmatic and heart-condition students should stay indoors.",
    riskLevel: 3
  },
  {
    min: 201, max: 300,
    label: "Poor",
    color: "#ff7e00",
    emoji: "🔴",
    healthImplication: "Breathing discomfort to most people on prolonged exposure. Serious risk to sensitive groups.",
    cautionaryStatement: "Everyone should avoid prolonged outdoor exertion. Sensitive groups should stay indoors.",
    sensitiveGroupsAdvice: "Stay indoors. Keep windows closed. Use air purifier if available.",
    generalPublicAdvice: "Avoid outdoor exertion. Wear N95 mask if going outside.",
    schoolAdvice: "⚠️ Cancel outdoor activities. Keep students indoors.",
    riskLevel: 4
  },
  {
    min: 301, max: 400,
    label: "Very Poor",
    color: "#ff0000",
    emoji: "🔴",
    healthImplication: "Respiratory illness on prolonged exposure. Effects felt by healthy people too.",
    cautionaryStatement: "Everyone should avoid outdoor exertion. Sensitive groups should remain indoors.",
    sensitiveGroupsAdvice: "Stay indoors with windows shut. Use air purifier. Seek medical help if symptoms worsen.",
    generalPublicAdvice: "Avoid going outside. If unavoidable, wear N95 mask.",
    schoolAdvice: "🚨 Consider closing school or conducting online classes.",
    riskLevel: 5
  },
  {
    min: 401, max: 500,
    label: "Severe",
    color: "#7e0023",
    emoji: "🟣",
    healthImplication: "Severe respiratory and cardiac effects. Serious risk even for healthy people.",
    cautionaryStatement: "HEALTH EMERGENCY. Everyone should avoid all outdoor activities.",
    sensitiveGroupsAdvice: "Medical emergency risk. Seek immediate medical attention if experiencing symptoms.",
    generalPublicAdvice: "Stay indoors. Seal windows and doors. Use air purifier. Avoid any outdoor exposure.",
    schoolAdvice: "🚨 CLOSE SCHOOL. Do not conduct in-person classes.",
    riskLevel: 6
  }
];

// PM2.5 sub-index breakpoints (µg/m³) — CPCB India
const PM25_BREAKPOINTS = [
  { aqiLow: 0,   aqiHigh: 50,  concLow: 0,   concHigh: 30  },
  { aqiLow: 51,  aqiHigh: 100, concLow: 31,  concHigh: 60  },
  { aqiLow: 101, aqiHigh: 200, concLow: 61,  concHigh: 90  },
  { aqiLow: 201, aqiHigh: 300, concLow: 91,  concHigh: 120 },
  { aqiLow: 301, aqiHigh: 400, concLow: 121, concHigh: 250 },
  { aqiLow: 401, aqiHigh: 500, concLow: 251, concHigh: 500 }
];

// PM10 sub-index breakpoints (µg/m³) — CPCB India
const PM10_BREAKPOINTS = [
  { aqiLow: 0,   aqiHigh: 50,  concLow: 0,   concHigh: 50  },
  { aqiLow: 51,  aqiHigh: 100, concLow: 51,  concHigh: 100 },
  { aqiLow: 101, aqiHigh: 200, concLow: 101, concHigh: 250 },
  { aqiLow: 201, aqiHigh: 300, concLow: 251, concHigh: 350 },
  { aqiLow: 301, aqiHigh: 400, concLow: 351, concHigh: 430 },
  { aqiLow: 401, aqiHigh: 500, concLow: 431, concHigh: 600 }
];

/**
 * Calculate sub-index from concentration using linear interpolation
 */
function calculateSubIndex(concentration, breakpoints) {
  if (concentration < 0) return 0;
  
  for (const bp of breakpoints) {
    if (concentration >= bp.concLow && concentration <= bp.concHigh) {
      return Math.round(
        ((bp.aqiHigh - bp.aqiLow) / (bp.concHigh - bp.concLow)) *
        (concentration - bp.concLow) + bp.aqiLow
      );
    }
  }
  
  // Above max breakpoint — return 500 (severe)
  return 500;
}

/**
 * Get AQI category object for a given AQI value
 */
function getAQICategory(aqi) {
  if (aqi == null || isNaN(aqi)) {
    return {
      label: "Unknown",
      color: "#999999",
      emoji: "⚪",
      healthImplication: "Data unavailable.",
      cautionaryStatement: "Monitor and check back later.",
      sensitiveGroupsAdvice: "Take precautions until data is available.",
      generalPublicAdvice: "Data unavailable. Exercise caution.",
      schoolAdvice: "Check back for updated data.",
      riskLevel: 0
    };
  }
  
  const clampedAQI = Math.min(500, Math.max(0, Math.round(aqi)));
  
  return AQI_CATEGORIES.find(
    cat => clampedAQI >= cat.min && clampedAQI <= cat.max
  ) || AQI_CATEGORIES[AQI_CATEGORIES.length - 1];
}

/**
 * Determine if an AQI value crosses an alert threshold
 * Returns the threshold level that was breached, or null
 */
function getAlertThreshold(currentAQI, previousAQI, userThreshold = 150) {
  const current = Math.round(currentAQI || 0);
  const previous = Math.round(previousAQI || 0);
  
  // Check if crossed user-defined threshold
  if (current >= userThreshold && previous < userThreshold) {
    return { type: "threshold_crossed", value: current, threshold: userThreshold };
  }
  
  // Check if crossed into a new category (always alert on Poor+ regardless of user setting)
  const CRITICAL_THRESHOLDS = [201, 301, 401];
  for (const threshold of CRITICAL_THRESHOLDS) {
    if (current >= threshold && previous < threshold) {
      return { type: "category_change", value: current, threshold };
    }
  }
  
  return null;
}

/**
 * Get dominant pollutant from readings
 */
function getDominantPollutant(readings) {
  if (!readings || Object.keys(readings).length === 0) return "PM2.5";
  
  const pollutantSubIndices = {};
  
  if (readings.pm25 != null) {
    pollutantSubIndices["PM2.5"] = calculateSubIndex(readings.pm25, PM25_BREAKPOINTS);
  }
  if (readings.pm10 != null) {
    pollutantSubIndices["PM10"] = calculateSubIndex(readings.pm10, PM10_BREAKPOINTS);
  }
  
  if (Object.keys(pollutantSubIndices).length === 0) return "Unknown";
  
  return Object.entries(pollutantSubIndices).reduce(
    (max, [pollutant, index]) => index > pollutantSubIndices[max] ? pollutant : max,
    Object.keys(pollutantSubIndices)[0]
  );
}

/**
 * Generate a simple 6-hour trend label based on recent readings
 */
function getTrendDescription(readings) {
  if (!readings || readings.length < 2) return "stable";
  
  const sorted = [...readings].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  const first = sorted[0].aqi;
  const last = sorted[sorted.length - 1].aqi;
  const diff = last - first;
  
  if (Math.abs(diff) < 10) return "stable";
  if (diff > 50) return "deteriorating rapidly";
  if (diff > 20) return "getting worse";
  if (diff < -50) return "improving rapidly";
  if (diff < -20) return "improving";
  return "slightly changing";
}

/**
 * Validate and sanitize a location string
 */
function sanitizeLocation(location) {
  if (!location || typeof location !== "string") return null;
  // Allow semicolons for WAQI geo format: "geo:lat;lon"
  const sanitized = location.trim().replace(/[<>{}|\\^`]/g, "").substring(0, 100);
  return sanitized.length > 0 ? sanitized : null;
}

/**
 * Build a structured AQI response object
 */
function buildAQIResponse(rawData, location) {
  const aqi = rawData.aqi != null ? Math.round(rawData.aqi) : null;
  const category = getAQICategory(aqi);
  const dominantPollutant = getDominantPollutant(rawData.readings);
  
  return {
    location: location,
    aqi: aqi,
    category: category.label,
    color: category.color,
    emoji: category.emoji,
    riskLevel: category.riskLevel,
    dominantPollutant,
    readings: {
      pm25: rawData.readings?.pm25 ?? null,
      pm10: rawData.readings?.pm10 ?? null,
      o3:   rawData.readings?.o3   ?? null,
      no2:  rawData.readings?.no2  ?? null,
      so2:  rawData.readings?.so2  ?? null,
      co:   rawData.readings?.co   ?? null
    },
    advice: {
      healthImplication:    category.healthImplication,
      cautionaryStatement:  category.cautionaryStatement,
      sensitiveGroups:      category.sensitiveGroupsAdvice,
      generalPublic:        category.generalPublicAdvice,
      schools:              category.schoolAdvice
    },
    source: rawData.source || "WAQI",
    stationName: rawData.stationName || location,
    timestamp: rawData.timestamp || new Date().toISOString(),
    ttl: Math.floor(Date.now() / 1000) + 1800  // 30 min DynamoDB TTL
  };
}

module.exports = {
  getAQICategory,
  getAlertThreshold,
  getDominantPollutant,
  getTrendDescription,
  sanitizeLocation,
  buildAQIResponse,
  calculateSubIndex,
  PM25_BREAKPOINTS,
  PM10_BREAKPOINTS,
  AQI_CATEGORIES
};
