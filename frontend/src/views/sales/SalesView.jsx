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

  const fetchAnalysis = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/analysis/metrics`, {
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
        setError(err.message || "No se pudo cargar el panel de análisis");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalysis();
  }, []);

  const status = analysisData?.status;
  const chartConfig = analysisData?.chart_data || {};
  const tableData = analysisData?.table_data || [];
  const columnTypes = analysisData?.column_types || {};

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionHeader
          title="Panel de Análisis"
          subtitle="KPIs básicos y visualizaciones rápidas"
          badge="Dashboard"
        />
        <div className="flex flex-wrap items-center gap-2">
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

      {status === "error" && (
        <p className="text-sm text-rose-600">
          No hay datos cargados. Sube archivos o conecta Mercado Libre.
        </p>
      )}

      {error && <p className="text-sm text-rose-600">{error}</p>}

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <SkeletonBlock />
          <SkeletonBlock />
          <SkeletonBlock />
          <SkeletonBlock />
        </div>
      ) : status === "ok" ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Ventas totales" value={analysisData?.ventas_totales} format="currency" />
          <MetricCard label="Unidades totales" value={analysisData?.unidades_totales} format="number" />
        </div>
      ) : null}

      {status === "ok" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard
            title="Tendencia"
            type={chartConfig?.type}
            data={chartConfig?.data || []}
            xKey={chartConfig?.x_key || chartConfig?.xKey || "label"}
            series={chartConfig?.series || []}
          />
          <TableCard
            title="Tabla de análisis"
            data={tableData}
            columnTypes={columnTypes}
          />
        </div>
      )}
    </section>
  );
};

export default SalesView;
