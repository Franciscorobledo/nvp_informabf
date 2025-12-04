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
      const stockResponse = await fetchWithAuth(`${API_URL}/metrics/stock`);
      setMetrics(stockResponse);
    } catch (err) {
      setError(err.message || "No se pudo cargar el panel de stock");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMetrics();
  }, []);

  const rotationChart = toChartCardConfig(metrics?.charts?.rotation);
  const deadStockChart = toChartCardConfig(metrics?.charts?.dead_stock);
  const semaphoreChart = toChartCardConfig(metrics?.charts?.semaphore);

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
        <button
          onClick={loadMetrics}
          className="rounded-xl border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm font-semibold"
        >
          Recargar
        </button>
      </div>

      {error && <p className="text-sm text-rose-600">{error}</p>}

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <SkeletonBlock />
          <SkeletonBlock />
          <SkeletonBlock />
          <SkeletonBlock />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Stock total" value={metrics?.kpis?.stock_total} format="number" />
          <MetricCard label="Productos críticos" value={metrics?.kpis?.critical_products} format="number" />
          <MetricCard label="Sin rotación" value={metrics?.kpis?.dead_stock} format="number" />
          <MetricCard label="Días inventario promedio" value={metrics?.kpis?.avg_days_inventory} format="number" />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Rotación (30 días)"
          type={rotationChart?.type}
          data={rotationChart?.data || []}
          xKey={rotationChart?.xKey}
          series={rotationChart?.series}
        />
        <ChartCard
          title="Stock muerto"
          type={deadStockChart?.type}
          data={deadStockChart?.data || []}
          xKey={deadStockChart?.xKey}
          series={deadStockChart?.series}
        />
      </div>

      <ChartCard
        title="Semáforo"
        type={semaphoreChart?.type}
        data={semaphoreChart?.data || []}
        xKey={semaphoreChart?.xKey}
        series={semaphoreChart?.series}
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
