import React from "react";
import SkeletonBlock from "../cards/SkeletonBlock";

const formatValue = (value, format) => {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  if (format === "currency") {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      maximumFractionDigits: 0,
    }).format(value);
  }
  if (format === "number") {
    return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 }).format(value);
  }
  return value;
};

const TableCard = ({ title, data = [], columns = [], columnTypes = {} }) => {
  const visibleColumns = columns.length
    ? columns
    : Object.keys(data[0] || {}).map((key) => ({ key, label: key }));

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/70 shadow-sm">
      <div className="flex items-center justify-between px-4 py-3">
        <div>
          <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</h4>
          <p className="text-xs text-slate-500">{data.length} filas • tipos detectados</p>
        </div>
        <div className="flex flex-wrap gap-1 max-w-xs justify-end">
          {Object.entries(columnTypes).map(([key, type]) => (
            <span
              key={key}
              className="rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-1 text-[11px] font-semibold text-slate-500 dark:text-slate-300"
            >
              {key}: {type}
            </span>
          ))}
        </div>
      </div>
      <div className="max-h-96 overflow-auto">
        <table className="min-w-full text-left text-xs text-slate-700 dark:text-slate-200">
          <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800/80">
            <tr>
              {visibleColumns.map((col) => (
                <th key={col.key} className="px-3 py-2 font-semibold uppercase tracking-wide text-[11px]">
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, idx) => (
              <tr key={idx} className="border-t border-slate-100 dark:border-slate-800">
                {visibleColumns.map((col) => (
                  <td key={col.key} className="px-3 py-2 whitespace-nowrap">
                    {formatValue(row[col.key], col.format)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {!data.length && <SkeletonBlock className="h-24 m-4" />}
      </div>
    </div>
  );
};

export default TableCard;
