import React, { useState } from "react";
import Header       from "./components/Header";
import SearchBar    from "./components/SearchBar";
import AQICard      from "./components/AQICard";
import HistoryChart from "./components/HistoryChart";
import AIAdvice     from "./components/AIAdvice";
import AlertSignup  from "./components/AlertSignup";
import PollutantGrid from "./components/PollutantGrid";
import UserProfileModal from "./components/UserProfileModal";
import EmptyState   from "./components/EmptyState";
import IndiaContextBanner from "./components/IndiaContextBanner";
import { useAQI }   from "./hooks/useAQI";

export default function App() {
  const [userProfile, setUserProfile] = useState({ groups: ["general"], hasAirPurifier: false });
  const [showProfileModal, setShowProfileModal] = useState(false);

  const {
    location, aqiData, history, recommendation,
    loading, historyLoading, aiLoading, error,
    lastUpdated, search, refresh
  } = useAQI();

  function handleSearch(loc) {
    search(loc, userProfile);
  }

  function handleProfileSave(profile) {
    setUserProfile(profile);
    setShowProfileModal(false);
    if (location) refresh(profile);
  }

  return (
    <div style={{ minHeight: "100vh" }}>
      <Header
        onOpenProfile={() => setShowProfileModal(true)}
        userProfile={userProfile}
      />

      <main style={{ 
        maxWidth: "1000px", 
        margin: "0 auto", 
        padding: "32px 20px 80px",
      }}>

        {/* Search */}
        <div className="fade-in">
          <SearchBar
            onSearch={handleSearch}
            loading={loading}
            currentLocation={location}
          />
        </div>

        {/* Error */}
        {error && !loading && (
          <div role="alert" className="slide-in-left" style={{
            marginTop: "20px",
            padding: "16px 20px",
            background: "linear-gradient(135deg, rgba(239,68,68,0.15) 0%, rgba(220,38,38,0.15) 100%)",
            border: "2px solid rgba(239,68,68,0.4)",
            borderRadius: "var(--radius)",
            color: "#fca5a5",
            fontSize: "14px",
            fontWeight: "500",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            boxShadow: "0 4px 16px rgba(239,68,68,0.2)"
          }}>
            <span style={{ fontSize: "18px" }}>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {/* Main content */}
        {!location && !loading && <EmptyState onCitySelect={handleSearch} />}

        {(loading || aqiData) && (
          <div style={{ marginTop: "28px", display: "flex", flexDirection: "column", gap: "24px" }}>

            {/* India Context Banner */}
            {aqiData && !loading && (
              <div className="slide-in-right">
                <IndiaContextBanner aqi={aqiData.aqi} location={location} />
              </div>
            )}

            {/* AQI Card */}
            <AQICard
              data={aqiData}
              loading={loading}
              lastUpdated={lastUpdated}
              onRefresh={() => refresh(userProfile)}
            />

            {/* Pollutant breakdown */}
            {aqiData && !loading && (
              <div className="fade-in" style={{ animationDelay: "0.1s" }}>
                <PollutantGrid readings={aqiData.readings} />
              </div>
            )}

            {/* AI Advice */}
            {(aqiData || aiLoading) && (
              <div className="fade-in" style={{ animationDelay: "0.2s" }}>
                <AIAdvice
                  data={recommendation}
                  loading={aiLoading}
                  aqi={aqiData?.aqi}
                />
              </div>
            )}

            {/* 7-day History Chart */}
            {(history.length > 0 || historyLoading) && (
              <div className="fade-in" style={{ animationDelay: "0.3s" }}>
                <HistoryChart
                  data={history}
                  loading={historyLoading}
                  location={location}
                />
              </div>
            )}

            {/* Alert Signup */}
            {aqiData && !loading && (
              <div className="fade-in" style={{ animationDelay: "0.4s" }}>
                <AlertSignup
                  location={location}
                  userProfile={userProfile}
                />
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer with gradient */}
      <footer style={{
        borderTop:    "1px solid rgba(148,163,184,0.15)",
        padding:      "32px 20px",
        marginTop:    "60px",
        textAlign:    "center",
        background:   "linear-gradient(180deg, rgba(15,23,42,0.5) 0%, rgba(10,14,39,0.9) 100%)",
        backdropFilter: "blur(10px)",
        position: "relative"
      }}>
        {/* Decorative gradient orbs */}
        <div style={{
          position: "absolute",
          top: "-100px",
          left: "10%",
          width: "200px",
          height: "200px",
          background: "radial-gradient(circle, rgba(16,185,129,0.15) 0%, transparent 70%)",
          borderRadius: "50%",
          filter: "blur(40px)",
          pointerEvents: "none"
        }} />
        <div style={{
          position: "absolute",
          top: "-80px",
          right: "15%",
          width: "180px",
          height: "180px",
          background: "radial-gradient(circle, rgba(59,130,246,0.15) 0%, transparent 70%)",
          borderRadius: "50%",
          filter: "blur(40px)",
          pointerEvents: "none"
        }} />
        
        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{
            display: "inline-block",
            marginBottom: "16px",
            padding: "10px 20px",
            background: "linear-gradient(135deg, rgba(16,185,129,0.15) 0%, rgba(6,182,212,0.15) 100%)",
            border: "2px solid rgba(16,185,129,0.3)",
            borderRadius: "12px",
            boxShadow: "0 4px 16px rgba(16,185,129,0.2)"
          }}>
            <p style={{ 
              fontSize: "14px", 
              fontWeight: "700",
              margin: 0
            }}>
              <span className="gradient-text">WeMakeDevs × AWS Environmental Hacks 2026</span>
            </p>
          </div>
          
          <p style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "16px" }}>
            Team: <strong style={{ 
              background: "linear-gradient(135deg, #10b981 0%, #34d399 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              fontWeight: "800"
            }}>FUTURE_PROTECTOR</strong> | Track: Air Quality & Environmental Health
          </p>
          
          <div style={{
            display:        "flex",
            alignItems:     "center",
            justifyContent: "center",
            gap:            "10px",
            fontSize:       "13px",
            color:          "var(--text-dim)",
            flexWrap:       "wrap",
            marginBottom: "16px"
          }}>
            <span style={{ 
              color: "#ff9900", 
              fontWeight: "700",
              fontSize: "14px"
            }}>Powered by AWS:</span>
            <span style={{
              padding: "4px 10px",
              background: "rgba(255,153,0,0.1)",
              border: "1px solid rgba(255,153,0,0.3)",
              borderRadius: "6px",
              fontSize: "11px",
              fontWeight: "600"
            }}>Lambda</span>
            <span style={{
              padding: "4px 10px",
              background: "rgba(168,85,247,0.1)",
              border: "1px solid rgba(168,85,247,0.3)",
              borderRadius: "6px",
              fontSize: "11px",
              fontWeight: "600"
            }}>Bedrock AI</span>
            <span style={{
              padding: "4px 10px",
              background: "rgba(59,130,246,0.1)",
              border: "1px solid rgba(59,130,246,0.3)",
              borderRadius: "6px",
              fontSize: "11px",
              fontWeight: "600"
            }}>DynamoDB</span>
            <span style={{
              padding: "4px 10px",
              background: "rgba(16,185,129,0.1)",
              border: "1px solid rgba(16,185,129,0.3)",
              borderRadius: "6px",
              fontSize: "11px",
              fontWeight: "600"
            }}>API Gateway</span>
            <span style={{
              padding: "4px 10px",
              background: "rgba(249,115,22,0.1)",
              border: "1px solid rgba(249,115,22,0.3)",
              borderRadius: "6px",
              fontSize: "11px",
              fontWeight: "600"
            }}>SNS</span>
            <span style={{
              padding: "4px 10px",
              background: "rgba(236,72,153,0.1)",
              border: "1px solid rgba(236,72,153,0.3)",
              borderRadius: "6px",
              fontSize: "11px",
              fontWeight: "600"
            }}>Amplify</span>
          </div>
          
          <p style={{ fontSize: "12px", color: "var(--text-dim)", marginTop: "12px" }}>
            Real-time data from <strong style={{ color: "#34d399" }}>WAQI</strong> & <strong style={{ color: "#34d399" }}>OpenAQ</strong> | 
            Using CPCB India AQI scale
          </p>
          
          <div style={{
            marginTop: "20px",
            paddingTop: "16px",
            borderTop: "1px solid rgba(148,163,184,0.1)"
          }}>
            <p style={{ fontSize: "11px", color: "var(--text-dim)" }}>
              © 2026 AirGuard • Built with 💚 for cleaner air in India
            </p>
          </div>
        </div>
      </footer>

      {/* User profile modal */}
      {showProfileModal && (
        <UserProfileModal
          current={userProfile}
          onSave={handleProfileSave}
          onClose={() => setShowProfileModal(false)}
        />
      )}
    </div>
  );
}
