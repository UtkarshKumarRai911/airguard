import React from "react";

export default function IndiaContextBanner({ aqi, location }) {
  if (!aqi || aqi < 150) return null;

  // India-specific seasonal context
  const month = new Date().getMonth(); // 0 = Jan, 9 = Oct, 10 = Nov
  const isWinterSmogSeason = month >= 9 || month <= 1; // Oct-Feb

  return (
    <div style={{
      background:   "rgba(245,158,11,0.08)",
      border:       "1px solid rgba(245,158,11,0.3)",
      borderRadius: "var(--radius)",
      padding:      "14px 18px",
      marginBottom: "16px",
      display:      "flex",
      alignItems:   "flex-start",
      gap:          "12px"
    }}>
      <span style={{ fontSize: "20px", flexShrink: 0 }}>🇮🇳</span>
      <div>
        <p style={{
          fontSize:    "14px",
          fontWeight:  "600",
          color:       "#f59e0b",
          marginBottom: "4px"
        }}>
          India Context
        </p>
        <p style={{
          fontSize:   "13px",
          color:      "var(--text-primary)",
          lineHeight: "1.6"
        }}>
          {isWinterSmogSeason ? (
            <>
              <strong>{location}</strong> is in winter smog season (Oct-Feb). Stubble burning in Punjab/Haryana, 
              Diwali firecrackers, and cold air trapping pollutants cause AQI to spike 3-5x higher than summer. 
              <strong> Schools often stay open even at AQI 300+</strong> — parents need alerts like this.
            </>
          ) : (
            <>
              <strong>{location}</strong> typically sees lower AQI during monsoon (Jun-Sep) due to rain washing 
              pollutants. However, industrial emissions and vehicular pollution remain year-round concerns. 
              Current AQI of <strong>{aqi}</strong> is still unhealthy for sensitive groups.
            </>
          )}
        </p>
        <p style={{
          fontSize:   "12px",
          color:      "var(--text-muted)",
          marginTop:  "6px"
        }}>
          💡 CPCB India scale is used (different from US EPA). "Poor" here = serious health risk.
        </p>
      </div>
    </div>
  );
}
