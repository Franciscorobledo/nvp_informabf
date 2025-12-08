import React, { useEffect, useState } from "react";
import API_URL from "../../api.js";
import SectionHeader from "../../components/cards/SectionHeader";
import SkeletonBlock from "../../components/cards/SkeletonBlock";
import { handleUploadSubmission } from "./uploadHelpers";

const SALES_STANDARD_FIELDS = ["date", "sku", "product_name", "quantity", "unit_price", "total", "channel"];
const STOCK_STANDARD_FIELDS = ["sku", "product_name", "category", "current_stock", "unit_cost", "location", "channel"];

const DataIntegrationsView = ({ onUnauthorized, onOpenMercadoLibre }) => {
  const [token, setToken] = useState(() => localStorage.getItem("token"));
  const [uploadStatus, setUploadStatus] = useState(null);
  const [datasets, setDatasets] = useState([]);
  const [unmappedColumns, setUnmappedColumns] = useState([]);
  const [remapSelections, setRemapSelections] = useState({});
  const [showRemapDialog, setShowRemapDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectingSource, setSelectingSource] = useState(false);

  useEffect(() => {
    const handleStorage = () => setToken(localStorage.getItem("token"));
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const authorizedFetch = async (url, options = {}) => {
    const res = await fetch(url, {
      ...options,
      headers: {
        ...(options.headers || {}),
        Authorization: token ? `Bearer ${token}` : undefined,
      },
    });

    const resClone = res.clone();
    let payload = null;

    try {
      payload = await res.json();
    } catch (err) {
      payload = null;
    }

    if (res.status === 401 || res.status === 403) {
      onUnauthorized?.("Tu sesión expiró. Vuelve a iniciar sesión.");
      throw new Error("unauthorized");
    }

    if (!res.ok) {
      const detail = payload?.message || payload?.detail;
      if (detail) {
        throw new Error(detail);
      }

      const fallbackText = await resClone.text().catch(() => "");
      throw new Error(fallbackText || "Error en la petición");
    }

    if (payload !== null) {
      return payload;
    }

    return resClone.text();
  };

  const downloadSample = async (type) => {
    setError("");
    try {
      const res = await fetch(`${API_URL}/data/sample/${type}`, {
        headers: {
          Authorization: token ? `Bearer ${token}` : undefined,
        },
      });

      if (res.status === 401 || res.status === 403) {
        onUnauthorized?.("Tu sesión expiró. Vuelve a iniciar sesión.");
        throw new Error("unauthorized");
      }

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "No se pudo descargar el ejemplo");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = type === "sales" ? "ejemplo_ventas.csv" : "ejemplo_stock.csv";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      if (err.message !== "unauthorized") {
        setError(err.message || "No se pudo descargar el ejemplo");
      }
    }
  };

  const handleUpload = async (event) =>
    handleUploadSubmission(event, {
      authorizedFetch,
      setLoading,
      setError,
      setUploadStatus,
      setDatasets,
      setUnmappedColumns,
    });
  
  const handleUseMercadoLibreSource = async () => {
    setError("");
    setSelectingSource(true);

    try {
      const data = await authorizedFetch(`${API_URL}/data/source`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: "mercadolibre", credential_id: 0 }),
      });

      setUploadStatus({ ...data, updated_at: data.updated_at || new Date().toISOString() });
      setDatasets([]);
    } catch (err) {
      if (err.message !== "unauthorized") {
        setError(err.message || "No se pudo activar MercadoLibre como fuente");
      }
    } finally {
      setSelectingSource(false);
    }
  };

  const handleOpenRemap = () => {
    const initialSelections = {};
    unmappedColumns.forEach((item) => {
      initialSelections[`${item.dataset}:${item.column}`] = "";
    });
    setRemapSelections(initialSelections);
    setShowRemapDialog(true);
  };

  const handleSelectionChange = (dataset, column, value) => {
    setRemapSelections((prev) => ({ ...prev, [`${dataset}:${column}`]: value }));
  };

  const handleSubmitRemap = async () => {
    const groupedMappings = {};
    Object.entries(remapSelections).forEach(([key, standard]) => {
      if (!standard) return;
      const [dataset, column] = key.split(":");
      if (!groupedMappings[dataset]) groupedMappings[dataset] = {};
      groupedMappings[dataset][standard] = column;
    });

    if (Object.keys(groupedMappings).length === 0) {
      setError("Selecciona a qué campo estándar corresponde cada columna");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const responses = await Promise.all(
        Object.entries(groupedMappings).map(([dataset, mapping]) =>
          authorizedFetch(`${API_URL}/data/remap`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ dataset, mapping }),
          }),
        ),
      );

      const remainingUnmapped = responses.flatMap((res) => res?.unmapped_columns || []);
      setUnmappedColumns(remainingUnmapped);
      setShowRemapDialog(false);
      setUploadStatus((prev) => ({ ...(prev || {}), updated_at: new Date().toISOString() }));
    } catch (err) {
      if (err.message !== "unauthorized") {
        setError(err.message || "No se pudo actualizar el mapeo");
      }
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
              onClick={handleUseMercadoLibreSource}
              disabled={selectingSource}
              className="rounded-xl border border-slate-300 dark:border-slate-700 px-4 py-2 text-sm font-semibold disabled:opacity-60"
            >
              {selectingSource ? "Activando..." : "Usar como fuente"}
            </button>
          </div>
        </div>

        <form
          onSubmit={handleUpload}
          encType="multipart/form-data"
          className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/70 p-5 space-y-3"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Archivos</p>
              <p className="text-xs text-slate-500">Sube ventas y stock actuales</p>
            </div>
            {uploadStatus ? (
              <span className="rounded-full bg-blue-100 text-blue-700 px-3 py-1 text-xs font-semibold">
                Actualizado {new Date(uploadStatus.updated_at || Date.now()).toLocaleDateString()}
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
                multiple
                className="w-full rounded-xl border border-dashed border-slate-300 dark:border-slate-700 px-3 py-2"
              />
              <button
                type="button"
                onClick={() => downloadSample("sales")}
                className="text-xs text-blue-600 hover:text-blue-700"
              >
                Descargar ejemplo (CSV)
              </button>
            </label>
            <label className="space-y-1">
              <span className="font-semibold text-slate-700 dark:text-slate-200">Archivo de stock</span>
              <input
                type="file"
                name="stock_file"
                accept=".csv,.xlsx,.xls"
                multiple
                className="w-full rounded-xl border border-dashed border-slate-300 dark:border-slate-700 px-3 py-2"
              />
              <button
                type="button"
                onClick={() => downloadSample("stock")}
                className="text-xs text-blue-600 hover:text-blue-700"
              >
                Descargar ejemplo (CSV)
              </button>
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

      {datasets.length > 0 && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/70 p-5 space-y-3">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Mapeo inteligente (IA)</p>
          <div className="grid gap-3 md:grid-cols-2">
            {datasets.map((ds, idx) => (
              <div
                key={`${ds.type}-${idx}`}
                className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold capitalize">{ds.type}</span>
                  <span className="text-xs text-slate-500">{ds.row_count} filas</span>
                </div>
                <div className="text-xs space-y-1">
                  {Object.entries(ds.column_mapping || {}).map(([standard, original]) => (
                    <div key={standard} className="flex justify-between gap-2">
                      <span className="font-semibold text-slate-700 dark:text-slate-200">{standard}</span>
                      <span className="text-slate-600 dark:text-slate-300">{original}</span>
                    </div>
                  ))}
                </div>
                {(ds.missing_optional || []).length > 0 && (
                  <p className="text-xs text-amber-600">
                    Faltan opcionales: {ds.missing_optional.join(", ")}
                  </p>
                )}
                {(ds.warnings || []).length > 0 && (
                  <ul className="text-xs text-amber-600 list-disc list-inside space-y-1">
                    {ds.warnings.map((warning, warningIdx) => (
                      <li key={warningIdx}>{warning}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {unmappedColumns.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 dark:border-amber-400/60 dark:bg-amber-900/20 p-4 space-y-2">
          <p className="text-sm font-semibold text-amber-700 dark:text-amber-200">
            Columnas no reconocidas: {unmappedColumns.map((c) => c.column).join(", ")}
          </p>
          <p className="text-xs text-amber-700 dark:text-amber-100">
            Configura manualmente a qué campo estándar corresponden para mejorar las métricas.
          </p>
          <button
            onClick={handleOpenRemap}
            className="rounded-lg bg-amber-600 text-white px-3 py-2 text-xs font-semibold hover:bg-amber-700"
          >
            Configurar mapeo manual
          </button>
        </div>
      )}

      {showRemapDialog && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-20 p-4">
          <div className="w-full max-w-xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Configurar columnas manualmente</p>
              <button onClick={() => setShowRemapDialog(false)} className="text-slate-500 text-xs">Cerrar</button>
            </div>
            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {unmappedColumns.map((item) => {
                const options = item.dataset === "stock" ? STOCK_STANDARD_FIELDS : SALES_STANDARD_FIELDS;
                return (
                  <div key={`${item.dataset}:${item.column}`} className="space-y-1 border-b border-slate-100 dark:border-slate-800 pb-2">
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                      {item.column} <span className="text-slate-400">({item.dataset})</span>
                    </p>
                    <select
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm px-2 py-1"
                      value={remapSelections[`${item.dataset}:${item.column}`] || ""}
                      onChange={(e) => handleSelectionChange(item.dataset, item.column, e.target.value)}
                    >
                      <option value="">Selecciona campo estándar</option>
                      {options.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowRemapDialog(false)}
                className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs text-slate-700 dark:text-slate-200"
              >
                Cancelar
              </button>
              <button
                onClick={handleSubmitRemap}
                className="rounded-lg bg-blue-600 text-white px-4 py-2 text-xs font-semibold hover:bg-blue-700"
              >
                Guardar mapeo
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default DataIntegrationsView;
export { handleUploadSubmission } from "./uploadHelpers";
