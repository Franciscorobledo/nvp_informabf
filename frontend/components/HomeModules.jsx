import React, { useMemo, useState, useEffect } from "react";

const moduleDefinitions = [
  {
    id: "analyze",
    title: "Carga y análisis de datos",
    description:
      "Carga tus archivos y recibe resúmenes claros con gráficos listos para compartir.",
    icon: "📊",
    badge: "Recomendado",
  },
  {
    id: "movie",
    title: "Película de datos",
    description:
      "Convierte tus números en una historia animada para explicar los cambios con facilidad.",
    icon: "🎬",
  },
  {
    id: "compare",
    title: "Comparativa de datos",
    description:
      "Enfrenta periodos, productos o canales y detecta lo que funciona mejor al instante.",
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

  const buttonStyles =
    "inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-[1px] hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500";

  return (
    <div className="space-y-10">
      <div className="space-y-3 text-center">
        <div className="mx-auto inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 ring-1 ring-blue-100 dark:bg-blue-900/40 dark:text-blue-100 dark:ring-blue-800/70">
          <span aria-hidden="true">●</span> Herramientas listas para tu negocio
        </div>
        <h2 className="text-3xl font-semibold tracking-tight text-gray-900 dark:text-white">
          Conoce tus datos en minutos
        </h2>
        <p className="mx-auto max-w-3xl text-base text-gray-600 dark:text-slate-300">
          Explora tus números con claridad: importa archivos, cuenta la historia detrás de tus datos o compara resultados sin necesidad de ser experto.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((module) => (
          <div
            key={module.id}
            className={`group relative flex h-full flex-col justify-between gap-4 rounded-2xl border p-6 text-left shadow-[0_20px_60px_-35px_rgba(15,23,42,0.45)] transition-all duration-300 ${
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
                      : "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-100 dark:ring-emerald-700"
                  }`}
                >
                  {module.isSelected ? "Seleccionado" : module.badge}
                </span>
              )}
            </div>

            <div className="space-y-3 pt-2 text-sm text-gray-600 dark:text-slate-300">
              {module.id === "analyze" && (
                <p>Sube tus archivos y obtén resúmenes claros y gráficos fáciles de leer.</p>
              )}
              {module.id === "movie" && (
                <p>Cuenta la evolución de tu negocio con visuales animados listos para compartir.</p>
              )}
              {module.id === "compare" && (
                <p>Enfrenta periodos, productos o campañas para ver qué funciona mejor.</p>
              )}
            </div>

            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => handleSelect(module.id)}
                className={buttonStyles}
              >
                Explorar módulo
                <span aria-hidden="true">→</span>
              </button>
              {module.isSelected && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-100 dark:ring-emerald-800">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
                  Activo
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default HomeModules;
