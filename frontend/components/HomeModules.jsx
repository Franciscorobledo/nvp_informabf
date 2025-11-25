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
    <div className="space-y-10">
      <div className="space-y-3 text-center">
        <div className="mx-auto inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-700">
          <span aria-hidden="true">●</span> Módulos listos para usar
        </div>
        <h2 className="text-3xl font-semibold tracking-tight text-gray-900 dark:text-white">
          Selecciona un módulo para comenzar
        </h2>
        <p className="text-base text-gray-600 dark:text-slate-300 max-w-3xl mx-auto">
          Tarjetas amplias, limpias y elegantes para activar el flujo perfecto: carga, narrativa o comparativa, todo con un tono corporativo cálido.
        </p>
      </div>

      <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((module) => (
          <button
            key={module.id}
            onClick={() => handleSelect(module.id)}
            className={`group relative flex h-full flex-col gap-4 rounded-2xl border p-6 text-left shadow-[0_20px_60px_-35px_rgba(15,23,42,0.45)] transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900 ${
              module.isSelected
                ? "border-blue-400/80 bg-gradient-to-br from-blue-50 via-white to-blue-100 text-gray-900 dark:border-blue-800 dark:from-slate-900 dark:via-slate-900 dark:to-blue-950/30 dark:text-white"
                : "border-slate-200/80 bg-white/90 text-gray-900 hover:-translate-y-1 hover:border-blue-200 hover:shadow-[0_25px_70px_-40px_rgba(37,99,235,0.55)] dark:border-slate-800 dark:bg-slate-900/80 dark:text-white"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-4">
                <span
                  className={`flex h-12 w-12 items-center justify-center rounded-xl text-2xl shadow-sm ring-1 ${
                    module.isSelected
                      ? "bg-white text-blue-700 ring-blue-200 shadow-blue-200/70 dark:bg-blue-900/40 dark:text-blue-100 dark:ring-blue-800"
                      : "bg-slate-50 text-slate-700 ring-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-700"
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
                      ? "bg-blue-600 text-white shadow-lg shadow-blue-300/50 dark:bg-blue-500"
                      : "bg-slate-900 text-white shadow-sm dark:bg-white dark:text-slate-900"
                  }`}
                >
                  {module.isSelected ? "Seleccionado" : module.badge}
                </span>
              )}
            </div>

            <div className="flex items-center justify-between pt-2 text-sm font-semibold text-blue-700 group-hover:text-blue-800 dark:text-blue-300">
              {module.isSelected ? (
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.2)] dark:shadow-none" aria-hidden="true" />
                  Activo y listo para continuar
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
