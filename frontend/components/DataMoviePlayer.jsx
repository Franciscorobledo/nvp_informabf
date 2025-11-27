import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  LineChart,
  Line,
  ResponsiveContainer,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceDot,
} from "recharts";
import AvatarPresenter from "./AvatarPresenter";
import {
  extractScenes,
  hasPlayableDataMovie,
  normalizeSceneList,
} from "./dataMovieUtils";
import MovieChart from "./MovieChart";

const fadeInKeyframes = `
@keyframes dataMovieFadeIn {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes dataMovieSlideIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
`;

const useCountUp = (targetValue, durationMs = 800) => {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const start = performance.now();
    const target = Number(targetValue) || 0;

    const tick = (ts) => {
      const progress = Math.min((ts - start) / durationMs, 1);
      setDisplay(Math.floor(progress * target));
      if (progress < 1) requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  }, [targetValue, durationMs]);

  return display.toLocaleString();
};

const TimelineScene = ({ scene }) => {
  const data = scene.chart_data || [];
  const timelineData = useMemo(() => {
    return data
      .map((point) => {
        const date = new Date(point.x);
        if (Number.isNaN(date.getTime())) return null;
        return {
          ...point,
          timestamp: date.getTime(),
          label: date.toLocaleDateString("es-ES", {
            year: "numeric",
            month: "short",
          }),
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.timestamp - b.timestamp);
  }, [data]);

  if (!timelineData.length) return <p className="text-slate-300">Sin datos temporales.</p>;

  const maxPoint = timelineData.reduce((a, b) => (b.y > a.y ? b : a), timelineData[0]);
  const minPoint = timelineData.reduce((a, b) => (b.y < a.y ? b : a), timelineData[0]);

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart
        data={timelineData}
        margin={{ top: 20, right: 20, left: 10, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
        <XAxis
          dataKey="timestamp"
          type="number"
          stroke="#cbd5e1"
          tick={{ fontSize: 12 }}
          tickFormatter={(value, index) => timelineData[index]?.label || ""}
          domain={["auto", "auto"]}
        />
        <YAxis stroke="#cbd5e1" tick={{ fontSize: 12 }} />
        <Tooltip
          contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", color: "#e2e8f0" }}
          labelFormatter={(value) =>
            new Date(value).toLocaleDateString("es-ES", {
              year: "numeric",
              month: "short",
              day: "2-digit",
            })
          }
        />
        <Line
          type="monotone"
          dataKey="y"
          stroke="#60a5fa"
          strokeWidth={3}
          dot={{ r: 3, fill: "#60a5fa" }}
          isAnimationActive
          animationDuration={900}
        />
        <ReferenceDot
          x={maxPoint.timestamp}
          y={maxPoint.y}
          r={6}
          fill="#22c55e"
          stroke="none"
        />
        <ReferenceDot
          x={minPoint.timestamp}
          y={minPoint.y}
          r={6}
          fill="#f87171"
          stroke="none"
        />
      </LineChart>
    </ResponsiveContainer>
  );
};

const RankingScene = ({ scene }) => {
  const entities = scene.entities || [];
  if (!entities.length) return <p className="text-slate-300">Sin ranking disponible.</p>;

  const maxValue = Math.max(...entities.map((e) => e.value || 0), 1);

  return (
    <div className="space-y-3">
      {entities.map((entity, idx) => {
        const widthPct = Math.max((entity.value / maxValue) * 100, 6);
        return (
          <div key={entity.name} className="flex items-center gap-3">
            <div className="w-24 text-sm text-slate-200 truncate" title={entity.name}>
              {idx === 0 ? "🏆 " : ""}
              {entity.name}
            </div>
            <div className="h-4 flex-1 rounded-full bg-slate-800 overflow-hidden">
              <div
                className={`h-full rounded-full ${idx === 0 ? "bg-emerald-400" : "bg-blue-400"}`}
                style={{ width: `${widthPct}%`, transition: "width 800ms ease" }}
              />
            </div>
            <div className="w-16 text-right text-sm text-slate-200">
              {entity.value?.toLocaleString?.()}
            </div>
            {entity.share != null && (
              <div className="w-12 text-right text-xs text-slate-300">{(entity.share * 100).toFixed(0)}%</div>
            )}
          </div>
        );
      })}
    </div>
  );
};

const RisksScene = ({ scene }) => {
  const alerts = scene.alerts || [];
  if (!alerts.length) return <p className="text-slate-300">Sin alertas relevantes.</p>;

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {alerts.slice(0, 3).map((alert) => (
        <div
          key={alert}
          className="flex items-start gap-3 rounded-xl bg-slate-800/70 p-4 text-slate-100 shadow-md border border-amber-500/30"
        >
          <span className="text-2xl animate-pulse">⚠️</span>
          <p className="text-sm leading-relaxed">{alert}</p>
        </div>
      ))}
    </div>
  );
};

const OutroScene = ({ scene, onReplay, onRestart }) => {
  const recommendations = scene.recommendations || [];

  return (
    <div className="space-y-4">
      <ul className="space-y-2">
        {recommendations.map((rec, idx) => (
          <li
            key={rec}
            className="flex items-start gap-2 text-slate-100"
            style={{ animation: "dataMovieFadeIn 0.8s ease forwards", animationDelay: `${idx * 120}ms` }}
          >
            <span className="mt-0.5">•</span>
            <span>{rec}</span>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-3">
        <button
          onClick={onReplay}
          className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700"
        >
          Reproducir de nuevo
        </button>
        <button
          onClick={onRestart}
          className="rounded-xl border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-100 hover:border-slate-400"
        >
          Volver al inicio de película
        </button>
      </div>
    </div>
  );
};

const IntroScene = ({ scene }) => {
  const rows = useCountUp(scene.kpis?.rows || 0);
  const entities = useCountUp(scene.kpis?.entities || 0);
  const metric = useCountUp(scene.kpis?.main_metric_value || 0);

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <div className="rounded-2xl bg-slate-800/70 p-4 text-center shadow">
        <p className="text-xs uppercase text-slate-400">Registros</p>
        <p className="text-3xl font-extrabold text-white">{rows}</p>
      </div>
      <div className="rounded-2xl bg-slate-800/70 p-4 text-center shadow">
        <p className="text-xs uppercase text-slate-400">Entidades</p>
        <p className="text-3xl font-extrabold text-white">{entities}</p>
      </div>
      {scene.kpis?.main_metric_label && (
        <div className="rounded-2xl bg-slate-800/70 p-4 text-center shadow">
          <p className="text-xs uppercase text-slate-400">{scene.kpis.main_metric_label}</p>
          <p className="text-3xl font-extrabold text-white">{metric}</p>
        </div>
      )}
      {scene.extra?.date_range && (
        <div className="md:col-span-3 rounded-xl border border-slate-700 bg-slate-800/50 p-3 text-sm text-slate-200">
          Rango temporal: {scene.extra.date_range}
        </div>
      )}
    </div>
  );
};

const UnknownScene = ({ scene }) => (
  <p className="text-slate-300">Escena no soportada todavía ({scene?.type}).</p>
);

const SCENE_REGISTRY = {
  intro: {
    type: "intro",
    label: "Introducción",
    defaultMood: "neutral",
    defaultDuration: 6,
    defaults: {},
    render: ({ scene }) => <IntroScene scene={scene} />,
  },
  timeline: {
    type: "timeline",
    label: "Línea de tiempo",
    defaultMood: "focused",
    defaultDuration: 7,
    defaults: { chart_data: [] },
    render: ({ scene }) => <TimelineScene scene={scene} />,
  },
  ranking: {
    type: "ranking",
    label: "Ranking",
    defaultMood: "happy",
    defaultDuration: 7,
    defaults: { entities: [] },
    render: ({ scene }) => <RankingScene scene={scene} />,
  },
  risks: {
    type: "risks",
    label: "Alertas",
    defaultMood: "warning",
    defaultDuration: 6,
    defaults: { alerts: [] },
    render: ({ scene }) => <RisksScene scene={scene} />,
  },
  outro: {
    type: "outro",
    label: "Cierre",
    defaultMood: "positive",
    defaultDuration: 7,
    defaults: { recommendations: [] },
    render: ({ scene, onReplay, onRestart }) => (
      <OutroScene scene={scene} onReplay={onReplay} onRestart={onRestart} />
    ),
  },
  fallback: {
    type: "generic",
    label: "Escena",
    defaultMood: "neutral",
    defaultDuration: 6,
    defaults: {},
    render: ({ scene }) => <UnknownScene scene={scene} />,
  },
};

const renderSceneContent = (scene, onReplay, onRestart) => {
  const definition = SCENE_REGISTRY[scene?.type] || SCENE_REGISTRY.fallback;
  return definition.render({ scene, onReplay, onRestart });
};

const DataMoviePlayer = ({ dataMovie }) => {
  const scenes = useMemo(() => {
    const rawScenes = extractScenes(dataMovie);
    return normalizeSceneList(rawScenes, SCENE_REGISTRY);
  }, [dataMovie]);
  const [currentSceneIndex, setCurrentSceneIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [displayedNarration, setDisplayedNarration] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [downloadStatus, setDownloadStatus] = useState({ state: "idle", message: "", type: null });
  const playerRef = useRef(null);

  const goToScene = useCallback(
    (idx, shouldPlay = null) => {
      if (!scenes.length) return;
      const clamped = Math.min(Math.max(idx, 0), scenes.length - 1);
      setCurrentSceneIndex(clamped);
      if (typeof shouldPlay === "boolean") {
        setIsPlaying(shouldPlay);
      }
    },
    [scenes.length]
  );

  const hasScenes = hasPlayableDataMovie(dataMovie) && scenes.length > 0;
  
  useEffect(() => {
    if (!scenes.length) return;
    setCurrentSceneIndex(0);
    setIsPlaying(true);
  }, [scenes.length]);

  useEffect(() => {
    if (!scenes.length) return undefined;
    const narration = scenes[currentSceneIndex]?.narration || "";
    let index = 0;
    setDisplayedNarration("");

    const typer = setInterval(() => {
      setDisplayedNarration(narration.slice(0, index));
      index += 1;
      if (index > narration.length) clearInterval(typer);
    }, 20);

    return () => clearInterval(typer);
  }, [currentSceneIndex, scenes]);

  useEffect(() => {
    if (!isPlaying || scenes.length <= 1) return undefined;
    const currentScene = scenes[currentSceneIndex] || {};
    const definition = SCENE_REGISTRY[currentScene.type] || SCENE_REGISTRY.fallback;
    const durationSec = Number(currentScene.duration_sec) || definition.defaultDuration;
    const duration = Math.max(durationSec * 1000, 2000);

    const timer = setTimeout(() => {
      if (currentSceneIndex >= scenes.length - 1) {
        setIsPlaying(false);
        return;
      }
      setCurrentSceneIndex((prev) => Math.min(prev + 1, scenes.length - 1));
    }, duration);

    return () => clearTimeout(timer);
  }, [isPlaying, currentSceneIndex, scenes]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const isActive = document.fullscreenElement === playerRef.current;
      setIsFullscreen(isActive);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (!hasScenes) return;
      if (event.key === "ArrowRight") {
        event.preventDefault();
        goToScene(currentSceneIndex + 1, false);
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        goToScene(currentSceneIndex - 1, false);
      }
      if (event.key === " ") {
        event.preventDefault();
        setIsPlaying((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentSceneIndex, goToScene, hasScenes]);
  const currentScene = scenes[currentSceneIndex] || {};
  const currentDefinition = SCENE_REGISTRY[currentScene.type] || SCENE_REGISTRY.fallback;

  const toggleFullscreen = async () => {
    if (!playerRef.current) return;

    try {
      if (!document.fullscreenElement) {
        await playerRef.current.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (error) {
      console.error("No se pudo cambiar a pantalla completa", error);
    }
  };

  const handleDownload = async (type = "movie") => {
    const downloadUrl = dataMovie?.download_urls?.[type] || dataMovie?.downloads?.[type];

    if (!downloadUrl) {
      setDownloadStatus({ state: "idle", message: "Descarga disponible pronto.", type });
      return;
    }

    try {
      setDownloadStatus({ state: "loading", message: "Preparando descarga…", type });
      window.open(downloadUrl, "_blank", "noopener");
      setTimeout(() => {
        setDownloadStatus({ state: "success", message: "Descarga iniciada.", type });
      }, 400);
    } catch (error) {
      setDownloadStatus({ state: "error", message: "No se pudo iniciar la descarga.", type });
    }
  };

  const renderSceneVisual = () => {
    // Mejora módulo premium Película de datos: visual adaptable por tipo de escena.
    if (["ranking", "risks", "intro", "outro"].includes(currentScene.type)) {
      return renderSceneContent(currentScene, () => goToScene(0, true), () => goToScene(0, false));
    }

    if (currentScene.chart_data || currentScene.chart_config?.data) {
      return <MovieChart scene={currentScene} />;
    }

    return renderSceneContent(currentScene, () => goToScene(0, true), () => goToScene(0, false));
  };

  const highlights =
    currentScene.highlights ||
    currentScene.bullets ||
    currentScene.recommendations ||
    currentScene.alerts ||
    [];

  const sceneTitle = currentScene.scene_title || currentScene.title || currentDefinition.label;
  const progressPct = ((currentSceneIndex + 1) / scenes.length) * 100;

  if (!hasScenes) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 text-center text-sm text-slate-200">
        No se pudo generar la película de datos. Intenta con un archivo que contenga fechas o métricas numéricas para construir la narrativa.
      </div>
    );
  }

  return (
    <div
      ref={playerRef}
      className={`rounded-3xl bg-slate-900 p-6 shadow-2xl border border-slate-800 space-y-5 transition-all ${
        isFullscreen ? "fixed inset-0 z-50 m-0 h-screen w-screen overflow-auto rounded-none" : ""
      }`}
    >
      <style>{fadeInKeyframes}</style>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h3 className="text-2xl font-bold text-white">{dataMovie?.movie_title || "Película de datos"}</h3>
          <p className="text-sm text-slate-300">{dataMovie?.movie_subtitle || "Presentación guiada"}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handleDownload("movie")}
            className={`rounded-full border border-slate-600 px-4 py-2 text-xs font-semibold text-slate-100 transition hover:border-blue-400 hover:text-white ${
              downloadStatus.state === "loading" ? "opacity-70" : ""
            }`}
            aria-label="Descargar película (.movie)"
          >
            {downloadStatus.state === "loading" ? "Preparando…" : "Descargar película (.movie)"}
          </button>
        </div>
      </div>

      {downloadStatus.message && (
        <div className="rounded-2xl border border-slate-700 bg-slate-800/60 px-4 py-3 text-xs text-slate-200" role="status">
          {downloadStatus.message}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[2fr,1fr]">
        <div
          className="relative overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 p-6 shadow-inner"
          style={{ animation: "dataMovieFadeIn 0.45s ease" }}
        >
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-slate-200">
            <div className="space-y-1">
              <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Escena</p>
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-blue-500/20 px-3 py-1 text-xs font-semibold text-blue-100">{currentDefinition.label}</span>
                <span className="text-xs text-slate-400">{currentScene.type}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <button
                onClick={() => goToScene(Math.max(currentSceneIndex - 1, 0), false)}
                className="rounded-full border border-slate-700 px-3 py-2 text-white transition hover:border-blue-400"
                aria-label="Escena anterior"
              >
                ◀
              </button>
              <button
                onClick={() => setIsPlaying((prev) => !prev)}
                className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700"
                aria-label={isPlaying ? "Pausar escena" : "Reproducir escena"}
              >
                {isPlaying ? "⏸️ Pausa" : "▶️ Reproducir"}
              </button>
              <button
                onClick={() => goToScene(Math.min(currentSceneIndex + 1, scenes.length - 1), false)}
                className="rounded-full border border-slate-700 px-3 py-2 text-white transition hover:border-blue-400"
                aria-label="Escena siguiente"
              >
                ▶
              </button>
              <button
                onClick={toggleFullscreen}
                className="rounded-full border border-slate-700 px-3 py-2 text-white transition hover:border-blue-400"
                aria-label={isFullscreen ? "Salir de pantalla completa" : "Ver en pantalla completa"}
              >
                {isFullscreen ? "🗗" : "🗖"}
              </button>
            </div>
          </div>

          <div className="min-h-[280px]" key={currentScene.id}>
            {renderSceneVisual()}
          </div>
        </div>

        <div
          className="rounded-3xl border border-slate-800 bg-slate-800/70 p-5 shadow-xl backdrop-blur"
          style={{ animation: "dataMovieSlideIn 0.55s ease" }}
        >
          <div className="flex items-start gap-4">
            <AvatarPresenter
              mood={currentScene.avatar_mood || currentDefinition.defaultMood}
              narration={displayedNarration || currentScene.narration}
            />
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.16em] text-blue-300">Escena {currentSceneIndex + 1} de {scenes.length}</p>
              <h4 className="text-lg font-semibold text-white">{sceneTitle}</h4>
              <p className="text-sm leading-relaxed text-slate-200">{displayedNarration || currentScene.narration}</p>
            </div>
          </div>

          {highlights.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Highlights</p>
              <ul className="space-y-2">
                {highlights.slice(0, 4).map((item, idx) => (
                  <li
                    key={`${item}-${idx}`}
                    className="flex items-start gap-2 rounded-xl border border-slate-700/70 bg-slate-900/30 px-3 py-2 text-sm text-slate-200"
                    style={{ animation: "dataMovieFadeIn 0.8s ease", animationDelay: `${idx * 80}ms` }}
                  >
                    <span className="mt-0.5 text-blue-300">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>Escena {currentSceneIndex + 1} de {scenes.length}</span>
          <span>{Math.round(progressPct)}% de la película</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
          <div className="h-full rounded-full bg-gradient-to-r from-blue-500 via-emerald-400 to-cyan-300" style={{ width: `${progressPct}%`, transition: "width 500ms ease" }} />
        </div>
        <div className="flex items-center justify-center gap-2">
          {scenes.map((scene, idx) => (
            <button
              key={scene.id || idx}
              onClick={() => goToScene(idx, false)}
              className={`h-3 w-3 rounded-full transition ${
                idx === currentSceneIndex ? "bg-blue-500 ring-4 ring-blue-900" : "bg-slate-700 hover:bg-slate-500"
              }`}
              aria-label={`Ir a escena ${idx + 1}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default DataMoviePlayer;
