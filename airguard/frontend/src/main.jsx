import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { Toaster } from "react-hot-toast";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 4000,
        style: {
          background: "#1e293b",
          color:      "#f1f5f9",
          border:     "1px solid #334155",
          borderRadius: "8px",
          fontSize:   "14px"
        },
        success: { iconTheme: { primary: "#10b981", secondary: "#0f172a" } },
        error:   { iconTheme: { primary: "#ef4444", secondary: "#0f172a" } }
      }}
    />
  </React.StrictMode>
);
