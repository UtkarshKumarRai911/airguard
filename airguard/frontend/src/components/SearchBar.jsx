import React, { useState, useRef, useEffect, useCallback } from "react";
import { Search, Loader, MapPin, Navigation } from "lucide-react";
import { searchStations } from "../utils/api";

// ── All major Indian cities — every state covered ────────────────────────────
const QUICK_CITIES = [
  // North India
  "Delhi", "Noida", "Gurgaon", "Faridabad", "Ghaziabad",
  "Agra", "Lucknow", "Kanpur", "Varanasi", "Prayagraj",
  "Meerut", "Bareilly", "Aligarh", "Moradabad", "Saharanpur",
  "Gorakhpur", "Mathura", "Firozabad", "Rampur",
  // Himachal & Uttarakhand
  "Shimla", "Manali", "Dehradun", "Haridwar", "Rishikesh", "Mussoorie",
  // Punjab & Haryana
  "Chandigarh", "Amritsar", "Ludhiana", "Jalandhar", "Patiala",
  "Ambala", "Hisar", "Rohtak", "Panipat", "Karnal",
  // Rajasthan
  "Jaipur", "Jodhpur", "Udaipur", "Ajmer", "Kota",
  "Bikaner", "Alwar", "Bharatpur", "Bhilwara", "Sikar",
  // Madhya Pradesh
  "Bhopal", "Indore", "Jabalpur", "Gwalior", "Ujjain",
  "Rewa", "Sagar", "Satna", "Ratlam", "Dewas",
  // Gujarat
  "Ahmedabad", "Surat", "Vadodara", "Rajkot", "Gandhinagar",
  "Bhavnagar", "Jamnagar", "Junagadh", "Anand", "Morbi",
  // Maharashtra
  "Mumbai", "Pune", "Nagpur", "Nashik", "Aurangabad",
  "Solapur", "Kolhapur", "Amravati", "Nanded", "Thane",
  "Navi Mumbai", "Kalyan", "Vasai",
  // Bihar & Jharkhand
  "Patna", "Gaya", "Muzaffarpur", "Bhagalpur", "Darbhanga",
  "Ranchi", "Jamshedpur", "Dhanbad", "Bokaro", "Hazaribagh",
  // West Bengal
  "Kolkata", "Howrah", "Asansol", "Durgapur", "Siliguri",
  "Bardhaman", "Malda", "Haldia",
  // Odisha
  "Bhubaneswar", "Cuttack", "Rourkela", "Puri", "Berhampur",
  // Chhattisgarh
  "Raipur", "Bhilai", "Bilaspur", "Korba",
  // Telangana & Andhra Pradesh
  "Hyderabad", "Warangal", "Nizamabad", "Karimnagar",
  "Visakhapatnam", "Vijayawada", "Tirupati", "Guntur", "Kakinada",
  // Karnataka
  "Bangalore", "Mysore", "Hubli", "Mangalore", "Belgaum",
  "Gulbarga", "Davangere", "Shimoga", "Tumkur",
  // Tamil Nadu
  "Chennai", "Coimbatore", "Madurai", "Salem", "Tiruchirappalli",
  "Tirunelveli", "Erode", "Vellore", "Thoothukudi",
  // Kerala
  "Thiruvananthapuram", "Kochi", "Kozhikode", "Thrissur",
  "Kollam", "Palakkad", "Alappuzha", "Kannur",
  // Northeast
  "Guwahati", "Dibrugarh", "Silchar", "Jorhat",
  "Imphal", "Shillong", "Agartala", "Aizawl",
  // Goa
  "Panaji", "Vasco da Gama", "Margao",
  // J&K & Ladakh
  "Jammu", "Srinagar", "Leh",
  // Union Territories
  "Puducherry", "Port Blair", "Daman", "Silvassa"
];

// ── Reverse geocode lat/lon → nearest city name ──────────────────────────────
// Uses the free OpenStreetMap Nominatim API — no key required
async function reverseGeocode(lat, lon) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=en`;
    const res = await fetch(url, {
      headers: { "User-Agent": "AirGuard/1.0" }
    });
    const data = await res.json();
    const addr = data.address || {};

    // Priority: city → town → village → county → state
    const city =
      addr.city ||
      addr.town ||
      addr.municipality ||
      addr.village ||
      addr.county ||
      addr.state_district ||
      addr.state;

    return city || null;
  } catch (err) {
    console.warn("Reverse geocode failed:", err.message);
    return null;
  }
}

export default function SearchBar({ onSearch, loading, currentLocation }) {
  const [query,        setQuery]        = useState("");
  const [suggestions,  setSuggestions]  = useState([]);
  const [sugLoading,   setSugLoading]   = useState(false);
  const [showSug,      setShowSug]      = useState(false);
  const [geoLoading,   setGeoLoading]   = useState(false);
  const [geoError,     setGeoError]     = useState("");
  const [showAllCities, setShowAllCities] = useState(false);

  const debounceRef  = useRef(null);
  const inputRef     = useRef(null);
  const containerRef = useRef(null);

  // Show only first 20 quick cities by default, all when expanded
  const visibleCities = showAllCities ? QUICK_CITIES : QUICK_CITIES.slice(0, 20);

  // Close suggestions on outside click
  useEffect(() => {
    function handleClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShowSug(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const fetchSuggestions = useCallback(async (q) => {
    if (q.length < 2) { setSuggestions([]); return; }
    setSugLoading(true);
    try {
      const results = await searchStations(q);
      setSuggestions(results.slice(0, 8));
    } catch {
      setSuggestions([]);
    } finally {
      setSugLoading(false);
    }
  }, []);

  function handleInput(e) {
    const val = e.target.value;
    setQuery(val);
    setShowSug(true);
    setGeoError("");
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(val), 350);
  }

  function handleSubmit(e) {
    e.preventDefault();
    const loc = query.trim();
    if (!loc) return;
    setShowSug(false);
    onSearch(loc);
  }

  function handleSelect(name) {
    setQuery(name);
    setShowSug(false);
    onSearch(name);
  }

  function handleKeyDown(e) {
    if (e.key === "Escape") { setShowSug(false); inputRef.current?.blur(); }
  }

  // ── Get My Location ─────────────────────────────────────────────────────────
  async function handleGetMyLocation() {
    if (!navigator.geolocation) {
      setGeoError("Geolocation is not supported by your browser.");
      return;
    }

    setGeoLoading(true);
    setGeoError("");

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        console.log(`Got coordinates: ${latitude}, ${longitude}`);

        try {
          // Reverse geocode to get city name via OpenStreetMap Nominatim (free, no key)
          const city = await reverseGeocode(latitude, longitude);

          if (city) {
            setQuery(city);
            onSearch(city);
          } else {
            setGeoError("Could not determine your city. Try searching manually.");
          }
        } catch (err) {
          setGeoError("Could not determine your location. Try searching manually.");
        } finally {
          setGeoLoading(false);
        }
      },
      (err) => {
        setGeoLoading(false);
        switch (err.code) {
          case err.PERMISSION_DENIED:
            setGeoError("Location permission denied. Please allow access and try again.");
            break;
          case err.POSITION_UNAVAILABLE:
            setGeoError("Location unavailable. Try searching your city manually.");
            break;
          case err.TIMEOUT:
            setGeoError("Location request timed out. Try again.");
            break;
          default:
            setGeoError("Could not get your location.");
        }
      },
      { timeout: 10000, maximumAge: 60000, enableHighAccuracy: false }
    );
  }

  return (
    <div style={{ width: "100%" }}>

      {/* ── Search form ──────────────────────────────────────────────────── */}
      <form onSubmit={handleSubmit} ref={containerRef} style={{ position: "relative" }}>
        <div style={{
          display:      "flex",
          alignItems:   "center",
          background:   "var(--bg-secondary)",
          border:       "1px solid var(--border)",
          borderRadius: "var(--radius)",
          padding:      "4px 4px 4px 16px",
          gap:          "8px",
          boxShadow:    "var(--shadow)"
        }}>
          <Search size={18} color="var(--text-muted)" aria-hidden="true" />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            onFocus={() => query.length >= 2 && setShowSug(true)}
            placeholder="Search any city, district or area in India…"
            aria-label="Search for a location"
            autoComplete="off"
            style={{
              flex:       1,
              background: "transparent",
              border:     "none",
              outline:    "none",
              color:      "var(--text-primary)",
              fontSize:   "16px",
              padding:    "8px 0"
            }}
          />

          {/* Get My Location button */}
          <button
            type="button"
            onClick={handleGetMyLocation}
            disabled={geoLoading || loading}
            title="Use my current location"
            aria-label="Use my current location"
            style={{
              background:   geoLoading ? "var(--border)" : "rgba(59,130,246,0.15)",
              border:       "1px solid rgba(59,130,246,0.4)",
              borderRadius: "8px",
              padding:      "8px 12px",
              color:        geoLoading ? "var(--text-muted)" : "#60a5fa",
              fontSize:     "13px",
              fontWeight:   "600",
              display:      "flex",
              alignItems:   "center",
              gap:          "5px",
              cursor:       geoLoading ? "not-allowed" : "pointer",
              transition:   "all 0.2s",
              whiteSpace:   "nowrap"
            }}
            onMouseEnter={e => {
              if (!geoLoading) e.currentTarget.style.background = "rgba(59,130,246,0.25)";
            }}
            onMouseLeave={e => {
              if (!geoLoading) e.currentTarget.style.background = "rgba(59,130,246,0.15)";
            }}
          >
            {geoLoading
              ? <><Loader size={13} className="spinning" /> Locating…</>
              : <><Navigation size={13} /> My Location</>
            }
          </button>

          {/* Search button */}
          <button
            type="submit"
            disabled={loading || !query.trim()}
            aria-label="Search"
            style={{
              background:     loading ? "var(--border)" : "var(--accent-green)",
              border:         "none",
              borderRadius:   "8px",
              padding:        "10px 20px",
              color:          "#000",
              fontSize:       "14px",
              fontWeight:     "600",
              display:        "flex",
              alignItems:     "center",
              gap:            "6px",
              opacity:        (!query.trim() && !loading) ? 0.5 : 1,
              cursor:         loading || !query.trim() ? "not-allowed" : "pointer",
              transition:     "background 0.2s, opacity 0.2s",
              minWidth:       "100px",
              justifyContent: "center"
            }}
          >
            {loading
              ? <><Loader size={14} className="spinning" /> Fetching…</>
              : <>Check AQI</>
            }
          </button>
        </div>

        {/* Geolocation error */}
        {geoError && (
          <p style={{
            fontSize: "12px", color: "#f87171", marginTop: "6px", paddingLeft: "4px"
          }}>
            ⚠️ {geoError}
          </p>
        )}

        {/* Autocomplete dropdown */}
        {showSug && (suggestions.length > 0 || sugLoading) && (
          <div
            role="listbox"
            aria-label="Station suggestions"
            style={{
              position:     "absolute",
              top:          "calc(100% + 4px)",
              left:         0,
              right:        0,
              background:   "var(--bg-secondary)",
              border:       "1px solid var(--border)",
              borderRadius: "var(--radius)",
              overflow:     "hidden",
              zIndex:       50,
              boxShadow:    "var(--shadow)"
            }}
          >
            {sugLoading && (
              <div style={{ padding: "12px 16px", color: "var(--text-muted)", fontSize: "13px" }}>
                Searching stations…
              </div>
            )}
            {suggestions.map((s, i) => (
              <button
                key={s.uid || i}
                role="option"
                onClick={() => handleSelect(s.name)}
                style={{
                  width:        "100%",
                  display:      "flex",
                  alignItems:   "center",
                  gap:          "10px",
                  padding:      "11px 16px",
                  background:   "transparent",
                  border:       "none",
                  borderBottom: i < suggestions.length - 1 ? "1px solid var(--border)" : "none",
                  color:        "var(--text-primary)",
                  fontSize:     "14px",
                  textAlign:    "left",
                  cursor:       "pointer"
                }}
                onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              >
                <MapPin size={13} color="var(--text-muted)" />
                <span style={{ flex: 1 }}>{s.name}</span>
                {s.aqi && s.aqi !== "-" && (
                  <span style={{
                    fontSize:   "12px",
                    color:      s.aqi <= 100 ? "#10b981" : s.aqi <= 200 ? "#f59e0b" : "#ef4444",
                    fontWeight: "600"
                  }}>
                    AQI {s.aqi}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </form>

      {/* ── Quick city grid — shown before any search ─────────────────────── */}
      {!currentLocation && (
        <div style={{ marginTop: "16px" }}>
          <div style={{
            display:        "flex",
            alignItems:     "center",
            justifyContent: "space-between",
            marginBottom:   "10px"
          }}>
            <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>
              Quick select — {QUICK_CITIES.length} cities across India:
            </p>
            <button
              onClick={() => setShowAllCities(v => !v)}
              style={{
                background:   "transparent",
                border:       "1px solid var(--border)",
                borderRadius: "6px",
                padding:      "3px 10px",
                color:        "var(--text-muted)",
                fontSize:     "11px",
                cursor:       "pointer"
              }}
            >
              {showAllCities ? "Show less ▲" : `Show all ${QUICK_CITIES.length} ▼`}
            </button>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "7px" }}>
            {visibleCities.map(city => (
              <button
                key={city}
                onClick={() => { setQuery(city); onSearch(city); }}
                style={{
                  background:   "var(--bg-secondary)",
                  border:       "1px solid var(--border)",
                  borderRadius: "20px",
                  padding:      "5px 13px",
                  color:        "var(--text-muted)",
                  fontSize:     "12px",
                  cursor:       "pointer",
                  transition:   "all 0.15s"
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = "var(--accent-green)";
                  e.currentTarget.style.color = "var(--accent-green)";
                  e.currentTarget.style.background = "rgba(16,185,129,0.06)";
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = "var(--border)";
                  e.currentTarget.style.color = "var(--text-muted)";
                  e.currentTarget.style.background = "var(--bg-secondary)";
                }}
              >
                {city}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
