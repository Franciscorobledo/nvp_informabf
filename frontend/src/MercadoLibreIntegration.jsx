import React, { useEffect, useMemo, useState } from "react";
import API_URL from "./api";
import { MERCADO_LIBRE_APP_ALIAS } from "./constants/mercadoLibre";

const MercadoLibreIntegration = ({ onUnauthorized }) => {
  const [appAlias] = useState(MERCADO_LIBRE_APP_ALIAS);
  const [connection, setConnection] = useState(null);
  const [seller, setSeller] = useState(null);
  const [syncMessage, setSyncMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastSync, setLastSync] = useState(null);
  const [syncData, setSyncData] = useState(null);
  const token = useMemo(() => localStorage.getItem("token"), []);

  const authorizedFetch = async (url, options = {}) => {
    const res = await fetch(url, {
      ...options,
      headers: {
        ...(options.headers || {}),
        Authorization: `Bearer ${token}`,
        "Content-Type": options.body instanceof FormData ? undefined : "application/json",
      },
    });

    if (res.status === 401 || res.status === 403) {
      onUnauthorized?.("Tu sesión expiró. Vuelve a iniciar sesión.");
      throw new Error("unauthorized");
    }

    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || "Error en la petición");
    }

    return res.json();
  };

  const loadStatus = async () => {
    try {
      const data = await authorizedFetch(
        `${API_URL}/meli/status?app_alias=${encodeURIComponent(appAlias.trim())}`
      );
      if (data) {
        setConnection(data);
      } else {
        setConnection(null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const handleConnect = async () => {
    setError("");
    setSyncMessage("");
    try {
      const data = await authorizedFetch(
        `${API_URL}/meli/auth?app_alias=${encodeURIComponent(appAlias.trim())}`
      );
      if (data.authorization_url) {
        window.open(data.authorization_url, "_blank", "noopener,noreferrer");
        setSyncMessage("Abre la pestaña de Mercado Libre, acepta y vuelve para sincronizar.");
      }
    } catch (err) {
      setError(err.message || "No se pudo iniciar el proceso de conexión");
    }
  };

  const handleSync = async () => {
    setLoading(true);
    setError("");
    setSyncMessage("");
    try {
      const data = await authorizedFetch(
        `${API_URL}/meli/sync?app_alias=${encodeURIComponent(appAlias.trim())}`
      );
      setSeller(data.seller);
      setSyncData(data);
      setLastSync(data.last_sync || new Date().toISOString());
      setConnection((prev) =>
        prev
          ? { ...prev, seller_id: data?.seller?.id || prev.seller_id, nickname: data?.seller?.nickname || prev.nickname }
          : prev
      );
      setSyncMessage("Sincronización completada");
    } catch (err) {
      setError(err.message || "No se pudo sincronizar");
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!appAlias.trim()) return;
    try {
      await authorizedFetch(`${API_URL}/meli/disconnect`, {
        method: "POST",
        body: JSON.stringify({ app_alias: appAlias.trim() }),
      });
      setConnection(null);
      setSeller(null);
      setSyncData(null);
      setLastSync(null);
      setSyncMessage("Integración desconectada");
    } catch (err) {
      setError(err.message || "No se pudo desconectar");
    }
  };

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide">Integraciones</p>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Mercado Libre</h2>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Conecta tu tienda con OAuth. Solo necesitas el alias que configuró el administrador.
        </p>
      </header>

      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/70 shadow-sm p-5 space-y-4">
        <div className="grid gap-4 sm:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-3">
            <label className="space-y-1 block">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-200">Alias de la app</span>
              <input
                value={appAlias}
                readOnly
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/60 px-3 py-2 text-sm text-slate-600"
              />
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Alias fijo configurado por el administrador.</p>
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={handleConnect}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 text-white px-5 py-2.5 text-sm font-semibold shadow hover:-translate-y-0.5 transition"
              >
                Conectar Mercado Libre
              </button>
              <button
                onClick={handleConnect}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200"
              >
                Conectar con QR
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 bg-slate-50/70 dark:bg-slate-800/60">
            {connection ? (
              <div className="space-y-1">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">Cuenta conectada</p>
                <p className="text-xs text-slate-600 dark:text-slate-300">Seller: {connection.nickname || connection.seller_id || "por sincronizar"}</p>
                <p className="text-xs text-slate-600 dark:text-slate-300">Última sincronización: {lastSync ? new Date(lastSync).toLocaleString() : "pendiente"}</p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">No tienes Mercado Libre conectado</p>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  Usa el botón conectar para iniciar el flujo OAuth.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleSync}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 text-white px-4 py-2 text-sm font-semibold shadow hover:-translate-y-0.5 transition disabled:opacity-60"
          >
            {loading ? "Sincronizando..." : "Sincronizar vendedor"}
          </button>
          <button
            onClick={handleSync}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 dark:border-slate-700 px-4 py-2 text-sm font-semibold text-slate-800 dark:text-slate-200"
          >
            Ver ventas
          </button>
          <button
            onClick={handleSync}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 dark:border-slate-700 px-4 py-2 text-sm font-semibold text-slate-800 dark:text-slate-200"
          >
            Ver stock
          </button>
          <button
            onClick={handleDisconnect}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-500 text-white px-4 py-2 text-sm font-semibold shadow hover:-translate-y-0.5 transition"
          >
            Desconectar
          </button>
        </div>

        {syncMessage && <p className="text-sm text-emerald-600 dark:text-emerald-300">{syncMessage}</p>}
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        {syncData && (
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 bg-slate-50/70 dark:bg-slate-800/60">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">Vendedor</p>
              <p className="text-xs text-slate-600 dark:text-slate-300">{seller?.nickname || seller?.id || "-"}</p>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 bg-slate-50/70 dark:bg-slate-800/60">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">Órdenes</p>
              <p className="text-xs text-slate-600 dark:text-slate-300">{(syncData.orders?.results || syncData.orders?.orders || []).length || syncData.orders?.results?.length || 0} recibidas</p>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 bg-slate-50/70 dark:bg-slate-800/60">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">Stock</p>
              <p className="text-xs text-slate-600 dark:text-slate-300">{(syncData.inventory?.active?.item_ids || []).length} activos</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MercadoLibreIntegration;
