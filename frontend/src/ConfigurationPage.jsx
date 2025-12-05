import React from "react";
import UserManagement from "./UserManagement";
import AdminOpenAIUsage from "./AdminOpenAIUsage";
import AdminLogsPanel from "./components/AdminLogsPanel";

const ConfigurationPage = ({ user, onUnauthorized }) => {
  const isAdmin = user?.role === "admin";

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <p className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-200">
          ⚙️ Centro de configuración
        </p>
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Panel de administración</h2>
            <p className="text-sm text-gray-600 dark:text-slate-300">
              Gestiona usuarios y monitorea el estado de la integración con OpenAI desde un solo lugar.
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-slate-300">
            <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
            Sesión: {user?.username || "desconocida"} ({user?.role || "usuario"})
          </div>
        </div>
      </header>

      {!isAdmin && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-800 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-100">
          <p className="font-semibold">Acceso restringido</p>
          <p className="text-sm">Solo los administradores pueden gestionar usuarios o actualizar el token de OpenAI.</p>
        </div>
      )}

      {isAdmin && (
        <div className="grid grid-cols-1 gap-6">
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <UserManagement onUnauthorized={onUnauthorized} />
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <AdminOpenAIUsage onUnauthorized={onUnauthorized} />
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <AdminLogsPanel onUnauthorized={onUnauthorized} />
          </div>
        </div>
      )}
    </section>
  );
};

export default ConfigurationPage;
