import React, { useEffect, useState, useCallback } from "react";
import API_URL from "./api";

const numberFormatter = new Intl.NumberFormat("es-ES", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const integerFormatter = new Intl.NumberFormat("es-ES");

const AdminOpenAIUsage = ({ onUnauthorized }) => {
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [tokenInput, setTokenInput] = useState("");
  const [savingToken, setSavingToken] = useState(false);
  const [hasKey, setHasKey] = useState(false);

  const fetchStatus = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      onUnauthorized?.("Tu sesión expiró. Inicia sesión nuevamente.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(`${API_URL}/admin/openai/status`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        if ([401, 403].includes(response.status)) {
          onUnauthorized?.("La sesión expiró. Vuelve a iniciar sesión.");
          return;
        }

        const msg = await response.text();
        throw new Error(msg || "No se pudo obtener el estado de OpenAI");
      }

      const data = await response.json();
      setSnapshot({
        status: data.status,
        message: data.message,
        ...data.usage,
      });
      setHasKey(Boolean(data.openai_key_present));
    } catch (err) {
      console.error("Error al consultar diagnóstico de OpenAI", err);
      setError(err.message || "Error desconocido al consultar el estado");
      setHasKey(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleTokenSave = async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      onUnauthorized?.("Tu sesión expiró. Inicia sesión nuevamente.");
      return;
    }

    if (!tokenInput.trim()) {
      setError("Ingresa un token de OpenAI válido para guardarlo.");
      return;
    }

    setSavingToken(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(`${API_URL}/admin/openai/token`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ api_key: tokenInput.trim() }),
      });

      if (!response.ok) {
        if ([401, 403].includes(response.status)) {
          onUnauthorized?.("La sesión expiró. Vuelve a iniciar sesión.");
          return;
        }

        const body = await response.json().catch(() => null);
        const msg = body?.detail || body?.message || "No se pudo guardar el token";
        throw new Error(msg);
      }

      setSuccess("Token actualizado correctamente. Se usará en las próximas llamadas.");
      setTokenInput("");
      fetchStatus();
    } catch (err) {
      console.error("Error al actualizar token de OpenAI", err);
      setError(err.message || "No se pudo actualizar el token");
    } finally {
      setSavingToken(false);
    }
  };

  const renderEventsTable = () => {
    const events = snapshot?.events || [];

    if (!events.length) {
      return (
        <p className="text-sm text-gray-500 dark:text-slate-400">
          Aún no hay solicitudes registradas para calcular el costo por llamada.
        </p>
      );
    }

    return (
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800/50 text-gray-600 dark:text-slate-300">
            <tr>
              <th className="px-3 py-2 font-semibold">Fecha</th>
              <th className="px-3 py-2 font-semibold">Usuario</th>
              <th className="px-3 py-2 font-semibold">Fuente</th>
              <th className="px-3 py-2 font-semibold">Modelo</th>
              <th className="px-3 py-2 font-semibold">Tokens</th>
              <th className="px-3 py-2 font-semibold text-right">Costo por solicitud</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
            {events.map((event) => (
              <tr key={event.timestamp} className="text-gray-700 dark:text-slate-200">
                <td className="px-3 py-2 whitespace-nowrap">{event.timestamp ? new Date(event.timestamp).toLocaleString() : "—"}</td>
                <td className="px-3 py-2 whitespace-nowrap text-xs sm:text-sm">{event.user || "desconocido"}</td>
                <td className="px-3 py-2 whitespace-nowrap text-xs sm:text-sm">{event.source || (event.files?.join(", ") || "desconocido")}</td>
                <td className="px-3 py-2 whitespace-nowrap text-xs sm:text-sm">{event.model || "—"}</td>
                <td className="px-3 py-2 text-xs sm:text-sm">
                  <div className="flex flex-col">
                    <span>Prompt: {integerFormatter.format(event.prompt_tokens ?? 0)}</span>
                    <span>Respuesta: {integerFormatter.format(event.completion_tokens ?? 0)}</span>
                    <span className="text-gray-500 dark:text-slate-400">Total: {integerFormatter.format(event.total_tokens ?? 0)}</span>
                  </div>
                </td>
                <td className="px-3 py-2 text-right font-semibold">${numberFormatter.format(event.cost_usd ?? 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <section className="w-full mt-8">
      <div className="flex items-center justify-between mb-3 gap-3">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-slate-100">
          🤖 Panel de consumo OpenAI
        </h3>
        <button
          onClick={fetchStatus}
          disabled={loading}
          className={`px-3 py-2 rounded-lg text-sm font-semibold border border-gray-200 dark:border-slate-700 shadow-sm transition-all duration-200 ${
            loading
              ? "bg-gray-100 dark:bg-slate-800 text-gray-400 cursor-not-allowed"
              : "bg-blue-600 text-white hover:bg-blue-700"
          }`}
        >
          {loading ? "Actualizando..." : "Actualizar"}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 rounded-lg border border-green-200 bg-green-50 text-green-700 text-sm">
          {success}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div className="p-4 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-gray-800 dark:text-slate-100">
                Token de OpenAI
              </span>
              <span className="text-xs text-gray-500 dark:text-slate-400">
                Guarda o actualiza el token usado por el sistema sin reiniciar el backend.
              </span>
            </div>
            {hasKey ? (
              <span className="px-2 py-1 rounded-md text-xs bg-green-100 text-green-700">Activo</span>
            ) : (
              <span className="px-2 py-1 rounded-md text-xs bg-amber-100 text-amber-700">No detectado</span>
            )}
          </div>

          {!hasKey && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
              No se detectó un token configurado. Ingresa uno válido para consultar el consumo real.
            </p>
          )}

          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="password"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder="sk-..."
              className="flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleTokenSave}
              disabled={savingToken}
              className={`px-3 py-2 rounded-lg text-sm font-semibold shadow-sm transition-all duration-200 ${
                savingToken
                  ? "bg-gray-100 dark:bg-slate-800 text-gray-400 cursor-not-allowed"
                  : "bg-blue-600 text-white hover:bg-blue-700"
              }`}
            >
              {savingToken ? "Guardando..." : "Guardar token"}
            </button>
          </div>
        </div>
      </div>

      {!snapshot && !loading && !error && (
        <p className="text-sm text-gray-500 dark:text-slate-400">
          No hay datos de uso disponibles aún.
        </p>
      )}

      {snapshot && (
        <div className="space-y-4">
          <div
            className={`flex items-center gap-3 p-4 rounded-xl border text-sm ${
              snapshot.status === "ok"
                ? "border-green-200 bg-green-50 text-green-800"
                : "border-amber-200 bg-amber-50 text-amber-800"
            }`}
          >
            <span className="text-xl" role="img" aria-hidden="true">
              {snapshot.status === "ok" ? "✅" : "⚠️"}
            </span>
            <div className="flex flex-col">
              <span className="font-semibold">{snapshot.message || "Estado no disponible"}</span>
              <span className="text-xs text-gray-600">
                Última llamada: {snapshot.last_call ? new Date(snapshot.last_call).toLocaleString() : "sin registros"}
              </span>
            </div>
          </div>

          <div className="p-4 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-gray-800 dark:text-slate-100">
                  Últimas solicitudes registradas
                </span>
                <span className="text-xs text-gray-500 dark:text-slate-400">
                  Costos calculados para cada llamada registrada en el historial reciente (máx. 25).
                </span>
              </div>
              <span className="text-xs px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300">
                {snapshot?.events?.length || 0} registro(s)
              </span>
            </div>

            {renderEventsTable()}
          </div>
        </div>
      )}
    </section>
  );
};

export default AdminOpenAIUsage;
