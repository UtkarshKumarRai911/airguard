import React, { useState } from "react";
import { X, Save } from "lucide-react";

const GROUP_OPTIONS = [
  { id: "general",  label: "General public",            emoji: "🧑", desc: "Standard healthy adult" },
  { id: "child",    label: "Children (school-age)",     emoji: "👶", desc: "Under 12 years" },
  { id: "elderly",  label: "Elderly (60+)",             emoji: "👴", desc: "Senior citizens" },
  { id: "asthma",   label: "Asthma / respiratory",      emoji: "💨", desc: "Asthma, COPD, etc." },
  { id: "heart",    label: "Heart condition",           emoji: "❤️", desc: "Cardiac patients" },
  { id: "pregnant", label: "Pregnant",                  emoji: "🤰", desc: "Expecting mothers" }
];

export default function UserProfileModal({ current, onSave, onClose }) {
  const [groups,         setGroups]         = useState(current?.groups || ["general"]);
  const [hasAirPurifier, setHasAirPurifier] = useState(current?.hasAirPurifier || false);
  const [activity,       setActivity]       = useState(current?.activityPlanned || "");

  function toggleGroup(id) {
    if (id === "general") {
      setGroups(["general"]);
      return;
    }
    setGroups(prev => {
      const withoutGeneral = prev.filter(g => g !== "general");
      if (withoutGeneral.includes(id)) {
        const updated = withoutGeneral.filter(g => g !== id);
        return updated.length === 0 ? ["general"] : updated;
      }
      return [...withoutGeneral, id];
    });
  }

  function handleSave() {
    onSave({
      groups,
      hasAirPurifier,
      activityPlanned: activity.trim() || undefined
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-title"
      style={{
        position:   "fixed",
        inset:      0,
        background: "rgba(0,0,0,0.7)",
        display:    "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex:     1000,
        padding:    "16px"
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background:   "var(--bg-secondary)",
        border:       "1px solid var(--border)",
        borderRadius: "var(--radius)",
        width:        "100%",
        maxWidth:     "480px",
        maxHeight:    "90vh",
        overflowY:    "auto"
      }}>
        {/* Header */}
        <div style={{
          display:        "flex",
          alignItems:     "center",
          justifyContent: "space-between",
          padding:        "18px 20px",
          borderBottom:   "1px solid var(--border)"
        }}>
          <div>
            <h2 id="profile-title" style={{ fontSize: "16px", fontWeight: "700", color: "var(--text-primary)" }}>
              Health Profile
            </h2>
            <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
              Get personalized AI advice based on your needs
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              background:   "transparent",
              border:       "none",
              color:        "var(--text-muted)",
              cursor:       "pointer",
              padding:      "4px"
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "20px" }}>

          {/* Groups */}
          <p style={{ fontSize: "13px", fontWeight: "600", color: "var(--text-muted)", marginBottom: "10px" }}>
            Who are you checking for?
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "20px" }}>
            {GROUP_OPTIONS.map(opt => {
              const selected = groups.includes(opt.id);
              return (
                <button
                  key={opt.id}
                  onClick={() => toggleGroup(opt.id)}
                  aria-pressed={selected}
                  style={{
                    display:      "flex",
                    alignItems:   "center",
                    gap:          "12px",
                    background:   selected ? "rgba(16,185,129,0.1)" : "var(--bg-primary)",
                    border:       `1px solid ${selected ? "#10b981" : "var(--border)"}`,
                    borderRadius: "8px",
                    padding:      "10px 14px",
                    cursor:       "pointer",
                    textAlign:    "left",
                    transition:   "all 0.15s"
                  }}
                >
                  <span style={{ fontSize: "20px" }}>{opt.emoji}</span>
                  <div style={{ flex: 1 }}>
                    <p style={{
                      fontSize:  "14px",
                      fontWeight: selected ? "600" : "400",
                      color:     selected ? "#10b981" : "var(--text-primary)"
                    }}>
                      {opt.label}
                    </p>
                    <p style={{ fontSize: "11px", color: "var(--text-muted)" }}>{opt.desc}</p>
                  </div>
                  {selected && (
                    <div style={{
                      width:        "18px",
                      height:       "18px",
                      borderRadius: "50%",
                      background:   "#10b981",
                      display:      "flex",
                      alignItems:   "center",
                      justifyContent: "center",
                      flexShrink:   0
                    }}>
                      <span style={{ color: "#000", fontSize: "10px", fontWeight: "800" }}>✓</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Air purifier toggle */}
          <div style={{
            display:        "flex",
            alignItems:     "center",
            justifyContent: "space-between",
            padding:        "14px",
            background:     "var(--bg-primary)",
            borderRadius:   "8px",
            marginBottom:   "16px"
          }}>
            <div>
              <p style={{ fontSize: "14px", color: "var(--text-primary)" }}>Air purifier at home?</p>
              <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>Affects indoor safety advice</p>
            </div>
            <button
              onClick={() => setHasAirPurifier(h => !h)}
              role="switch"
              aria-checked={hasAirPurifier}
              style={{
                width:        "44px",
                height:       "24px",
                borderRadius: "12px",
                background:   hasAirPurifier ? "#10b981" : "var(--border)",
                border:       "none",
                cursor:       "pointer",
                position:     "relative",
                transition:   "background 0.2s",
                flexShrink:   0
              }}
            >
              <div style={{
                position:   "absolute",
                top:        "2px",
                left:       hasAirPurifier ? "22px" : "2px",
                width:      "20px",
                height:     "20px",
                borderRadius: "50%",
                background: "#fff",
                transition: "left 0.2s"
              }} />
            </button>
          </div>

          {/* Planned activity */}
          <div style={{ marginBottom: "20px" }}>
            <label htmlFor="activity-input" style={{
              display:      "block",
              fontSize:     "13px",
              color:        "var(--text-muted)",
              marginBottom: "6px"
            }}>
              Planned activity today (optional)
            </label>
            <input
              id="activity-input"
              type="text"
              value={activity}
              onChange={e => setActivity(e.target.value)}
              placeholder="e.g. morning jog, school run, outdoor event"
              maxLength={100}
              style={{
                width:        "100%",
                background:   "var(--bg-primary)",
                border:       "1px solid var(--border)",
                borderRadius: "8px",
                padding:      "10px 14px",
                color:        "var(--text-primary)",
                fontSize:     "14px",
                outline:      "none"
              }}
            />
          </div>

          {/* Save button */}
          <button
            onClick={handleSave}
            style={{
              width:          "100%",
              background:     "var(--accent-green)",
              border:         "none",
              borderRadius:   "8px",
              padding:        "12px",
              color:          "#000",
              fontWeight:     "700",
              fontSize:       "14px",
              cursor:         "pointer",
              display:        "flex",
              alignItems:     "center",
              justifyContent: "center",
              gap:            "8px"
            }}
          >
            <Save size={15} />
            Save Profile & Get Personalized Advice
          </button>
        </div>
      </div>
    </div>
  );
}
