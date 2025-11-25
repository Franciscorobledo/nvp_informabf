const decodeSegment = (segment) => {
  try {
    const normalized = segment.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(normalized.length + (4 - (normalized.length % 4)) % 4, "=");
    return JSON.parse(atob(padded));
  } catch (err) {
    console.warn("No se pudo decodificar el token JWT", err);
    return null;
  }
};

export const decodeTokenPayload = (token) => {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length < 2) return null;
  return decodeSegment(parts[1]);
};

export const isTokenExpired = (token) => {
  const payload = decodeTokenPayload(token);
  if (!payload?.exp) return false;
  const expirationMs = payload.exp * 1000;
  return Date.now() >= expirationMs;
};

export const clearStoredSession = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
};

export const persistUserSession = (token, user) => {
  localStorage.setItem("token", token);
  localStorage.setItem("user", JSON.stringify(user));
};

