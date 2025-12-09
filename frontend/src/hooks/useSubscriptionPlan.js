import { useCallback, useEffect, useMemo, useState } from "react";
import API_URL from "../api";
import { fetchWithAuth } from "../utils/apiHelpers";

let cachedPlan = null;
let cachedError = null;

const getAlias = (planData) =>
  (planData?.current_plan?.alias || planData?.plan || planData?.alias || planData?.name || "")
    .toString()
    .toLowerCase();

const useSubscriptionPlan = ({ onUnauthorized } = {}) => {
  const [plan, setPlan] = useState(cachedPlan);
  const [loading, setLoading] = useState(!cachedPlan);
  const [error, setError] = useState(cachedError);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchWithAuth(`${API_URL}/subscription/summary`, { onUnauthorized });
      cachedPlan = data;
      cachedError = null;
      setPlan(data);
    } catch (err) {
      if (err.message !== "unauthorized") {
        const message = err.message || "No se pudo obtener el plan de suscripción";
        cachedError = message;
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }, [onUnauthorized]);

  useEffect(() => {
    if (!plan) {
      refresh();
    }
  }, [plan, refresh]);

  const alias = useMemo(() => getAlias(plan), [plan]);
  const isProOrPremium = alias === "pro" || alias === "premium";

  return {
    plan,
    alias,
    isProOrPremium,
    loading,
    error,
    refresh,
  };
};

export default useSubscriptionPlan;
