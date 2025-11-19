// Detecta si estás en desarrollo (npm run dev)
const isDev = import.meta.env.MODE === "development";

// Backend local
const LOCAL_API = "http://localhost:1000";

// Backend producción (Render)
const PROD_API = "https://nvp-informabf.onrender.com";

// Usa VITE_API_URL si existe; si no, detecta entorno automáticamente
const API_URL =
  import.meta.env.VITE_API_URL ||
  (isDev ? LOCAL_API : PROD_API);

export default API_URL;

