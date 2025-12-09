export const fetchWithAuth = async (url, options = {}) => {
  const { onUnauthorized, ...fetchOptions } = options;
  const token = localStorage.getItem("token");
  const hasCustomContentType =
    fetchOptions.body instanceof FormData ||
    Boolean(fetchOptions.headers && fetchOptions.headers["Content-Type"]);
  const contentTypeHeader = hasCustomContentType
    ? {}
    : { "Content-Type": "application/json" };

  const res = await fetch(url, {
    ...fetchOptions,
    headers: {
      ...contentTypeHeader,
      ...(fetchOptions.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (res.status === 401 || res.status === 403) {
    onUnauthorized?.("Tu sesión expiró. Vuelve a iniciar sesión.");
    throw new Error("unauthorized");
  }

  if (!res.ok) {
    let message = "Error en la petición";
    try {
      const data = await res.clone().json();
      message = data?.detail || data?.message || message;
    } catch (jsonError) {
      try {
        const text = await res.text();
        message = text || message;
      } catch (textError) {
        message = jsonError?.message || message;
      }
    }
    throw new Error(message);
  }

  return res.json();
};

export default fetchWithAuth;
