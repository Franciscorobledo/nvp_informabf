import React, { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import axios from "axios";
import API_URL from "../src/api";
import AppButton from "./AppButton";
import LoadingBar from "./LoadingBar";

const focusOptions = [
  { value: "todo", label: "Todo" },
  { value: "venta", label: "Venta" },
  { value: "stock", label: "Stock" },
  { value: "producto", label: "Producto" },
  { value: "reportes", label: "Reportes" },
];

const stepMessages = {
  subiendo_archivos: "Subiendo archivos…",
  preparando_datos: "Preparando datos…",
  leyendo_archivos: "Leyendo datasets…",
  comparando_datasets: "Comparando datasets…",
  generando_insights: "Generando insights…",
  completo: "Comparativa lista",
  error: "Ocurrió un error en la comparación",
};

const SummaryStat = ({ label, value, accent }) => (
  <div className="rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/60 p-4 space-y-1">
    <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-slate-400">{label}</p>
    <p className={`text-2xl font-bold ${accent ?? "text-gray-900 dark:text-white"}`}>{value}</p>
  </div>
);

const DataComparisonModule = ({ onUnauthorized }) => {
  const [fileA, setFileA] = useState(null);
  const [fileB, setFileB] = useState(null);
  const [labelA, setLabelA] = useState("Dataset A");
  const [labelB, setLabelB] = useState("Dataset B");
  const [focus, setFocus] = useState("todo");
  const [compareJobId, setCompareJobId] = useState(null);
  const [compareProgress, setCompareProgress] = useState(0);
  const [compareStep, setCompareStep] = useState("");
  const [isComparing, setIsComparing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [compareError, setCompareError] = useState("");
  const [compareResult, setCompareResult] = useState(null);
  const [preSummary, setPreSummary] = useState(null);
  const [showTechnical, setShowTechnical] = useState(false);
  const [showEntityTable, setShowEntityTable] = useState(false);
  const [demoMetadata, setDemoMetadata] = useState(null);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setCompareError("");
    setDemoMetadata(null);
    setCompareProgress(0);
    setCompareStep("subiendo_archivos");
    setUploadProgress(0);

    if (!fileA || !fileB) {
      setCompareError("Debes seleccionar ambos archivos para comparar.");
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) {
      onUnauthorized?.("Tu sesión expiró. Inicia sesión nuevamente.");
      return;
    }

    const formData = new FormData();
    formData.append("file_a", fileA);
    formData.append("file_b", fileB);
    formData.append("user_focus", focus);
    formData.append("label_a", labelA || "Dataset A");
    formData.append("label_b", labelB || "Dataset B");

    try {
      setIsComparing(true);
      setIsUploading(true);
      setCompareResult(null);

      const startResponse = await axios.post(`${API_URL}/compare/start`, formData, {
        headers: { Authorization: `Bearer ${token}` },
        onUploadProgress: (event) => {
          if (!event.total) return;
          const percent = Math.round((event.loaded / event.total) * 100);
          setUploadProgress(percent);
        },
      });

      const data = startResponse.data;
      setUploadProgress(100);
      setIsUploading(false);
      setCompareJobId(data.job_id);
      setPreSummary(data.pre_summary);
      setCompareProgress(data.progress ?? 0);
      setCompareStep(data.step || "preparando_datos");
      return;
    } catch (err) {
      setIsUploading(false);
      if (axios.isAxiosError(err)) {
        const status = err.response?.status;

        if ([401, 403].includes(status)) {
          onUnauthorized?.("Tu sesión expiró. Inicia sesión nuevamente.");
          setIsComparing(false);
          return;
        }

        if (status === 404) {
          try {
            const legacyResponse = await axios.post(`${API_URL}/analyze/compare`, formData, {
              headers: { Authorization: `Bearer ${token}` },
              onUploadProgress: (event) => {
                if (!event.total) return;
                const percent = Math.round((event.loaded / event.total) * 100);
                setUploadProgress(percent);
              },
            });

            const legacyData = legacyResponse.data;
            setCompareResult(legacyData);
            setCompareProgress(100);
            setCompareStep("completo");
            setIsComparing(false);
            return;
          } catch (legacyErr) {
            const msg = legacyErr.response?.data || legacyErr.message;
            console.error("Error en comparativa (legacy):", legacyErr);
            setCompareError(msg || "No se pudo iniciar la comparativa (legacy).");
            setIsComparing(false);
            return;
          }
        }
      }

      console.error("Error en comparativa:", err);
      setCompareError(err.message);
      setIsComparing(false);
    }
  };

  const handleDemoCompare = async () => {
    setCompareError("");
    setIsComparing(true);
    setCompareProgress(25);
    setCompareStep("leyendo_archivos");
    setCompareResult(null);
    setDemoMetadata(null);
    setPreSummary(null);

    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`${API_URL}/demo/compare?scenario=ventas_2024_vs_2025`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if ([401, 403].includes(res.status)) {
        onUnauthorized?.("Tu sesión expiró. Inicia sesión nuevamente.");
        setIsComparing(false);
        return;
      }

      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || "No se pudo cargar la comparativa demo.");
      }

      const data = await res.json();
      setCompareResult(data);
      setLabelA(data.label_a || "Ventas 2024 (demo)");
      setLabelB(data.label_b || "Ventas 2025 (demo)");
      setDemoMetadata(data.demo_metadata || { is_demo: true, scenario: "ventas_2024_vs_2025" });
      setCompareProgress(100);
      setCompareStep("completo");
    } catch (err) {
      console.error("Error en comparativa demo:", err);
      setCompareError(err.message);
      setCompareStep("error");
    } finally {
      setIsComparing(false);
    }
  };

  useEffect(() => {
    if (!isComparing || !compareJobId) return undefined;

    const interval = setInterval(async () => {
      const token = localStorage.getItem("token");
      if (!token) {
        onUnauthorized?.("Tu sesión expiró. Inicia sesión nuevamente.");
        clearInterval(interval);
        return;
      }

      try {
        const statusResponse = await fetch(`${API_URL}/compare/status/${compareJobId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!statusResponse.ok) {
          if ([401, 403].includes(statusResponse.status)) {
            onUnauthorized?.("Tu sesión expiró. Inicia sesión nuevamente.");
            clearInterval(interval);
            return;
          }
          const msg = await statusResponse.text();
          throw new Error(msg || "No se pudo obtener el estado de la comparativa.");
        }

        const statusData = await statusResponse.json();
        setCompareProgress(statusData.progress ?? 0);
        setCompareStep(statusData.step || "comparando_datasets");
        setCompareError(statusData.error || "");

        if (statusData.done) {
          setIsComparing(false);
          if (statusData.error) {
            setCompareResult(null);
          } else {
            setCompareResult(statusData.result || null);
          }
          clearInterval(interval);
        }
      } catch (err) {
        console.error("Error en polling de comparativa:", err);
        setCompareError(err.message);
        setIsComparing(false);
        clearInterval(interval);
      }
    }, 1800);

    return () => clearInterval(interval);
  }, [compareJobId, isComparing, onUnauthorized]);

  const summary = compareResult?.comparison?.summary;
  const byEntity = compareResult?.comparison?.by_entity;
  const byTime = compareResult?.comparison?.by_time;

  const diffPercentLabel = useMemo(() => {
    if (!summary?.diff_percent && summary?.diff_percent !== 0) return "-";
    return `${(summary.diff_percent * 100).toFixed(1)}%`;
  }, [summary]);

  const resolvedLabelA = useMemo(
    () => summary?.label_a || labelA || "Dataset A",
    [labelA, summary]
  );
  const resolvedLabelB = useMemo(
    () => summary?.label_b || labelB || "Dataset B",
    [labelB, summary]
  );
  const mainMetricLabel = useMemo(
    () => summary?.main_metric_label || summary?.main_metric || "Métrica principal",
    [summary]
  );

  const renderEntityTable = () => {
    if (!byEntity?.rows?.length) return null;

    return (
      <div className="overflow-auto rounded-xl border border-gray-200 dark:border-slate-800">
        <table className="min-w-full text-sm">
            <thead className="bg-gray-50 dark:bg-slate-800 text-left">
              <tr>
                <th className="px-4 py-3 font-semibold text-gray-700 dark:text-slate-200">
                  {byEntity.entity_label || byEntity.entity_key || "Entidad"}
                </th>
                <th className="px-4 py-3 font-semibold text-gray-700 dark:text-slate-200">{resolvedLabelA}</th>
                <th className="px-4 py-3 font-semibold text-gray-700 dark:text-slate-200">{resolvedLabelB}</th>
                <th className="px-4 py-3 font-semibold text-gray-700 dark:text-slate-200">Diferencia</th>
                <th className="px-4 py-3 font-semibold text-gray-700 dark:text-slate-200">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
            {byEntity.rows.slice(0, 30).map((row) => (
              <tr key={row.entity} className="hover:bg-gray-50 dark:hover:bg-slate-800/50">
                <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{row.entity}</td>
                <td className="px-4 py-3 text-gray-700 dark:text-slate-200">{row.value_a?.toLocaleString?.("es-CL") ?? row.value_a}</td>
                <td className="px-4 py-3 text-gray-700 dark:text-slate-200">{row.value_b?.toLocaleString?.("es-CL") ?? row.value_b}</td>
                <td className={`px-4 py-3 font-semibold ${row.diff_abs >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                  {row.diff_abs?.toLocaleString?.("es-CL") ?? row.diff_abs}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                      row.status === "up"
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200"
                        : row.status === "new"
                        ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200"
                        : row.status === "lost"
                        ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200"
                        : "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-200"
                    }`}
                  >
                    {row.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <section className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-xl font-semibold text-gray-800 dark:text-white">📈 Comparativa de datos</h2>
        <p className="text-sm text-gray-600 dark:text-slate-300">
          Compara dos periodos o fuentes de datos, detecta variaciones y obtén insights rápidos.
        </p>
        {demoMetadata?.is_demo && (
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-200 border border-amber-200 dark:border-amber-700 text-xs font-semibold">
            Comparativa demo: Ventas 2024 vs 2025
          </span>
        )}
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
          <p className="text-sm font-semibold text-gray-800 dark:text-white">Dataset A</p>
          <label className="space-y-1 block">
            <span className="text-xs font-semibold text-gray-600 dark:text-slate-300">Nombre del dataset</span>
            <input
              type="text"
              value={labelA}
              onChange={(e) => setLabelA(e.target.value)}
              placeholder="Ej: Ventas noviembre 2025 (retail)"
              className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 px-3 py-2 text-sm"
            />
          </label>
          <input
            type="file"
            accept=".csv,.xlsx,.zip"
            onChange={(e) => {
              setDemoMetadata(null);
              setFileA(e.target.files?.[0] ?? null);
            }}
            disabled={demoMetadata?.is_demo}
            className="w-full text-sm text-gray-700 dark:text-slate-200"
          />
        </div>

        <div className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
          <p className="text-sm font-semibold text-gray-800 dark:text-white">Dataset B</p>
          <label className="space-y-1 block">
            <span className="text-xs font-semibold text-gray-600 dark:text-slate-300">Nombre del dataset</span>
            <input
              type="text"
              value={labelB}
              onChange={(e) => setLabelB(e.target.value)}
              placeholder="Ej: Ventas noviembre 2025 (retail)"
              className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 px-3 py-2 text-sm"
            />
          </label>
          <input
            type="file"
            accept=".csv,.xlsx,.zip"
            onChange={(e) => {
              setDemoMetadata(null);
              setFileB(e.target.files?.[0] ?? null);
            }}
            disabled={demoMetadata?.is_demo}
            className="w-full text-sm text-gray-700 dark:text-slate-200"
          />
        </div>

        <div className="lg:col-span-2 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <label className="w-full sm:w-auto text-sm font-medium text-gray-700 dark:text-slate-200 flex items-center gap-2">
            Foco de usuario
            <select
              value={focus}
              onChange={(e) => setFocus(e.target.value)}
              className="rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
            >
              {focusOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <AppButton
              type="submit"
              loading={isComparing}
              loadingText="Procesando comparativa..."
              fullWidth
              className="sm:w-auto"
            >
              Comparar
            </AppButton>

            <AppButton
              type="button"
              onClick={handleDemoCompare}
              loading={isComparing}
              loadingText="Cargando demo..."
              variant="secondary"
              fullWidth
              className="sm:w-auto"
            >
              Probar comparativa de ejemplo
            </AppButton>
          </div>
        </div>
      </form>

      {isUploading && (
        <LoadingBar
          progress={uploadProgress}
          label={stepMessages.subiendo_archivos}
          helperText="Estamos asegurando que ambos archivos se suban correctamente."
        />
      )}

      {!isUploading && isComparing && (
        <LoadingBar
          progress={compareProgress}
          label={stepMessages[compareStep] || "Procesando comparativa…"}
          helperText="Generando comparativa inteligente con IA."
        />
      )}

      {preSummary && (
        <div className="rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
          <p className="text-sm font-semibold text-gray-800 dark:text-white">Resumen preliminar</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-gray-700 dark:text-slate-200">
            <div>
              <p className="font-semibold">{preSummary.label_a}</p>
              <p>Filas (estimado): {preSummary.rows_a_est?.toLocaleString?.() ?? preSummary.rows_a_est}</p>
              <p>Columnas: {preSummary.columns_a?.length ?? preSummary.columns_a}</p>
            </div>
            <div>
              <p className="font-semibold">{preSummary.label_b}</p>
              <p>Filas (estimado): {preSummary.rows_b_est?.toLocaleString?.() ?? preSummary.rows_b_est}</p>
              <p>Columnas: {preSummary.columns_b?.length ?? preSummary.columns_b}</p>
            </div>
          </div>
        </div>
      )}

      {compareError && (
        <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm">
          {compareError}
        </div>
      )}

      {summary && (
        <div className="space-y-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-lg font-semibold text-gray-800 dark:text-white">
                Resumen de {resolvedLabelA} vs {resolvedLabelB}
              </p>
              <span className="text-xs rounded-full bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-100 px-3 py-1 font-semibold">
                Métrica principal: {mainMetricLabel}
              </span>
            </div>
            <p className="text-sm text-gray-600 dark:text-slate-300">
              {summary.insight_text || `En ${resolvedLabelB} la métrica principal cambia ${diffPercentLabel} respecto a ${resolvedLabelA}.`}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <SummaryStat
              label={`${mainMetricLabel} (${resolvedLabelA})`}
              value={summary.total_a.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            />
            <SummaryStat
              label={`${mainMetricLabel} (${resolvedLabelB})`}
              value={summary.total_b.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            />
            <SummaryStat
              label="Diferencia absoluta"
              value={summary.diff_abs.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              accent={summary.diff_abs >= 0 ? "text-emerald-600" : "text-rose-600"}
            />
            <SummaryStat
              label="Diferencia %"
              value={diffPercentLabel}
              accent={summary.diff_percent >= 0 ? "text-emerald-600" : "text-rose-600"}
            />
          </div>

          <div className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
            <p className="text-sm font-semibold text-gray-800 dark:text-white">Impacto total</p>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={[{ name: mainMetricLabel, value_a: summary.total_a, value_b: summary.total_b }]}
                  margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
                  barSize={36}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="value_a" fill="#2563eb" name={resolvedLabelA} radius={[6, 6, 0, 0]} />
                  <Bar dataKey="value_b" fill="#10b981" name={resolvedLabelB} radius={[6, 6, 0, 0]} />
                  <ReferenceLine y={0} stroke="#e5e7eb" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-gray-600 dark:text-slate-300">
              En <strong>{resolvedLabelB}</strong> la métrica principal varia {diffPercentLabel} respecto a <strong>{resolvedLabelA}</strong>.
            </p>
          </div>

          {byTime?.has_time && byTime.rows?.length > 0 && (
            <div className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-800 dark:text-white">
                  Evolución temporal ({byTime.date_column})
                </p>
                <span className="text-xs text-gray-500 dark:text-slate-300">Granularidad: {byTime.timeline_granularity || "auto"}</span>
              </div>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={byTime.rows} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="period" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    {byTime?.max_gap?.period && (
                      <ReferenceLine x={byTime.max_gap.period} stroke="#f59e0b" strokeDasharray="3 3" label="Máx diferencia" />
                    )}
                    <Line type="monotone" dataKey="metric_a" stroke="#2563eb" name={resolvedLabelA} strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="metric_b" stroke="#10b981" name={resolvedLabelB} strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {byEntity?.rows?.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-800 dark:text-white">
                  Top variaciones por {byEntity.entity_label || "entidad"}
                </p>
                <div className="flex gap-3 text-xs text-gray-600 dark:text-slate-300">
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-100">
                    Nuevas: {byEntity.new_count ?? byEntity.new_entities?.length ?? 0}
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-100">
                    Perdidas: {byEntity.lost_count ?? byEntity.lost_entities?.length ?? 0}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                  <p className="text-sm font-semibold text-gray-800 dark:text-white mb-3">Top alzas</p>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={byEntity.top_increases} layout="vertical" margin={{ top: 10, right: 10, left: 30, bottom: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" />
                        <YAxis dataKey="entity" type="category" width={120} />
                        <Tooltip />
                        <Bar dataKey="diff_abs" fill="#10b981" name="Diferencia" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                  <p className="text-sm font-semibold text-gray-800 dark:text-white mb-3">Top caídas</p>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={byEntity.top_decreases} layout="vertical" margin={{ top: 10, right: 10, left: 30, bottom: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" />
                        <YAxis dataKey="entity" type="category" width={120} />
                        <Tooltip />
                        <Bar dataKey="diff_abs" fill="#ef4444" name="Diferencia" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowEntityTable((prev) => !prev)}
                className="text-sm font-semibold text-blue-700 dark:text-blue-300 hover:underline"
              >
                {showEntityTable ? "Ocultar detalle por entidad" : "Ver detalle por entidad (tabla)"}
              </button>

              {showEntityTable && renderEntityTable()}
            </div>
          )}

          <div className="rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-800 dark:text-white">Detalle técnico</p>
              <button
                type="button"
                onClick={() => setShowTechnical((prev) => !prev)}
                className="text-xs font-semibold text-blue-700 dark:text-blue-300 hover:underline"
              >
                {showTechnical ? "Ocultar" : "Ver detalle avanzado"}
              </button>
            </div>
            {showTechnical && (
              <div className="mt-3 space-y-2 text-xs text-gray-700 dark:text-slate-200">
                <p>
                  Filas {resolvedLabelA}: {summary.rows_a.toLocaleString()} · Filas {resolvedLabelB}: {summary.rows_b.toLocaleString()}
                </p>
                <p>
                  Columnas {resolvedLabelA}: {summary.columns_a} · Columnas {resolvedLabelB}: {summary.columns_b}
                </p>
                <pre className="overflow-auto rounded-lg bg-gray-900 text-gray-100 p-3">
                  {JSON.stringify(compareResult?.comparison, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
};

export default DataComparisonModule;
