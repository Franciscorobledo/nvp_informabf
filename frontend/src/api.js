// Detecta si estás en desarrollo (npm run dev)
const metaEnv = typeof import.meta !== "undefined" && import.meta.env ? import.meta.env : {};
const isDev = metaEnv.MODE === "development";

// Backend local
const LOCAL_API = "http://localhost:1000";

// Backend producción (Render)
// Usamos el dominio principal desplegado actualmente; el endpoint anterior se
// mantiene como respaldo por si se reactiva en el futuro.
const RENDER_BACKEND = "https://nvp-informabf.onrender.com";
const LEGACY_RENDER_BACKEND = "https://nvp-informabf-backend-wxbb.onrender.com";

const deriveBackendFromHostname = () => {
  if (typeof window === "undefined") return "";

  const { hostname } = window.location;
  if (hostname.includes("front")) {
    return `https://${hostname.replace("front", "backend")}`;
  }

  return "";
};

// Usa VITE_API_URL si existe; si no, detecta entorno automáticamente.
// En producción preferimos el backend desplegado en Render; si se define
// VITE_API_URL se respeta, y solo recurrimos al dominio heredado como último
// recurso. Esto evita intentar derivar un host inexistente cuando el front
// está publicado con un subdominio distinto.
const PROD_API =
  metaEnv.VITE_API_URL ||
  RENDER_BACKEND ||
  LEGACY_RENDER_BACKEND ||
  deriveBackendFromHostname();

const API_URL = isDev ? LOCAL_API : PROD_API;

let globalHandlersRegistered = false;

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

const sendClientLog = async ({ level = "ERROR", message, details, path }) => {
  if (!message) return;

  const headers = {
    "Content-Type": "application/json",
  };

  const token = localStorage.getItem("token");
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let user;
  try {
    const storedUser = JSON.parse(localStorage.getItem("user"));
    user = storedUser?.username || storedUser?.email;
  } catch (err) {
    console.warn("No se pudo leer el usuario almacenado", err);
  }

  try {
    await fetch(`${API_URL}/admin/logs`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        source: "frontend",
        level: level?.toUpperCase() || "ERROR",
        message: message.toString(),
        details,
        path: path || window.location.pathname,
        user,
      }),
    });
  } catch (err) {
    console.warn("No se pudo enviar el log del cliente", err);
  }
};

export const registerGlobalErrorHandlers = () => {
  if (typeof window === "undefined" || globalHandlersRegistered) return;
  globalHandlersRegistered = true;

  window.onerror = (message, source, lineno, colno, error) => {
    sendClientLog({
      level: "ERROR",
      message: message?.toString?.() || "Error no controlado",
      details: serializeError(error),
      path: window.location.pathname,
    });
  };

  window.onunhandledrejection = (event) => {
    const reason = event?.reason;
    sendClientLog({
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

export default API_URL;

