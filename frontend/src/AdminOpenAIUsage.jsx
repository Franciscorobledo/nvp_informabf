import React, { useEffect, useState, useCallback } from "react";
import API_URL from "./api";

const numberFormatter = new Intl.NumberFormat("es-ES", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const AdminOpenAIUsage = ({ onUnauthorized }) => {
  const [snapshot, setSnapshot] = useState(null);
  const [billing, setBilling] = useState(null);
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
      setBilling(data.billing || null);
      setHasKey(Boolean(data.openai_key_present));
    } catch (err) {
      console.error("Error al consultar diagnóstico de OpenAI", err);
      setError(err.message || "Error desconocido al consultar el estado");
      setBilling(null);
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

  const renderCard = (label, value, helper) => (
    <div className="flex flex-col gap-1 p-4 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm">
      <span className="text-sm text-gray-500 dark:text-slate-400">{label}</span>
      <span className="text-xl font-semibold text-gray-800 dark:text-slate-100">{value}</span>
      {helper && <span className="text-xs text-gray-400 dark:text-slate-500">{helper}</span>}
    </div>
  );

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

        {snapshot && (
          <div className="p-4 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm">
            <p className="text-sm font-semibold text-gray-800 dark:text-slate-100 mb-1">Consumo real (últimos 30 días)</p>
            {billing ? (
              <div className="space-y-3 text-sm text-gray-700 dark:text-slate-200">
                <div
                  className={`flex items-center gap-2 text-xs font-medium px-2 py-1 rounded-lg inline-flex w-fit ${
                    billing.status === "ok"
                      ? "bg-green-50 text-green-700 border border-green-200"
                      : "bg-amber-50 text-amber-800 border border-amber-200"
                  }`}
                >
                  <span>{billing.status === "ok" ? "Datos completos" : "Datos parciales"}</span>
                  <span className="text-[11px] text-gray-500 dark:text-slate-400">
                    {billing.message}
                  </span>
                </div>

                {billing.total_usage_usd !== undefined && (
                  <div className="flex items-center justify-between">
                    <span>Total facturado</span>
                    <span className="font-semibold">${numberFormatter.format(billing.total_usage_usd ?? 0)}</span>
                  </div>
                )}

                {billing.credits ? (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                    <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                      <span className="block text-slate-500">Créditos otorgados</span>
                      <span className="font-semibold">${numberFormatter.format(billing.credits.granted_usd ?? 0)}</span>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                      <span className="block text-slate-500">Usado</span>
                      <span className="font-semibold">${numberFormatter.format(billing.credits.used_usd ?? 0)}</span>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                      <span className="block text-slate-500">Disponible</span>
                      <span className="font-semibold">${numberFormatter.format(billing.credits.available_usd ?? 0)}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-gray-500 dark:text-slate-400">
                    No se pudieron obtener los créditos disponibles.
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-500 dark:text-slate-400">
                Sin datos de consumo real. Verifica que el token sea válido.
              </p>
            )}
          </div>
        )}
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

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {renderCard(
              "Presupuesto total",
              `$${numberFormatter.format(snapshot.budget_usd ?? 0)}`,
              "Configurado en OPENAI_BUDGET_USD"
            )}
            {renderCard(
              "Presupuesto restante",
              `$${numberFormatter.format(snapshot.remaining_budget_usd ?? 0)}`,
              snapshot.budget_usd
                ? `${((snapshot.remaining_budget_usd / snapshot.budget_usd) * 100).toFixed(1)}% disponible`
                : undefined
            )}
            {renderCard(
              "Costo acumulado",
              `$${numberFormatter.format(snapshot.total_cost_usd ?? 0)}`,
              snapshot.last_model ? `Modelo más reciente: ${snapshot.last_model}` : undefined
            )}
            {renderCard(
              "Costo promedio por 1K (estimado)",
              `$${numberFormatter.format((snapshot.total_cost_usd / Math.max((snapshot.total_prompt_tokens + snapshot.total_completion_tokens) / 1000 || 1, 1)))}`,
              "Basado en los costos registrados"
            )}
          </div>
        </div>
      )}
    </section>
  );
};

export default AdminOpenAIUsage;
