import React from "react";

const variantStyles = {
  primary:
    "bg-gradient-to-r from-blue-600 via-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/25 hover:shadow-blue-500/35 hover:-translate-y-0.5 focus-visible:ring-blue-300 disabled:bg-blue-400 disabled:shadow-none disabled:hover:translate-y-0",
  secondary:
    "border border-slate-200/90 dark:border-slate-700/80 bg-white/80 dark:bg-slate-900/40 text-slate-800 dark:text-slate-50 hover:border-blue-300 hover:text-blue-800 hover:shadow-sm focus-visible:ring-blue-200 focus-visible:dark:ring-blue-800",
  danger:
    "bg-rose-600 text-white hover:bg-rose-700 focus-visible:ring-rose-300 disabled:bg-rose-400 disabled:hover:bg-rose-400",
  ghost:
    "text-blue-700 hover:bg-blue-50 focus-visible:ring-blue-200 dark:text-blue-200 dark:hover:bg-blue-900/40 focus-visible:dark:ring-blue-800",
};

const Spinner = () => (
  <svg
    className="h-4 w-4 animate-spin text-current"
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    role="status"
    aria-hidden="true"
  >
    <circle
      className="opacity-25"
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="4"
    />
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
    />
  </svg>
);

const AppButton = ({
  children,
  variant = "primary",
  loading = false,
  loadingText,
  disabled = false,
  fullWidth = false,
  className = "",
  ...props
}) => {
  const stateDisabled = disabled || loading;
  const variantClass = variantStyles[variant] || variantStyles.primary;
  const widthClass = fullWidth ? "w-full" : "";
  const baseStyles =
    "inline-flex items-center justify-center gap-2 rounded-2xl px-5 h-12 text-sm font-semibold transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900";
  const disabledStyles = stateDisabled ? "opacity-80 cursor-not-allowed" : "";

  return (
    <button
      type="button"
      className={`${baseStyles} ${variantClass} ${widthClass} ${disabledStyles} ${className}`.trim()}
      disabled={stateDisabled}
      aria-busy={loading}
      {...props}
    >
      {loading && <Spinner />}
      <span>{loading ? loadingText || children : children}</span>
    </button>
  );
};

export default AppButton;
