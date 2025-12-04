import React from "react";

const MetricCard = ({ label, value, format = "number", delta, highlight = "" }) => {
  const formattedValue = (() => {
    if (format === "currency") {
      return new Intl.NumberFormat("es-AR", {
        style: "currency",
        currency: "ARS",
        maximumFractionDigits: 0,
      }).format(value || 0);
    }
    if (format === "number") {
      return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 }).format(value ?? 0);
    }
    return value ?? "—";
  })();

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/70 p-4 shadow-sm">
      <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-300 uppercase tracking-wide">
        <span>{label}</span>
        {highlight && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-100 px-2 py-0.5 text-[10px] font-bold">
            {highlight}
          </span>
        )}
      </div>
      <div className="flex items-end gap-2">
        <p className="text-2xl font-bold text-slate-900 dark:text-white">{formattedValue}</p>
        {delta !== undefined && (
          <span className={`text-sm font-semibold ${delta >= 0 ? "text-emerald-600" : "text-rose-500"}`}>
            {delta >= 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(1)}%
          </span>
        )}
      </div>
    </div>
  );
};

export default MetricCard;
