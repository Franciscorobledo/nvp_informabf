import React, { useEffect, useState } from "react";
import API_URL from "./api";

const SubscriptionStatus = ({ token }) => {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch(`${API_URL}/subscriptions/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await res.json();
        setStatus(data);
      } catch (err) {
        setStatus({ subscription_status: "none" });
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      fetchStatus();
    }
  }, [token]);

  if (loading) return <p>Cargando estado...</p>;
  if (!status) return <p>No se pudo obtener el estado.</p>;

  const isActive = status.subscription_status === "active";

  return (
    <div className="max-w-2xl mx-auto text-center space-y-4">
      <h1 className="text-3xl font-bold">Estado de suscripción</h1>
      <div
        className={`p-6 rounded-2xl border ${
          isActive
            ? "bg-green-50 border-green-200 text-green-900"
            : "bg-amber-50 border-amber-200 text-amber-900"
        }`}
      >
        {isActive ? (
          <>
            <p className="text-xl font-semibold">¡Suscripción activa!</p>
            <p>Plan: {status.current_plan?.name}</p>
          </>
        ) : (
          <>
            <p className="text-xl font-semibold">Suscripción pendiente o inactiva</p>
            <p>Revisa tu pago o vuelve a elegir un plan.</p>
          </>
        )}
      </div>
      <a
        href="/planes"
        className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-blue-600 text-white font-semibold shadow hover:bg-blue-700"
      >
        Ir a planes
      </a>
    </div>
  );
};

export default SubscriptionStatus;
