import React, { useEffect, useState } from "react";
import API_URL from "../api";

const PlanPricingManager = ({ onUnauthorized }) => {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [edits, setEdits] = useState({});

  const parseError = async (response, fallback = "Ocurrió un error") => {
    try {
      const body = await response.json();
      return body?.detail || body?.message || fallback;
    } catch (err) {
      console.warn("No se pudo parsear el error", err);
      return fallback;
    }
  };

  const loadPlans = async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      onUnauthorized?.("Tu sesión expiró. Inicia sesión nuevamente.");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(`${API_URL}/subscriptions/admin/plans`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        if ([401, 403].includes(response.status)) {
          const detail = await parseError(response, "No autorizado");
          onUnauthorized?.(detail);
          throw new Error(detail);
        }
        throw new Error(await parseError(response));
      }

      const data = await response.json();
      setPlans(data);
      const nextEdits = {};
      data.forEach((plan) => {
        nextEdits[plan.id] = {
          price_monthly: plan.price_monthly,
          currency: plan.currency,
        };
      });
      setEdits(nextEdits);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlans();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleChange = (planId, field, value) => {
    setEdits((prev) => ({
      ...prev,
      [planId]: {
        ...prev[planId],
        [field]: value,
      },
    }));
  };

  const savePlan = async (planId) => {
    const token = localStorage.getItem("token");
    if (!token) {
      onUnauthorized?.("Tu sesión expiró. Inicia sesión nuevamente.");
      return;
    }

    const payload = edits[planId];
    setSaving(planId);
    setMessage("");
    setError("");

    try {
      const response = await fetch(`${API_URL}/subscriptions/admin/plans/${planId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          price_monthly: Number(payload.price_monthly),
          currency: payload.currency,
        }),
      });

      if (!response.ok) {
        if ([401, 403].includes(response.status)) {
          const detail = await parseError(response, "No autorizado");
          onUnauthorized?.(detail);
          throw new Error(detail);
        }
        throw new Error(await parseError(response, "No se pudo actualizar el plan"));
      }

      const data = await response.json();
      setMessage(`${data.plan.name} actualizado correctamente`);
      setPlans((prev) => prev.map((plan) => (plan.id === planId ? data.plan : plan)));
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(null);
    }
  };

  if (loading && !plans.length) {
    return <p>Cargando planes...</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Precios de planes</h3>
          <p className="text-sm text-gray-600 dark:text-slate-300">
            Ajusta el precio y la moneda directamente desde el panel de configuración.
          </p>
        </div>
        <button
          onClick={loadPlans}
          className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 shadow hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100"
        >
          🔄 Actualizar
        </button>
      </div>

      {message && <div className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</div>}
      {error && <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}

      <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
        {plans.map((plan) => (
          <div key={plan.id} className="grid gap-4 p-4 sm:grid-cols-4 sm:items-center">
            <div className="sm:col-span-2">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{plan.name}</p>
              <p className="text-xs text-slate-500">Alias: {plan.alias}</p>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-500" htmlFor={`price-${plan.id}`}>
                Precio
              </label>
              <input
                id={`price-${plan.id}`}
                type="number"
                min="0"
                step="100"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-800"
                value={edits[plan.id]?.price_monthly ?? ""}
                onChange={(e) => handleChange(plan.id, "price_monthly", e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-500" htmlFor={`currency-${plan.id}`}>
                Moneda
              </label>
              <input
                id={`currency-${plan.id}`}
                type="text"
                className="w-28 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-800"
                value={edits[plan.id]?.currency ?? ""}
                onChange={(e) => handleChange(plan.id, "currency", e.target.value)}
              />
            </div>
            <div className="sm:col-span-4 flex justify-end">
              <button
                onClick={() => savePlan(plan.id)}
                disabled={saving === plan.id}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700 disabled:opacity-60"
              >
                {saving === plan.id ? "Guardando..." : "Guardar cambios"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PlanPricingManager;
