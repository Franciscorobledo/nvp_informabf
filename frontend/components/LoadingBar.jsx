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

  // --- MODO PROGRESO NORMAL (NO INDETERMINADO) ---
  useEffect(() => {
    if (indeterminate) return;

    // Garantiza que nunca retroceda
    setDisplayProgress((prev) => {
      const next = clampProgress(progress);
      return next < prev ? prev : next;
    });
  }, [progress, indeterminate]);

  return (
    <div className="w-full max-w-3xl mx-auto font-sans py-4">
      {/* Header: Label & Percentage */}
      <div className="mb-2 flex items-end justify-between">
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            {label || "Procesando..."}
          </span>
          {helperText && (
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {helperText}
            </span>
          )}
        </div>

        {!indeterminate && (
          <span className="text-sm font-bold text-slate-700 dark:text-slate-300 tabular-nums">
            {Math.round(displayProgress)}%
          </span>
        )}
      </div>

      {/* Progress Container */}
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
        {/* --- MODO INDETERMINADO --- */}
        {indeterminate ? (
          <div className="absolute inset-0 overflow-hidden">
            <div className="indeterminate-bar" />
          </div>
        ) : (
          /* --- MODO NORMAL --- */
          <div
            className="h-full bg-blue-600 dark:bg-blue-500 transition-all duration-300 ease-out"
            style={{ width: `${displayProgress}%` }}
            role="progressbar"
            aria-valuenow={Math.round(displayProgress)}
          />
        )}
      </div>

      {/* Estilos para la animación indeterminada */}
      <style>{`
        .indeterminate-bar {
          width: 50%;
          height: 100%;
          background-color: #2563eb;
          border-radius: 999px;
          animation: indeterminateLoop 1.3s infinite ease-in-out;
        }

        @keyframes indeterminateLoop {
          0% {
            transform: translateX(-50%);
          }
          50% {
            transform: translateX(120%);
          }
          100% {
            transform: translateX(-50%);
          }
        }
      `}</style>
    </div>
  );
};

export default LoadingBar;
