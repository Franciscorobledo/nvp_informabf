import React, { useMemo, useState, useEffect } from "react";

const moduleDefinitions = [
  {
    id: "analyze",
    title: "Carga y análisis de datos",
    description:
      "Sube archivos CSV/XLSX/ZIP, genera KPIs y obtén visualizaciones claras en minutos.",
    icon: "📊",
    badge: "Recomendado",
  },
  {
    id: "movie",
    title: "Película de datos",
    description:
      "Crea una narrativa visual y animada que muestre la evolución de tu dataset.",
    icon: "🎬",
  },
  {
    id: "compare",
    title: "Comparativa de datos",
    description:
      "Compara periodos, productos o canales para detectar cambios clave de un vistazo.",
    icon: "📈",
  },
];

const HomeModules = ({ currentModule = "home", onNavigateModule }) => {
  const [selectedModule, setSelectedModule] = useState(currentModule);

  useEffect(() => {
    setSelectedModule(currentModule);
  }, [currentModule]);

  const handleSelect = (moduleId) => {
    setSelectedModule(moduleId);
    onNavigateModule?.(moduleId);
  };

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
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
          Selecciona un módulo para comenzar
        </h2>
        <p className="text-base text-gray-600 dark:text-slate-300 max-w-3xl mx-auto">
          Activa el módulo que necesitas para cargar, narrar o comparar tus datos con
          una experiencia guiada y visual.
        </p>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((module) => (
          <button
            key={module.id}
            onClick={() => handleSelect(module.id)}
            className={`group relative flex h-full flex-col gap-4 rounded-2xl border p-6 text-left shadow-sm transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900 ${
              module.isSelected
                ? "border-blue-500 bg-blue-50/80 text-gray-900 shadow-md dark:border-blue-400 dark:bg-slate-800/70 dark:text-white"
                : "border-gray-200 bg-white text-gray-900 hover:-translate-y-0.5 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900 dark:text-white"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-4">
                <span
                  className={`flex h-12 w-12 items-center justify-center rounded-xl text-2xl shadow-sm ${
                    module.isSelected
                      ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200"
                      : "bg-gray-100 text-gray-700 dark:bg-slate-800 dark:text-slate-100"
                  }`}
                  aria-hidden="true"
                >
                  {module.icon}
                </span>
                <div className="space-y-1">
                  <h3 className="text-lg font-semibold leading-tight text-gray-900 dark:text-white">
                    {module.title}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-slate-300">
                    {module.description}
                  </p>
                </div>
              </div>

              {(module.isSelected || module.badge) && (
                <span
                  className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                    module.isSelected
                      ? "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-100"
                      : "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200"
                  }`}
                >
                  {module.isSelected ? "Seleccionado" : module.badge}
                </span>
              )}
            </div>

            <div className="flex items-center justify-between pt-2 text-sm font-semibold text-blue-600 group-hover:text-blue-700 dark:text-blue-300">
              {module.isSelected ? (
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-blue-500" aria-hidden="true" />
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
    </div>
  );
};

export default HomeModules;
