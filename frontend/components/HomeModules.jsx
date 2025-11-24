import React, { useMemo, useState } from "react";
import DataUploadAnalysis from "./DataUploadAnalysis";
import DataMovieModule from "./DataMovieModule";
import DataComparisonModule from "./DataComparisonModule";
import AppCard from "./ui/AppCard";

const moduleDefinitions = [
  {
    id: "data-analysis",
    title: "Carga y análisis de datos",
    description:
      "Sube archivos CSV/XLSX/ZIP, genera KPIs y obtén visualizaciones claras en minutos.",
    icon: "📊",
    badge: "Recomendado",
  },
  {
    id: "data-movie",
    title: "Película de datos",
    description:
      "Crea una narrativa visual y animada que muestre la evolución de tu dataset.",
    icon: "🎬",
  },
  {
    id: "comparativa",
    title: "Comparativa de datos",
    description:
      "Compara periodos, productos o canales para detectar cambios clave de un vistazo.",
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
        <h2 className="text-3xl font-semibold text-slate-50">Selecciona un módulo para comenzar</h2>
        <p className="text-base text-slate-400 max-w-3xl mx-auto">
          Activa el módulo que necesitas para cargar, narrar o comparar tus datos con una experiencia guiada y visual.
        </p>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((module) => (
          <button
            key={module.id}
            onClick={() => setSelectedModule(module.id)}
            className={`group relative flex h-full flex-col gap-4 rounded-2xl border border-slate-800/80 bg-slate-900/70 p-6 text-left shadow-lg shadow-black/20 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 ${
              module.isSelected
                ? "border-indigo-400 bg-indigo-950/40 text-white shadow-indigo-500/20"
                : "hover:-translate-y-1 hover:border-indigo-500/50"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-4">
                <span
                  className={`flex h-12 w-12 items-center justify-center rounded-xl text-2xl shadow-sm ${
                    module.isSelected
                      ? "bg-indigo-500/20 text-indigo-100 border border-indigo-400/50"
                      : "bg-slate-800/80 text-slate-100 border border-slate-700"
                  }`}
                  aria-hidden="true"
                >
                  {module.icon}
                </span>
                <div className="space-y-1">
                  <h3 className="text-lg font-semibold leading-tight text-white">
                    {module.title}
                  </h3>
                  <p className="text-sm text-slate-400">
                    {module.description}
                  </p>
                </div>
              </div>

              {(module.isSelected || module.badge) && (
                <span
                  className={`accent-pill ${module.isSelected ? "border-indigo-400/60" : ""}`}
                >
                  {module.isSelected ? "Seleccionado" : module.badge}
                </span>
              )}
            </div>

            <div className="flex items-center justify-between pt-2 text-sm font-semibold text-indigo-200 group-hover:text-indigo-100">
              {module.isSelected ? (
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-indigo-400" aria-hidden="true" />
                  Activo: listo para continuar
                </span>
              ) : (
                <span className="inline-flex items-center gap-2">
                  Explorar módulo
                  <span aria-hidden="true">→</span>
                </span>
              )}
            </div>
          </button>
        ))}
      </div>

      <AppCard className="p-6">
        {selectedModule === "none" && (
          <p className="text-center text-slate-400">
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
          <DataComparisonModule onUnauthorized={onUnauthorized} />
        )}
      </AppCard>
    </div>
  );
};

export default HomeModules;
