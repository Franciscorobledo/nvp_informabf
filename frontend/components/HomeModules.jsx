import React, { useMemo, useState } from "react";
import DataUploadAnalysis from "./DataUploadAnalysis";
import DataMovieModule from "./DataMovieModule";

const moduleDefinitions = [
  {
    id: "data-analysis",
    title: "Carga y análisis de datos",
    description:
      "Sube archivos CSV/XLSX/ZIP y genera KPIs, visualizaciones e insights.",
    icon: "📊",
  },
  {
    id: "data-movie",
    title: "Película de datos",
    description:
      "Genera una historia visual tipo video con la evolución de tu dataset.",
    icon: "🎬",
  },
  {
    id: "comparativa",
    title: "Comparativa de datos",
    description:
      "Compara dos o más archivos para ver diferencias entre periodos, productos o canales.",
    icon: "📈",
  },
];

const HomeModules = ({ user, onUnauthorized, onDataReceived }) => {
  const [selectedModule, setSelectedModule] = useState("none");

  const cards = useMemo(
    () =>
      moduleDefinitions.map((module) => ({
        ...module,
        isSelected: selectedModule === module.id,
      })),
    [selectedModule]
  );

  return (
    <div className="space-y-8">
      <div className="space-y-3 text-center">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
          Selecciona un módulo para comenzar
        </h2>
        <p className="text-sm text-gray-600 dark:text-slate-300 max-w-2xl mx-auto">
          Elige la experiencia que necesitas: análisis completo, película de datos o
          comparativas entre datasets.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((module) => (
          <button
            key={module.id}
            onClick={() => setSelectedModule(module.id)}
            className={`text-left rounded-2xl border p-5 shadow-sm transition focus:outline-none focus:ring-2 focus:ring-blue-400 ${
              module.isSelected
                ? "border-blue-500 bg-blue-50 dark:bg-slate-800/80 dark:border-blue-400 shadow-md"
                : "border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:shadow-md"
            }`}
          >
            <div className="flex items-start gap-3">
              <span className="text-2xl" aria-hidden="true">
                {module.icon}
              </span>
              <div className="space-y-2">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {module.title}
                </p>
                <p className="text-sm text-gray-600 dark:text-slate-300">
                  {module.description}
                </p>
                <p className="text-xs text-blue-600 dark:text-blue-300 font-semibold">
                  {module.isSelected ? "Seleccionado" : "Explorar"}
                </p>
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm p-6">
        {selectedModule === "none" && (
          <p className="text-center text-gray-600 dark:text-slate-300">
            Selecciona un módulo para comenzar.
          </p>
        )}

        {selectedModule === "data-analysis" && (
          <DataUploadAnalysis
            user={user}
            onUnauthorized={onUnauthorized}
            onDataReceived={onDataReceived}
          />
        )}

        {selectedModule === "data-movie" && (
          <DataMovieModule onUnauthorized={onUnauthorized} />
        )}

        {selectedModule === "comparativa" && (
          <div className="text-center space-y-2">
            <p className="text-lg font-semibold text-gray-800 dark:text-white">
              Comparativa de datos
            </p>
            <p className="text-sm text-gray-600 dark:text-slate-300">
              Estamos construyendo esta experiencia para que puedas cruzar periodos y
              fuentes. Próximamente estará disponible.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default HomeModules;
