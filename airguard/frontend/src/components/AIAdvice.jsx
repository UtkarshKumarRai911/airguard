import React, { useState } from "react";
import { Sparkles, ChevronDown, ChevronUp, ShieldCheck, AlertTriangle } from "lucide-react";

function Skeleton({ w = "100%", h = "14px" }) {
  return (
    <div className="pulsing" style={{
      width: w, height: h, background: "var(--border)", borderRadius: "4px", marginBottom: "8px"
    }} />
  );
}

export default function AIAdvice({ data, loading, aqi }) {
  const [expanded, setExpanded] = useState(true);

  if (loading) {
    return (
      <div style={{
        background:   "var(--bg-secondary)",
        border:       "1px solid var(--border)",
        borderRadius: "var(--radius)",
        padding:      "20px 24px"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
          <Sparkles size={16} color="#a78bfa" />
          <span style={{ fontSize: "15px", fontWeight: "600", color: "#a78bfa" }}>
            AI Health Advice
          </span>
          <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>Generating…</span>
        </div>
        <Skeleton w="90%" />
        <Skeleton w="70%" />
        <Skeleton w="80%" />
        <Skeleton w="50%" />
      </div>
    );
  }

  if (!data) return null;

  const isOutdoorSafe = data.isOutdoorSafe;
  const accentColor   = isOutdoorSafe ? "#10b981" : aqi >= 300 ? "#ef4444" : "#f59e0b";

  return (
    <div
      className="fade-in"
      style={{
        background:   "var(--bg-secondary)",
        border:       `1px solid ${accentColor}33`,
        borderRadius: "var(--radius)",
        overflow:     "hidden"
      }}
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(e => !e)}
        aria-expanded={expanded}
        style={{
          width:          "100%",
          display:        "flex",
          alignItems:     "center",
          justifyContent: "space-between",
          padding:        "16px 24px",
          background:     "transparent",
          border:         "none",
          cursor:         "pointer",
          borderBottom:   expanded ? "1px solid var(--border)" : "none"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Sparkles size={16} color="#a78bfa" />
          <span style={{ fontSize: "15px", fontWeight: "600", color: "#a78bfa" }}>
            AI Health Advice
          </span>
          {data.aiPowered !== false && (
            <span style={{
              fontSize:   "11px",
              color:      "#a78bfa",
              background: "rgba(167,139,250,0.1)",
              border:     "1px solid rgba(167,139,250,0.3)",
              borderRadius: "4px",
              padding:    "1px 6px"
            }}>
              Amazon Bedrock
            </span>
          )}
          {data.source === "rule-based" && (
            <span style={{
              fontSize:   "11px",
              color:      "var(--text-muted)",
              background: "var(--bg-primary)",
              border:     "1px solid var(--border)",
              borderRadius: "4px",
              padding:    "1px 6px"
            }}>
              Rule-based
            </span>
          )}
        </div>
        {expanded ? <ChevronUp size={16} color="var(--text-muted)" /> : <ChevronDown size={16} color="var(--text-muted)" />}
      </button>

      {expanded && (
        <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: "16px" }}>

          {/* Outdoor safety banner */}
          <div style={{
            display:      "flex",
            alignItems:   "center",
            gap:          "12px",
            background:   `${accentColor}15`,
            border:       `1px solid ${accentColor}44`,
            borderRadius: "8px",
            padding:      "14px 16px"
          }}>
            {isOutdoorSafe
              ? <ShieldCheck size={20} color={accentColor} />
              : <AlertTriangle size={20} color={accentColor} />
            }
            <div>
              <p style={{ fontSize: "14px", fontWeight: "700", color: accentColor, marginBottom: "2px" }}>
                {isOutdoorSafe ? "Outdoor activities are relatively safe" : "Limit outdoor exposure"}
              </p>
              <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>
                {data.immediateAction}
              </p>
            </div>
          </div>

          {/* Summary */}
          <p style={{ fontSize: "14px", color: "var(--text-primary)", lineHeight: "1.7" }}>
            {data.summary}
          </p>

          {/* Two-column advice */}
          <div style={{
            display:             "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            gap:                 "12px"
          }}>
            {/* Activity advice */}
            {data.activityAdvice && (
              <InfoBlock title="🏃 Activity Advice" text={data.activityAdvice} />
            )}
            {/* Safest time */}
            {data.safestTimeToGoOut && (
              <InfoBlock title="⏰ Best Time to Go Out" text={data.safestTimeToGoOut} />
            )}
            {/* Children */}
            {data.childrenAdvice && (
              <InfoBlock title="👶 For Children" text={data.childrenAdvice} />
            )}
            {/* Mask */}
            {data.maskAdvice && (
              <InfoBlock title="😷 Mask Advice" text={data.maskAdvice} />
            )}
          </div>

          {/* Protective steps */}
          {data.protectiveSteps?.length > 0 && (
            <div>
              <h3 style={{ fontSize: "13px", fontWeight: "600", color: "var(--text-muted)", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Protective Steps
              </h3>
              <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "6px" }}>
                {data.protectiveSteps.map((step, i) => (
                  <li key={i} style={{
                    display:    "flex",
                    alignItems: "flex-start",
                    gap:        "8px",
                    fontSize:   "13px",
                    color:      "var(--text-primary)"
                  }}>
                    <span style={{
                      width:        "20px",
                      height:       "20px",
                      background:   "var(--accent-green)",
                      borderRadius: "50%",
                      display:      "flex",
                      alignItems:   "center",
                      justifyContent: "center",
                      fontSize:     "11px",
                      fontWeight:   "700",
                      color:        "#000",
                      flexShrink:   0,
                      marginTop:    "1px"
                    }}>
                      {i + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Doctor advice */}
          {data.whenToSeeDoctor && (
            <div style={{
              background:   "rgba(239,68,68,0.05)",
              border:       "1px solid rgba(239,68,68,0.2)",
              borderRadius: "8px",
              padding:      "12px 14px",
              fontSize:     "12px",
              color:        "var(--text-muted)",
              lineHeight:   "1.6"
            }}>
              <strong style={{ color: "#fca5a5" }}>🏥 See a doctor if: </strong>
              {data.whenToSeeDoctor}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function InfoBlock({ title, text }) {
  return (
    <div style={{
      background:   "var(--bg-primary)",
      borderRadius: "8px",
      padding:      "12px 14px"
    }}>
      <p style={{ fontSize: "12px", fontWeight: "600", color: "var(--text-muted)", marginBottom: "4px" }}>
        {title}
      </p>
      <p style={{ fontSize: "13px", color: "var(--text-primary)", lineHeight: "1.5" }}>
        {text}
      </p>
    </div>
  );
}
