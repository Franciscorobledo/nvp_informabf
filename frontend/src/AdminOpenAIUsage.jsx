import React, { useEffect, useState, useCallback } from "react";
import API_URL from "./api";

const numberFormatter = new Intl.NumberFormat("es-ES", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const integerFormatter = new Intl.NumberFormat("es-ES");

const AdminOpenAIUsage = () => {
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchStatus = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      setError("No se encontró token. Inicia sesión nuevamente.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_URL}/admin/openai/status`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const msg = await response.text();
        throw new Error(msg || "No se pudo obtener el estado de OpenAI");
      }

      const data = await response.json();
      setSnapshot({
        status: data.status,
        message: data.message,
        ...data.usage,
      });
    } catch (err) {
      console.error("Error al consultar diagnóstico de OpenAI", err);
      setError(err.message || "Error desconocido al consultar el estado");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

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
            {renderCard("Tokens prompt", integerFormatter.format(snapshot.total_prompt_tokens ?? 0))}
            {renderCard("Tokens completion", integerFormatter.format(snapshot.total_completion_tokens ?? 0))}
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
