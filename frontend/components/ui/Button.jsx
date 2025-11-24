import React from "react";

const baseButton =
  "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/60 focus:ring-offset-2 focus:ring-offset-slate-950 disabled:opacity-60 disabled:cursor-not-allowed";

export const PrimaryButton = ({ className = "", children, ...props }) => (
  <button
    className={`${baseButton} bg-indigo-500 text-white shadow-lg shadow-indigo-500/20 hover:bg-indigo-400 ${className}`}
    {...props}
  >
    {children}
  </button>
);

export const SecondaryButton = ({ className = "", children, ...props }) => (
  <button
    className={`${baseButton} border border-slate-300 bg-white text-slate-800 hover:border-indigo-400 hover:text-indigo-700 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100 dark:hover:text-indigo-100 ${className}`}
    {...props}
  >
    {children}
  </button>
);

export const GhostButton = ({ className = "", children, ...props }) => (
  <button
    className={`${baseButton} text-slate-600 hover:text-slate-900 hover:bg-slate-200/80 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-900/60 ${className}`}
    {...props}
  >
    {children}
  </button>
);

export default PrimaryButton;
