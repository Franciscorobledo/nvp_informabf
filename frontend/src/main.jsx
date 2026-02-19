import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import ShortsStudio from "./ShortsStudio.jsx";
import "./index.css";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import { registerGlobalErrorHandlers } from "./api";

registerGlobalErrorHandlers();

const isShortsStudio = typeof window !== "undefined" && window.location.pathname.includes("shorts-studio");

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>{isShortsStudio ? <ShortsStudio /> : <App />}</ErrorBoundary>
  </React.StrictMode>
);
