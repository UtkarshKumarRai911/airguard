/**
 * AQI visual constants for the frontend
 * Mirrors the backend aqi-utils.js categories
 */

export const AQI_LEVELS = [
  { min: 0,   max: 50,  label: "Good",       color: "#00b050", bg: "#0a2e1a", textColor: "#ffffff" },
  { min: 51,  max: 100, label: "Satisfactory",color: "#92d050", bg: "#1a2e0a", textColor: "#ffffff" },
  { min: 101, max: 200, label: "Moderate",    color: "#ffff00", bg: "#2e2e00", textColor: "#000000" },
  { min: 201, max: 300, label: "Poor",        color: "#ff7e00", bg: "#2e1800", textColor: "#ffffff" },
  { min: 301, max: 400, label: "Very Poor",   color: "#ff0000", bg: "#2e0000", textColor: "#ffffff" },
  { min: 401, max: 500, label: "Severe",      color: "#7e0023", bg: "#1e0009", textColor: "#ffffff" }
];

export function getAQILevel(aqi) {
  if (aqi == null || isNaN(aqi)) {
    return { label: "Unknown", color: "#64748b", bg: "#1e293b", textColor: "#ffffff" };
  }
  return (
    AQI_LEVELS.find(l => aqi >= l.min && aqi <= l.max) ||
    AQI_LEVELS[AQI_LEVELS.length - 1]
  );
}

export function getAQIEmoji(aqi) {
  if (aqi == null) return "⚪";
  if (aqi <= 50)  return "🟢";
  if (aqi <= 100) return "🟡";
  if (aqi <= 200) return "🟠";
  if (aqi <= 300) return "🔴";
  if (aqi <= 400) return "🔴";
  return "🟣";
}

export function getRiskText(aqi) {
  if (aqi == null) return "No data";
  if (aqi <= 50)  return "Healthy";
  if (aqi <= 100) return "Acceptable";
  if (aqi <= 200) return "Caution";
  if (aqi <= 300) return "Unhealthy";
  if (aqi <= 400) return "Very Unhealthy";
  return "Hazardous";
}
