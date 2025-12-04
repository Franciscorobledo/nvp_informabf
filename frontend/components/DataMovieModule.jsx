import React, { useMemo, useState } from "react";
import DataMoviePlayer from "./DataMoviePlayer";
import AppButton from "./AppButton";
import LoadingBar from "./LoadingBar";
import focusOptions from "./focusOptions";
import UploadDropzone from "./UploadDropzone";

const DataMovieModule = ({ onUnauthorized }) => {
  const [file, setFile] = useState(null);
  const [userFocus, setUserFocus] = useState("todos");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [response, setResponse] = useState(null);

  const apiUrl = useMemo(
    () => import.meta.env.VITE_API_URL || "http://localhost:1000",
    []
  );

  const parseJsonResponse = async (res, defaultError) => {
    const text = await res.text();

    if (!res.ok) {
      throw new Error(text || defaultError);
    }

    if (!text) {
      throw new Error("La respuesta del servidor llegó vacía. Intenta nuevamente.");
    }

    try {
      return JSON.parse(text);
    } catch (parseError) {
      console.error("Respuesta inválida del servidor", parseError);
      throw new Error(
        "No se pudo interpretar la respuesta del servidor. Intenta nuevamente o usa el modo demo."
      );
    }
  };

  const handleSubmit = async () => {
    setError("");
    setResponse(null);
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

      const data = await parseJsonResponse(
        res,
        "No se pudo generar la película de datos."
      );
      if (!data?.data_movie) {
        throw new Error(
          "La respuesta no contiene la película de datos. Intenta nuevamente o usa el modo demo."
        );
      }
      setResponse(data);
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
    setResponse(null);

    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`${apiUrl}/demo/movie?scenario=ventas_demo`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if ([401, 403].includes(res.status)) {
        onUnauthorized?.("Tu sesión expiró. Inicia sesión nuevamente.");
        return;
      }

      const data = await parseJsonResponse(
        res,
        "No se pudo generar la película demo."
      );
      if (!data?.data_movie) {
        throw new Error("No se pudo cargar la película demo. Intenta más tarde.");
      }
      setResponse(data);
    } catch (err) {
      console.error("Error al generar película demo", err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const playerRef = React.useRef(null);

  React.useEffect(() => {
    if (response && playerRef.current) {
      playerRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [response]);

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
              <option key={option.valor} value={option.valor}>
                {option.etiqueta}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500 dark:text-slate-400">
            Usamos este foco para orientar los KPIs y la historia automática.
          </p>
        </div>

        <div className="space-y-3">
          <p className="block text-sm font-semibold text-gray-700 dark:text-slate-100">
            📁 Archivo base
          </p>
          <UploadDropzone
            id="data-movie-file"
            accept=".csv,.xlsx"
            onFileSelect={(selected) => setFile(selected || null)}
            helperText="Formatos permitidos: CSV, XLSX. Peso máximo recomendado: 1MB."
            description="Selecciona o arrastra el archivo que quieres convertir en narrativa visual."
            selectedFileName={file?.name}
          />
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/40 px-4 py-3 text-sm">
          {error}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <AppButton
          onClick={handleSubmit}
          loading={isLoading}
          loadingText="Generando…"
          fullWidth
          className="sm:flex-1"
        >
          Generar película de datos
        </AppButton>

        <AppButton
          onClick={handleDemoMovie}
          loading={isLoading}
          loadingText="Cargando demo…"
          variant="secondary"
          fullWidth
          className="sm:flex-1"
        >
          Probar película con datos de ejemplo
        </AppButton>
      </div>

      {isLoading && (
        <LoadingBar
          indeterminate
          progress={64}
          label="Generando tu película de datos"
          status="Narrativa visual"
          helperText="Estamos analizando los KPIs y armando la narrativa visual."
        />
      )}

      {response && (
        <div ref={playerRef} className="rounded-3xl border border-slate-800 bg-slate-950/80 p-4 scroll-mt-6">
          <p className="text-sm text-slate-200 mb-2">
            Presentación automática con escenas animadas y avatar. Usa las flechas o espera a que el reproductor avance según la duración de cada escena.
          </p>
          <DataMoviePlayer dataMovie={response.data_movie} />
        </div>
      )}
    </div>
  );
};

export default DataMovieModule;
