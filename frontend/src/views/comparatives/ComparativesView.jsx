import React, { useEffect, useMemo, useState } from "react";
import API_URL from "../../api";
import SectionHeader from "../../components/cards/SectionHeader";
import ChartCard from "../../components/charts/ChartCard";
import SkeletonBlock from "../../components/cards/SkeletonBlock";
import { toChartCardConfig } from "../../components/charts/chartMappers";

const ComparativesView = ({ onUnauthorized }) => {
  const token = useMemo(() => localStorage.getItem("token"), []);
  const [charts, setCharts] = useState(null);
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

  const loadComparatives = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetchWithAuth(`${API_URL}/metrics/comparative`);
      setCharts(response.charts);
    } catch (err) {
      setError(err.message || "No se pudo cargar el panel de comparativas");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadComparatives();
  }, []);

  const monthlyChart = toChartCardConfig(charts?.monthly);
  const categoryChart = toChartCardConfig(charts?.categories);
  const periodChart = toChartCardConfig(charts?.periods);

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionHeader
          title="Panel de Comparativas"
          subtitle="Mes vs mes, categoría y períodos"
          badge="Dashboard oficial"
        />
        <button
          onClick={loadComparatives}
          className="rounded-xl border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm font-semibold"
        >
          Recargar
        </button>
      </div>

      {error && <p className="text-sm text-rose-600">{error}</p>}

      {loading ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <SkeletonBlock />
          <SkeletonBlock />
          <SkeletonBlock />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <ChartCard
            title="Mes vs Mes"
            type={monthlyChart?.type}
            data={monthlyChart?.data || []}
            xKey={monthlyChart?.xKey}
            series={monthlyChart?.series}
          />
          <ChartCard
            title="Categoría vs Categoría"
            type={categoryChart?.type || "stacked"}
            data={categoryChart?.data || []}
            xKey={categoryChart?.xKey}
            series={categoryChart?.series}
          />
          <ChartCard
            title="Período vs Período"
            type={periodChart?.type}
            data={periodChart?.data || []}
            xKey={periodChart?.xKey}
            series={periodChart?.series}
          />
        </div>
      )}
    </section>
  );
};

export default ComparativesView;
