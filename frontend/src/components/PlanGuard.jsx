import React from "react";

const PLAN_PRIORITY = {
  starter: 1,
  pro: 2,
  premium: 3,
};

const PlanGuard = ({
  user,
  subscription,
  minPlan = "starter",
  onUpgrade,
  children,
}) => {
  const isAdmin = user?.role === "admin";
  const currentAlias = subscription?.current_plan?.alias?.toLowerCase();
  const status = subscription?.subscription_status;
  const hasPlan =
    status === "active" && PLAN_PRIORITY[currentAlias] >= PLAN_PRIORITY[minPlan];

  if (isAdmin || hasPlan) return children;

  return (
    <div className="border border-dashed border-amber-300 bg-amber-50 text-amber-900 dark:bg-amber-900/20 dark:border-amber-500 dark:text-amber-100 rounded-2xl p-6 text-center space-y-3">
      <p className="text-lg font-semibold">Esta función requiere el plan {minPlan}.</p>
      <p className="text-sm opacity-80">
        Mejora tu suscripción para acceder a todas las herramientas disponibles.
      </p>
      <button
        onClick={onUpgrade}
        className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-amber-500 text-white font-semibold shadow-md hover:bg-amber-600"
      >
        Ver planes
      </button>
    </div>
  );
};

export default PlanGuard;
