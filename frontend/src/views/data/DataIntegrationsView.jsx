import React, { useEffect, useState } from "react";
import API_URL from "../../api.js";
import SectionHeader from "../../components/cards/SectionHeader";
import SkeletonBlock from "../../components/cards/SkeletonBlock";
import { handleUploadSubmission } from "./uploadHelpers";
import { MERCADO_LIBRE_APP_ALIAS } from "../../constants/mercadoLibre";

const SALES_STANDARD_FIELDS = ["date", "sku", "product_name", "quantity", "unit_price", "total", "channel"];
const STOCK_STANDARD_FIELDS = ["sku", "product_name", "category", "current_stock", "unit_cost", "location", "channel"];

const DataIntegrationsView = ({ onUnauthorized, onOpenMercadoLibre }) => {
  const [token, setToken] = useState(() => localStorage.getItem("token"));
  const [uploadStatus, setUploadStatus] = useState(null);
  const [datasets, setDatasets] = useState([]);
  const [unmappedColumns, setUnmappedColumns] = useState([]);
  const [remapSelections, setRemapSelections] = useState({ sales: {}, stock: {} });
  const [activeDataset, setActiveDataset] = useState("sales");
  const [showRemapDialog, setShowRemapDialog] = useState(false);
  const [draggingColumn, setDraggingColumn] = useState("");
  const [dragTarget, setDragTarget] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectingSource, setSelectingSource] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [credentials, setCredentials] = useState([]);
  const [selectedCredentialId, setSelectedCredentialId] = useState("");

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

  useEffect(() => {
    if (!token) return;

    const fetchStatus = async () => {
      setStatusLoading(true);
      try {
        const data = await authorizedFetch(
          `${API_URL}/meli/status?app_alias=${encodeURIComponent(MERCADO_LIBRE_APP_ALIAS)}`,
        );
        setConnectionStatus(data);
      } catch (err) {
        if (err.message !== "unauthorized") {
          console.error(err);
        }
      } finally {
        setStatusLoading(false);
      }
    };

    const fetchCredentials = async () => {
      try {
        const data = await authorizedFetch(`${API_URL}/admin/ml/credentials`);
        setCredentials(data);
        if (data.length > 0) {
          setSelectedCredentialId((prev) => prev || String(data[0].id));
        }
      } catch (err) {
        if (err.message !== "unauthorized") {
          setError(err.message || "No se pudieron cargar las credenciales");
        }
      }
    };

    fetchStatus();
    fetchCredentials();
  }, [token]);

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
    if (!selectedCredentialId) {
      setError("Selecciona una credencial de Mercado Libre");
      return;
    }
    setSelectingSource(true);

    try {
      const data = await authorizedFetch(`${API_URL}/data/source`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: "mercadolibre", credential_id: Number(selectedCredentialId) }),
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

  const handleOpenRemap = (dataset = null) => {
    const datasetKeys = Array.from(new Set(unmappedColumns.map((item) => item.dataset)));
    const defaultDataset = dataset || datasetKeys[0] || "sales";

    const initialSelections = datasetKeys.reduce(
      (acc, key) => ({
        ...acc,
        [key]: {},
      }),
      { sales: {}, stock: {} },
    );

    setRemapSelections(initialSelections);
    setActiveDataset(defaultDataset);
    setShowRemapDialog(true);
  };

  const handleSelectionChange = (dataset, standard, column) => {
    setRemapSelections((prev) => {
      const nextDataset = { ...(prev[dataset] || {}) };
      if (column) {
        nextDataset[standard] = column;
      } else {
        delete nextDataset[standard];
      }
      return { ...prev, [dataset]: nextDataset };
    });
  };

  const handleSubmitRemap = async () => {
    const groupedMappings = {};
    Object.entries(remapSelections).forEach(([dataset, mapping]) => {
      const cleanedMapping = Object.fromEntries(
        Object.entries(mapping || {}).filter(([, column]) => Boolean(column)),
      );
      if (Object.keys(cleanedMapping).length > 0) {
        groupedMappings[dataset] = cleanedMapping;
      }
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

  const unmappedByDataset = unmappedColumns.reduce((acc, item) => {
    acc[item.dataset] = (acc[item.dataset] || 0) + 1;
    return acc;
  }, {});

  const activeFields = activeDataset === "stock" ? STOCK_STANDARD_FIELDS : SALES_STANDARD_FIELDS;
  const usedColumns = new Set(Object.values(remapSelections[activeDataset] || {}));
  const availableColumns = unmappedColumns.filter(
    (item) => item.dataset === activeDataset && !usedColumns.has(item.column),
  );

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
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                connectionStatus
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-200"
              }`}
            >
              {statusLoading
                ? "Verificando..."
                : connectionStatus
                  ? `Conectado a ${connectionStatus.nickname || "Mercado Libre"}`
                  : "No conectado"}
            </span>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Usa el flujo ya implementado para sincronizar órdenes y stock. Se guarda como fuente activa en el motor.
          </p>
          <div className="space-y-2 text-xs text-slate-500">
            <p>La importación completa puede tardar unos minutos.</p>
          </div>
          <div className="grid gap-2 text-sm md:grid-cols-2">
            <label className="space-y-1">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">Credencial de Mercado Libre</span>
              <select
                value={selectedCredentialId}
                onChange={(e) => setSelectedCredentialId(e.target.value)}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
              >
                {credentials.length === 0 && <option value="">Sin credenciales disponibles</option>}
                {credentials.map((cred) => (
                  <option key={cred.id} value={cred.id}>
                    {cred.account_name} {cred.nickname ? `(${cred.nickname})` : ""}
                  </option>
                ))}
              </select>
            </label>
          </div>
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
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-amber-700 dark:text-amber-200">Columnas no reconocidas</p>
              <p className="text-xs text-amber-700 dark:text-amber-100">
                Configura manualmente a qué campo estándar corresponden arrastrando cada caluga hacia su tarjeta.
              </p>
            </div>
            <span className="rounded-full bg-white/70 px-3 py-1 text-[11px] font-semibold text-amber-700 border border-amber-200">
              {unmappedColumns.length} pendientes
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(unmappedByDataset).map(([dataset, count]) => (
              <button
                key={dataset}
                onClick={() => handleOpenRemap(dataset)}
                className="inline-flex items-center gap-2 rounded-full bg-amber-600 text-white px-4 py-2 text-xs font-semibold shadow hover:bg-amber-700"
              >
                Mapear {dataset === "stock" ? "stock" : "ventas"}
                <span className="rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-bold">{count}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {showRemapDialog && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-20 p-4">
          <div className="w-full max-w-4xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Configurar columnas manualmente</p>
                <p className="text-xs text-slate-500">Arrastra las calugas de columnas hacia la tarjeta del campo estándar.</p>
              </div>
              <button onClick={() => setShowRemapDialog(false)} className="text-slate-500 text-xs">Cerrar</button>
            </div>

            <div className="flex flex-wrap gap-2">
              {["sales", "stock"].map((dataset) => {
                const hasPending = Boolean(unmappedByDataset[dataset]);
                const label = dataset === "stock" ? "Stock" : "Ventas";
                return (
                  <button
                    key={dataset}
                    onClick={() => setActiveDataset(dataset)}
                    disabled={!hasPending && activeDataset !== dataset}
                    className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold transition ${
                      activeDataset === dataset
                        ? "border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-900/40 dark:text-blue-100"
                        : "border-slate-200 bg-white text-slate-700 hover:border-blue-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    } ${!hasPending && activeDataset !== dataset ? "opacity-60" : ""}`}
                  >
                    Mapear {label}
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-100">
                      {unmappedByDataset[dataset] || 0}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="grid gap-4 md:grid-cols-5">
              <div className="md:col-span-2 space-y-2">
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">Columnas disponibles</p>
                    <span className="text-[11px] text-slate-500">{availableColumns.length} sin asignar</span>
                  </div>
                  <p className="text-[11px] text-slate-500">Arrastra una caluga hacia el campo que corresponda.</p>
                  <div className="flex flex-wrap gap-2">
                    {availableColumns.length === 0 && (
                      <span className="text-[11px] text-slate-400">Todas las columnas de {activeDataset === "stock" ? "stock" : "ventas"} están asignadas.</span>
                    )}
                    {availableColumns.map((item) => (
                      <div
                        key={`${item.dataset}:${item.column}`}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData("text/plain", item.column);
                          e.dataTransfer.setData("text/dataset", item.dataset);
                          setDraggingColumn(`${item.dataset}:${item.column}`);
                        }}
                        onDragEnd={() => setDraggingColumn("")}
                        className={`cursor-grab rounded-full border px-3 py-1 text-xs font-semibold shadow-sm transition dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 ${
                          draggingColumn === `${item.dataset}:${item.column}`
                            ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/50 dark:text-blue-100"
                            : "border-slate-200 bg-white text-slate-700 hover:border-blue-400"
                        }`}
                      >
                        {item.column}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="md:col-span-3 grid gap-3 sm:grid-cols-2">
                {activeFields.map((field) => {
                  const assignedColumn = remapSelections[activeDataset]?.[field];
                  const label = field.replaceAll("_", " ");
                  const isActiveTarget = dragTarget === field;
                  return (
                    <div
                      key={field}
                      onDragOver={(e) => {
                        e.preventDefault();
                        const datasetFromDrag = e.dataTransfer.getData("text/dataset") || activeDataset;
                        if (datasetFromDrag === activeDataset) {
                          setDragTarget(field);
                        }
                      }}
                      onDragLeave={() => setDragTarget("")}
                      onDrop={(e) => {
                        e.preventDefault();
                        const datasetFromDrag = e.dataTransfer.getData("text/dataset") || activeDataset;
                        const column = e.dataTransfer.getData("text/plain");
                        setDragTarget("");
                        if (!column || datasetFromDrag !== activeDataset) return;
                        handleSelectionChange(activeDataset, field, column);
                        setDraggingColumn("");
                      }}
                      className={`rounded-xl border p-3 transition-colors duration-150 ${
                        isActiveTarget
                          ? "border-blue-500 bg-blue-50/70 dark:border-blue-400 dark:bg-blue-900/30"
                          : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 capitalize">{label}</p>
                          <p className="text-[11px] text-slate-500">Suelta aquí la columna que corresponda.</p>
                        </div>
                        {assignedColumn && (
                          <button
                            onClick={() => handleSelectionChange(activeDataset, field, "")}
                            className="text-[11px] text-slate-500 hover:text-rose-500"
                          >
                            Quitar
                          </button>
                        )}
                      </div>
                      <div className="mt-2 min-h-[40px] flex items-center">
                        {assignedColumn ? (
                          <span className="inline-flex items-center gap-2 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-100 px-3 py-1 text-xs font-semibold">
                            {assignedColumn}
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full border border-dashed border-slate-300 dark:border-slate-700 px-3 py-1 text-[11px] text-slate-500">
                            Arrastra una columna aquí
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
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
