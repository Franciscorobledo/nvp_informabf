import React, { useEffect, useMemo, useState } from "react";
import API_URL from "../../api";
import SectionHeader from "../../components/cards/SectionHeader";
import MetricCard from "../../components/cards/MetricCard";
import ChartCard from "../../components/charts/ChartCard";
import TableCard from "../../components/tables/TableCard";
import SkeletonBlock from "../../components/cards/SkeletonBlock";
import { toChartCardConfig } from "../../components/charts/chartMappers";
import { fetchWithAuth } from "../../utils/apiHelpers";

const StockView = ({ onUnauthorized }) => {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [category, setCategory] = useState("");

  const loadMetrics = async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (fromDate) params.append("from_date", fromDate);
      if (toDate) params.append("to_date", toDate);
      if (category) params.append("category", category);
      const stockResponse = await fetchWithAuth(`${API_URL}/metrics/stock?${params.toString()}`, {
        onUnauthorized,
      });
      setMetrics(stockResponse);
    } catch (err) {
      if (err.message !== "unauthorized") {
        setError(err.message || "No se pudo cargar el panel de stock");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMetrics();
  }, [fromDate, toDate, category]);

  const kpis = metrics?.kpis || {};
  const rotationChart = toChartCardConfig(metrics?.charts?.rotation);
  const deadStockChart = toChartCardConfig(metrics?.charts?.dead_stock);
  const semaphoreChart = toChartCardConfig(metrics?.charts?.semaphore);
  const alertMessages = metrics?.alerts || [];
  const tableData = metrics?.table || [];
  const hasData = Boolean(tableData.length || Object.keys(kpis).length);

  const hasChartData = (chartConfig) => Boolean(chartConfig?.data?.length);
  const chartsWithData = [rotationChart, deadStockChart, semaphoreChart].filter(hasChartData);

  const categoryOptions = useMemo(() => {
    const tableCategories = (metrics?.table || []).map((row) => row?.category).filter(Boolean);
    const chartCategories = (metrics?.charts?.rotation?.x || []).filter(Boolean);
    return Array.from(new Set([...tableCategories, ...chartCategories])).sort();
  }, [metrics]);

  const columns = [
    { key: "product_name", label: "Producto" },
    { key: "category", label: "Categoría" },
    { key: "current_stock", label: "Stock", format: "number" },
    { key: "quantity_sold_last30", label: "Ventas 30d", format: "number" },
    { key: "rotation", label: "Rotación", format: "number" },
    { key: "days_inventory", label: "Días inventario", format: "number" },
  ];

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionHeader
          title="Panel de Stock"
          subtitle="Salud de inventario, rotación y riesgo"
          badge="Dashboard oficial"
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
            onClick={loadMetrics}
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
      ) : !hasData ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-slate-700 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
          <p className="text-sm font-medium">No hay datos de stock. Sube un archivo o conecta Mercado Libre.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="Stock total"
            value={metrics?.kpis?.stock_total}
            format="number"
            tooltip="Unidades totales en inventario"
          />
          <MetricCard
            label="Productos críticos"
            value={metrics?.kpis?.critical_products}
            format="number"
            tooltip="Items con stock bajo (≤10 unidades)"
          />
          <MetricCard
            label="Sin rotación"
            value={metrics?.kpis?.dead_stock}
            format="number"
            tooltip="Productos con stock pero sin ventas recientes"
          />
          <MetricCard
            label="Días inventario promedio"
            value={metrics?.kpis?.avg_days_inventory}
            format="number"
            tooltip="Promedio de días que el inventario permanece antes de venderse"
          />
        </div>
      )}

      {!!chartsWithData.length && (
        <div className="grid gap-4 lg:grid-cols-2">
          {hasChartData(rotationChart) && (
            <ChartCard
              title="Rotación (30 días)"
              type={rotationChart?.type}
              data={rotationChart?.data || []}
              xKey={rotationChart?.xKey}
              series={rotationChart?.series}
              tooltip="Velocidad de venta vs stock disponible"
            />
          )}
          {hasChartData(deadStockChart) && (
            <ChartCard
              title="Stock muerto"
              type={deadStockChart?.type}
              data={deadStockChart?.data || []}
              xKey={deadStockChart?.xKey}
              series={deadStockChart?.series}
              tooltip="Productos con stock y sin rotación"
            />
          )}
        </div>
      )}

      {hasChartData(semaphoreChart) && (
        <ChartCard
          title="Semáforo"
          type={semaphoreChart?.type}
          data={semaphoreChart?.data || []}
          xKey={semaphoreChart?.xKey}
          series={semaphoreChart?.series}
          tooltip="Distribución de productos por nivel de riesgo"
        />
      )}

      {tableData.length > 0 && (
        <TableCard
          title="Detalle de inventario"
          data={tableData}
          columns={columns}
          columnTypes={metrics?.column_types || {}}
        />
      )}
    </section>
  );
};

export default StockView;
