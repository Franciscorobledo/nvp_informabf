import React, { useCallback, useEffect, useMemo, useState } from "react";
import API_URL from "../api";

const formatDate = (value) => {
  if (!value) return "";
  try {
    return new Date(value).toLocaleString();
  } catch (err) {
    return value;
  }
};

const truncate = (text, length = 80) => {
  if (!text) return "";
  if (text.length <= length) return text;
  return `${text.slice(0, length)}…`;
};

const AdminLogsPanel = ({ onUnauthorized }) => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filterSource, setFilterSource] = useState("");
  const [filterLevel, setFilterLevel] = useState("");
  const [selectedLog, setSelectedLog] = useState(null);

  const token = useMemo(() => localStorage.getItem("token"), []);

  const authHeaders = useMemo(() => {
    const headers = {
      "Content-Type": "application/json",
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    return headers;
  }, [token]);

  const parseBackendMessage = useCallback(async (response, fallbackMessage) => {
    try {
      const body = await response.json();
      return body?.detail || body?.message || fallbackMessage;
    } catch (err) {
      return fallbackMessage;
    }
  }, []);

  const fetchLogs = useCallback(async () => {
    if (!token) {
      const detail = "Tu sesión expiró. Inicia sesión nuevamente.";
      onUnauthorized?.(detail);
      setError(detail);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({ limit: "100" });
      if (filterSource) params.append("source", filterSource);
      if (filterLevel) params.append("level", filterLevel);

      const response = await fetch(`${API_URL}/admin/logs?${params.toString()}`, {
        headers: authHeaders,
      });

      if (!response.ok) {
        if ([401, 403].includes(response.status)) {
          const detail = await parseBackendMessage(
            response,
            "No se pudieron cargar los logs. Sesión expirada."
          );
          onUnauthorized?.(detail);
          throw new Error(detail);
        }

        const backendMessage = await response.text();
        throw new Error(
          backendMessage || "No se pudieron cargar los logs de diagnóstico"
        );
      }

      const data = await response.json();
      setLogs(Array.isArray(data?.logs) ? data.logs : []);
    } catch (err) {
      console.error("Error al obtener logs", err);
      setError(err.message || "No se pudieron cargar los logs");
    } finally {
      setLoading(false);
    }
  }, [authHeaders, filterLevel, filterSource, onUnauthorized, parseBackendMessage, token]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-300">
            Panel de logs / Diagnóstico
          </p>
          <p className="text-sm text-gray-600 dark:text-slate-300">
            Consulta errores recientes para depurar problemas de backend y frontend.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            value={filterSource}
            onChange={(e) => setFilterSource(e.target.value)}
          >
            <option value="">Origen: todos</option>
            <option value="backend">Backend</option>
            <option value="frontend">Frontend</option>
          </select>
          <select
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            value={filterLevel}
            onChange={(e) => setFilterLevel(e.target.value)}
          >
            <option value="">Nivel: todos</option>
            <option value="ERROR">ERROR</option>
            <option value="WARNING">WARNING</option>
            <option value="INFO">INFO</option>
          </select>
          <button
            type="button"
            onClick={fetchLogs}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:bg-indigo-500 dark:hover:bg-indigo-400"
            disabled={loading}
          >
            {loading ? "Actualizando..." : "Refrescar"}
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-slate-800 dark:bg-slate-900/60">
        {loading && (
          <p className="text-sm text-gray-600 dark:text-slate-300">Cargando logs...</p>
        )}

        {!loading && error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-900/50 dark:text-rose-100">
            {error}
          </div>
        )}

        {!loading && !error && logs.length === 0 && (
          <p className="text-sm text-gray-600 dark:text-slate-300">
            Aún no hay logs registrados.
          </p>
        )}

        {!loading && !error && logs.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-slate-800">
              <thead className="bg-white dark:bg-slate-900">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700 dark:text-slate-200">
                    Fecha/hora
                  </th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700 dark:text-slate-200">
                    Source
                  </th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700 dark:text-slate-200">
                    Nivel
                  </th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700 dark:text-slate-200">
                    Mensaje
                  </th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700 dark:text-slate-200">
                    Path
                  </th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700 dark:text-slate-200">
                    Acción
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-slate-800">
                {logs.map((log) => (
                  <tr key={log.id} className="bg-white dark:bg-slate-900/70">
                    <td className="px-3 py-2 text-gray-800 dark:text-slate-100">
                      {formatDate(log.created_at)}
                    </td>
                    <td className="px-3 py-2">
                      <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold uppercase text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-200">
                        {log.source}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold uppercase ${
                          log.level === "ERROR"
                            ? "bg-rose-50 text-rose-700 dark:bg-rose-900/40 dark:text-rose-100"
                            : log.level === "WARNING"
                              ? "bg-amber-50 text-amber-700 dark:bg-amber-900/40 dark:text-amber-100"
                              : "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-100"
                        }`}
                      >
                        {log.level}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-800 dark:text-slate-100">
                      {truncate(log.message)}
                    </td>
                    <td className="px-3 py-2 text-gray-800 dark:text-slate-100">
                      {log.path || "-"}
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        className="text-sm font-semibold text-indigo-600 hover:text-indigo-500 dark:text-indigo-300"
                        onClick={() => setSelectedLog(log)}
                      >
                        Ver detalle
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[80vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm uppercase text-gray-500 dark:text-slate-400">
                  {selectedLog.level} · {selectedLog.source}
                </p>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                  {selectedLog.message}
                </h3>
                <p className="text-sm text-gray-600 dark:text-slate-300">
                  {formatDate(selectedLog.created_at)} — {selectedLog.path || "sin path"}
                </p>
                {selectedLog.user && (
                  <p className="text-sm text-gray-600 dark:text-slate-300">
                    Usuario: {selectedLog.user}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="rounded-full bg-gray-100 px-3 py-1 text-sm font-semibold text-gray-700 shadow hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700"
              >
                Cerrar
              </button>
            </div>
            <div className="mt-4">
              <p className="text-sm font-semibold text-gray-800 dark:text-slate-100">Detalles</p>
              <pre className="mt-2 max-h-[50vh] overflow-auto whitespace-pre-wrap rounded-lg bg-slate-900 p-4 text-sm text-slate-100">
                {selectedLog.details || "Sin detalles adicionales"}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminLogsPanel;
