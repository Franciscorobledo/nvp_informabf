import React, { useMemo, useState } from "react";
import DataUploadAnalysis from "./DataUploadAnalysis";
import DataMovieModule from "./DataMovieModule";
import DataComparisonModule from "./DataComparisonModule";
import UserManagement from "../src/UserManagement";

const moduleDefinitions = [
  {
    id: "data-analysis",
    title: "Carga y análisis de datos",
    description:
      "Sube archivos CSV/XLSX/ZIP, genera KPIs y obtén visualizaciones claras en minutos.",
    icon: "📊",
    badge: "Recomendado",
    featured: true,
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
  {
    id: "user-management",
    title: "Gestión de usuarios",
    description: "Administra accesos, roles y expiración de cuentas de tu organización.",
    icon: "🛡️",
    requiresAdmin: true,
  },
  {
    id: "config",
    title: "Configuración y cuenta",
    description: "Actualiza preferencias, API keys y controles avanzados de la plataforma.",
    icon: "⚙️",
    navigateTo: "config",
  },
];

const HomeModules = ({ user, onUnauthorized, onDataReceived, onNavigate }) => {
  const [selectedModule, setSelectedModule] = useState("none");
  const isAdmin = user?.role === "admin";

  const cards = useMemo(
    () =>
      moduleDefinitions
        .filter((module) => !module.requiresAdmin || isAdmin)
        .map((module) => ({
          ...module,
          isSelected: selectedModule === module.id,
        })),
    [isAdmin, selectedModule]
  );

  const handleCardClick = (module) => {
    if (module.navigateTo && onNavigate) {
      onNavigate(module.navigateTo);
      return;
    }

    setSelectedModule(module.id);
  };

  return (
    <div className="space-y-8">
      <div className="rounded-3xl border border-gray-200 bg-gradient-to-br from-gray-50 via-white to-blue-50 p-6 shadow-sm dark:border-slate-800 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950">
        <div className="space-y-2 text-center">
          <p className="inline-flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-700 dark:bg-blue-900/40 dark:text-blue-100">
            ✨ Hub de producto
          </p>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white sm:text-4xl">
            Elige cómo quieres empezar
          </h2>
          <p className="mx-auto max-w-3xl text-base text-gray-600 dark:text-slate-300">
            Selecciona una experiencia para cargar datos, generar película interactiva, comparar resultados o administrar tu cuenta.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((module) => (
          <button
            key={module.id}
            onClick={() => handleCardClick(module)}
            className={`group relative flex h-full flex-col gap-4 rounded-2xl border p-6 text-left transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900 ${
              module.isSelected
                ? "border-blue-500 bg-blue-50/80 shadow-lg dark:border-blue-500 dark:bg-blue-950/40"
                : module.featured
                  ? "border-blue-200 bg-blue-50 shadow-sm hover:-translate-y-0.5 hover:shadow-lg dark:border-blue-800/60 dark:bg-blue-950/40"
                  : "border-gray-200 bg-white shadow-sm hover:-translate-y-0.5 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-4">
                <span
                  className={`flex h-12 w-12 items-center justify-center rounded-xl text-2xl shadow-sm ${
                    module.isSelected
                      ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200"
                      : "bg-white text-gray-700 ring-1 ring-gray-200 dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-700"
                  }`}
                  aria-hidden="true"
                >
                  {module.icon}
                </span>
                <div className="space-y-1">
                  <h3 className="text-xl font-semibold leading-tight text-gray-900 dark:text-white">
                    {module.title}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-slate-300">
                    {module.description}
                  </p>
                </div>
              </div>

              {(module.isSelected || module.badge || module.featured) && (
                <span
                  className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                    module.isSelected
                      ? "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-100"
                      : "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-100"
                  }`}
                >
                  {module.isSelected ? "Seleccionado" : module.badge || "Inicio rápido"}
                </span>
              )}
            </div>

            <div className="mt-auto flex items-center justify-between pt-2 text-sm font-semibold text-blue-700 transition group-hover:text-blue-800 dark:text-blue-200 dark:group-hover:text-blue-100">
              <span className="inline-flex items-center gap-2">
                {module.navigateTo ? "Ir a configuración" : "Explorar módulo"}
                <span aria-hidden="true">→</span>
              </span>
              <span className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-blue-700 shadow-sm ring-1 ring-blue-200 dark:bg-blue-900/40 dark:text-blue-50 dark:ring-blue-800/60">
                Empezar
              </span>
            </div>
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {selectedModule === "none" && (
          <div className="flex flex-col items-center justify-center gap-3 text-center text-gray-600 dark:text-slate-300">
            <span className="text-3xl" aria-hidden="true">
              🚀
            </span>
            <div>
              <p className="font-semibold">Selecciona una caluga para continuar</p>
              <p className="text-sm">Activa la experiencia que necesites y sigue el flujo guiado.</p>
            </div>
          </div>
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

        {selectedModule === "user-management" && isAdmin && (
          <UserManagement onUnauthorized={onUnauthorized} />
        )}
      </div>
    </div>
  );
};

export default HomeModules;
