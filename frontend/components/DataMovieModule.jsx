import React, { useMemo, useState } from "react";
import DataMoviePlayer from "./DataMoviePlayer";

const focusOptions = [
  { value: "todos", label: "🔎 Todo / sin filtro" },
  { value: "ventas", label: "🛒 Venta" },
  { value: "stock", label: "📦 Stock" },
  { value: "producto", label: "📌 Producto" },
  { value: "auditoria", label: "🕵️ Auditoría" },
  { value: "reportes", label: "📈 Reportes de análisis" },
];

const DataMovieModule = ({ onUnauthorized }) => {
  const [file, setFile] = useState(null);
  const [userFocus, setUserFocus] = useState("todos");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [dataMovie, setDataMovie] = useState(null);

  const apiUrl = useMemo(
    () => import.meta.env.VITE_API_URL || "http://localhost:1000",
    []
  );

  const handleSubmit = async () => {
    setError("");
    if (!file) {
      setError("Selecciona un archivo para generar la película de datos.");
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) {
      onUnauthorized?.("Tu sesión expiró. Inicia sesión nuevamente.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("user_focus", userFocus);

    setIsLoading(true);
    setDataMovie(null);
    try {
      const res = await fetch(`${apiUrl}/analyze/movie`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (res.status === 401) {
        onUnauthorized?.("Tu sesión expiró. Inicia sesión nuevamente.");
        return;
      }

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "No se pudo generar la película de datos.");
      }

      const data = await res.json();
      setDataMovie(data?.data_movie || null);
    } catch (err) {
      console.error("Error al generar película de datos", err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoMovie = async () => {
    setError("");
    setIsLoading(true);
    setDataMovie(null);

    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`${apiUrl}/demo/movie?scenario=ventas_demo`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if ([401, 403].includes(res.status)) {
        onUnauthorized?.("Tu sesión expiró. Inicia sesión nuevamente.");
        return;
      }

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "No se pudo generar la película demo.");
      }

      const data = await res.json();
      setDataMovie(data?.data_movie || null);
    } catch (err) {
      console.error("Error al generar película demo", err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h3 className="text-xl font-semibold text-gray-800 dark:text-white flex items-center gap-2">
          <span aria-hidden="true">🎬</span>
          Película de datos
        </h3>
        <p className="text-sm text-gray-600 dark:text-slate-300">
          Sube un archivo y genera una narrativa visual de cómo evolucionan tus métricas clave.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-3">
          <label
            htmlFor="data-movie-focus"
            className="block text-sm font-semibold text-gray-700 dark:text-slate-100"
          >
            🎯 Foco del análisis
          </label>
          <select
            id="data-movie-focus"
            value={userFocus}
            onChange={(e) => setUserFocus(e.target.value)}
            className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400 dark:text-slate-100"
          >
            {focusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500 dark:text-slate-400">
            Usamos este foco para orientar los KPIs y la historia automática.
          </p>
        </div>

        <div className="space-y-3">
          <label
            htmlFor="data-movie-file"
            className="block text-sm font-semibold text-gray-700 dark:text-slate-100"
          >
            📁 Archivo base
          </label>
          <input
            id="data-movie-file"
            type="file"
            accept=".csv, .xlsx"
            onChange={(event) => setFile(event.target.files?.[0] || null)}
            className="w-full rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400 dark:text-slate-100"
          />
          <p className="text-xs text-gray-500 dark:text-slate-400">
            Se admite un solo archivo .CSV o .XLSX para esta vista dedicada.
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/40 px-4 py-3 text-sm">
          {error}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={handleSubmit}
          disabled={isLoading}
          className={`flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold text-white shadow-md transition focus:outline-none focus:ring-4 focus:ring-emerald-200 ${
            isLoading ? "bg-emerald-400 cursor-not-allowed" : "bg-emerald-600 hover:bg-emerald-700"
          }`}
        >
          {isLoading ? "Generando…" : "Generar película de datos"}
        </button>

        <button
          onClick={handleDemoMovie}
          disabled={isLoading}
          className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold border border-amber-300 text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-900/30 hover:bg-amber-100 dark:hover:bg-amber-900/50 transition"
        >
          {isLoading ? "Cargando demo…" : "Probar película con datos de ejemplo"}
        </button>
      </div>

      {dataMovie && (
        <div className="rounded-3xl border border-slate-800 bg-slate-950/80 p-4">
          <p className="text-sm text-slate-200 mb-2">
            Presentación automática con escenas animadas y avatar. Usa las flechas o espera a que el reproductor avance según la duración de cada escena.
          </p>
          <DataMoviePlayer dataMovie={dataMovie} />
        </div>
      )}
    </div>
  );
};

export default DataMovieModule;
