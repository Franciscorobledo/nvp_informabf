import React, { useEffect, useMemo, useState } from "react";
import API_URL from "./api";

const emptyForm = {
  alias: "",
  site_id: "MLA",
  client_id: "",
  client_secret: "",
  redirect_uri: "",
  webhook_url: "",
};

const countryOptions = [
  "MLA",
  "MLB",
  "MLM",
  "MLC",
  "MCO",
  "MPE",
  "MLU",
  "MLV",
  "MCR",
  "MBO",
];

const AdminMercadoLibreApps = ({ onUnauthorized }) => {
  const [form, setForm] = useState(emptyForm);
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState(null);
  const token = useMemo(() => localStorage.getItem("token"), []);

  const authorizedFetch = async (url, options = {}) => {
    const res = await fetch(url, {
      ...options,
      headers: {
        ...(options.headers || {}),
        Authorization: `Bearer ${token}`,
        "Content-Type": options.body instanceof FormData ? undefined : "application/json",
      },
    });

    if (res.status === 401 || res.status === 403) {
      onUnauthorized?.("Tu sesión expiró o no tienes permisos para el panel de admin.");
      throw new Error("unauthorized");
    }

    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || "Error en la petición");
    }

    return res.json();
  };

  const loadApps = async () => {
    if (!token) return;
    try {
      const data = await authorizedFetch(`${API_URL}/admin/ml/apps`);
      setApps(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadApps();
  }, []);

  const handleChange = (evt) => {
    const { name, value } = evt.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async (evt) => {
    evt.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");

    try {
      if (!form.alias.trim() || !form.client_id.trim() || (!editingId && !form.client_secret.trim())) {
        throw new Error("Alias, CLIENT_ID y CLIENT_SECRET son obligatorios");
      }

      const payload = {
        alias: form.alias.trim(),
        site_id: form.site_id,
        client_id: form.client_id.trim(),
        client_secret: form.client_secret.trim() || undefined,
        redirect_uri: form.redirect_uri.trim(),
        webhook_url: form.webhook_url.trim() || undefined,
      };

      const method = editingId ? "PUT" : "POST";
      const url = editingId
        ? `${API_URL}/admin/ml/apps/${editingId}`
        : `${API_URL}/admin/ml/apps`;

      const data = await authorizedFetch(url, { method, body: JSON.stringify(payload) });
      setMessage(editingId ? "Aplicación actualizada" : "Aplicación creada");
      setEditingId(null);
      setForm(emptyForm);
      setApps((prev) => {
        const filtered = prev.filter((item) => item.id !== data.id);
        return [data, ...filtered];
      });
    } catch (err) {
      setError(err.message || "No se pudo guardar");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (app) => {
    setEditingId(app.id);
    setForm({
      alias: app.alias,
      site_id: app.site_id,
      client_id: app.client_id,
      client_secret: "",
      redirect_uri: app.redirect_uri,
      webhook_url: app.webhook_url || "",
    });
    setMessage("Editando aplicación. Guarda para aplicar cambios.");
    window.history.pushState({ page: "meli-admin" }, "", "/admin/integraciones/mercadolibre");
  };

  const handleDelete = async (id) => {
    if (!window.confirm("¿Eliminar esta app?")) return;
    try {
      await authorizedFetch(`${API_URL}/admin/ml/apps/${id}`, { method: "DELETE" });
      setApps((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      setError(err.message || "No se pudo eliminar");
    }
  };

  const handleTest = async (id) => {
    try {
      const data = await authorizedFetch(`${API_URL}/admin/ml/apps/${id}/test`, { method: "POST" });
      setMessage("URL de autorización generada. Se abrirá en una nueva pestaña.");
      if (data.authorization_url) {
        window.open(data.authorization_url, "_blank", "noopener,noreferrer");
      }
    } catch (err) {
      setError(err.message || "No se pudo probar la conexión");
    }
  };

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide">Panel admin</p>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Mercado Libre • Apps</h2>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Crea apps oficiales para los usuarios. Los secretos se almacenan cifrados y nunca se muestran completos.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <form
          onSubmit={handleSave}
          className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/70 shadow-sm p-5 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              {editingId ? "Editar aplicación" : "Nueva aplicación"}
            </h3>
            <span className="text-xs text-slate-500 dark:text-slate-300">Campos obligatorios</span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-200">Alias</span>
              <input
                name="alias"
                value={form.alias}
                onChange={handleChange}
                required
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/60 px-3 py-2 text-sm"
                placeholder="tienda-principal"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-200">Site ID</span>
              <select
                name="site_id"
                value={form.site_id}
                onChange={handleChange}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/60 px-3 py-2 text-sm"
              >
                {countryOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-200">CLIENT_ID</span>
              <input
                name="client_id"
                value={form.client_id}
                onChange={handleChange}
                required
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/60 px-3 py-2 text-sm"
                placeholder="App ID de Mercado Libre"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-200">CLIENT_SECRET</span>
              <input
                name="client_secret"
                type="password"
                value={form.client_secret}
                onChange={handleChange}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/60 px-3 py-2 text-sm"
                placeholder={editingId ? "(opcional, solo si quieres actualizar)" : "Se guarda cifrado"}
                required={!editingId}
              />
            </label>
          </div>

          <label className="space-y-1">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-200">REDIRECT_URI</span>
            <input
              name="redirect_uri"
              value={form.redirect_uri}
              onChange={handleChange}
              required
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/60 px-3 py-2 text-sm"
              placeholder="https://tu-backend.com/meli/callback"
            />
          </label>

          <label className="space-y-1">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-200">Webhook URL (opcional)</span>
            <input
              name="webhook_url"
              value={form.webhook_url}
              onChange={handleChange}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/60 px-3 py-2 text-sm"
              placeholder="https://miapp.com/webhooks/meli"
            />
          </label>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 text-white px-5 py-3 text-sm font-semibold shadow hover:-translate-y-0.5 transition disabled:opacity-60"
            >
              {loading ? "Guardando..." : editingId ? "Actualizar app" : "Crear app"}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setForm(emptyForm);
                  setMessage("");
                }}
                className="text-sm text-slate-600 dark:text-slate-300 underline"
              >
                Cancelar edición
              </button>
            )}
          </div>

          {message && <p className="text-sm text-emerald-600 dark:text-emerald-300">{message}</p>}
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        </form>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/70 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Apps configuradas</h3>
            <span className="text-xs text-slate-500 dark:text-slate-300">{apps.length} app(s)</span>
          </div>

          {apps.length === 0 && (
            <p className="text-sm text-slate-600 dark:text-slate-300">
              No hay apps configuradas. Crea una para permitir a los usuarios conectarse.
            </p>
          )}

          <div className="space-y-3">
            {apps.map((app) => (
              <div
                key={app.id}
                className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 bg-slate-50/80 dark:bg-slate-800/60 flex flex-col gap-2"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{app.alias}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-300">Site: {app.site_id}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleTest(app.id)}
                      className="text-xs px-3 py-1.5 rounded-lg bg-amber-500 text-white hover:-translate-y-0.5 transition"
                    >
                      Probar conexión
                    </button>
                    <button
                      onClick={() => handleEdit(app)}
                      className="text-xs px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:-translate-y-0.5 transition"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleDelete(app.id)}
                      className="text-xs px-3 py-1.5 rounded-lg bg-red-500 text-white hover:-translate-y-0.5 transition"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300">CLIENT_ID: {app.client_id}</p>
                <p className="text-xs text-slate-600 dark:text-slate-300">CLIENT_SECRET: ••••••</p>
                <p className="text-xs text-slate-600 dark:text-slate-300 truncate">Redirect: {app.redirect_uri}</p>
                {app.webhook_url && (
                  <p className="text-xs text-slate-600 dark:text-slate-300 truncate">Webhook: {app.webhook_url}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminMercadoLibreApps;
