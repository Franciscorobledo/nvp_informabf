import React, { useEffect, useMemo, useState } from "react";

const clampProgress = (value) => Math.min(Math.max(value ?? 0, 0), 100);

const toneStyles = {
  info: {
    track: "bg-slate-200/80 dark:bg-slate-800/80",
    fillFrom: "#2563eb",
    fillTo: "#6366f1",
    glow: "shadow-[0_10px_40px_rgba(37,99,235,0.18)]",
  },
  success: {
    track: "bg-emerald-100/70 dark:bg-emerald-900/30",
    fillFrom: "#10b981",
    fillTo: "#22c55e",
    glow: "shadow-[0_10px_40px_rgba(16,185,129,0.15)]",
  },
  warning: {
    track: "bg-amber-100/70 dark:bg-amber-900/30",
    fillFrom: "#f59e0b",
    fillTo: "#f97316",
    glow: "shadow-[0_10px_40px_rgba(245,158,11,0.16)]",
  },
};

const LoadingBar = ({
  label = "Procesando…",
  helperText,
  progress = 0,
  indeterminate = false,
  status,
  tone = "info",
  showPercentage = true,
  className = "",
}) => {
  const [displayProgress, setDisplayProgress] = useState(
    clampProgress(progress)
  );

  const palette = useMemo(() => toneStyles[tone] ?? toneStyles.info, [tone]);

  useEffect(() => {
    if (indeterminate) return;

    setDisplayProgress((prev) => {
      const next = clampProgress(progress);
      return next < prev ? prev : next;
    });
  }, [progress, indeterminate]);

  const ariaValue = Math.round(displayProgress);

  return (
    <div className={`w-full ${className}`}>
      <div className="rounded-2xl border border-gray-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/60 shadow-sm backdrop-blur px-4 py-3">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              {status && (
                <span className="inline-flex items-center rounded-full bg-blue-50 text-blue-700 dark:bg-blue-900/50 dark:text-blue-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide">
                  {status}
                </span>
              )}
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                {label}
              </span>
            </div>

            {helperText && (
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                {helperText}
              </p>
            )}
          </div>

          {!indeterminate && showPercentage && (
            <span className="text-sm font-bold text-slate-800 dark:text-slate-100 tabular-nums">
              {ariaValue}%
            </span>
          )}
        </div>

        <div className="mt-3">
          <div
            className={`relative h-2.5 w-full overflow-hidden rounded-full ${palette.track}`}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={indeterminate ? undefined : ariaValue}
          >
            {indeterminate ? (
              <div
                className="loading-bar__indeterminate"
                style={{
                  background: `linear-gradient(90deg, ${palette.fillFrom}, ${palette.fillTo})`,
                }}
              />
            ) : (
              <div
                className={`loading-bar__fill ${palette.glow}`}
                style={{
                  width: `${displayProgress}%`,
                  background: `linear-gradient(90deg, ${palette.fillFrom}, ${palette.fillTo})`,
                }}
              >
                <span className="loading-bar__shine" />
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .loading-bar__fill {
          height: 100%;
          border-radius: 999px;
          position: relative;
          transition: width 360ms cubic-bezier(0.4, 0, 0.2, 1);
        }

        .loading-bar__shine {
          position: absolute;
          inset: 0;
          content: "";
          background: linear-gradient(120deg, rgba(255, 255, 255, 0), rgba(255, 255, 255, 0.3), rgba(255, 255, 255, 0));
          transform: translateX(-100%);
          animation: loading-bar-shine 1.9s ease-in-out infinite;
        }

        .loading-bar__indeterminate {
          position: absolute;
          inset: 0;
          width: 46%;
          border-radius: 999px;
          animation: loading-bar-indeterminate 1.35s infinite ease-in-out;
          filter: saturate(1.05);
        }

        @keyframes loading-bar-shine {
          from {
            transform: translateX(-100%);
          }
          to {
            transform: translateX(100%);
          }
        }

        @keyframes loading-bar-indeterminate {
          0% {
            transform: translateX(-60%);
          }
          50% {
            transform: translateX(120%);
          }
          100% {
            transform: translateX(-60%);
          }
        }
      `}</style>
    </div>
  );
};

export default LoadingBar;
