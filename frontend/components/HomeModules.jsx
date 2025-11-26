import React, { useMemo, useState, useEffect } from "react";

const BoxIcon = ({ className = "" }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="m4.5 7 7.5 4.25L19.5 7m-15 0L12 2.75 19.5 7m-15 0v10.25L12 22l7.5-4.75V7"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const ClockIcon = ({ className = "" }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.6" />
    <path
      d="M12 7.5V12l2.5 1.5"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const ShieldIcon = ({ className = "" }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M12 21s7-3.5 7-10.5V6.25L12 3 5 6.25V10.5C5 17.5 12 21 12 21Z"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="m9.5 12.25 1.75 1.75 3.25-3.5"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const moduleDefinitions = [
  {
    id: "analyze",
    title: "Carga y análisis de datos",
    description: "Carga archivos y recibe gráficos listos para compartir.",
    icon: "📊",
    badge: "Recomendado",
  },
  {
    id: "movie",
    title: "Película de datos",
    description: "Convierte números en historias animadas.",
    icon: "🎬",
    ribbon: "Nuevo",
  },
  {
    id: "compare",
    title: "Comparativa de datos",
    description: "Contrasta periodos, productos o canales.",
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
      <div className="space-y-4 text-center">
        <div className="flex flex-wrap items-center justify-center gap-3">
          {[
            { label: "Motor IA", tone: "from-blue-500/90 to-indigo-500/90", icon: "⚡" },
            { label: "Flujos automatizados", tone: "from-cyan-500/90 to-blue-500/90", icon: "🛰️" },
            { label: "Cifrado cloud", tone: "from-emerald-500/90 to-teal-500/90", icon: "🔒" },
          ].map((pill) => (
            <span
              key={pill.label}
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold text-white shadow-sm ring-1 ring-white/70 bg-gradient-to-r ${pill.tone}`}
            >
              <span aria-hidden="true" className="text-base">
                {pill.icon}
              </span>
              {pill.label}
            </span>
          ))}
        </div>

        <div className="flex flex-col items-center gap-3">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-500 text-white shadow-lg shadow-blue-500/30">
            <span aria-hidden="true" className="text-xl">
              ✨
            </span>
          </div>
          <div className="space-y-2">
            <h2 className="text-3xl font-semibold tracking-tight text-transparent bg-gradient-to-r from-sky-500 via-indigo-600 to-purple-600 bg-clip-text sm:text-4xl">
              Conoce tus datos en minutos
            </h2>
            <p className="mx-auto max-w-2xl text-base text-gray-600 dark:text-slate-300">
              Panel inteligente con micro‑interacciones, animación y comparativas listas para activar con un clic.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((module) => (
          <div
            key={module.id}
            className={`group relative flex h-full flex-col justify-between gap-6 overflow-hidden rounded-2xl border p-8 text-left shadow-[0_20px_60px_-35px_rgba(15,23,42,0.45)] transition-all duration-300 ${
              module.isSelected
                ? "border-blue-400/80 bg-gradient-to-br from-blue-50 via-white to-blue-100 text-gray-900 dark:border-blue-800 dark:from-slate-900 dark:via-slate-900 dark:to-blue-950/30 dark:text-white"
                : "border-slate-200/80 bg-white/90 text-gray-900 hover:-translate-y-1 hover:border-blue-200 hover:shadow-[0_25px_70px_-40px_rgba(37,99,235,0.55)] dark:border-slate-800 dark:bg-slate-900/80 dark:text-white"
            }`}
          >
            {module.ribbon && (
              <span className="pointer-events-none absolute -left-12 top-6 -rotate-45 bg-orange-500 px-12 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-white shadow-lg">
                {module.ribbon}
              </span>
            )}

            {(module.isSelected || module.badge) && (
              <span
                className={`absolute right-6 top-6 inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold shadow-sm ring-1 ${
                  module.isSelected
                    ? "bg-blue-600 text-white ring-blue-300/80 shadow-blue-200/60 dark:bg-blue-500"
                    : "bg-emerald-100 text-emerald-700 ring-emerald-200 dark:bg-emerald-900/60 dark:text-emerald-100 dark:ring-emerald-800"
                }`}
              >
                {module.isSelected ? "Seleccionado" : module.badge}
              </span>
            )}

            <div className="flex items-start gap-4 pr-16">
              <span
                className={`flex h-14 w-14 items-center justify-center rounded-xl text-3xl shadow-sm ring-1 ${
                  module.isSelected
                    ? "bg-white text-blue-700 ring-blue-200 shadow-blue-200/70 dark:bg-blue-900/40 dark:text-blue-100 dark:ring-blue-800"
                    : "bg-slate-50 text-slate-700 ring-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-700"
                }`}
                aria-hidden="true"
              >
                {module.icon}
              </span>
              <div className="space-y-1">
                <h3 className="text-xl font-semibold leading-tight text-gray-900 dark:text-white">
                  {module.title}
                </h3>
                <p className="text-base text-gray-600 dark:text-slate-300">
                  {module.description}
                </p>
              </div>
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

      <div className="grid grid-cols-1 gap-4 rounded-2xl border border-slate-200/70 bg-white/80 p-5 shadow-[0_20px_60px_-35px_rgba(15,23,42,0.35)] dark:border-slate-800 dark:bg-slate-900/70 md:grid-cols-3">
        <div className="flex items-start gap-3 rounded-xl border border-slate-100/80 bg-white/70 px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-800/60">
          <BoxIcon className="h-5 w-5 text-blue-600 dark:text-blue-300" />
          <div className="space-y-0.5 text-left">
            <p className="text-sm font-semibold text-slate-900 dark:text-white">Arquitectura modular</p>
            <p className="text-xs text-slate-500 dark:text-slate-300">Activa solo los módulos que necesitas.</p>
          </div>
        </div>
        <div className="flex items-start gap-3 rounded-xl border border-slate-100/80 bg-white/70 px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-800/60">
          <ClockIcon className="h-5 w-5 text-amber-500 dark:text-amber-300" />
          <div className="space-y-0.5 text-left">
            <p className="text-sm font-semibold text-slate-900 dark:text-white">Velocidad inmediata</p>
            <p className="text-xs text-slate-500 dark:text-slate-300">Insights listos en cuestión de minutos.</p>
          </div>
        </div>
        <div className="flex items-start gap-3 rounded-xl border border-slate-100/80 bg-white/70 px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-800/60">
          <ShieldIcon className="h-5 w-5 text-emerald-600 dark:text-emerald-300" />
          <div className="space-y-0.5 text-left">
            <p className="text-sm font-semibold text-slate-900 dark:text-white">Confianza asegurada</p>
            <p className="text-xs text-slate-500 dark:text-slate-300">Protección y gobernanza desde el inicio.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomeModules;
