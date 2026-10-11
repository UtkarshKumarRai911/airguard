import React from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine
} from "recharts";

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const aqi = payload[0]?.value;

  let color = "#10b981";
  if (aqi > 400) color = "#7e0023";
  else if (aqi > 300) color = "#ef4444";
  else if (aqi > 200) color = "#f97316";
  else if (aqi > 100) color = "#f59e0b";
  else if (aqi > 50)  color = "#84cc16";

  return (
    <div style={{
      background:   "var(--bg-secondary)",
      border:       "1px solid var(--border)",
      borderRadius: "8px",
      padding:      "10px 14px",
      fontSize:     "13px"
    }}>
      <p style={{ color: "var(--text-muted)", marginBottom: "4px" }}>{label}</p>
      <p style={{ color, fontWeight: "700", fontSize: "18px" }}>AQI {aqi}</p>
    </div>
  );
}

export default function HistoryChart({ data, loading, location }) {
  if (loading) {
    return (
      <div style={{
        background:   "var(--bg-secondary)",
        border:       "1px solid var(--border)",
        borderRadius: "var(--radius)",
        padding:      "24px",
        height:       "200px",
        display:      "flex",
        alignItems:   "center",
        justifyContent: "center",
        color:        "var(--text-muted)",
        fontSize:     "14px"
      }}>
        Loading history…
      </div>
    );
  }

  if (!data || data.length === 0) return null;

  const chartData = [...data]
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
    .map(d => ({
      time: new Date(d.timestamp).toLocaleTimeString("en-IN", {
        hour: "2-digit", minute: "2-digit", hour12: true
      }),
      aqi: d.aqi
    }));

  // Show every 4th label to avoid crowding
  const tickInterval = Math.max(1, Math.floor(chartData.length / 8));

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
        marginBottom: "4px"
      }}>
        24-Hour AQI History
      </h2>
      <p style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "16px" }}>
        {location} — last {data.length} readings
      </p>

      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
          <defs>
            <linearGradient id="aqiGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />

          <XAxis
            dataKey="time"
            tick={{ fill: "var(--text-muted)", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            interval={tickInterval}
          />
          <YAxis
            tick={{ fill: "var(--text-muted)", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            domain={[0, "auto"]}
          />

          <Tooltip content={<CustomTooltip />} />

          {/* Reference lines for AQI thresholds */}
          <ReferenceLine y={100} stroke="#f59e0b" strokeDasharray="4 4" strokeOpacity={0.6}
            label={{ value: "Moderate", fill: "#f59e0b", fontSize: 10, position: "right" }} />
          <ReferenceLine y={200} stroke="#f97316" strokeDasharray="4 4" strokeOpacity={0.6}
            label={{ value: "Poor", fill: "#f97316", fontSize: 10, position: "right" }} />

          <Area
            type="monotone"
            dataKey="aqi"
            stroke="#3b82f6"
            strokeWidth={2}
            fill="url(#aqiGradient)"
            dot={false}
            activeDot={{ r: 5, fill: "#3b82f6", stroke: "var(--bg-secondary)", strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
