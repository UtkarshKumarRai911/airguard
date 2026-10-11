import React from "react";
import { RefreshCw, MapPin, Clock, Wifi } from "lucide-react";
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
      className="fade-in"
      style={{
        background:   "var(--bg-secondary)",
        border:       `1px solid ${level.color}44`,
        borderRadius: "var(--radius)",
        overflow:     "hidden",
        boxShadow:    `0 0 30px ${level.color}22`
      }}
    >
      {/* Color accent bar */}
      <div style={{ height: "4px", background: level.color }} />

      <div style={{ padding: "24px 28px" }}>
        {/* Location & meta */}
        <div style={{
          display:       "flex",
          justifyContent: "space-between",
          alignItems:    "flex-start",
          marginBottom:  "20px",
          flexWrap:      "wrap",
          gap:           "8px"
        }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
              <MapPin size={14} color="var(--text-muted)" />
              <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>
                {data.stationName || data.location}
              </span>
            </div>
            {data.stationName && data.stationName !== data.location && (
              <p style={{ fontSize: "12px", color: "var(--text-muted)", marginLeft: "20px" }}>
                {data.location}
              </p>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {/* Cache status */}
            {data.cached && !data.stale && (
              <span style={{
                fontSize: "11px",
                color:    "#10b981",
                background: "rgba(16,185,129,0.1)",
                border:   "1px solid rgba(16,185,129,0.3)",
                borderRadius: "4px",
                padding:  "2px 8px",
                display:  "flex",
                alignItems: "center",
                gap:      "4px"
              }} title="Served from DynamoDB cache — reduces API calls">
                ⚡ Cached
              </span>
            )}
            
            {/* Stale indicator */}
            {data.stale && (
              <span style={{
                fontSize: "11px",
                color:    "#f59e0b",
                background: "rgba(245,158,11,0.1)",
                border:   "1px solid rgba(245,158,11,0.3)",
                borderRadius: "4px",
                padding:  "2px 8px"
              }}>
                ⚠️ Stale data
              </span>
            )}

            {/* Data source */}
            <span style={{
              fontSize:    "11px",
              color:       "var(--text-muted)",
              display:     "flex",
              alignItems:  "center",
              gap:         "4px"
            }}>
              <Wifi size={11} />
              {data.source || "WAQI"}
            </span>

            {/* Refresh button */}
            <button
              onClick={onRefresh}
              title="Refresh AQI data"
              aria-label="Refresh data"
              style={{
                background:   "transparent",
                border:       "1px solid var(--border)",
                borderRadius: "6px",
                padding:      "4px 8px",
                color:        "var(--text-muted)",
                cursor:       "pointer",
                display:      "flex",
                alignItems:   "center",
                gap:          "4px",
                fontSize:     "12px"
              }}
            >
              <RefreshCw size={12} />
              Refresh
            </button>
          </div>
        </div>

        {/* AQI value + category */}
        <div style={{ display: "flex", alignItems: "flex-end", gap: "20px", flexWrap: "wrap" }}>
          {/* Big AQI number */}
          <div style={{ textAlign: "center" }}>
            <div style={{
              fontSize:    "80px",
              fontWeight:  "900",
              lineHeight:  "1",
              color:       level.color,
              fontVariantNumeric: "tabular-nums"
            }}>
              {data.aqi ?? "–"}
            </div>
            <div style={{
              fontSize:    "13px",
              color:       "var(--text-muted)",
              marginTop:   "4px"
            }}>
              AQI (CPCB India)
            </div>
          </div>

          {/* Category badge + health implication */}
          <div style={{ flex: 1, minWidth: "200px" }}>
            <div style={{
              display:      "inline-flex",
              alignItems:   "center",
              gap:          "8px",
              background:   `${level.color}22`,
              border:       `1px solid ${level.color}66`,
              borderRadius: "8px",
              padding:      "8px 14px",
              marginBottom: "12px"
            }}>
              <div style={{
                width:        "10px",
                height:       "10px",
                borderRadius: "50%",
                background:   level.color,
                flexShrink:   0
              }} />
              <span style={{
                fontSize:   "16px",
                fontWeight: "700",
                color:      level.color
              }}>
                {data.category}
              </span>
            </div>

            <p style={{
              fontSize:   "14px",
              color:      "var(--text-muted)",
              lineHeight: "1.6"
            }}>
              {data.advice?.healthImplication}
            </p>

            {/* School advice — prominently shown when risky */}
            {data.aqi >= 200 && (
              <div style={{
                marginTop:    "12px",
                padding:      "10px 14px",
                background:   "rgba(239,68,68,0.1)",
                border:       "1px solid rgba(239,68,68,0.3)",
                borderRadius: "8px",
                fontSize:     "13px",
                color:        "#fca5a5",
                lineHeight:   "1.5"
              }}>
                🏫 <strong>School:</strong> {data.advice?.schools}
              </div>
            )}

            {/* Why this matters for India */}
            {data.aqi >= 150 && (
              <div style={{
                marginTop:    "12px",
                padding:      "10px 14px",
                background:   "rgba(16,185,129,0.06)",
                border:       "1px solid rgba(16,185,129,0.2)",
                borderRadius: "8px",
                fontSize:     "12px",
                color:        "var(--text-muted)",
                lineHeight:   "1.5"
              }}>
                <strong style={{ color: "var(--text-primary)" }}>🇮🇳 Why alerts matter:</strong> In India, 
                most schools don't close even at AQI 300+. Parents get no official warning. This is the gap 
                AirGuard fills — giving you the alert <em>before</em> you send your child outside.
              </div>
            )}
          </div>
        </div>

        {/* Dominant pollutant + timestamp */}
        <div style={{
          marginTop:      "20px",
          paddingTop:     "16px",
          borderTop:      "1px solid var(--border)",
          display:        "flex",
          justifyContent: "space-between",
          alignItems:     "center",
          flexWrap:       "wrap",
          gap:            "12px"
        }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", flex: 1 }}>
            <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>
              Dominant pollutant:{" "}
              <strong style={{ color: "var(--text-primary)" }}>
                {data.dominantPollutant || "—"}
              </strong>
            </span>
            {formattedTime && (
              <span style={{
                display:    "flex",
                alignItems: "center",
                gap:        "4px",
                fontSize:   "12px",
                color:      "var(--text-muted)"
              }} title={`Last updated: ${lastUpdated?.toLocaleString('en-IN')}`}>
                <Clock size={11} />
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
