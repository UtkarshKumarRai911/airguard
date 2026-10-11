import React from "react";

const POLLUTANTS = [
  { key: "pm25", label: "PM2.5", unit: "µg/m³", who: 15,  safe: 60,  desc: "Fine particles (lung damage risk)" },
  { key: "pm10", label: "PM10",  unit: "µg/m³", who: 45,  safe: 100, desc: "Coarse particles (respiratory)" },
  { key: "o3",   label: "O₃",    unit: "µg/m³", who: 100, safe: 100, desc: "Ozone (throat irritation)" },
  { key: "no2",  label: "NO₂",   unit: "µg/m³", who: 25,  safe: 80,  desc: "Nitrogen dioxide (airway damage)" },
  { key: "so2",  label: "SO₂",   unit: "µg/m³", who: 40,  safe: 80,  desc: "Sulfur dioxide (breathing issues)" },
  { key: "co",   label: "CO",    unit: "mg/m³",  who: 4,   safe: 4,   desc: "Carbon monoxide (blood oxygen)" }
];

function getBarColor(value, safe) {
  const ratio = value / safe;
  if (ratio <= 0.5)  return "#10b981";
  if (ratio <= 0.75) return "#f59e0b";
  if (ratio <= 1.0)  return "#f97316";
  return "#ef4444";
}

export default function PollutantGrid({ readings }) {
  if (!readings) return null;

  const available = POLLUTANTS.filter(p => readings[p.key] != null);
  if (available.length === 0) return null;

  return (
    <div style={{
      background:   "var(--bg-secondary)",
      border:       "1px solid var(--border)",
      borderRadius: "var(--radius)",
      padding:      "20px 24px"
    }}>
      <h2 style={{
        fontSize:    "15px",
        fontWeight:  "600",
        color:       "var(--text-primary)",
        marginBottom: "16px"
      }}>
        Pollutant Breakdown
      </h2>

      <div style={{
        display:             "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
        gap:                 "12px"
      }}>
        {available.map(p => {
          const value    = readings[p.key];
          const barColor = getBarColor(value, p.safe);
          const barWidth = Math.min(100, (value / (p.safe * 1.5)) * 100);

          return (
            <div
              key={p.key}
              style={{
                background:   "var(--bg-primary)",
                borderRadius: "8px",
                padding:      "14px"
              }}
              title={p.desc}
            >
              <div style={{
                display:        "flex",
                justifyContent: "space-between",
                alignItems:     "baseline",
                marginBottom:   "8px"
              }}>
                <span style={{ fontSize: "13px", fontWeight: "700", color: "var(--text-primary)" }}>
                  {p.label}
                </span>
                <span style={{ fontSize: "16px", fontWeight: "800", color: barColor }}>
                  {value}
                  <span style={{ fontSize: "11px", fontWeight: "400", color: "var(--text-muted)", marginLeft: "2px" }}>
                    {p.unit}
                  </span>
                </span>
              </div>

              {/* Progress bar */}
              <div style={{
                height:       "6px",
                background:   "var(--border)",
                borderRadius: "3px",
                overflow:     "hidden"
              }}>
                <div style={{
                  width:        `${barWidth}%`,
                  height:       "100%",
                  background:   barColor,
                  borderRadius: "3px",
                  transition:   "width 0.6s ease"
                }} />
              </div>

              <div style={{
                display:        "flex",
                justifyContent: "space-between",
                marginTop:      "4px"
              }}>
                <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>{p.desc}</span>
                <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>
                  WHO: {p.who}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
