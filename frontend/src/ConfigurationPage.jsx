import React, { useMemo, useState } from "react";
import UserManagement from "./UserManagement";
import AdminOpenAIUsage from "./AdminOpenAIUsage";

const ConfigurationPage = ({ user, onUnauthorized }) => {
  const isAdmin = user?.role === "admin";

  const initialProfile = useMemo(
    () => ({
      fullName: user?.username || "Usuario InformeBF",
      email: `${user?.username || "usuario"}@informe.bf`,
    }),
    [user]
  );

  const [profile, setProfile] = useState(initialProfile);
  const [profileStatus, setProfileStatus] = useState("");
  const [profileError, setProfileError] = useState("");

  const [appPreferences, setAppPreferences] = useState({
    theme: "dark",
    language: "es",
    notifications: true,
  });
  const [appStatus, setAppStatus] = useState("");
  const [analysisPrefs, setAnalysisPrefs] = useState({
    detailLevel: "alto",
    reportLanguage: "es",
    summarize: true,
  });
  const [analysisStatus, setAnalysisStatus] = useState("");
  const [securityStatus, setSecurityStatus] = useState("");

  const handleProfileSave = (e) => {
    e.preventDefault();
    setProfileError("");
    setProfileStatus("Cambios guardados correctamente.");
  };

  const handleAppSave = (e) => {
    e.preventDefault();
    setAppStatus("Preferencias guardadas correctamente.");
  };

  const handleAnalysisSave = (e) => {
    e.preventDefault();
    setAnalysisStatus("Preferencias de análisis actualizadas.");
  };

  const handleSecurityAction = (e) => {
    e.preventDefault();
    setSecurityStatus("Se aplicaron los cambios de seguridad.");
  };

  return (
    <section className="max-w-5xl mx-auto space-y-6 px-4 py-6">
      <header className="space-y-3 bg-slate-900/60 border border-slate-800 rounded-2xl p-6 shadow-lg shadow-slate-950/20">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1">
            <p className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-200 border border-blue-500/30">
              ⚙️ Centro de configuración
            </p>
            <h2 className="text-3xl font-bold text-slate-50">Configuración de la cuenta</h2>
            <p className="text-sm text-slate-400">
              Ajusta tu perfil, preferencias de la aplicación y parámetros de análisis sin afectar tu sesión.
            </p>
          </div>
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-sm">
            <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
            Sesión activa: {user?.username || "desconocida"} ({user?.role || "usuario"})
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg shadow-slate-950/20 space-y-4 md:col-span-1">
          <div className="space-y-1">
            <h3 className="text-xl font-semibold text-slate-50">Perfil</h3>
            <p className="text-sm text-slate-400">Actualiza tus datos básicos. El correo es de solo lectura.</p>
          </div>

          {profileStatus && (
            <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 text-emerald-200 px-4 py-3 text-sm">
              {profileStatus}
            </div>
          )}
          {profileError && (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 text-red-200 px-4 py-3 text-sm">
              {profileError}
            </div>
          )}

          <form onSubmit={handleProfileSave} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">Nombre</label>
              <input
                type="text"
                value={profile.fullName}
                onChange={(e) => setProfile((prev) => ({ ...prev, fullName: e.target.value }))}
                className="w-full rounded-xl border border-slate-700 bg-slate-800 text-slate-100 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">Correo</label>
              <input
                type="email"
                value={profile.email}
                readOnly
                className="w-full rounded-xl border border-slate-700 bg-slate-800/70 text-slate-300 px-4 py-3 focus:outline-none"
              />
              <p className="text-xs text-slate-500">Para actualizar el correo contacta a un administrador.</p>
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                className="px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-md shadow-blue-500/30 transition"
              >
                Guardar cambios
              </button>
            </div>
          </form>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg shadow-slate-950/20 space-y-4 md:col-span-1">
          <div className="space-y-1">
            <h3 className="text-xl font-semibold text-slate-50">Preferencias de la app</h3>
            <p className="text-sm text-slate-400">Elige cómo se presenta la aplicación y tus notificaciones.</p>
          </div>

          {appStatus && (
            <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 text-emerald-200 px-4 py-3 text-sm">
              {appStatus}
            </div>
          )}

          <form onSubmit={handleAppSave} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">Tema</label>
              <select
                value={appPreferences.theme}
                onChange={(e) => setAppPreferences((prev) => ({ ...prev, theme: e.target.value }))}
                className="w-full rounded-xl border border-slate-700 bg-slate-800 text-slate-100 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="dark">Oscuro</option>
                <option value="light">Claro</option>
              </select>
              <p className="text-xs text-slate-500">Elige el modo visual para toda la interfaz.</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">Idioma</label>
              <select
                value={appPreferences.language}
                onChange={(e) => setAppPreferences((prev) => ({ ...prev, language: e.target.value }))}
                className="w-full rounded-xl border border-slate-700 bg-slate-800 text-slate-100 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="es">Español</option>
                <option value="en">Inglés</option>
              </select>
              <p className="text-xs text-slate-500">Cambia el idioma preferido para la navegación.</p>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-800/60 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-slate-100">Notificaciones</p>
                <p className="text-xs text-slate-500">Recibe alertas cuando se generen nuevos reportes.</p>
              </div>
              <button
                type="button"
                onClick={() => setAppPreferences((prev) => ({ ...prev, notifications: !prev.notifications }))}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                  appPreferences.notifications ? "bg-blue-600" : "bg-slate-600"
                }`}
                aria-pressed={appPreferences.notifications}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
                    appPreferences.notifications ? "translate-x-5" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                className="px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-md shadow-blue-500/30 transition"
              >
                Guardar preferencias
              </button>
            </div>
          </form>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg shadow-slate-950/20 space-y-4 md:col-span-2">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
            <div className="space-y-1">
              <h3 className="text-xl font-semibold text-slate-50">Preferencias de análisis / IA</h3>
              <p className="text-sm text-slate-400">Configura cómo se generan los reportes y el nivel de detalle.</p>
            </div>
            <button
              onClick={handleAnalysisSave}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-md shadow-blue-500/30 transition"
            >
              Guardar preferencias de análisis
            </button>
          </div>

          {analysisStatus && (
            <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 text-emerald-200 px-4 py-3 text-sm">
              {analysisStatus}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">Nivel de detalle</label>
              <select
                value={analysisPrefs.detailLevel}
                onChange={(e) => setAnalysisPrefs((prev) => ({ ...prev, detailLevel: e.target.value }))}
                className="w-full rounded-xl border border-slate-700 bg-slate-800 text-slate-100 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="alto">Alto</option>
                <option value="medio">Medio</option>
                <option value="resumen">Resumen</option>
              </select>
              <p className="text-xs text-slate-500">Define cuánto contexto se incluye en cada reporte.</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">Idioma de los informes</label>
              <select
                value={analysisPrefs.reportLanguage}
                onChange={(e) => setAnalysisPrefs((prev) => ({ ...prev, reportLanguage: e.target.value }))}
                className="w-full rounded-xl border border-slate-700 bg-slate-800 text-slate-100 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="es">Español</option>
                <option value="en">Inglés</option>
              </select>
              <p className="text-xs text-slate-500">Aplica al texto generado y a las etiquetas clave.</p>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-800/60 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-slate-100">Resumir automáticamente</p>
                <p className="text-xs text-slate-500">Activa la síntesis automática para reportes extensos.</p>
              </div>
              <button
                type="button"
                onClick={() => setAnalysisPrefs((prev) => ({ ...prev, summarize: !prev.summarize }))}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                  analysisPrefs.summarize ? "bg-blue-600" : "bg-slate-600"
                }`}
                aria-pressed={analysisPrefs.summarize}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
                    analysisPrefs.summarize ? "translate-x-5" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg shadow-slate-950/20 space-y-4 md:col-span-2">
          <div className="space-y-1">
            <h3 className="text-xl font-semibold text-slate-50">Seguridad</h3>
            <p className="text-sm text-slate-400">Gestiona opciones sensibles como contraseñas o cierre de sesiones.</p>
          </div>

          {securityStatus && (
            <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 text-emerald-200 px-4 py-3 text-sm">
              {securityStatus}
            </div>
          )}

          <form className="grid grid-cols-1 md:grid-cols-2 gap-4" onSubmit={handleSecurityAction}>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">Contraseña</label>
              <input
                type="password"
                placeholder="••••••••"
                className="w-full rounded-xl border border-slate-700 bg-slate-800 text-slate-100 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-slate-500">Nunca compartas tu contraseña. Usa una combinación segura.</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">Cierre de sesiones</label>
              <select className="w-full rounded-xl border border-slate-700 bg-slate-800 text-slate-100 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option>Finalizar otras sesiones activas</option>
                <option>Cerrar todas las sesiones</option>
              </select>
              <p className="text-xs text-slate-500">Controla el acceso desde otros dispositivos o ubicaciones.</p>
            </div>
            <div className="md:col-span-2 flex justify-end gap-3">
              <button
                type="button"
                className="px-4 py-3 rounded-xl border border-slate-700 text-slate-200 bg-slate-800 hover:bg-slate-700 transition"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-md shadow-blue-500/30 transition"
              >
                Guardar seguridad
              </button>
            </div>
          </form>
        </div>
      </div>

      {!isAdmin && (
        <div className="rounded-2xl border border-amber-600/60 bg-amber-500/10 p-4 text-amber-100">
          <p className="font-semibold">Acceso restringido</p>
          <p className="text-sm">Solo los administradores pueden gestionar usuarios o actualizar el token de OpenAI.</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 shadow-lg shadow-slate-950/20">
          <UserManagement onUnauthorized={onUnauthorized} />
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 shadow-lg shadow-slate-950/20">
          <AdminOpenAIUsage onUnauthorized={onUnauthorized} />
        </div>
      </div>
    </section>
  );
};

export default ConfigurationPage;
