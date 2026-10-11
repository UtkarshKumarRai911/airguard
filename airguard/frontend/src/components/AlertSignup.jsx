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
  const [phone,        setPhone]        = useState("");
  const [alertChannel, setAlertChannel] = useState("email"); // "email" or "sms"
  const [threshold,    setThreshold]    = useState(150);
  const [subscribed,   setSubscribed]   = useState(false);
  const [loading,      setLoading]      = useState(false);
  const [showUnsub,    setShowUnsub]    = useState(false);
  const [emailError,   setEmailError]   = useState("");
  const [phoneError,   setPhoneError]   = useState("");

  function validateEmail(val) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(val);
  }

  function validateIndianPhone(num) {
    // Indian mobile: 10 digits starting with 6, 7, 8, or 9
    const cleaned = num.replace(/[\s\-\(\)]/g, '');
    return /^[6-9]\d{9}$/.test(cleaned);
  }

  function handleEmailChange(e) {
    setEmail(e.target.value);
    if (emailError) setEmailError("");
  }

  function handlePhoneChange(e) {
    setPhone(e.target.value);
    if (phoneError) setPhoneError("");
  }

  async function handleSubscribe(e) {
    e.preventDefault();

    // Validate based on selected channel
    if (alertChannel === "email") {
      if (!validateEmail(email)) {
        setEmailError("Please enter a valid email address");
        return;
      }
    } else {
      if (!validateIndianPhone(phone)) {
        setPhoneError("Please enter a valid 10-digit Indian mobile number");
        return;
      }
    }

    setLoading(true);
    try {
      await subscribe({
        email:       alertChannel === "email" ? email : undefined,
        phone:       alertChannel === "sms" ? phone.replace(/[\s\-\(\)]/g, '') : undefined,
        alertChannel,
        location,
        threshold,
        userProfile: userProfile || { groups: ["general"] }
      });
      setSubscribed(true);
      toast.success(`Alerts enabled for ${location}! Check your ${alertChannel === "email" ? "inbox" : "phone"}.`);
    } catch (err) {
      toast.error(err.message || "Failed to subscribe. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleUnsubscribe() {
    setLoading(true);
    try {
      const identifier = alertChannel === "email" ? email : phone;
      await unsubscribe(identifier, location);
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
    const displayIdentifier = alertChannel === "email" ? email : `+91 ${phone}`;
    const channelName = alertChannel === "email" ? "email" : "SMS";
    
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
                {channelName} alerts activated for {location}
              </p>
              <p style={{ fontSize: "13px", color: "var(--text-muted)", marginTop: "2px" }}>
                You'll receive alerts at <strong>{displayIdentifier}</strong> when AQI exceeds {threshold}
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

          {/* Channel selector */}
          <div>
            <label style={{
              display:      "block",
              fontSize:     "13px",
              color:        "var(--text-muted)",
              marginBottom: "8px"
            }}>
              Alert me via
            </label>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                type="button"
                onClick={() => setAlertChannel("email")}
                style={{
                  flex:         1,
                  background:   alertChannel === "email" ? "var(--accent-green)" : "var(--bg-primary)",
                  border:       `1px solid ${alertChannel === "email" ? "var(--accent-green)" : "var(--border)"}`,
                  borderRadius: "8px",
                  padding:      "10px 14px",
                  color:        alertChannel === "email" ? "#000" : "var(--text-muted)",
                  fontWeight:   alertChannel === "email" ? "600" : "400",
                  fontSize:     "14px",
                  cursor:       "pointer",
                  transition:   "all 0.2s"
                }}
              >
                📧 Email
              </button>
              <button
                type="button"
                onClick={() => setAlertChannel("sms")}
                style={{
                  flex:         1,
                  background:   alertChannel === "sms" ? "var(--accent-green)" : "var(--bg-primary)",
                  border:       `1px solid ${alertChannel === "sms" ? "var(--accent-green)" : "var(--border)"}`,
                  borderRadius: "8px",
                  padding:      "10px 14px",
                  color:        alertChannel === "sms" ? "#000" : "var(--text-muted)",
                  fontWeight:   alertChannel === "sms" ? "600" : "400",
                  fontSize:     "14px",
                  cursor:       "pointer",
                  transition:   "all 0.2s"
                }}
              >
                📱 SMS
              </button>
            </div>
          </div>

          {/* Email input (shown when email selected) */}
          {alertChannel === "email" && (
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
          )}

          {/* Phone input (shown when SMS selected) */}
          {alertChannel === "sms" && (
            <div>
              <label htmlFor="alert-phone" style={{
                display:      "block",
                fontSize:     "13px",
                color:        "var(--text-muted)",
                marginBottom: "6px"
              }}>
                Mobile number (India)
              </label>
              <div style={{ position: "relative" }}>
                <span style={{
                  position:   "absolute",
                  left:       "14px",
                  top:        "50%",
                  transform:  "translateY(-50%)",
                  fontSize:   "14px",
                  color:      "var(--text-muted)",
                  fontWeight: "600"
                }}>
                  +91
                </span>
                <input
                  id="alert-phone"
                  type="tel"
                  value={phone}
                  onChange={handlePhoneChange}
                  placeholder="9876543210"
                  required
                  pattern="[6-9][0-9]{9}"
                  maxLength="10"
                  aria-invalid={!!phoneError}
                  aria-describedby={phoneError ? "phone-error" : undefined}
                  style={{
                    width:        "100%",
                    background:   "var(--bg-primary)",
                    border:       `1px solid ${phoneError ? "#ef4444" : "var(--border)"}`,
                    borderRadius: "8px",
                    padding:      "10px 14px 10px 48px",
                    color:        "var(--text-primary)",
                    fontSize:     "14px",
                    outline:      "none"
                  }}
                />
              </div>
              {phoneError && (
                <p id="phone-error" role="alert" style={{
                  fontSize: "12px", color: "#ef4444", marginTop: "4px"
                }}>
                  {phoneError}
                </p>
              )}
              <p style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
                SMS works on any phone, no internet needed. Costs ₹0.16 per message.
              </p>
            </div>
          )}

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
            disabled={loading || (alertChannel === "email" ? !email : !phone)}
            style={{
              background:    loading ? "var(--border)" : "var(--accent-green)",
              border:        "none",
              borderRadius:  "8px",
              padding:       "11px 20px",
              color:         "#000",
              fontWeight:    "600",
              fontSize:      "14px",
              cursor:        loading || (alertChannel === "email" ? !email : !phone) ? "not-allowed" : "pointer",
              display:       "flex",
              alignItems:    "center",
              justifyContent: "center",
              gap:           "8px",
              opacity:       (alertChannel === "email" ? !email : !phone) ? 0.5 : 1,
              transition:    "background 0.2s, opacity 0.2s"
            }}
          >
            {loading
              ? <><Loader size={14} className="spinning" /> Setting up alerts…</>
              : <><Bell size={14} /> Enable {alertChannel === "email" ? "Email" : "SMS"} Alerts</>
            }
          </button>

          <p style={{ fontSize: "11px", color: "var(--text-muted)", textAlign: "center" }}>
            {alertChannel === "email" 
              ? "You'll also receive a daily 7 AM summary. Alerts powered by AWS SNS."
              : "SMS alerts work on any phone without internet. Daily summary also available."
            }
          </p>
        </div>
      </form>
    </div>
  );
}
