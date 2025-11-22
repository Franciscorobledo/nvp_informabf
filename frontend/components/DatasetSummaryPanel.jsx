import React from "react";

const iconByKeyword = [
  { match: ["sku", "codigo"], icon: "🏷️" },
  { match: ["producto", "item", "articulo"], icon: "🛒" },
  { match: ["bodega", "almacen", "ubicacion"], icon: "🏢" },
  { match: ["fecha", "date"], icon: "📅" },
  { match: ["precio", "monto", "valor"], icon: "💰" },
];

const numericKeys = ["mean", "std", "min", "max", "25%", "50%", "75%", "count", "sum"];

const formatNumber = (value) => {
  if (value === null || value === undefined || value === "nan") return "-";
  if (typeof value === "number") return value.toLocaleString("es-ES", { maximumFractionDigits: 2 });
  const numberValue = Number(value);
  return Number.isNaN(numberValue)
    ? String(value)
    : numberValue.toLocaleString("es-ES", { maximumFractionDigits: 2 });
};

const detectType = (column, stats) => {
  if (!stats || typeof stats !== "object") return "text";
  if (stats.error) return "error";

  const keys = Object.keys(stats).map((k) => k.toLowerCase());
  const lowerCol = column.toLowerCase();

  const isDateLike = keys.includes("min") && keys.includes("max") &&
    (Date.parse(stats.min) || Date.parse(stats.max) || lowerCol.includes("fecha") || lowerCol.includes("date"));

  if (isDateLike) return "date";
  if (keys.includes("unique_values")) return "unique";
  if (numericKeys.some((key) => key in stats)) return "numeric";

  const values = Object.values(stats);
  const areCounts = values.every((value) => typeof value === "number");
  if (areCounts) return "categorical";

  return "text";
};

const pickIcon = (column, type) => {
  const lower = column.toLowerCase();
  const keywordIcon = iconByKeyword.find(({ match }) =>
    match.some((word) => lower.includes(word))
  );

  if (keywordIcon) return keywordIcon.icon;

  const fallback = {
    numeric: "📊",
    categorical: "🧩",
    date: "📅",
    unique: "🔢",
    error: "⚠️",
    text: "📄",
  };

  return fallback[type] || "📄";
};

const BaseCard = ({ children }) => (
  <div className="bg-white/90 dark:bg-slate-900/80 border border-gray-200 dark:border-slate-800 rounded-xl shadow-md backdrop-blur-sm p-4">
    {children}
  </div>
);

const SummaryBadge = ({ label, value }) => (
  <div className="flex items-center justify-between bg-gray-50 dark:bg-slate-800 rounded-lg px-3 py-2">
    <span className="text-xs text-gray-500 dark:text-slate-400">{label}</span>
    <span className="text-sm font-semibold text-gray-800 dark:text-slate-100">{value}</span>
  </div>
);

const DatasetSummaryPanel = ({ summary }) => {
  if (!summary) {
    return (
      <BaseCard>
        <p className="text-sm text-gray-600 dark:text-slate-300">No hay resumen disponible.</p>
      </BaseCard>
    );
  }

  if (typeof summary !== "object" || Array.isArray(summary)) {
    return (
      <BaseCard>
        <p className="text-sm text-gray-700 dark:text-slate-200 whitespace-pre-wrap">{String(summary)}</p>
      </BaseCard>
    );
  }

  const entries = Object.entries(summary);
  const analyzed = entries.map(([column, stats]) => ({
    column,
    stats,
    type: detectType(column, stats),
    icon: pickIcon(column, detectType(column, stats)),
  }));

  const anomalies = analyzed.filter(({ stats, type }) => stats?.error || type === "error");

  const numericColumns = analyzed.filter(({ type }) => type === "numeric");
  const datasetCount = numericColumns.reduce((acc, { stats }) => {
    const value = Number(stats?.count);
    return Number.isFinite(value) ? Math.max(acc ?? value, value) : acc;
  }, null);

  const minValue = numericColumns.reduce((acc, { stats }) => {
    const value = Number(stats?.min);
    if (!Number.isFinite(value)) return acc;
    if (acc === null) return value;
    return Math.min(acc, value);
  }, null);

  const maxValue = numericColumns.reduce((acc, { stats }) => {
    const value = Number(stats?.max);
    if (!Number.isFinite(value)) return acc;
    if (acc === null) return value;
    return Math.max(acc, value);
  }, null);

  const topCategorical = analyzed.find(({ type, stats }) => type === "categorical" && stats && Object.keys(stats).length > 0);

  const smartNarratives = analyzed
    .map((item) => {
      const { stats, type, column, icon } = item;

      if (type === "numeric") {
        const mean = Number(stats.mean ?? stats.prom ?? 0);
        const max = Number(stats.max ?? 0);
        const min = Number(stats.min ?? 0);
        const std = Number(stats.std ?? 0);
        const variability = mean !== 0 ? Math.abs(std / mean) : 0;

        const mood = variability > 0.6 ? "Alta variabilidad" : "Tendencia estable";
        const detail = variability > 0.6
          ? "Revisa outliers y crea alertas para variaciones fuertes."
          : "Úsalo como KPI central y define umbrales de control.";

        return {
          column,
          icon,
          badge: "Métrica",
          score: (stats.count ?? 0) + variability * 100,
          headline: `${mood} en ${column}`,
          body: `Promedio ${formatNumber(mean)}, rango ${formatNumber(min)} - ${formatNumber(max)}. ${detail}`,
        };
      }

      if (type === "categorical") {
        const sorted = Object.entries(stats)
          .sort(([, a], [, b]) => Number(b) - Number(a));
        const [topName, topValue] = sorted[0] || [];
        const total = sorted.reduce((acc, [, value]) => acc + Number(value || 0), 0) || 1;
        const topShare = ((Number(topValue || 0) / total) * 100).toFixed(1);

        return {
          column,
          icon,
          badge: "Comportamiento",
          score: Number(topValue || 0),
          headline: `${topName || "Categoría"} domina ${column}`,
          body: `${formatNumber(topValue)} registros (${topShare}% del total). Ideal para segmentar reportes y detectar nichos.`,
        };
      }

      if (type === "date") {
        return {
          column,
          icon,
          badge: "Tiempo",
          score: Number(stats.count || 0),
          headline: `Ventana temporal en ${column}`,
          body: `Cobertura desde ${stats.min || "-"} hasta ${stats.max || "-"}. Aprovecha para medir tendencias y estacionalidad.`,
        };
      }

      if (type === "unique") {
        return {
          column,
          icon,
          badge: "Identidad",
          score: Number(stats.unique_values || 0),
          headline: `${formatNumber(stats.unique_values)} valores únicos en ${column}`,
          body: "Úsalo para llaves, deduplicación o segmentaciones personalizadas.",
        };
      }

      if (type === "error") {
        return {
          column,
          icon,
          badge: "Atención",
          score: 999,
          headline: `Revisa ${column}`,
          body: stats.error || "Dato fuera de rango o corrupto. Prioriza limpieza.",
        };
      }

      return null;
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);

  const typeCount = analyzed.reduce(
    (acc, item) => {
      acc[item.type] = (acc[item.type] || 0) + 1;
      return acc;
    },
    { total: analyzed.length }
  );

  const topCategories = topCategorical
    ? Object.entries(topCategorical.stats)
        .sort(([, a], [, b]) => Number(b) - Number(a))
        .slice(0, 3)
    : [];

  const kpiCards = [
    {
      label: "Registros analizados",
      value: datasetCount !== null ? formatNumber(datasetCount) : "--",
      helper: "Basado en campos numéricos detectados",
    },
    {
      label: "Mínimo global",
      value: minValue !== null ? formatNumber(minValue) : "--",
      helper: "Valor mínimo entre columnas numéricas",
    },
    {
      label: "Máximo global",
      value: maxValue !== null ? formatNumber(maxValue) : "--",
      helper: "Valor máximo entre columnas numéricas",
    },
  ];

  const renderTopItems = (stats) => {
    const sorted = Object.entries(stats)
      .sort(([, a], [, b]) => Number(b) - Number(a))
      .slice(0, 3);

    return (
      <div className="mt-3 space-y-2">
        <p className="text-xs font-semibold text-gray-500 dark:text-slate-400">Top 3 categorías</p>
        <div className="space-y-2">
          {sorted.map(([label, value]) => (
            <div key={label} className="flex items-center justify-between text-sm">
              <span className="text-gray-700 dark:text-slate-200 truncate mr-2">{label}</span>
              <span className="font-semibold text-gray-900 dark:text-white">{formatNumber(value)}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderCardContent = (item) => {
    const { stats, type } = item;

    if (type === "numeric") {
      return (
        <div className="grid grid-cols-2 gap-3">
          <SummaryBadge label="Total" value={formatNumber(stats.count)} />
          {"sum" in stats && <SummaryBadge label="Suma" value={formatNumber(stats.sum)} />}
          {"mean" in stats && <SummaryBadge label="Promedio" value={formatNumber(stats.mean)} />}
          <SummaryBadge label="Mínimo" value={formatNumber(stats.min)} />
          <SummaryBadge label="Máximo" value={formatNumber(stats.max)} />
          {"std" in stats && <SummaryBadge label="Desviación" value={formatNumber(stats.std)} />}
        </div>
      );
    }

    if (type === "date") {
      return (
        <div className="space-y-2">
          <SummaryBadge label="Registros" value={formatNumber(stats.count)} />
          <SummaryBadge label="Desde" value={stats.min || "-"} />
          <SummaryBadge label="Hasta" value={stats.max || "-"} />
        </div>
      );
    }

    if (type === "categorical") {
      return renderTopItems(stats);
    }

    if (type === "unique") {
      return <SummaryBadge label="Valores únicos" value={formatNumber(stats.unique_values)} />;
    }

    if (type === "error") {
      return (
        <div className="text-sm text-red-700 bg-red-50 dark:bg-red-900/30 dark:text-red-200 rounded-lg p-3 border border-red-100 dark:border-red-800">
          {stats.error}
        </div>
      );
    }

    return (
      <p className="text-sm text-gray-700 dark:text-slate-200 whitespace-pre-wrap">
        {typeof stats === "string" ? stats : JSON.stringify(stats, null, 2)}
      </p>
    );
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        {kpiCards.map((kpi) => (
          <BaseCard key={kpi.label}>
            <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-slate-400">{kpi.label}</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{kpi.value}</p>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">{kpi.helper}</p>
          </BaseCard>
        ))}

        <BaseCard>
          <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-slate-400">Top 3 categorías</p>
          {topCategories.length > 0 ? (
            <div className="mt-2 space-y-2">
              {topCategories.map(([label, value]) => (
                <div key={label} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700 dark:text-slate-200 truncate mr-2">{label}</span>
                  <span className="font-semibold text-gray-900 dark:text-white">{formatNumber(value)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Esperando datos categóricos.</p>
          )}
        </BaseCard>
      </div>

      {smartNarratives.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {smartNarratives.map((insight) => (
            <BaseCard key={insight.column}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg" aria-hidden="true">{insight.icon}</span>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-blue-600 dark:text-blue-300 font-semibold">
                      Reporte inteligente
                    </p>
                    <h4 className="text-sm font-bold text-gray-900 dark:text-white leading-tight">
                      {insight.headline}
                    </h4>
                  </div>
                </div>
                <span className="text-[11px] px-2 py-1 rounded-full bg-blue-50 dark:bg-slate-800 text-blue-700 dark:text-blue-200 border border-blue-100 dark:border-slate-700">
                  {insight.badge}
                </span>
              </div>
              <p className="text-sm text-gray-700 dark:text-slate-200 mt-2 leading-relaxed">{insight.body}</p>
            </BaseCard>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <BaseCard>
          <p className="text-xs text-gray-500 dark:text-slate-400">Columnas analizadas</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{typeCount.total}</p>
        </BaseCard>
        <BaseCard>
          <p className="text-xs text-gray-500 dark:text-slate-400">Campos numéricos</p>
          <p className="text-xl font-semibold text-gray-900 dark:text-white">{typeCount.numeric || 0}</p>
        </BaseCard>
        <BaseCard>
          <p className="text-xs text-gray-500 dark:text-slate-400">Campos con fechas</p>
          <p className="text-xl font-semibold text-gray-900 dark:text-white">{typeCount.date || 0}</p>
        </BaseCard>
        <BaseCard>
          <p className="text-xs text-gray-500 dark:text-slate-400">Campos categóricos</p>
          <p className="text-xl font-semibold text-gray-900 dark:text-white">{typeCount.categorical || 0}</p>
        </BaseCard>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {analyzed.map((item) => (
          <BaseCard key={item.column}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-lg" aria-hidden="true">{item.icon}</span>
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white truncate">{item.column}</h4>
              </div>
              <span className="text-xs uppercase tracking-wide text-gray-500 dark:text-slate-400 bg-gray-50 dark:bg-slate-800 px-2 py-1 rounded-full">
                {item.type === "numeric"
                  ? "Numérico"
                  : item.type === "categorical"
                  ? "Categoría"
                  : item.type === "date"
                  ? "Fecha"
                  : item.type === "unique"
                  ? "Únicos"
                  : item.type === "error"
                  ? "Error"
                  : "Texto"}
              </span>
            </div>
            {renderCardContent(item)}
          </BaseCard>
        ))}
      </div>

      {anomalies.length > 0 && (
        <BaseCard>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg" aria-hidden="true">⚠️</span>
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Errores o anomalías detectadas</h4>
          </div>
          <div className="space-y-2">
            {anomalies.map((item) => (
              <div
                key={item.column}
                className="flex items-start justify-between bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-lg px-3 py-2"
              >
                <div>
                  <p className="text-sm font-semibold text-red-800 dark:text-red-200">{item.column}</p>
                  <p className="text-xs text-red-700 dark:text-red-300">{item.stats.error || "Dato fuera de rango"}</p>
                </div>
                <span className="text-lg" aria-hidden="true">⚠️</span>
              </div>
            ))}
          </div>
        </BaseCard>
      )}
    </div>
  );
};

export default DatasetSummaryPanel;
