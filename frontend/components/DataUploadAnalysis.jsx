import React from "react";
import FileUpload from "./FileUpload";

const DataUploadAnalysis = ({
  user,
  onUnauthorized,
  onDataReceived,
  onNavigateModule,
}) => {
  return (
    <section className="w-full max-w-6xl mx-auto space-y-8">
      <div className="relative overflow-hidden rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-gradient-to-br from-white via-blue-50/60 to-slate-50 dark:from-slate-900 dark:via-slate-900/70 dark:to-slate-950 shadow-xl px-6 py-8 sm:px-10">
        <div className="absolute inset-y-0 right-0 hidden sm:block opacity-10">
          <div className="w-40 h-40 rounded-full bg-gradient-to-br from-blue-500 to-slate-700 blur-3xl" />
        </div>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-3 max-w-3xl">
            <div className="inline-flex items-center gap-3 rounded-full bg-white/80 dark:bg-slate-900/60 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-600 dark:text-slate-200 shadow-sm">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-white text-lg shadow-lg shadow-blue-500/30">
                📊
              </span>
              Carga y análisis de datos
            </div>
            <h2 className="text-3xl font-semibold text-slate-900 dark:text-white leading-tight">
              Diseño premium para subir, elegir enfoque y analizar tus datasets
            </h2>
            <p className="text-base text-slate-600 dark:text-slate-300 leading-relaxed">
              Sube tus datos para generar KPIs, visualizaciones e insights con IA. Un flujo claro: subir archivo → elegir enfoque → analizar → ver resultados.
            </p>
          </div>
          <div className="flex flex-col items-start sm:items-end gap-2 text-sm text-slate-500 dark:text-slate-300">
            <span className="rounded-full border border-slate-200/80 dark:border-slate-700 bg-white/60 dark:bg-slate-900/60 px-3 py-1 font-medium">
              Responsivo · Modo claro/oscuro
            </span>
            <span className="rounded-full border border-blue-200/80 dark:border-blue-900/60 bg-blue-50/70 dark:bg-blue-900/30 px-3 py-1 text-blue-700 dark:text-blue-200 font-semibold">
              Flujo guiado para análisis
            </span>
          </div>
        </div>
      </div>

      <FileUpload
        key={user?.username}
        onUnauthorized={onUnauthorized}
        onDataReceived={onDataReceived}
        onNavigateModule={onNavigateModule}
      />

      <div className="text-gray-600 dark:text-slate-300 text-sm text-center italic">
        Carga tus archivos .CSV o .XLSX para generar visualizaciones automáticas.
      </div>
    </section>
  );
};

export default DataUploadAnalysis;
