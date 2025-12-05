import API_URL from "../api";

const serializeDetails = (details) => {
  if (details === undefined || details === null) return undefined;
  if (typeof details === "string") return details;
  if (details?.stack) return details.stack;
  try {
    return JSON.stringify(details);
  } catch (err) {
    console.warn("No se pudo serializar el detalle del error", err);
    return String(details);
  }
};

export const logClientError = async ({
  level = "ERROR",
  message,
  details,
  path,
  user,
}) => {
  if (!message) return;

  const headers = {
    "Content-Type": "application/json",
  };

  const token = localStorage.getItem("token");
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let resolvedUser = user;
  if (!resolvedUser) {
    try {
      const storedUser = JSON.parse(localStorage.getItem("user"));
      resolvedUser = storedUser?.username || storedUser?.email || undefined;
    } catch (err) {
      console.warn("No se pudo leer el usuario almacenado", err);
    }
  }

  const payload = {
    source: "frontend",
    level: level?.toUpperCase() || "ERROR",
    message: message.toString(),
    details: serializeDetails(details),
    path: path || window.location.pathname,
    user: resolvedUser,
  };

  try {
    await fetch(`${API_URL}/admin/logs`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.warn("No se pudo enviar el log del cliente", err);
  }
};
