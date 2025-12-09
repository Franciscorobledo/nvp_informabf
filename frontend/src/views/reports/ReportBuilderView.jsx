import React, { useState } from "react";
import API_URL from "../../api";
import SectionHeader from "../../components/cards/SectionHeader";
import ChartCard from "../../components/charts/ChartCard";
import TableCard from "../../components/tables/TableCard";
import SkeletonBlock from "../../components/cards/SkeletonBlock";
import { toChartCardConfig } from "../../components/charts/chartMappers";
import { fetchWithAuth } from "../../utils/apiHelpers";

const metricsOptions = [
  { value: "sales", label: "Ventas" },
  { value: "units", label: "Unidades" },
  { value: "margin", label: "Margen" },
  { value: "stock", label: "Stock" },
  { value: "rotation", label: "Rotación" },
];

const dimensionOptions = [
  { value: "product", label: "Producto" },
  { value: "category", label: "Categoría" },
  { value: "date", label: "Fecha" },
];

const chartTypes = [
  { value: "bar", label: "Barras" },
  { value: "line", label: "Líneas" },
  { value: "pie", label: "Pastel" },
  { value: "table", label: "Tabla" },
];

const ReportBuilderView = ({ onUnauthorized }) => {
  const [config, setConfig] = useState({
    metric: "sales",
    dimension: "product",
    chart_type: "bar",
  });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleBuild = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetchWithAuth(`${API_URL}/metrics/custom`, {
        method: "POST",
        body: JSON.stringify(config),
        onUnauthorized,
      });
      setResult(response);
    } catch (err) {
      if (err.message !== "unauthorized") {
        setError(err.message || "No se pudo generar el reporte personalizado");
      }
    } finally {
      setLoading(false);
    }
  };

  const previewChart = toChartCardConfig(result?.chart);

  const columns = (result?.table_data?.[0]
    ? Object.keys(result.table_data[0])
    : []
  ).map((key) => ({ key, label: key }));

  return (
    <section className="space-y-6">
      <SectionHeader
        title="Report Builder"
        subtitle="Selecciona métrica, dimensión y visualización"
        badge="Dashboard oficial"
      />

      {error && <p className="text-sm text-rose-600">{error}</p>}

      <form onSubmit={handleBuild} className="grid gap-4 md:grid-cols-4">
        <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          Métrica
          <select
            value={config.metric}
            onChange={(e) => setConfig({ ...config, metric: e.target.value })}
            className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
          >
            {metricsOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          Dimensión
          <select
            value={config.dimension}
            onChange={(e) => setConfig({ ...config, dimension: e.target.value })}
            className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
          >
            {dimensionOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          Visualización
          <select
            value={config.chart_type}
            onChange={(e) => setConfig({ ...config, chart_type: e.target.value })}
            className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
          >
            {chartTypes.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <div className="flex items-end">
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-blue-600 text-white px-4 py-2 text-sm font-semibold shadow hover:bg-blue-700 disabled:opacity-60"
          >
            {loading ? "Generando..." : "Vista previa"}
          </button>
        </div>
      </form>

      {loading && <SkeletonBlock className="h-24" />}

      {config.chart_type === "table" ? (
        <TableCard
          title="Vista previa"
          data={result?.table_data || []}
          columns={columns}
          columnTypes={result?.column_types || {}}
        />
      ) : (
        <ChartCard
          title="Vista previa"
          type={previewChart?.type}
          data={previewChart?.data || []}
          xKey={previewChart?.xKey}
          series={previewChart?.series}
        />
      )}

      <div className="flex justify-end">
        <button
          type="button"
          className="rounded-xl border border-slate-300 dark:border-slate-700 px-4 py-2 text-sm font-semibold"
        >
          Guardar reporte
        </button>
      </div>
    </section>
  );
};

export default ReportBuilderView;
