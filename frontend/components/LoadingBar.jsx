import React, { useEffect, useState } from "react";

const clampProgress = (value) => Math.min(Math.max(value ?? 0, 0), 100);

const LoadingBar = ({
  label,
  helperText,
  progress = 0,
  indeterminate = false,
}) => {
  const [displayProgress, setDisplayProgress] = useState(
    clampProgress(progress)
  );

  useEffect(() => {
    if (indeterminate) return;
    setDisplayProgress(clampProgress(progress));
  }, [progress, indeterminate]);

  useEffect(() => {
    if (!indeterminate) return undefined;

    setDisplayProgress(48);
    const interval = setInterval(() => {
      setDisplayProgress((prev) => {
        const next = prev + (Math.random() * 14 - 6);
        if (next > 86) return 62;
        if (next < 28) return 46;
        return next;
      });
    }, 900);

    return () => clearInterval(interval);
  }, [indeterminate]);

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/80 p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full rounded-full bg-blue-500 opacity-60 animate-ping" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-600 shadow-[0_0_0_2px_rgba(59,130,246,0.2)]" />
          </span>
          <p className="text-sm font-semibold text-gray-800 dark:text-slate-100">{label}</p>
        </div>
        <span className="text-xs font-semibold text-blue-700 dark:text-blue-200">
          {Math.round(displayProgress)}%
        </span>
      </div>

      {helperText && (
        <p className="mt-1 text-xs text-gray-600 dark:text-slate-300">{helperText}</p>
      )}

      <div className="mt-3 relative h-3 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800/80 border border-white/70 dark:border-slate-700/70 shadow-inner">
        <div className="loading-bar-glow" aria-hidden />
        <div
          className="loading-bar-fill"
          style={{ width: `${displayProgress}%` }}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(displayProgress)}
          aria-label={label}
        >
          <span className="loading-bar-shine" aria-hidden />
        </div>
      </div>
    </div>
  );
};

export default LoadingBar;
