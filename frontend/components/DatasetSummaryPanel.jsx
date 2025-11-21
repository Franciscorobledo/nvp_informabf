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
  <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl shadow-sm p-4">
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

  const typeCount = analyzed.reduce(
    (acc, item) => {
      acc[item.type] = (acc[item.type] || 0) + 1;
      return acc;
    },
    { total: analyzed.length }
  );

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
    <div className="space-y-4">
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
