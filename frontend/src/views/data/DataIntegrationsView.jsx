import React, { useEffect, useState } from "react";
import API_URL from "../../api.js";
import SectionHeader from "../../components/cards/SectionHeader";
import SkeletonBlock from "../../components/cards/SkeletonBlock";
import { handleUploadSubmission } from "./uploadHelpers";
import { MERCADO_LIBRE_APP_ALIAS } from "../../constants/mercadoLibre";
import useSubscriptionPlan from "../../hooks/useSubscriptionPlan";

const SALES_STANDARD_FIELDS = ["date", "sku", "product_name", "quantity", "unit_price", "total", "channel"];
const STOCK_STANDARD_FIELDS = ["sku", "product_name", "category", "current_stock", "unit_cost", "location", "channel"];

const DataIntegrationsView = ({ onUnauthorized, onOpenMercadoLibre }) => {
  const [token, setToken] = useState(() => localStorage.getItem("token"));
  const [uploadStatus, setUploadStatus] = useState(null);
  const [datasets, setDatasets] = useState([]);
  const [unmappedColumns, setUnmappedColumns] = useState([]);
  const [remapSelections, setRemapSelections] = useState({});
  const [showRemapDialog, setShowRemapDialog] = useState(false);
  const [activeDataset, setActiveDataset] = useState(null);
  const [draggingKey, setDraggingKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectingSource, setSelectingSource] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [credentials, setCredentials] = useState([]);
  const [selectedCredentialId, setSelectedCredentialId] = useState("");
  const { isProOrPremium, loading: planLoading } = useSubscriptionPlan({ onUnauthorized });
  const upgradeMessage =
    "Función disponible en planes Pro y Premium. Actualiza tu plan en la sección Planes.";

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
    if (!token || !isProOrPremium) return;

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
  }, [token, isProOrPremium]);

  const downloadSample = async (type) => {
    setError("");
    if (!isProOrPremium) {
      setError(upgradeMessage);
      return;
    }
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
    if (!isProOrPremium) {
      setError(upgradeMessage);
      return;
    }
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

  const handleOpenRemap = () => {
    const initialSelections = {};
    unmappedColumns.forEach((item) => {
      initialSelections[`${item.dataset}:${item.column}`] = "";
    });
    setRemapSelections(initialSelections);
    setActiveDataset(unmappedColumns[0]?.dataset || "sales");
    setShowRemapDialog(true);
  };

  const handleDropOnStandard = (dataset, standard, column) => {
    setRemapSelections((prev) => {
      const updated = { ...prev };

      Object.entries(updated).forEach(([key, std]) => {
        const [ds] = key.split(":");
        if (ds === dataset && std === standard) {
          delete updated[key];
        }
      });

      updated[`${dataset}:${column}`] = standard;
      return updated;
    });
  };

  const getStandardFields = (dataset) => (dataset === "stock" ? STOCK_STANDARD_FIELDS : SALES_STANDARD_FIELDS);

  const getAssignedColumn = (dataset, standard) => {
    const match = Object.entries(remapSelections).find(([key, std]) => {
      const [ds] = key.split(":");
      return ds === dataset && std === standard;
    });

    if (!match) return "";
    return match[0].split(":")[1];
  };

  const isColumnAssigned = (dataset, column) => Boolean(remapSelections[`${dataset}:${column}`]);

  const clearStandardMapping = (dataset, standard) => {
    setRemapSelections((prev) => {
      const updated = { ...prev };
      Object.entries(updated).forEach(([key, std]) => {
        const [ds] = key.split(":");
        if (ds === dataset && std === standard) {
          delete updated[key];
        }
      });
      return updated;
    });
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

      {!planLoading && !isProOrPremium && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/60 dark:bg-amber-900/20 dark:text-amber-50 px-4 py-3">
          {upgradeMessage}
        </div>
      )}

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
              disabled={!isProOrPremium}
              className="rounded-xl bg-emerald-600 text-white px-4 py-2 text-sm font-semibold shadow hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              Conectar / revisar conexión
            </button>
            <button
              onClick={handleUseMercadoLibreSource}
              disabled={selectingSource || !isProOrPremium}
              className="rounded-xl border border-slate-300 dark:border-slate-700 px-4 py-2 text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
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
          <div className="w-full max-w-5xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Configurar columnas manualmente</p>
                <p className="text-xs text-slate-500">Arrastra las columnas hacia el campo estándar correcto.</p>
              </div>
              <button onClick={() => setShowRemapDialog(false)} className="text-slate-500 text-xs">Cerrar</button>
            </div>

            <div className="flex flex-wrap gap-2 text-xs">
              <button
                onClick={() => setActiveDataset("sales")}
                className={`rounded-full border px-3 py-1 font-semibold transition ${
                  activeDataset === "sales"
                    ? "border-blue-600 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-900/40 dark:text-blue-100"
                    : "border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-200"
                }`}
              >
                Mapear ventas
              </button>
              <button
                onClick={() => setActiveDataset("stock")}
                className={`rounded-full border px-3 py-1 font-semibold transition ${
                  activeDataset === "stock"
                    ? "border-blue-600 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-900/40 dark:text-blue-100"
                    : "border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-200"
                }`}
              >
                Mapear stock
              </button>
            </div>

            {activeDataset ? (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-200">
                    <span>Columnas sin mapear ({unmappedColumns.filter((c) => c.dataset === activeDataset).length})</span>
                    <span className="text-slate-400">Arrastra para asignar</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {unmappedColumns
                      .filter((item) => item.dataset === activeDataset)
                      .map((item) => (
                        <div
                          key={`${item.dataset}:${item.column}`}
                          draggable
                          onDragStart={() => setDraggingKey(`${item.dataset}:${item.column}`)}
                          onDragEnd={() => setDraggingKey("")}
                          className={`cursor-grab rounded-lg border px-3 py-2 text-xs font-semibold shadow-sm transition ${
                            isColumnAssigned(item.dataset, item.column)
                              ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700/60 dark:bg-emerald-900/40 dark:text-emerald-100"
                              : "border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                          } ${draggingKey === `${item.dataset}:${item.column}` ? "ring-2 ring-blue-300" : ""}`}
                        >
                          {item.column}
                          <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-500 dark:bg-slate-700 dark:text-slate-200">
                            {item.dataset}
                          </span>
                        </div>
                      ))}
                    {unmappedColumns.filter((item) => item.dataset === activeDataset).length === 0 && (
                      <p className="text-xs text-slate-500">No hay columnas pendientes para este tipo.</p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">Campos estándar</p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {getStandardFields(activeDataset).map((standard) => {
                      const assigned = getAssignedColumn(activeDataset, standard);
                      const isActiveDrop = draggingKey.startsWith(`${activeDataset}:`);

                      return (
                        <div
                          key={standard}
                          onDragOver={(e) => {
                            if (isActiveDrop) e.preventDefault();
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            const [dataset, column] = draggingKey.split(":");
                            if (dataset === activeDataset && column) {
                              handleDropOnStandard(dataset, standard, column);
                            }
                            setDraggingKey("");
                          }}
                          className={`rounded-lg border px-3 py-3 text-sm transition ${
                            assigned
                              ? "border-emerald-300 bg-emerald-50/70 dark:border-emerald-700/60 dark:bg-emerald-900/30"
                              : "border-dashed border-slate-300 bg-white/70 dark:border-slate-700 dark:bg-slate-800/70"
                          } ${isActiveDrop ? "hover:border-blue-400" : ""}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-xs font-semibold uppercase text-slate-600 dark:text-slate-300">{standard}</p>
                              <p className="text-[11px] text-slate-500">Suelta aquí la columna correspondiente.</p>
                            </div>
                            {assigned && (
                              <button
                                onClick={() => clearStandardMapping(activeDataset, standard)}
                                className="text-[11px] text-amber-600 hover:text-amber-700"
                              >
                                Quitar
                              </button>
                            )}
                          </div>
                          {assigned ? (
                            <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-semibold text-emerald-800 dark:bg-emerald-800/50 dark:text-emerald-100">
                              <span className="h-2 w-2 rounded-full bg-emerald-500" />
                              {assigned}
                            </div>
                          ) : (
                            <div className="mt-2 rounded-full border border-dashed border-slate-300 px-3 py-1 text-[11px] text-slate-400">
                              Sin asignar
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500">Sube archivos para comenzar a mapear.</p>
            )}

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
