import React, { useEffect, useMemo, useState } from "react";
import API_URL from "../../api";
import SectionHeader from "../../components/cards/SectionHeader";
import MetricCard from "../../components/cards/MetricCard";
import ChartCard from "../../components/charts/ChartCard";
import TableCard from "../../components/tables/TableCard";
import SkeletonBlock from "../../components/cards/SkeletonBlock";
import { toChartCardConfig } from "../../components/charts/chartMappers";

const SalesView = ({ onUnauthorized }) => {
  const token = useMemo(() => localStorage.getItem("token"), []);
  const [metrics, setMetrics] = useState(null);
  const [aiSummary, setAiSummary] = useState("");
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
      const [salesResponse, summaryResponse] = await Promise.all([
        fetchWithAuth(`${API_URL}/metrics/sales`),
        fetchWithAuth(`${API_URL}/metrics/summary`),
      ]);
      setMetrics(salesResponse);
      setAiSummary(summaryResponse.ai_summary || "");
    } catch (err) {
      setError(err.message || "No se pudo cargar el panel de ventas");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMetrics();
  }, []);

  const trendChart = toChartCardConfig(metrics?.charts?.trend);
  const topProductsChart = toChartCardConfig(metrics?.charts?.top_products);
  const categoriesChart = toChartCardConfig(metrics?.charts?.categories);

  const columns = [
    { key: "product_name", label: "Producto" },
    { key: "category", label: "Categoría" },
    { key: "revenue", label: "Ventas", format: "currency" },
    { key: "quantity_sold", label: "Unidades", format: "number" },
    { key: "margin", label: "Margen", format: "currency" },
  ];

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionHeader
          title="Panel de Ventas"
          subtitle="KPIs de ingresos, unidades y márgenes"
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
          <MetricCard label="Ventas totales" value={metrics?.kpis?.total_sales} format="currency" />
          <MetricCard label="Unidades vendidas" value={metrics?.kpis?.units_sold} format="number" />
          <MetricCard label="Ticket promedio" value={metrics?.kpis?.avg_ticket} format="currency" />
          <MetricCard label="Margen estimado" value={metrics?.kpis?.margin} format="currency" />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Ventas por día / semana"
          type={trendChart?.type}
          data={trendChart?.data || []}
          xKey={trendChart?.xKey}
          series={trendChart?.series}
        />
        <ChartCard
          title="Top productos"
          type={topProductsChart?.type}
          data={topProductsChart?.data || []}
          xKey={topProductsChart?.xKey}
          series={topProductsChart?.series}
        />
      </div>

      <ChartCard
        title="Ventas por categoría"
        type={categoriesChart?.type}
        data={categoriesChart?.data || []}
        xKey={categoriesChart?.xKey}
        series={categoriesChart?.series}
      />

      <TableCard
        title="Detalle de productos"
        data={metrics?.table || []}
        columns={columns}
        columnTypes={metrics?.column_types || {}}
      />

      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/70 p-5 space-y-2">
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Resumen automático (IA)</p>
        <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-line">
          {aiSummary || "Aún no hay resumen disponible."}
        </p>
      </div>
    </section>
  );
};

export default SalesView;
