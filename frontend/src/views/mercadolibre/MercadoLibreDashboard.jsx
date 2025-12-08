import React, { useEffect, useMemo, useState } from "react";
import SectionHeader from "../../components/cards/SectionHeader";
import API_URL from "../../api";

const MercadoLibreDashboard = ({ onUnauthorized }) => {
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const token = useMemo(() => localStorage.getItem("token"), []);

  const fetchSnapshot = async () => {
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`${API_URL}/mercadolibre/sync`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.status === 401 || res.status === 403) {
        onUnauthorized?.("Tu sesión expiró. Vuelve a iniciar sesión.");
        return;
      }

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "No se pudo sincronizar Mercado Libre");
      }

      const data = await res.json();
      setSnapshot(data);
    } catch (err) {
      setError(err.message || "No se pudo obtener la información de Mercado Libre");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSnapshot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sellerNickname = snapshot?.seller?.nickname || "Sin sincronizar";
  const sellerLevel = snapshot?.seller?.seller_reputation?.level_id || "N/D";
  const ordersCount = (snapshot?.orders?.results || snapshot?.orders?.orders || []).length;
  const activeCount = snapshot?.inventory?.active?.item_ids?.length || 0;
  const pausedCount = snapshot?.inventory?.paused?.item_ids?.length || 0;
  const lastSyncLabel = snapshot?.last_sync
    ? new Date(snapshot.last_sync).toLocaleString()
    : "Pendiente";

  return (
    <section className="space-y-6">
      <SectionHeader
        title="Mercado Libre"
        subtitle="Estado de tu cuenta sincronizada"
        badge="Integración"
      />

      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/70 p-5 space-y-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Cuenta de vendedor</p>
            <p className="text-lg font-bold text-slate-900 dark:text-white">{sellerNickname}</p>
            <p className="text-xs text-slate-500">Nivel: {sellerLevel}</p>
            <p className="text-xs text-slate-500">Última sincronización: {lastSyncLabel}</p>
          </div>
          <button
            onClick={fetchSnapshot}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 text-white px-4 py-2 text-sm font-semibold shadow hover:-translate-y-0.5 transition disabled:opacity-60"
          >
            {loading ? "Actualizando..." : "Actualizar ahora"}
          </button>
        </div>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/60 p-4">
            <p className="text-xs text-slate-500">Órdenes recientes</p>
            <p className="text-2xl font-semibold text-slate-900 dark:text-white">{ordersCount}</p>
            <p className="text-[11px] text-slate-500">Últimas órdenes pagadas</p>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/60 p-4">
            <p className="text-xs text-slate-500">Publicaciones activas</p>
            <p className="text-2xl font-semibold text-slate-900 dark:text-white">{activeCount}</p>
            <p className="text-[11px] text-slate-500">Inventario disponible</p>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/60 p-4">
            <p className="text-xs text-slate-500">Publicaciones pausadas</p>
            <p className="text-2xl font-semibold text-slate-900 dark:text-white">{pausedCount}</p>
            <p className="text-[11px] text-slate-500">Productos a revisar</p>
          </div>
        </div>

        {!snapshot && !loading && (
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Conecta tu cuenta para ver métricas de Mercado Libre.
          </p>
        )}
      </div>
    </section>
  );
};

export default MercadoLibreDashboard;
