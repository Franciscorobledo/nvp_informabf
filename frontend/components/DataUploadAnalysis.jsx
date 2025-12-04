import React from "react";
import FileUpload from "./FileUpload";

const DataUploadAnalysis = ({
  user,
  onUnauthorized,
  onDataReceived,
  onNavigateModule,
  onOpenIntegrations,
}) => {
  return (
    <section className="w-full max-w-6xl mx-auto space-y-6">
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/80 shadow-lg shadow-blue-500/10 p-6 flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
          <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 text-blue-800 dark:bg-blue-900/40 dark:text-blue-100 px-3 py-1">
            📂 Carga de datos
          </span>
          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-100 px-3 py-1">
            🛒 MercadoLibre
          </span>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2 max-w-2xl">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
              Comienza subiendo un archivo o conecta MercadoLibre
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Mantén la experiencia de tarjetas y módulos, pero prioriza aquí la ingesta: sube CSV o usa tus tokens de MercadoLibre para generar el panel automáticamente.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={() => onOpenIntegrations?.()}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-3 text-sm font-semibold shadow-md shadow-emerald-500/20"
            >
              Ir a MercadoLibre
              <span aria-hidden>↗</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigateModule?.("analyze")}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/90 dark:bg-slate-900/70 px-4 py-3 text-sm font-semibold text-slate-800 dark:text-slate-100 shadow-sm"
            >
              Seguir con análisis
            </button>
          </div>
        </div>
      </div>

      <FileUpload
        key={user?.username}
        onUnauthorized={onUnauthorized}
        onDataReceived={onDataReceived}
        onNavigateModule={onNavigateModule}
      />
    </section>
  );
};

export default DataUploadAnalysis;
