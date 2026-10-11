import React from "react";
import { RefreshCw, MapPin, Clock, Wifi, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { getAQILevel } from "../utils/aqi-colors";
import ShareButton from "./ShareButton";

function Skeleton({ w = "100%", h = "20px", radius = "6px" }) {
  return (
    <div className="pulsing" style={{
      width: w, height: h,
      background:   "var(--border)",
      borderRadius: radius
    }} />
  );
}

export default function AQICard({ data, loading, lastUpdated, onRefresh }) {
  if (loading) {
    return (
      <div style={{
        background:   "var(--bg-secondary)",
        border:       "1px solid var(--border)",
        borderRadius: "var(--radius)",
        padding:      "28px",
        display:      "flex",
        flexDirection: "column",
        gap:          "16px"
      }}>
        <Skeleton w="40%" h="14px" />
        <Skeleton w="120px" h="80px" radius="12px" />
        <Skeleton w="60%" h="16px" />
        <Skeleton w="80%" h="14px" />
      </div>
    );
  }

  if (!data) return null;

  const level = getAQILevel(data.aqi);
  const formattedTime = lastUpdated
    ? lastUpdated.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <div
      className="fade-in glass-card"
      style={{
        background:   `linear-gradient(135deg, ${level.color}08 0%, rgba(30, 41, 59, 0.5) 100%)`,
        border:       `1px solid ${level.color}33`,
        borderRadius: "var(--radius-lg)",
        overflow:     "hidden",
        boxShadow:    `0 8px 32px ${level.color}22, 0 0 60px ${level.color}11`,
        backdropFilter: "blur(20px)",
        position: "relative"
      }}
    >
      {/* Animated gradient background overlay */}
      <div style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: `radial-gradient(circle at 20% 50%, ${level.color}15 0%, transparent 50%)`,
        pointerEvents: "none",
        opacity: 0.6
      }} />
      
      {/* Color accent bar with gradient */}
      <div style={{ 
        height: "5px", 
        background: `linear-gradient(90deg, ${level.color} 0%, ${level.color}66 100%)`,
        boxShadow: `0 2px 8px ${level.color}44`
      }} />

      <div style={{ padding: "32px", position: "relative", zIndex: 1 }}>
        {/* Location & meta */}
        <div style={{
          display:       "flex",
          justifyContent: "space-between",
          alignItems:    "flex-start",
          marginBottom:  "28px",
          flexWrap:      "wrap",
          gap:           "12px"
        }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
              <MapPin size={16} color={level.color} strokeWidth={2.5} />
              <span style={{ 
                fontSize: "15px", 
                color: "var(--text-primary)",
                fontWeight: "600",
                letterSpacing: "0.01em"
              }}>
                {data.stationName || data.location}
              </span>
            </div>
            {data.stationName && data.stationName !== data.location && (
              <p style={{ fontSize: "13px", color: "var(--text-dim)", marginLeft: "24px" }}>
                {data.location}
              </p>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            {/* Cache status */}
            {data.cached && !data.stale && (
              <span style={{
                fontSize: "11px",
                fontWeight: "600",
                color:    "#34d399",
                background: "rgba(16,185,129,0.15)",
                border:   "1px solid rgba(16,185,129,0.4)",
                borderRadius: "6px",
                padding:  "4px 10px",
                display:  "flex",
                alignItems: "center",
                gap:      "5px",
                boxShadow: "0 0 10px rgba(16,185,129,0.2)"
              }} title="Served from DynamoDB cache — reduces API calls">
                ⚡ Cached
              </span>
            )}
            
            {/* Stale indicator */}
            {data.stale && (
              <span style={{
                fontSize: "11px",
                fontWeight: "600",
                color:    "#fbbf24",
                background: "rgba(245,158,11,0.15)",
                border:   "1px solid rgba(245,158,11,0.4)",
                borderRadius: "6px",
                padding:  "4px 10px"
              }}>
                ⚠️ Stale
              </span>
            )}

            {/* Data source */}
            <span style={{
              fontSize:    "11px",
              fontWeight: "600",
              color:       "var(--text-muted)",
              background: "rgba(148,163,184,0.1)",
              border: "1px solid rgba(148,163,184,0.2)",
              borderRadius: "6px",
              padding: "4px 10px",
              display:     "flex",
              alignItems:  "center",
              gap:         "5px"
            }}>
              <Wifi size={12} />
              {data.source || "WAQI"}
            </span>

            {/* Refresh button */}
            <button
              onClick={onRefresh}
              title="Refresh AQI data"
              aria-label="Refresh data"
              className="gradient-btn"
              style={{
                background:   "linear-gradient(135deg, rgba(16,185,129,0.2) 0%, rgba(6,182,212,0.2) 100%)",
                border:       "1px solid rgba(16,185,129,0.4)",
                borderRadius: "8px",
                padding:      "6px 12px",
                color:        "#34d399",
                cursor:       "pointer",
                display:      "flex",
                alignItems:   "center",
                gap:          "6px",
                fontSize:     "12px",
                fontWeight: "600",
                boxShadow: "0 0 12px rgba(16,185,129,0.2)",
                transition: "all 0.2s ease"
              }}
            >
              <RefreshCw size={13} />
              Refresh
            </button>
          </div>
        </div>

        {/* AQI value + category */}
        <div style={{ display: "flex", alignItems: "center", gap: "32px", flexWrap: "wrap", marginBottom: "24px" }}>
          {/* Big AQI number with trend - floating animation */}
          <div style={{ textAlign: "center" }} className="floating">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "12px" }}>
              <div style={{
                fontSize:    "96px",
                fontWeight:  "900",
                lineHeight:  "1",
                background: `linear-gradient(135deg, ${level.color} 0%, ${level.color}cc 100%)`,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                fontVariantNumeric: "tabular-nums",
                filter: `drop-shadow(0 4px 12px ${level.color}44)`,
                textShadow: `0 0 40px ${level.color}33`
              }}>
                {data.aqi ?? "–"}
              </div>
              
              {/* Trend indicator with animation */}
              {data.trend && data.trend !== "stable" && (
                <div style={{ 
                  display: "flex", 
                  flexDirection: "column", 
                  alignItems: "center",
                  marginLeft: "6px",
                  animation: data.trend === "rising" ? "pulse 2s ease-in-out infinite" : ""
                }}>
                  {data.trend === "rising" ? (
                    <div style={{
                      background: "linear-gradient(135deg, #ef4444 0%, #f97316 100%)",
                      borderRadius: "12px",
                      padding: "8px",
                      boxShadow: "0 4px 16px rgba(239,68,68,0.4)"
                    }}>
                      <TrendingUp size={32} color="white" strokeWidth={3} />
                    </div>
                  ) : (
                    <div style={{
                      background: "linear-gradient(135deg, #10b981 0%, #34d399 100%)",
                      borderRadius: "12px",
                      padding: "8px",
                      boxShadow: "0 4px 16px rgba(16,185,129,0.4)"
                    }}>
                      <TrendingDown size={32} color="white" strokeWidth={3} />
                    </div>
                  )}
                </div>
              )}
            </div>
            
            <div style={{
              fontSize:    "14px",
              fontWeight: "600",
              color:       "var(--text-muted)",
              marginTop:   "8px",
              letterSpacing: "0.05em"
            }}>
              AQI (CPCB India)
            </div>
            
            {/* Trend text with gradient */}
            {data.trend && data.trendPeriodHours > 0 && (
              <div style={{
                fontSize:   "13px",
                background: data.trend === "rising" 
                  ? "linear-gradient(135deg, #ef4444 0%, #f97316 100%)" 
                  : data.trend === "falling"
                  ? "linear-gradient(135deg, #10b981 0%, #34d399 100%)"
                  : "rgba(148,163,184,0.3)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                marginTop:  "10px",
                fontWeight: "700",
                letterSpacing: "0.02em"
              }}>
                {data.trend === "rising" && "↑ "} 
                {data.trend === "falling" && "↓ "}
                {data.trend === "stable" && "→ "}
                {data.trendDelta > 0 && "+"}
                {data.trendDelta} points in {data.trendPeriodHours}h
              </div>
            )}
          </div>

          {/* Category badge + health implication */}
          <div style={{ flex: 1, minWidth: "250px" }}>
            <div style={{
              display:      "inline-flex",
              alignItems:   "center",
              gap:          "10px",
              background:   `linear-gradient(135deg, ${level.color}25 0%, ${level.color}15 100%)`,
              border:       `2px solid ${level.color}66`,
              borderRadius: "12px",
              padding:      "10px 18px",
              marginBottom: "16px",
              boxShadow: `0 4px 16px ${level.color}22`
            }}>
              <div style={{
                width:        "12px",
                height:       "12px",
                borderRadius: "50%",
                background:   level.color,
                flexShrink:   0,
                boxShadow: `0 0 12px ${level.color}88`,
                animation: "pulse 2s ease-in-out infinite"
              }} />
              <span style={{
                fontSize:   "18px",
                fontWeight: "800",
                color:      level.color,
                letterSpacing: "0.01em",
                textShadow: `0 0 20px ${level.color}44`
              }}>
                {data.category}
              </span>
            </div>

            <p style={{
              fontSize:   "14px",
              color:      "var(--text-primary)",
              lineHeight: "1.7",
              marginBottom: "16px"
            }}>
              {data.advice?.healthImplication}
            </p>

            {/* School advice — prominently shown when risky */}
            {data.aqi >= 200 && (
              <div style={{
                padding:      "14px 16px",
                background:   "linear-gradient(135deg, rgba(239,68,68,0.15) 0%, rgba(249,115,22,0.15) 100%)",
                border:       "2px solid rgba(239,68,68,0.4)",
                borderRadius: "12px",
                fontSize:     "14px",
                color:        "#fca5a5",
                lineHeight:   "1.6",
                boxShadow: "0 4px 16px rgba(239,68,68,0.2)"
              }}>
                <div style={{ fontWeight: "700", marginBottom: "6px", color: "#ef4444" }}>
                  🏫 SCHOOL ALERT
                </div>
                {data.advice?.schools}
              </div>
            )}
          </div>
        </div>

        {/* Why this matters for India - Enhanced */}
        {data.aqi >= 150 && (
          <div style={{
            marginTop:    "20px",
            padding:      "18px 20px",
            background:   "linear-gradient(135deg, rgba(16,185,129,0.1) 0%, rgba(6,182,212,0.1) 100%)",
            border:       "2px solid rgba(16,185,129,0.3)",
            borderRadius: "14px",
            fontSize:     "13px",
            color:        "var(--text-primary)",
            lineHeight:   "1.7",
            boxShadow: "0 4px 16px rgba(16,185,129,0.15)"
          }}>
            <div style={{ 
              display: "flex", 
              alignItems: "center", 
              gap: "8px", 
              marginBottom: "10px",
              fontWeight: "700",
              fontSize: "14px"
            }}>
              🇮🇳 <span className="gradient-text">Why AirGuard Matters in India</span>
            </div>
            <div style={{ color: "var(--text-muted)" }}>
              In India, most schools <strong style={{ color: "#ef4444" }}>don't close even at AQI 300+</strong>. 
              Parents get <strong>no official warning</strong>. Stubble burning, Diwali firecrackers, and 
              winter smog cause AQI spikes of 3-5x higher than summer. <span style={{ color: "#34d399" }}>AirGuard fills 
              this gap</span> — giving you the alert <em>before</em> you send your child outside.
            </div>
          </div>
        )}

        {/* Dominant pollutant + timestamp */}
        <div style={{
          marginTop:      "24px",
          paddingTop:     "20px",
          borderTop:      "1px solid rgba(148,163,184,0.2)",
          display:        "flex",
          justifyContent: "space-between",
          alignItems:     "center",
          flexWrap:       "wrap",
          gap:            "16px"
        }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", flex: 1 }}>
            <span style={{ fontSize: "14px", color: "var(--text-muted)" }}>
              Dominant pollutant:{" "}
              <strong style={{ 
                color: level.color,
                fontSize: "15px",
                fontWeight: "700"
              }}>
                {data.dominantPollutant || "—"}
              </strong>
            </span>
            {formattedTime && (
              <span style={{
                display:    "flex",
                alignItems: "center",
                gap:        "6px",
                fontSize:   "13px",
                color:      "var(--text-dim)",
                fontWeight: "500"
              }} title={`Last updated: ${lastUpdated?.toLocaleString('en-IN')}`}>
                <Clock size={13} />
                Updated {formattedTime}
                {(() => {
                  if (!lastUpdated) return null;
                  const ageMin = Math.floor((Date.now() - lastUpdated.getTime()) / 60000);
                  if (ageMin < 1) return " (just now)";
                  if (ageMin < 60) return ` (${ageMin}m ago)`;
                  return ` (${Math.floor(ageMin / 60)}h ago)`;
                })()}
              </span>
            )}
          </div>
          
          {/* Share on WhatsApp */}
          <ShareButton location={data.location} aqi={data.aqi} category={data.category} />
        </div>
      </div>
    </div>
  );
}
