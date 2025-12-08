import React, { useEffect, useState } from "react";
import API_URL from "../api";

const MercadoPagoTokenCard = ({ onUnauthorized }) => {
  const [accessToken, setAccessToken] = useState("");
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const parseError = async (response, fallback = "Ocurrió un error") => {
    try {
      const body = await response.json();
      return body?.detail || body?.message || fallback;
    } catch (err) {
      console.warn("No se pudo parsear el error", err);
      return fallback;
    }
  };

  const fetchStatus = async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      onUnauthorized?.("Tu sesión expiró. Inicia sesión nuevamente.");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(`${API_URL}/subscriptions/admin/mercadopago/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        if ([401, 403].includes(response.status)) {
          const detail = await parseError(response, "No autorizado");
          onUnauthorized?.(detail);
          throw new Error(detail);
        }
        throw new Error(await parseError(response));
      }

      setStatus(await response.json());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const saveToken = async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      onUnauthorized?.("Tu sesión expiró. Inicia sesión nuevamente.");
      return;
    }

    setSaving(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch(`${API_URL}/subscriptions/admin/mercadopago/token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ access_token: accessToken }),
      });

      if (!response.ok) {
        if ([401, 403].includes(response.status)) {
          const detail = await parseError(response, "No autorizado");
          onUnauthorized?.(detail);
          throw new Error(detail);
        }
        throw new Error(await parseError(response, "No se pudo guardar el token"));
      }

      setMessage("Token actualizado correctamente. Ya puedes iniciar el flujo de pago.");
      setAccessToken("");
      fetchStatus();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const badge = status?.access_token_present ? (
    <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-100">
      ✅ Token detectado
    </span>
  ) : (
    <span className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-100">
      ⚠️ Falta configurar el token
    </span>
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Token de Mercado Pago</h3>
          <p className="text-sm text-gray-600 dark:text-slate-300">
            Configura el access token para habilitar el flujo de suscripción completo.
          </p>
        </div>
        {status && badge}
      </div>

      {message && <div className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</div>}
      {error && <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <label className="text-sm font-medium text-slate-900 dark:text-slate-100" htmlFor="mp-token">
          Access token
        </label>
        <input
          id="mp-token"
          type="password"
          placeholder="APP_USR-..."
          className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-800"
          value={accessToken}
          onChange={(e) => setAccessToken(e.target.value)}
        />
        <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
          <span>{loading ? "Consultando estado..." : "Los cambios se aplican al instante."}</span>
          <button
            onClick={saveToken}
            disabled={saving || !accessToken}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700 disabled:opacity-60"
          >
            {saving ? "Guardando..." : "Guardar token"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MercadoPagoTokenCard;
