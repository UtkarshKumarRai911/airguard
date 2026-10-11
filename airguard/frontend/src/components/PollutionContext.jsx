/**
 * PollutionContext — Tier 2, Improvement 7
 *
 * Displays a "Why is AQI high today?" panel powered by Bedrock's
 * whyHighToday field. Shown when AQI ≥ 150.
 *
 * Props:
 *   data  — recommendation.whyHighToday object from API
 */

import React from "react";

export default function PollutionContext({ data }) {
  if (!data) return null;

  return (
    <div
      role="region"
      aria-label="Pollution source context"
      style={{
        background:   "rgba(245,158,11,0.06)",
        border:       "1px solid rgba(245,158,11,0.25)",
        borderRadius: "var(--radius)",
        padding:      "16px 20px"
      }}
    >
      {/* Header row */}
      <div style={{
        display:       "flex",
        alignItems:    "center",
        gap:           "8px",
        marginBottom:  "10px",
        flexWrap:      "wrap"
      }}>
        <span style={{ fontSize: "16px" }} aria-hidden="true">📊</span>
        <span style={{ fontSize: "14px", fontWeight: "600", color: "#f59e0b" }}>
          Why is AQI high today?
        </span>

        {/* Temporary / Ongoing badge */}
        {data.isTemporary ? (
          <span style={{
            fontSize:     "11px",
            background:   "rgba(16,185,129,0.1)",
            color:        "#10b981",
            border:       "1px solid rgba(16,185,129,0.3)",
            borderRadius: "4px",
            padding:      "1px 7px",
            fontWeight:   "600"
          }}>
            Temporary
          </span>
        ) : (
          <span style={{
            fontSize:     "11px",
            background:   "rgba(239,68,68,0.1)",
            color:        "#ef4444",
            border:       "1px solid rgba(239,68,68,0.3)",
            borderRadius: "4px",
            padding:      "1px 7px",
            fontWeight:   "600"
          }}>
            Ongoing
          </span>
        )}
      </div>

      {/* Cause */}
      <p style={{
        fontSize:    "14px",
        color:       "var(--text-primary)",
        lineHeight:  "1.6",
        marginBottom: "6px",
        margin:      "0 0 6px"
      }}>
        {data.cause}
      </p>

      {/* Duration */}
      <p style={{
        fontSize:    "13px",
        color:       "var(--text-muted)",
        lineHeight:  "1.5",
        margin:      "0 0 6px"
      }}>
        <strong style={{ color: "var(--text-secondary)" }}>Expected duration:</strong>{" "}
        {data.duration}
      </p>

      {/* Action note */}
      {data.actionNote && (
        <p style={{
          fontSize:    "13px",
          color:       "var(--text-primary)",
          lineHeight:  "1.5",
          margin:      "0",
          paddingTop:  "8px",
          borderTop:   "1px solid rgba(255,255,255,0.07)"
        }}>
          💡 {data.actionNote}
        </p>
      )}
    </div>
  );
}
