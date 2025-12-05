import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";
import { logClientError } from "./services/logService";

const registerGlobalErrorHandlers = () => {
  const serializeError = (value) => {
    if (!value) return undefined;
    if (value.stack) return value.stack;
    if (value.message) return value.message;
    try {
      return JSON.stringify(value);
    } catch (err) {
      console.warn("No se pudo serializar el error", err);
      return String(value);
    }
  };

  const safeLog = async (payload) => {
    try {
      await logClientError(payload);
    } catch (err) {
      console.warn("No se pudo registrar el error de frontend", err);
    }
  };

  window.onerror = (message, source, lineno, colno, error) => {
    safeLog({
      level: "ERROR",
      message: message?.toString?.() || "Error no controlado",
      details: serializeError(error),
      path: window.location.pathname,
    });
  };

  window.onunhandledrejection = (event) => {
    const reason = event?.reason;
    safeLog({
      level: "ERROR",
      message:
        reason?.message ||
        reason?.toString?.() ||
        "Promesa rechazada sin capturar",
      details: serializeError(reason),
      path: window.location.pathname,
    });
  };
};

registerGlobalErrorHandlers();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
