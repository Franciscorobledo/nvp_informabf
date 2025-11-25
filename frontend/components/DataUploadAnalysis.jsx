import React from "react";
import FileUpload from "./FileUpload";

const DataUploadAnalysis = ({
  user,
  onUnauthorized,
  onDataReceived,
  onNavigateModule,
}) => {
  return (
    <section className="space-y-6">
      <div className="space-y-2 text-center">
        <h2 className="text-xl font-semibold text-gray-700 dark:text-slate-100">
          📊 Carga y análisis de datos
        </h2>
        <p className="text-sm text-gray-600 dark:text-slate-300">
          Sube archivos para generar KPIs, visualizaciones e insights con IA.
        </p>
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
