// Detecta si estás en desarrollo (npm run dev)
const metaEnv = typeof import.meta !== "undefined" && import.meta.env ? import.meta.env : {};
const isDev = metaEnv.MODE === "development";

// Backend local
const LOCAL_API = "http://localhost:1000";

// Backend producción (Render)
const PROD_API = "https://nvp-informabf.onrender.com";

// Usa VITE_API_URL si existe; si no, detecta entorno automáticamente
const API_URL = metaEnv.VITE_API_URL || (isDev ? LOCAL_API : PROD_API);

export default API_URL;

