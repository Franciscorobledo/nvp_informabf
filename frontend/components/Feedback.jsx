import React from "react";

const variantStyles = {
  error:
    "border-red-200 bg-red-50 text-red-800 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-100",
  warning:
    "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/50 dark:text-amber-100",
  info:
    "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900/60 dark:bg-blue-950/50 dark:text-blue-100",
};

export const MessageCard = ({ message, title, variant = "error", className = "" }) => (
  <div
    className={`rounded-2xl border px-4 py-3 text-sm shadow-sm ${
      variantStyles[variant] || variantStyles.error
    } ${className}`}
  >
    {title && <p className="font-semibold mb-1">{title}</p>}
    <p>{message}</p>
  </div>
);

export const LoadingBanner = ({ message = "Cargando...", subtle = false }) => (
  <div
    className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold shadow-sm ${
      subtle
        ? "border-blue-200/40 bg-blue-500/5 text-blue-900 dark:border-blue-800/60 dark:bg-blue-900/20 dark:text-blue-100"
        : "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900/60 dark:bg-blue-950/50 dark:text-blue-100"
    }`}
  >
    <span
      className="relative flex h-3 w-3"
      aria-hidden="true"
    >
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
      <span className="relative inline-flex h-3 w-3 rounded-full bg-blue-500" />
    </span>
    <span>{message}</span>
  </div>
);
