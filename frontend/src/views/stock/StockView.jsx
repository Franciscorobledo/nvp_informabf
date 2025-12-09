import React, { useEffect, useMemo, useState } from "react";
import API_URL from "../../api";
import SectionHeader from "../../components/cards/SectionHeader";
import MetricCard from "../../components/cards/MetricCard";
import ChartCard from "../../components/charts/ChartCard";
import TableCard from "../../components/tables/TableCard";
import SkeletonBlock from "../../components/cards/SkeletonBlock";
import { toChartCardConfig } from "../../components/charts/chartMappers";

const StockView = ({ onUnauthorized }) => {
  const token = useMemo(() => localStorage.getItem("token"), []);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [category, setCategory] = useState("");

  const fetchWithAuth = async (url, options = {}) => {
    const res = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
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

  const loadMetrics = async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (fromDate) params.append("from_date", fromDate);
      if (toDate) params.append("to_date", toDate);
      if (category) params.append("category", category);
      const stockResponse = await fetchWithAuth(`${API_URL}/metrics/stock?${params.toString()}`);
      setMetrics(stockResponse);
    } catch (err) {
      setError(err.message || "No se pudo cargar el panel de stock");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMetrics();
  }, [fromDate, toDate, category]);

  const rotationChart = toChartCardConfig(metrics?.charts?.rotation);
  const deadStockChart = toChartCardConfig(metrics?.charts?.dead_stock);
  const semaphoreChart = toChartCardConfig(metrics?.charts?.semaphore);
  const alertMessages = metrics?.alerts || [];

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

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Rotación (30 días)"
          type={rotationChart?.type}
          data={rotationChart?.data || []}
          xKey={rotationChart?.xKey}
          series={rotationChart?.series}
          tooltip="Velocidad de venta vs stock disponible"
        />
        <ChartCard
          title="Stock muerto"
          type={deadStockChart?.type}
          data={deadStockChart?.data || []}
          xKey={deadStockChart?.xKey}
          series={deadStockChart?.series}
          tooltip="Productos con stock y sin rotación"
        />
      </div>

      <ChartCard
        title="Semáforo"
        type={semaphoreChart?.type}
        data={semaphoreChart?.data || []}
        xKey={semaphoreChart?.xKey}
        series={semaphoreChart?.series}
        tooltip="Distribución de productos por nivel de riesgo"
      />

      <TableCard
        title="Detalle de inventario"
        data={metrics?.table || []}
        columns={columns}
        columnTypes={metrics?.column_types || {}}
      />
    </section>
  );
};

export default StockView;
