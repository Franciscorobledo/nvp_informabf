import React, { useEffect, useMemo, useState } from "react";
import { hasPlayableDataMovie } from "./dataMovieUtils";

const DataMoviePlayer = ({ dataMovie }) => {
  const frames = useMemo(() => dataMovie?.frames || [], [dataMovie]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    if (!frames.length) return undefined;
    setCurrentIndex(0);
    setIsPlaying(false);
  }, [frames.length]);

  useEffect(() => {
    if (!isPlaying || frames.length <= 1) return undefined;

    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % frames.length);
    }, 2600);

    return () => clearInterval(timer);
  }, [isPlaying, frames.length]);

  const hasPlayableFrames = hasPlayableDataMovie(dataMovie);

  if (!hasPlayableFrames) {
    return (
      <div className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm text-center text-sm text-gray-600 dark:text-slate-300">
        No se pudo generar la película de datos. Intenta con un archivo que contenga
        fechas o métricas numéricas para construir la narrativa.
      </div>
    );
  }

  const currentFrame = frames[currentIndex] || {};
  const movieTitle = dataMovie.movie_title || "Película de datos";
  const movieSubtitle = dataMovie.movie_subtitle || "Resumen visual de la evolución";

  const handlePrev = () => setCurrentIndex((prev) => (prev === 0 ? frames.length - 1 : prev - 1));
  const handleNext = () => setCurrentIndex((prev) => (prev + 1) % frames.length);

  const handleProgressClick = (event) => {
    if (!frames.length) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1);
    const targetIndex = Math.round(ratio * (frames.length - 1));
    setCurrentIndex(targetIndex);
    setIsPlaying(false);
  };

  return (
    <div className="w-full space-y-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-lg p-6">
        <div className="flex flex-col gap-2 mb-4">
          <p className="text-sm font-semibold text-blue-600 dark:text-blue-300">{movieTitle}</p>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <span role="img" aria-hidden="true">
              🎬
            </span>
            Película de datos
          </h3>
          <p className="text-sm text-gray-600 dark:text-slate-300">{movieSubtitle}</p>
        </div>

        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="text-xs uppercase tracking-[0.15em] text-gray-500 dark:text-slate-400">Momento actual</p>
              <p className="text-2xl font-extrabold text-gray-900 dark:text-white leading-tight">{currentFrame.time_label}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsPlaying((prev) => !prev)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-md transition"
              >
                <span className="text-lg" role="img" aria-hidden="true">
                  {isPlaying ? "⏸️" : "▶️"}
                </span>
                {isPlaying ? "Pausar" : "Reproducir"}
              </button>
              <button
                onClick={handlePrev}
                className="inline-flex items-center justify-center px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-700 dark:text-slate-100 hover:shadow-sm"
              >
                ◀
              </button>
              <button
                onClick={handleNext}
                className="inline-flex items-center justify-center px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-700 dark:text-slate-100 hover:shadow-sm"
              >
                ▶
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <div
              className="relative h-3 w-full cursor-pointer rounded-full bg-gray-200 dark:bg-slate-800"
              onClick={handleProgressClick}
              aria-label="Progreso de película"
            >
              <div
                className="absolute left-0 top-0 h-full rounded-full bg-blue-500"
                style={{ width: `${((currentIndex + 1) / frames.length) * 100}%` }}
              />
              <div className="absolute inset-0 flex items-center justify-between">
                {frames.map((frame, idx) => (
                  <button
                    key={frame.id}
                    onClick={() => {
                      setCurrentIndex(idx);
                      setIsPlaying(false);
                    }}
                    className={`h-3 w-3 rounded-full transition ${
                      idx === currentIndex
                        ? "bg-blue-600 ring-4 ring-blue-200 dark:ring-blue-900"
                        : "bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700"
                    }`}
                    aria-label={`Ir al frame ${idx + 1}`}
                  />
                ))}
              </div>
            </div>
            <div className="flex justify-between text-xs text-gray-500 dark:text-slate-400">
              <span>Frame {currentIndex + 1} de {frames.length}</span>
              <span>{currentFrame.context?.granularity !== "none" ? `Granularidad: ${currentFrame.context?.granularity}` : "Sin línea de tiempo"}</span>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-gradient-to-br from-white to-gray-50 dark:from-slate-900 dark:to-slate-950 p-6 shadow-inner">
            <div className="flex flex-col gap-2 mb-4">
              <h4 className="text-lg font-semibold text-gray-900 dark:text-white">{currentFrame.title}</h4>
              <p className="text-sm text-gray-600 dark:text-slate-300">{currentFrame.subtitle}</p>
            </div>

            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {Object.entries(currentFrame.metrics || {}).map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm"
                >
                  <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-slate-400">{label}</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">
                    {typeof value === "number" ? value.toLocaleString() : value}
                  </p>
                </div>
              ))}
              {(!currentFrame.metrics || !Object.keys(currentFrame.metrics).length) && (
                <p className="text-sm text-gray-500 dark:text-slate-400">Sin métricas disponibles.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DataMoviePlayer;
