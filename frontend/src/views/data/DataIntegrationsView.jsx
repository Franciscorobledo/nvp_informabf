import React, { useMemo, useState } from "react";
import API_URL from "../../api";
import SectionHeader from "../../components/cards/SectionHeader";
import SkeletonBlock from "../../components/cards/SkeletonBlock";

const DataIntegrationsView = ({ onUnauthorized, onOpenMercadoLibre }) => {
  const token = useMemo(() => localStorage.getItem("token"), []);
  const [uploadStatus, setUploadStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const authorizedFetch = async (url, options = {}) => {
    const res = await fetch(url, {
      ...options,
      headers: {
        ...(options.headers || {}),
        Authorization: token ? `Bearer ${token}` : undefined,
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

  const handleUpload = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    const formData = new FormData(event.target);

    try {
      const data = await authorizedFetch(`${API_URL}/data/upload`, {
        method: "POST",
        body: formData,
      });
      setUploadStatus(data);
    } catch (err) {
      setError(err.message || "No se pudo subir los archivos");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="space-y-6">
      <SectionHeader title="Datos e integraciones" subtitle="Mercado Libre y archivos unificados" badge="Orígenes" />

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/70 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Mercado Libre</p>
              <p className="text-xs text-slate-500">Conecta y usa los tokens existentes</p>
            </div>
            <span className="rounded-full bg-emerald-100 text-emerald-700 px-3 py-1 text-xs font-semibold">OAuth activo</span>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Usa el flujo ya implementado para sincronizar órdenes y stock. Se guarda como fuente activa en el motor.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={onOpenMercadoLibre}
              className="rounded-xl bg-emerald-600 text-white px-4 py-2 text-sm font-semibold shadow hover:bg-emerald-700"
            >
              Conectar / revisar conexión
            </button>
            <button
              onClick={() => authorizedFetch(`${API_URL}/data/source`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ source: "mercadolibre" }),
              })}
              className="rounded-xl border border-slate-300 dark:border-slate-700 px-4 py-2 text-sm font-semibold"
            >
              Usar como fuente
            </button>
          </div>
        </div>

        <form
          onSubmit={handleUpload}
          className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/70 p-5 space-y-3"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Archivos</p>
              <p className="text-xs text-slate-500">Sube ventas y stock actuales</p>
            </div>
            {uploadStatus ? (
              <span className="rounded-full bg-blue-100 text-blue-700 px-3 py-1 text-xs font-semibold">
                Actualizado {new Date(uploadStatus.updated_at).toLocaleDateString()}
              </span>
            ) : (
              <span className="text-xs text-slate-400">Sin cargas</span>
            )}
          </div>

          <div className="grid gap-3 md:grid-cols-2 text-sm">
            <label className="space-y-1">
              <span className="font-semibold text-slate-700 dark:text-slate-200">Archivo de ventas</span>
              <input
                type="file"
                name="sales_file"
                accept=".csv,.xlsx,.xls"
                className="w-full rounded-xl border border-dashed border-slate-300 dark:border-slate-700 px-3 py-2"
              />
            </label>
            <label className="space-y-1">
              <span className="font-semibold text-slate-700 dark:text-slate-200">Archivo de stock</span>
              <input
                type="file"
                name="stock_file"
                accept=".csv,.xlsx,.xls"
                className="w-full rounded-xl border border-dashed border-slate-300 dark:border-slate-700 px-3 py-2"
              />
            </label>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-blue-600 text-white px-4 py-2 text-sm font-semibold shadow hover:bg-blue-700 disabled:opacity-60"
            >
              {loading ? "Subiendo..." : "Subir y usar"}
            </button>
            <p className="text-xs text-slate-500">Se guardan como fuente activa para ventas y stock</p>
          </div>

          {error && <p className="text-sm text-rose-600">{error}</p>}
        </form>
      </div>

      {loading && <SkeletonBlock className="h-16" />}
    </section>
  );
};

export default DataIntegrationsView;
