import React from "react";
import SkeletonBlock from "../cards/SkeletonBlock";

const ChartCard = ({ title, chart }) => (
  <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/70 p-4 shadow-sm">
    <div className="flex items-center justify-between mb-3">
      <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</h4>
      <span className="text-[11px] rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-1 text-slate-500 dark:text-slate-300">
        {chart?.type?.toUpperCase() || "N/A"}
      </span>
    </div>
    {chart ? (
      <div className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
        <p className="text-xs text-slate-500">Eje X: {Array.isArray(chart.x) ? chart.x.slice(0, 6).join(", ") : "—"}</p>
        {chart.series?.map((serie) => (
          <div key={serie.name} className="flex items-center justify-between rounded-xl bg-slate-50 dark:bg-slate-800/80 px-3 py-2">
            <span className="font-semibold text-slate-800 dark:text-slate-200">{serie.name}</span>
            <span className="text-xs text-slate-500 dark:text-slate-300">{serie.data.slice(0, 5).join(", ")}...</span>
          </div>
        ))}
      </div>
    ) : (
      <SkeletonBlock className="h-24" />
    )}
  </div>
);

export default ChartCard;
