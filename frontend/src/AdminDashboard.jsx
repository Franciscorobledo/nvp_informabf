import React, { useCallback, useEffect, useState } from "react";
import API_URL from "./api";

const statusColors = {
  ok: "bg-emerald-500",
  error: "bg-rose-500",
  default: "bg-gray-400",
};

const AdminDashboard = ({ onUnauthorized }) => {
  const [openaiStatus, setOpenaiStatus] = useState(null);
  const [logs, setLogs] = useState([]);
  const [systemStatus, setSystemStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const parseBackendMessage = useCallback(async (response, fallbackMessage) => {
    try {
      const body = await response.json();
      return body?.detail || body?.message || fallbackMessage;
    } catch (err) {
      try {
        const text = await response.text();
        return text || fallbackMessage;
      } catch {
        console.warn("No se pudo leer el detalle de error", err);
        return fallbackMessage;
      }
    }
  }, []);

  const fetchWithAuth = useCallback(
    async (endpoint, token, fallbackMessage) => {
      const response = await fetch(endpoint, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        if ([401, 403].includes(response.status)) {
          const detail = await parseBackendMessage(
            response,
            "Tu sesión expiró. Vuelve a iniciar sesión."
          );
          onUnauthorized?.(detail);
          throw new Error(detail);
        }

        const detail = await parseBackendMessage(response, fallbackMessage);
        throw new Error(detail);
      }

      return response.json();
    },
    [onUnauthorized, parseBackendMessage]
  );

  const loadDashboard = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      onUnauthorized?.("Tu sesión expiró. Inicia sesión nuevamente.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const [openaiData, logsData, systemData] = await Promise.all([
        fetchWithAuth(
          `${API_URL}/admin/openai/status`,
          token,
          "No se pudo obtener el estado de OpenAI"
        ),
        fetchWithAuth(
          `${API_URL}/admin/logs?level=ERROR&limit=10`,
          token,
          "No se pudieron cargar los logs de error"
        ),
        fetchWithAuth(
          `${API_URL}/admin/system/status`,
          token,
          "No se pudo obtener el estado del sistema"
        ),
      ]);

      setOpenaiStatus(openaiData);
      setLogs(logsData?.logs || []);
      setSystemStatus(systemData);
    } catch (err) {
      console.error("Error al cargar el panel admin", err);
      setError(err.message || "No se pudo cargar el panel de administración");
    } finally {
      setLoading(false);
    }
  }, [fetchWithAuth, onUnauthorized]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const openAiIndicatorColor =
    statusColors[openaiStatus?.status] || statusColors.default;

  const renderUsageBar = (percentage = 0) => (
    <div className="w-full h-2 rounded-full bg-gray-200 dark:bg-slate-800 overflow-hidden">
      <div
        className="h-full rounded-full bg-blue-500 transition-all"
        style={{ width: `${Math.min(percentage, 100)}%` }}
      />
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-100">
            🛡️ Panel de control
          </p>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mt-2">
            Estado del sistema
          </h3>
          <p className="text-sm text-gray-600 dark:text-slate-300">
            Revisa la salud de OpenAI, los últimos errores y el uso de recursos del servidor.
          </p>
        </div>
        <button
          onClick={loadDashboard}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-blue-600 text-white shadow hover:-translate-y-0.5 transition disabled:opacity-70"
        >
          🔄 {loading ? "Actualizando" : "Actualizar"}
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-rose-800 dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-100">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-slate-400">Estado de OpenAI</p>
              <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                {openaiStatus?.message || "Consultando..."}
              </h4>
            </div>
            <span
              className={`h-3 w-3 rounded-full ${openAiIndicatorColor}`}
              aria-label={`Estado: ${openaiStatus?.status || "desconocido"}`}
            />
          </div>
          <div className="mt-3 space-y-2 text-sm text-gray-600 dark:text-slate-300">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-100">🔑</span>
              Token configurado: {openaiStatus?.openai_key_present ? "Sí" : "No"}
            </div>
            {openaiStatus?.usage && (
              <div className="rounded-xl bg-slate-50 p-3 text-xs text-gray-700 dark:bg-slate-800 dark:text-slate-200">
                <p className="font-semibold mb-2">Uso reciente</p>
                {Object.entries(openaiStatus.usage).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between py-1 border-b border-gray-100 last:border-b-0 dark:border-slate-700">
                    <span className="capitalize">{key.replaceAll("_", " ")}</span>
                    <span className="font-semibold">{String(value)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-slate-400">Salud del servidor</p>
              <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                {systemStatus?.environment ? `Entorno: ${systemStatus.environment}` : "Consultando..."}
              </h4>
            </div>
            <span className="text-xs text-gray-500 dark:text-slate-400">
              Uptime: {systemStatus?.uptime_human || "-"}
            </span>
          </div>
          <div className="mt-3 space-y-3 text-sm text-gray-700 dark:text-slate-200">
            <div className="grid grid-cols-2 gap-3 text-xs sm:text-sm">
              <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/80">
                <p className="text-gray-500 dark:text-slate-400">Inicio</p>
                <p className="font-semibold break-all">{systemStatus?.server_started_at || "-"}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/80">
                <p className="text-gray-500 dark:text-slate-400">Host</p>
                <p className="font-semibold">{systemStatus?.host || "-"}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/80">
                <p className="text-gray-500 dark:text-slate-400">Python</p>
                <p className="font-semibold">{systemStatus?.python_version || "-"}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/80">
                <p className="text-gray-500 dark:text-slate-400">Retención logs</p>
                <p className="font-semibold">{systemStatus?.log_retention_days || 0} días</p>
              </div>
            </div>

            {systemStatus?.resources && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs sm:text-sm">
                  <span className="text-gray-500 dark:text-slate-400">CPU</span>
                  <span className="font-semibold">{systemStatus.resources.cpu_percent}%</span>
                </div>
                {renderUsageBar(systemStatus.resources.cpu_percent)}

                <div className="flex items-center justify-between text-xs sm:text-sm mt-2">
                  <span className="text-gray-500 dark:text-slate-400">Memoria</span>
                  <span className="font-semibold">
                    {systemStatus.resources.memory_used_mb} / {systemStatus.resources.memory_total_mb} MB ({systemStatus.resources.memory_percent}%)
                  </span>
                </div>
                {renderUsageBar(systemStatus.resources.memory_percent)}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm text-gray-500 dark:text-slate-400">Errores recientes</p>
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white">Últimos 10 errores reportados</h4>
          </div>
          <span className="text-xs text-gray-500 dark:text-slate-400">Actualizado: {systemStatus?.timestamp || "-"}</span>
        </div>

        <div className="overflow-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-gray-500 dark:text-slate-400">
                <th className="pb-2 pr-4">Fecha</th>
                <th className="pb-2 pr-4">Fuente</th>
                <th className="pb-2">Mensaje</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-3 text-center text-gray-500 dark:text-slate-400">
                    No hay errores recientes registrados.
                  </td>
                </tr>
              )}
              {logs.map((log) => (
                <tr key={log.id} className="border-t border-gray-100 dark:border-slate-800">
                  <td className="py-2 pr-4 text-xs text-gray-600 dark:text-slate-300">
                    {new Date(log.created_at).toLocaleString()}
                  </td>
                  <td className="py-2 pr-4">
                    <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-gray-700 dark:bg-slate-800 dark:text-slate-100">
                      {log.source}
                    </span>
                  </td>
                  <td className="py-2 text-sm text-gray-800 dark:text-slate-100">
                    <div className="font-semibold">{log.message}</div>
                    {log.details && (
                      <p className="text-xs text-gray-500 dark:text-slate-400 mt-1 line-clamp-2">
                        {log.details}
                      </p>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
