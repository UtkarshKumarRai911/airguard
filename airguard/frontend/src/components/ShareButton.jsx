import React from "react";
import { Share2 } from "lucide-react";

export default function ShareButton({ location, aqi, category }) {
  function handleShare() {
    const text = `⚠️ Air Quality Alert: ${location}

AQI: ${aqi} (${category})

${aqi >= 200 ? "🚨 UNSAFE for children and outdoor activities" : "⚠️ Sensitive groups should limit outdoor exposure"}

Check your city's AQI and get personalized AI health advice:
${window.location.origin}

#AirQuality #AirGuard #${location.replace(/\s/g, "")}`;

    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
    
    window.open(whatsappUrl, '_blank');
  }

  return (
    <button
      onClick={handleShare}
      style={{
        display:      "flex",
        alignItems:   "center",
        gap:          "8px",
        background:   "#25D366",
        border:       "none",
        borderRadius: "8px",
        padding:      "10px 16px",
        color:        "#ffffff",
        fontSize:     "14px",
        fontWeight:   "600",
        cursor:       "pointer",
        transition:   "transform 0.2s, box-shadow 0.2s",
        boxShadow:    "0 2px 8px rgba(37,211,102,0.3)"
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = "translateY(-1px)";
        e.currentTarget.style.boxShadow = "0 4px 12px rgba(37,211,102,0.4)";
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "0 2px 8px rgba(37,211,102,0.3)";
      }}
    >
      <Share2 size={16} />
      Share on WhatsApp
    </button>
  );
}
