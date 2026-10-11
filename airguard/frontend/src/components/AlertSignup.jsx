import React, { useState } from "react";
import { Bell, BellOff, CheckCircle, Loader } from "lucide-react";
import { subscribe, unsubscribe } from "../utils/api";
import toast from "react-hot-toast";

const THRESHOLD_OPTIONS = [
  { value: 100, label: "100 — Satisfactory (recommended for sensitive groups)" },
  { value: 150, label: "150 — Moderate boundary (default)" },
  { value: 200, label: "200 — Poor boundary" },
  { value: 300, label: "300 — Very Poor boundary" }
];

export default function AlertSignup({ location, userProfile }) {
  const [email,        setEmail]        = useState("");
  const [threshold,    setThreshold]    = useState(150);
  const [subscribed,   setSubscribed]   = useState(false);
  const [loading,      setLoading]      = useState(false);
  const [showUnsub,    setShowUnsub]    = useState(false);
  const [emailError,   setEmailError]   = useState("");

  function validateEmail(val) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(val);
  }

  function handleEmailChange(e) {
    setEmail(e.target.value);
    if (emailError) setEmailError("");
  }

  async function handleSubscribe(e) {
    e.preventDefault();

    if (!validateEmail(email)) {
      setEmailError("Please enter a valid email address");
      return;
    }

    setLoading(true);
    try {
      await subscribe({
        email,
        location,
        threshold,
        userProfile: userProfile || { groups: ["general"] }
      });
      setSubscribed(true);
      toast.success(`Alerts enabled for ${location}! Check your inbox.`);
    } catch (err) {
      toast.error(err.message || "Failed to subscribe. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleUnsubscribe() {
    setLoading(true);
    try {
      await unsubscribe(email, location);
      setSubscribed(false);
      setShowUnsub(false);
      toast.success("Unsubscribed successfully.");
    } catch (err) {
      toast.error(err.message || "Failed to unsubscribe.");
    } finally {
      setLoading(false);
    }
  }

  if (subscribed) {
    return (
      <div
        className="fade-in"
        style={{
          background:   "var(--bg-secondary)",
          border:       "1px solid rgba(16,185,129,0.3)",
          borderRadius: "var(--radius)",
          padding:      "20px 24px"
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <CheckCircle size={20} color="#10b981" />
            <div>
              <p style={{ fontSize: "15px", fontWeight: "600", color: "#10b981" }}>
                Alerts activated for {location}
              </p>
              <p style={{ fontSize: "13px", color: "var(--text-muted)", marginTop: "2px" }}>
                You'll receive an email at <strong>{email}</strong> when AQI exceeds {threshold}
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowUnsub(true)}
            disabled={loading}
            style={{
              background:   "transparent",
              border:       "1px solid var(--border)",
              borderRadius: "6px",
              padding:      "6px 14px",
              color:        "var(--text-muted)",
              fontSize:     "13px",
              cursor:       "pointer",
              display:      "flex",
              alignItems:   "center",
              gap:          "6px"
            }}
          >
            <BellOff size={13} />
            Unsubscribe
          </button>
        </div>

        {/* Unsubscribe confirmation */}
        {showUnsub && (
          <div style={{
            marginTop:    "14px",
            padding:      "14px",
            background:   "rgba(239,68,68,0.08)",
            border:       "1px solid rgba(239,68,68,0.2)",
            borderRadius: "8px"
          }}>
            <p style={{ fontSize: "13px", color: "var(--text-primary)", marginBottom: "10px" }}>
              Remove all alerts for <strong>{location}</strong>?
            </p>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                onClick={handleUnsubscribe}
                disabled={loading}
                style={{
                  background: "#ef4444", border: "none", borderRadius: "6px",
                  padding: "6px 14px", color: "#fff", fontSize: "13px",
                  cursor: "pointer", display: "flex", alignItems: "center", gap: "6px"
                }}
              >
                {loading ? <Loader size={12} className="spinning" /> : <BellOff size={12} />}
                Yes, unsubscribe
              </button>
              <button
                onClick={() => setShowUnsub(false)}
                style={{
                  background: "transparent", border: "1px solid var(--border)",
                  borderRadius: "6px", padding: "6px 14px",
                  color: "var(--text-muted)", fontSize: "13px", cursor: "pointer"
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{
      background:   "var(--bg-secondary)",
      border:       "1px solid var(--border)",
      borderRadius: "var(--radius)",
      padding:      "20px 24px"
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
        <Bell size={16} color="var(--accent-green)" />
        <h2 style={{ fontSize: "15px", fontWeight: "600", color: "var(--text-primary)" }}>
          Get AQI Alerts for {location}
        </h2>
      </div>
      <p style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "18px" }}>
        Receive email alerts when air quality deteriorates. Free, no spam, unsubscribe anytime.
      </p>

      <form onSubmit={handleSubscribe} noValidate>
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>

          {/* Email input */}
          <div>
            <label htmlFor="alert-email" style={{
              display:      "block",
              fontSize:     "13px",
              color:        "var(--text-muted)",
              marginBottom: "6px"
            }}>
              Email address
            </label>
            <input
              id="alert-email"
              type="email"
              value={email}
              onChange={handleEmailChange}
              placeholder="you@example.com"
              required
              aria-invalid={!!emailError}
              aria-describedby={emailError ? "email-error" : undefined}
              style={{
                width:        "100%",
                background:   "var(--bg-primary)",
                border:       `1px solid ${emailError ? "#ef4444" : "var(--border)"}`,
                borderRadius: "8px",
                padding:      "10px 14px",
                color:        "var(--text-primary)",
                fontSize:     "14px",
                outline:      "none"
              }}
            />
            {emailError && (
              <p id="email-error" role="alert" style={{
                fontSize: "12px", color: "#ef4444", marginTop: "4px"
              }}>
                {emailError}
              </p>
            )}
          </div>

          {/* Threshold selector */}
          <div>
            <label htmlFor="alert-threshold" style={{
              display:      "block",
              fontSize:     "13px",
              color:        "var(--text-muted)",
              marginBottom: "6px"
            }}>
              Alert me when AQI exceeds
            </label>
            <select
              id="alert-threshold"
              value={threshold}
              onChange={e => setThreshold(Number(e.target.value))}
              style={{
                width:        "100%",
                background:   "var(--bg-primary)",
                border:       "1px solid var(--border)",
                borderRadius: "8px",
                padding:      "10px 14px",
                color:        "var(--text-primary)",
                fontSize:     "13px",
                outline:      "none",
                cursor:       "pointer"
              }}
            >
              {THRESHOLD_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || !email}
            style={{
              background:    loading ? "var(--border)" : "var(--accent-green)",
              border:        "none",
              borderRadius:  "8px",
              padding:       "11px 20px",
              color:         "#000",
              fontWeight:    "600",
              fontSize:      "14px",
              cursor:        loading || !email ? "not-allowed" : "pointer",
              display:       "flex",
              alignItems:    "center",
              justifyContent: "center",
              gap:           "8px",
              opacity:       !email ? 0.5 : 1,
              transition:    "background 0.2s, opacity 0.2s"
            }}
          >
            {loading
              ? <><Loader size={14} className="spinning" /> Setting up alerts…</>
              : <><Bell size={14} /> Enable Alerts</>
            }
          </button>

          <p style={{ fontSize: "11px", color: "var(--text-muted)", textAlign: "center" }}>
            You'll also receive a daily 7 AM summary. Alerts powered by AWS SNS.
          </p>
        </div>
      </form>
    </div>
  );
}
