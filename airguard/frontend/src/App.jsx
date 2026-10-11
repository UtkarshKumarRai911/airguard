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
    <div style={{ minHeight: "100vh", background: "var(--bg-primary)" }}>
      <Header
        onOpenProfile={() => setShowProfileModal(true)}
        userProfile={userProfile}
      />

      <main style={{ maxWidth: "900px", margin: "0 auto", padding: "24px 16px 64px" }}>

        {/* Search */}
        <SearchBar
          onSearch={handleSearch}
          loading={loading}
          currentLocation={location}
        />

        {/* Error */}
        {error && !loading && (
          <div role="alert" style={{
            marginTop: "16px",
            padding: "14px 18px",
            background: "#2d1515",
            border: "1px solid #7f1d1d",
            borderRadius: "var(--radius)",
            color: "#fca5a5",
            fontSize: "14px"
          }}>
            ⚠️ {error}
          </div>
        )}

        {/* Main content */}
        {!location && !loading && <EmptyState onCitySelect={handleSearch} />}

        {(loading || aqiData) && (
          <div style={{ marginTop: "24px", display: "flex", flexDirection: "column", gap: "20px" }}>

            {/* India Context Banner */}
            {aqiData && !loading && (
              <IndiaContextBanner aqi={aqiData.aqi} location={location} />
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
              <PollutantGrid readings={aqiData.readings} />
            )}

            {/* AI Advice */}
            {(aqiData || aiLoading) && (
              <AIAdvice
                data={recommendation}
                loading={aiLoading}
                aqi={aqiData?.aqi}
              />
            )}

            {/* 24h History Chart */}
            {(history.length > 0 || historyLoading) && (
              <HistoryChart
                data={history}
                loading={historyLoading}
                location={location}
              />
            )}

            {/* Alert Signup */}
            {aqiData && !loading && (
              <AlertSignup
                location={location}
                userProfile={userProfile}
              />
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer style={{
        borderTop:    "1px solid var(--border)",
        padding:      "20px 16px",
        marginTop:    "40px",
        textAlign:    "center",
        background:   "var(--bg-secondary)"
      }}>
        <p style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "8px" }}>
          Built for <strong style={{ color: "var(--text-primary)" }}>WeMakeDevs × AWS Environmental Hacks 2026</strong>
        </p>
        <p style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "12px" }}>
          Team: <strong style={{ color: "#10b981" }}>FUTURE_PROTECTOR</strong> | Track: Air
        </p>
        <div style={{
          display:        "flex",
          alignItems:     "center",
          justifyContent: "center",
          gap:            "12px",
          fontSize:       "12px",
          color:          "var(--text-muted)",
          flexWrap:       "wrap"
        }}>
          <span style={{ color: "#ff9900", fontWeight: "600" }}>AWS Services:</span>
          Lambda · Bedrock · DynamoDB · SNS · API Gateway · Amplify · EventBridge
        </div>
        <p style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "12px" }}>
          Data from WAQI & OpenAQ | Using CPCB India AQI scale
        </p>
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
