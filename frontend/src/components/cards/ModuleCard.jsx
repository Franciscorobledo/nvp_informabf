import React from "react";

const ModuleCard = ({ title, description, icon, actionLabel, onAction, badge }) => (
  <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/70 p-4 shadow-sm flex flex-col gap-3">
    <div className="flex items-center gap-3">
      <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 via-indigo-500 to-cyan-400 text-white flex items-center justify-center">
        {icon || <span>✨</span>}
      </div>
      <div className="flex-1">
        <p className="text-sm font-semibold text-slate-900 dark:text-white">{title}</p>
        <p className="text-xs text-slate-500 dark:text-slate-300">{description}</p>
      </div>
      {badge && (
        <span className="text-[11px] rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-100 px-2 py-1 font-semibold">
          {badge}
        </span>
      )}
    </div>
    {actionLabel && (
      <button
        onClick={onAction}
        className="self-start rounded-xl bg-slate-900 text-white px-3 py-2 text-xs font-semibold hover:bg-slate-800 transition"
      >
        {actionLabel}
      </button>
    )}
  </div>
);

export default ModuleCard;
