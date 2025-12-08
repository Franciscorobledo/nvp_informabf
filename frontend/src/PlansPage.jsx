import React, { useEffect, useState } from "react";
import API_URL from "./api";

const PlansPage = ({ token, onSubscriptionRefresh }) => {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const res = await fetch(`${API_URL}/subscriptions/plans`);
        if (!res.ok) throw new Error("No se pudieron cargar los planes");
        const data = await res.json();
        setPlans(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchPlans();
  }, []);

  const handleSelectPlan = async (planId) => {
    if (!token) {
      alert("Inicia sesión para continuar");
      return;
    }

    try {
      const res = await fetch(`${API_URL}/subscriptions/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ plan_id: planId }),
      });

      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || "No se pudo iniciar la suscripción");
      }

      const data = await res.json();
      onSubscriptionRefresh?.();
      if (data.redirect_url) {
        window.location.href = data.redirect_url;
      }
    } catch (err) {
      alert(err.message);
    }
  };

  if (loading) return <p>Cargando planes...</p>;
  if (error) return <p className="text-red-500">{error}</p>;

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="text-center space-y-3">
        <h1 className="text-3xl font-bold">Planes de suscripción</h1>
        <p className="text-gray-600 dark:text-gray-300">
          Elige el plan que mejor se adapta a tu negocio y accede a funcionalidades avanzadas.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {plans.map((plan) => (
          <div
            key={plan.id}
            className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm p-6 flex flex-col gap-4"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">{plan.name}</h2>
              <span className="px-3 py-1 rounded-full text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                {plan.alias}
              </span>
            </div>
            <p className="text-3xl font-bold">${plan.price_monthly} {plan.currency}</p>
            <p className="text-gray-600 dark:text-gray-300">{plan.description}</p>
            <ul className="space-y-2 text-sm text-left">
              {plan.features?.map((feature, idx) => (
                <li key={idx} className="flex items-center gap-2">
                  <span className="text-green-500">✔</span>
                  {feature}
                </li>
              ))}
            </ul>
            <button
              onClick={() => handleSelectPlan(plan.id)}
              className="mt-auto inline-flex items-center justify-center px-4 py-2 rounded-xl bg-blue-600 text-white font-semibold shadow hover:bg-blue-700"
            >
              Elegir este plan
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PlansPage;
