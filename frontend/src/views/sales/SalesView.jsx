import React, { useEffect, useMemo, useState } from "react";
import API_URL from "../../api";
import SectionHeader from "../../components/cards/SectionHeader";
import MetricCard from "../../components/cards/MetricCard";
import SkeletonBlock from "../../components/cards/SkeletonBlock";
import ChartCard from "../../components/charts/ChartCard";
import TableCard from "../../components/tables/TableCard";

const metricOptions = [
  { value: "sales", label: "Ventas" },
  { value: "units", label: "Unidades" },
  { value: "margin", label: "Margen" },
  { value: "stock", label: "Stock" },
  { value: "rotation", label: "Rotación" },
];

const dimensionOptions = [
  { value: "product_name", label: "Producto" },
  { value: "category", label: "Categoría" },
  { value: "date", label: "Fecha" },
  { value: "channel", label: "Canal" },
];

const SalesView = ({ onUnauthorized }) => {
  const token = useMemo(() => localStorage.getItem("token"), []);
  const [mode, setMode] = useState("auto");
  const [source, setSource] = useState("demo");
  const [autoMetrics, setAutoMetrics] = useState(null);
  const [manualConfig, setManualConfig] = useState({
    metric: "sales",
    dimension: "product_name",
    filters: { top_n: 10 },
    chart_type: "bar",
  });
  const [manualResult, setManualResult] = useState(null);
  const [loading, setLoading] = useState({ auto: false, manual: false, source: false });
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

  const fetchAutoMetrics = async () => {
    setLoading((prev) => ({ ...prev, auto: true }));
    setError("");
    try {
      const data = await authorizedFetch(`${API_URL}/data/metrics/auto`);
      setAutoMetrics(data);
      setSource(data.source);
    } catch (err) {
      setError(err.message || "No se pudo obtener métricas automáticas");
    } finally {
      setLoading((prev) => ({ ...prev, auto: false }));
    }
  };

  const applyManual = async () => {
    setLoading((prev) => ({ ...prev, manual: true }));
    setError("");
    try {
      const payload = { ...manualConfig };
      const data = await authorizedFetch(`${API_URL}/data/metrics/manual`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setManualResult(data);
    } catch (err) {
      setError(err.message || "No se pudo calcular la vista manual");
    } finally {
      setLoading((prev) => ({ ...prev, manual: false }));
    }
  };

  const switchSource = async (nextSource) => {
    setLoading((prev) => ({ ...prev, source: true }));
    setError("");
    try {
      await authorizedFetch(`${API_URL}/data/source`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: nextSource }),
      });
      setSource(nextSource);
      fetchAutoMetrics();
    } catch (err) {
      setError(err.message || "No se pudo cambiar la fuente de datos");
    } finally {
      setLoading((prev) => ({ ...prev, source: false }));
    }
  };

  useEffect(() => {
    fetchAutoMetrics();
  }, []);

  const kpis = autoMetrics?.kpis || {};
  const chartData = autoMetrics?.chart_data;
  const tableData = autoMetrics?.table_data || [];

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionHeader title="Ventas" subtitle="Fuente unificada de Mercado Libre y archivos" badge="Panel de ventas" />
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500">Fuente: {source}</span>
          <button
            onClick={() => switchSource("files")}
            className={`rounded-xl px-3 py-2 text-xs font-semibold border ${
              source === "files" ? "bg-blue-600 text-white border-blue-600" : "border-slate-300"
            }`}
          >
            Archivos
          </button>
          <button
            onClick={() => switchSource("mercadolibre")}
            className={`rounded-xl px-3 py-2 text-xs font-semibold border ${
              source === "mercadolibre" ? "bg-emerald-600 text-white border-emerald-600" : "border-slate-300"
            }`}
          >
            Mercado Libre
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-rose-600">{error}</p>}

      <div className="inline-flex items-center rounded-2xl bg-slate-100 dark:bg-slate-800/70 p-1">
        <button
          onClick={() => setMode("auto")}
          className={`px-4 py-2 text-sm font-semibold rounded-xl ${mode === "auto" ? "bg-white shadow" : "text-slate-500"}`}
        >
          Modo automático
        </button>
        <button
          onClick={() => setMode("manual")}
          className={`px-4 py-2 text-sm font-semibold rounded-xl ${mode === "manual" ? "bg-white shadow" : "text-slate-500"}`}
        >
          Modo manual
        </button>
      </div>

      {mode === "auto" ? (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {loading.auto ? (
              <>
                <SkeletonBlock />
                <SkeletonBlock />
                <SkeletonBlock />
                <SkeletonBlock />
              </>
            ) : (
              <>
                <MetricCard label="Ventas totales" value={kpis.total_sales?.value} format="currency" />
                <MetricCard label="Unidades" value={kpis.total_units?.value} />
                <MetricCard label="Ticket promedio" value={kpis.avg_ticket?.value} format="currency" />
                <MetricCard label="Margen" value={kpis.total_margin?.value} format="currency" />
              </>
            )}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard title="Ranking de ventas" chart={chartData} />
            <ChartCard title="Datos listos para gráfico" chart={chartData} />
          </div>

          <TableCard title="Tabla consolidada" data={tableData} columnTypes={{}} />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              Métrica
              <select
                value={manualConfig.metric}
                onChange={(e) => setManualConfig({ ...manualConfig, metric: e.target.value })}
                className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
              >
                {metricOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              Dimensión
              <select
                value={manualConfig.dimension}
                onChange={(e) => setManualConfig({ ...manualConfig, dimension: e.target.value })}
                className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
              >
                {dimensionOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              Top N
              <input
                type="number"
                min={0}
                value={manualConfig.filters.top_n || ""}
                onChange={(e) =>
                  setManualConfig({ ...manualConfig, filters: { ...manualConfig.filters, top_n: Number(e.target.value) } })
                }
                className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
              />
            </label>

            <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              Tipo de gráfico
              <select
                value={manualConfig.chart_type}
                onChange={(e) => setManualConfig({ ...manualConfig, chart_type: e.target.value })}
                className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
              >
                <option value="bar">Barras</option>
                <option value="line">Líneas</option>
                <option value="table">Tabla</option>
              </select>
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={applyManual}
              disabled={loading.manual}
              className="rounded-xl bg-blue-600 text-white px-4 py-2 text-sm font-semibold shadow hover:bg-blue-700 disabled:opacity-60"
            >
              {loading.manual ? "Calculando..." : "Aplicar"}
            </button>
            <p className="text-xs text-slate-500">Agrupa en backend, listo para gráfico + tabla</p>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard title="Resultado manual" chart={manualResult?.chart_data} />
            <TableCard title="Tabla agregada" data={manualResult?.table_data || []} columnTypes={{}} />
          </div>
        </div>
      )}
    </section>
  );
};

export default SalesView;
