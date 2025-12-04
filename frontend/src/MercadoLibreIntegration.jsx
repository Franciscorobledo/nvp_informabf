import React, { useEffect, useMemo, useState } from "react";
import API_URL from "./api";

const emptyForm = {
  account_name: "Principal",
  client_id: "",
  client_secret: "",
  redirect_uri: "",
  country_code: "MLA",
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

const MercadoLibreIntegration = ({ onUnauthorized }) => {
  const [form, setForm] = useState(emptyForm);
  const [credentials, setCredentials] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [syncPreview, setSyncPreview] = useState(null);

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
      onUnauthorized?.("Tu sesión expiró. Vuelve a iniciar sesión.");
      throw new Error("unauthorized");
    }

    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || "Error en la petición");
    }

    return res.json();
  };

  const loadCredentials = async () => {
    if (!token) return;
    try {
      const data = await authorizedFetch(`${API_URL}/mercadolibre/credentials`);
      setCredentials(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadCredentials();
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
      const payload = { ...form };
      if (!payload.webhook_url) delete payload.webhook_url;
      const data = await authorizedFetch(`${API_URL}/mercadolibre/credentials`, {
        method: "POST",
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" },
      });
      setMessage("Credenciales guardadas. Ahora conecta la cuenta para obtener tokens.");
      setCredentials((prev) => [data, ...prev]);
      setForm(emptyForm);
    } catch (err) {
      setError(err.message || "No se pudo guardar");
    } finally {
      setLoading(false);
    }
  };

  const handleAuthorize = async (id) => {
    try {
      const data = await authorizedFetch(`${API_URL}/mercadolibre/credentials/${id}/authorize`, {
        method: "POST",
      });
      if (data.authorization_url) {
        window.open(data.authorization_url, "_blank", "noopener,noreferrer");
        setMessage("Redirigido a MercadoLibre. Completa el consentimiento y vuelve a esta pantalla.");
      }
    } catch (err) {
      setError(err.message || "No se pudo iniciar la autorización");
    }
  };

  const handleSync = async (id, resource) => {
    setError("");
    setMessage("");
    try {
      const data = await authorizedFetch(`${API_URL}/mercadolibre/credentials/${id}/${resource}`);
      setSyncPreview({ resource, data });
      setMessage("Datos sincronizados. Revisa el panel de análisis para explotarlos.");
    } catch (err) {
      setError(err.message || "No se pudo sincronizar");
    }
  };

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <p className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 dark:bg-amber-900/40 dark:text-amber-100">
          🛒 Integraciones • MercadoLibre
        </p>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Configura credenciales por usuario</h2>
        <p className="text-sm text-gray-600 dark:text-slate-300">
          Guarda CLIENT_ID, CLIENT_SECRET, REDIRECT_URI y país sin usar variables de entorno. Cada usuario controla sus propios vendedores.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <form
          onSubmit={handleSave}
          className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/70 shadow-sm p-5 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Nueva credencial</h3>
            <span className="text-xs text-slate-500 dark:text-slate-300">Campos sensibles se almacenan cifrados</span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-200">Alias</span>
              <input
                name="account_name"
                value={form.account_name}
                onChange={handleChange}
                required
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/60 px-3 py-2 text-sm"
                placeholder="Cuenta principal"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-200">País / Site ID</span>
              <select
                name="country_code"
                value={form.country_code}
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
                placeholder="App ID de MercadoLibre"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-200">CLIENT_SECRET</span>
              <input
                name="client_secret"
                value={form.client_secret}
                onChange={handleChange}
                required
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/60 px-3 py-2 text-sm"
                placeholder="Se guarda cifrado"
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
              placeholder="https://tu-backend.com/mercadolibre/oauth/callback"
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

          <button
            type="submit"
            disabled={loading}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 text-white px-5 py-3 text-sm font-semibold shadow hover:-translate-y-0.5 transition disabled:opacity-60"
          >
            {loading ? "Guardando..." : "Guardar credenciales"}
          </button>

          {message && <p className="text-sm text-emerald-600 dark:text-emerald-300">{message}</p>}
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        </form>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/70 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Cuentas conectadas</h3>
            <span className="text-xs text-slate-500 dark:text-slate-300">{credentials.length} configurada(s)</span>
          </div>

          {credentials.length === 0 && (
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Aún no hay credenciales. Completa el formulario para agregar una cuenta.
            </p>
          )}

          <div className="space-y-4">
            {credentials.map((cred) => (
              <div
                key={cred.id}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50 p-4 space-y-3"
              >
                <div className="flex flex-wrap items-center gap-3 justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{cred.account_name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-300">
                      {cred.country_code} • Redirect: {cred.redirect_uri}
                    </p>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${cred.has_tokens
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-100"
                      : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-100"
                      }`}
                  >
                    {cred.has_tokens ? "Tokens listos" : "Falta autorizar"}
                  </span>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => handleAuthorize(cred.id)}
                    className="inline-flex items-center gap-2 rounded-xl bg-slate-900 text-white px-4 py-2 text-xs font-semibold shadow"
                  >
                    Conectar cuenta MercadoLibre
                  </button>
                  <button
                    onClick={() => handleSync(cred.id, "seller")}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-300 dark:border-slate-700 px-4 py-2 text-xs font-semibold"
                  >
                    Sincronizar vendedor
                  </button>
                  <button
                    onClick={() => handleSync(cred.id, "listings/active")}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-300 dark:border-slate-700 px-4 py-2 text-xs font-semibold"
                  >
                    Publicaciones activas
                  </button>
                  <button
                    onClick={() => handleSync(cred.id, "orders")}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-300 dark:border-slate-700 px-4 py-2 text-xs font-semibold"
                  >
                    Ventas / órdenes
                  </button>
                  <button
                    onClick={() => handleSync(cred.id, "listings/paused")}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-300 dark:border-slate-700 px-4 py-2 text-xs font-semibold"
                  >
                    Productos pausados
                  </button>
                </div>
              </div>
            ))}
          </div>

          {syncPreview && (
            <div className="rounded-xl bg-slate-100 dark:bg-slate-800/80 p-3 text-xs text-slate-800 dark:text-slate-200 overflow-x-auto">
              <p className="font-semibold mb-2">Resultado rápido ({syncPreview.resource}):</p>
              <pre className="whitespace-pre-wrap">
                {JSON.stringify(syncPreview.data, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-blue-100 dark:border-blue-900/50 bg-blue-50/70 dark:bg-blue-900/30 p-4 text-sm text-blue-900 dark:text-blue-100 space-y-2">
        <p className="font-semibold">Flujo recomendado</p>
        <ol className="list-decimal list-inside space-y-1">
          <li>Registra la aplicación en MercadoLibre y copia el CLIENT_ID/CLIENT_SECRET.</li>
          <li>Configura el redirect hacia <code className="px-1 bg-white/60 dark:bg-slate-800/60 rounded">/mercadolibre/oauth/callback</code> de este backend.</li>
          <li>Guarda las credenciales, pulsa "Conectar cuenta" y acepta el consentimiento.</li>
          <li>Usa los botones de sincronización o el análisis automático en el módulo de cargas para graficar los datos.</li>
        </ol>
      </div>
    </section>
  );
};

export default MercadoLibreIntegration;
