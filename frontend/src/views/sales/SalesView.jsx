import React, { useEffect, useMemo, useState } from "react";
import API_URL from "../../api";
import SectionHeader from "../../components/cards/SectionHeader";
import MetricCard from "../../components/cards/MetricCard";
import ChartCard from "../../components/charts/ChartCard";
import TableCard from "../../components/tables/TableCard";
import SkeletonBlock from "../../components/cards/SkeletonBlock";

const SalesView = ({ onUnauthorized, onGoToData }) => {
  const token = useMemo(() => localStorage.getItem("token"), []);
  const [analysisData, setAnalysisData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [category, setCategory] = useState("");

  const fetchAnalysis = async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (fromDate) params.append("from_date", fromDate);
      if (toDate) params.append("to_date", toDate);
      if (category) params.append("category", category);

      const res = await fetch(`${API_URL}/metrics/sales?${params.toString()}`, {
        headers: {
          "Content-Type": "application/json",
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

      const data = await res.json();
      setAnalysisData(data);
    } catch (err) {
      if (err.message !== "unauthorized") {
        const friendlyMessage =
          err.name === "TypeError"
            ? "No se pudo conectar con el servidor. Intenta nuevamente."
            : err.message || "No se pudo cargar el panel de análisis";
        setError(friendlyMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalysis();
  }, [fromDate, toDate, category]);

  const kpis = analysisData?.kpis || {};
  const charts = analysisData?.charts || {};

  const normalizeSeriesKey = (name, idx) => {
    if (!name) return `serie_${idx}`;
    return name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .replace(/_{2,}/g, "_")
      .trim() || `serie_${idx}`;
  };

  const mapChart = (chart) => {
    if (!chart) return null;

    if (chart.type === "pie") {
      const values = chart?.series?.[0]?.data || [];
      const labels = chart?.x || [];

      return {
        type: "pie",
        data: labels.map((label, idx) => ({
          name: label,
          value: values[idx] ?? 0,
        })),
        series: [{ dataKey: "value", nameKey: "name" }],
      };
    }

    const xLabels = chart?.x || [];
    const seriesConfig = (chart?.series || []).map((serie, idx) => {
      const dataKey = serie.dataKey || normalizeSeriesKey(serie.name, idx);
      return {
        ...serie,
        dataKey,
        name: serie.name || dataKey,
      };
    });

    const data = xLabels.map((label, rowIdx) => {
      const row = { label };
      seriesConfig.forEach((serie) => {
        row[serie.dataKey] = serie.data?.[rowIdx] ?? 0;
      });
      return row;
    });

    return {
      type: chart.type || "bar",
      data,
      xKey: "label",
      series: seriesConfig.map((serie) => ({
        dataKey: serie.dataKey,
        name: serie.name,
      })),
    };
  };

  const trendChart = useMemo(() => mapChart(charts.trend), [charts]);
  const topProductsChart = useMemo(() => mapChart(charts.top_products), [charts]);
  const categoriesChart = useMemo(() => mapChart(charts.categories), [charts]);

  const tableData = analysisData?.table || [];
  const columnTypes = analysisData?.column_types || {};
  const alertMessages = analysisData?.alerts || [];
  const hasData = Boolean(tableData.length || Object.keys(kpis).length);

  const categoryOptions = useMemo(() => {
    const categoriesFromTable = tableData
      .map((row) => row?.category)
      .filter(Boolean);
    const categoriesFromChart = (charts?.categories?.x || []).filter(Boolean);
    return Array.from(new Set([...categoriesFromTable, ...categoriesFromChart])).sort();
  }, [tableData, charts]);

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionHeader
          title="Panel de Análisis"
          subtitle="KPIs básicos y visualizaciones rápidas"
          badge="Dashboard"
        />
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs text-slate-600 dark:text-slate-300">
            Desde
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="mt-1 w-36 rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-900"
            />
          </label>
          <label className="text-xs text-slate-600 dark:text-slate-300">
            Hasta
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="mt-1 w-36 rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-900"
            />
          </label>
          <label className="text-xs text-slate-600 dark:text-slate-300">
            Categoría
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="mt-1 w-44 rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            >
              <option value="">Todas</option>
              {categoryOptions.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </label>
          <button
            onClick={onGoToData}
            className="rounded-xl bg-blue-600 text-white px-3 py-2 text-sm font-semibold shadow hover:bg-blue-700"
          >
            Ir a Carga de datos
          </button>
          <button
            onClick={fetchAnalysis}
            className="rounded-xl border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm font-semibold"
          >
            Recargar
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-rose-600">{error}</p>}

      {!!alertMessages.length && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-500/70 dark:bg-amber-950/50 dark:text-amber-100">
          <span className="mt-0.5">⚠️</span>
          <div className="space-y-1">
            {alertMessages.map((msg, idx) => (
              <p key={idx}>{msg}</p>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <SkeletonBlock />
          <SkeletonBlock />
          <SkeletonBlock />
          <SkeletonBlock />
        </div>
      ) : hasData ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="Ventas totales"
            value={kpis?.total_sales}
            format="currency"
            tooltip="Suma de ventas en el período seleccionado"
          />
          <MetricCard
            label="Unidades totales"
            value={kpis?.units_sold}
            format="number"
            tooltip="Cantidad de unidades vendidas"
          />
          <MetricCard
            label="Ticket promedio"
            value={kpis?.avg_ticket}
            format="currency"
            tooltip="Ventas totales / número de transacciones"
          />
          <MetricCard
            label="Margen"
            value={kpis?.margin}
            format="currency"
            tooltip="Ganancia neta = Ventas - Costo de mercancía"
          />
        </div>
      ) : (
        <p className="text-sm text-amber-600">
          No hay datos de ventas. Sube archivos o conecta Mercado Libre para ver el panel.
        </p>
      )}

      {hasData && (
        <div className="grid gap-4 lg:grid-cols-3">
          <ChartCard
            title={charts?.trend?.title || "Tendencia"}
            type={trendChart?.type}
            data={trendChart?.data || []}
            xKey={trendChart?.xKey || "label"}
            series={trendChart?.series || []}
            tooltip="Evolución diaria de ventas y unidades"
          />
          <ChartCard
            title={charts?.top_products?.title || "Top productos"}
            type={topProductsChart?.type || "bar"}
            data={topProductsChart?.data || []}
            xKey={topProductsChart?.xKey || "label"}
            series={topProductsChart?.series || []}
            tooltip="Productos con mayor contribución en el período"
          />
          <ChartCard
            title={charts?.categories?.title || "Categorías"}
            type={categoriesChart?.type || "pie"}
            data={categoriesChart?.data || []}
            xKey={categoriesChart?.xKey || "label"}
            series={categoriesChart?.series || []}
            tooltip="Participación de ventas por categoría"
          />
        </div>
      )}

      {hasData && (
        <TableCard
          title="Tabla de análisis"
          data={tableData}
          columnTypes={columnTypes}
          columns={[
            { key: "product_name", label: "Producto" },
            { key: "category", label: "Categoría" },
            { key: "revenue", label: "Ventas", format: "currency" },
            { key: "quantity_sold", label: "Unidades", format: "number" },
            { key: "margin", label: "Margen", format: "currency" },
          ]}
        />
      )}
    </section>
  );
};

export default SalesView;
