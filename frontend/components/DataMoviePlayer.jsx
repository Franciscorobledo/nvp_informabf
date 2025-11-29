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
import KPICard from "./KPICard";
import NetflixHero from "./NetflixHero";
import SceneTimeline from "./SceneTimeline";
import CinemaControls from "./CinemaControls";
import '../src/netflix-movie.css';

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

// 🆕 New Scene Components
const ComparisonScene = ({ scene }) => {
  const data = scene.data || {};
  const entityA = data.entity_a || {};
  const entityB = data.entity_b || {};
  const changePct = data.change_pct || 0;
  const trend = data.trend || "stable";

  const isPositive = trend === "up";
  const isNegative = trend === "down";

  const trendColor = isPositive ? "text-emerald-400" : isNegative ? "text-rose-400" : "text-slate-400";
  const bgColor = isPositive ? "bg-emerald-500/10" : isNegative ? "bg-rose-500/10" : "bg-slate-500/10";
  const borderColor = isPositive ? "border-emerald-500/20" : isNegative ? "border-rose-500/20" : "border-slate-500/20";

  return (
    <div className="flex flex-col items-center justify-center h-full gap-10">
      <div className="grid gap-8 md:grid-cols-2 w-full max-w-4xl">
        <div className="relative overflow-hidden rounded-[2rem] border border-slate-700 bg-slate-800/50 p-10 text-center backdrop-blur-md transition hover:border-slate-500 hover:bg-slate-800/70 group">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400 mb-4">{entityA.label}</p>
          <p className="text-5xl lg:text-6xl font-black text-white tracking-tight">{entityA.value?.toLocaleString()}</p>
        </div>
        <div className="relative overflow-hidden rounded-[2rem] border border-slate-700 bg-slate-800/50 p-10 text-center backdrop-blur-md transition hover:border-slate-500 hover:bg-slate-800/70 group">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400 mb-4">{entityB.label}</p>
          <p className="text-5xl lg:text-6xl font-black text-white tracking-tight">{entityB.value?.toLocaleString()}</p>
        </div>
      </div>

      <div className={`relative flex flex-col items-center justify-center rounded-full ${bgColor} ${borderColor} border-4 p-12 shadow-[0_0_60px_rgba(0,0,0,0.3)] backdrop-blur-xl`}>
        {isPositive ? (
          <svg className="w-28 h-28 text-emerald-400 drop-shadow-[0_0_20px_rgba(52,211,153,0.6)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
        ) : isNegative ? (
          <svg className="w-28 h-28 text-rose-400 drop-shadow-[0_0_20px_rgba(251,113,133,0.6)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
          </svg>
        ) : (
          <svg className="w-28 h-28 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 12h14" />
          </svg>
        )}
        <div className={`mt-3 text-4xl font-black ${trendColor} tracking-tighter`}>
          {Math.abs(changePct).toFixed(1)}%
        </div>
        <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mt-1">Variación</p>
      </div>
    </div>
  );
};

const DistributionScene = ({ scene }) => {
  const stats = scene.stats || {};
  return (
    <div className="flex flex-col h-full justify-center gap-8 px-4">
      {/* Hero Metric: Average */}
      <div className="flex flex-col items-center justify-center py-6">
        <p className="text-sm font-bold uppercase tracking-[0.25em] text-blue-400 mb-2">Promedio General</p>
        <p className="text-7xl lg:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-slate-400 tracking-tighter drop-shadow-2xl">
          {stats.mean?.toFixed(1) || "-"}
        </p>
      </div>

      {/* Secondary Metrics Grid */}
      <div className="grid gap-4 grid-cols-3 max-w-4xl mx-auto w-full">
        <div className="rounded-2xl border border-slate-700/50 bg-slate-800/30 p-6 text-center backdrop-blur-sm transition hover:bg-slate-800/50">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Mínimo</p>
          <p className="text-3xl font-bold text-slate-200">{stats.min?.toFixed(1) || "-"}</p>
        </div>
        <div className="rounded-2xl border border-slate-700/50 bg-slate-800/30 p-6 text-center backdrop-blur-sm transition hover:bg-slate-800/50">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Mediana</p>
          <p className="text-3xl font-bold text-blue-200">{stats.median?.toFixed(1) || "-"}</p>
        </div>
        <div className="rounded-2xl border border-slate-700/50 bg-slate-800/30 p-6 text-center backdrop-blur-sm transition hover:bg-slate-800/50">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Máximo</p>
          <p className="text-3xl font-bold text-slate-200">{stats.max?.toFixed(1) || "-"}</p>
        </div>
      </div>
    </div>
  );
};

const CorrelationScene = ({ scene }) => {
  const strength = scene.strength || "moderate";
  const direction = scene.direction || "positive";
  const corrCoef = scene.correlation_coef || 0;

  const strengthColor = strength === "strong" ? "text-emerald-400" : "text-blue-400";
  const directionText = direction === "positive" ? "Positiva" : "Negativa";

  return (
    <div className="flex flex-col h-full justify-center items-center gap-8">
      <div className="relative rounded-[2.5rem] border border-slate-700 bg-slate-800/40 p-12 text-center backdrop-blur-md shadow-2xl max-w-2xl w-full">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-900 border border-slate-700 px-6 py-2">
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Coeficiente R</span>
        </div>

        <p className={`text-8xl lg:text-9xl font-black ${strengthColor} mb-6 tracking-tighter drop-shadow-[0_0_30px_rgba(0,0,0,0.5)]`}>
          {corrCoef.toFixed(2)}
        </p>

        <div className="space-y-2">
          <p className="text-2xl font-light text-slate-200">
            Correlación <span className="font-bold text-white">{directionText}</span>
          </p>
          <div className="inline-flex items-center gap-2 rounded-full bg-slate-900/50 px-4 py-1 border border-slate-700/50">
            <div className={`h-2 w-2 rounded-full ${strength === "strong" ? "bg-emerald-400 shadow-[0_0_8px_#34d399]" : "bg-blue-400"}`} />
            <span className="text-sm font-medium text-slate-300 uppercase tracking-wide">
              Intensidad {strength === "strong" ? "Fuerte" : "Moderada"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

const AnomaliesScene = ({ scene }) => {
  const alerts = scene.alerts || [];

  return (
    <div className="flex flex-col h-full justify-center gap-6 max-w-3xl mx-auto w-full px-4">
      {alerts.map((alert, idx) => (
        <div
          key={idx}
          className="group flex items-center gap-6 rounded-3xl border border-amber-500/20 bg-gradient-to-r from-amber-950/40 to-amber-900/20 p-8 shadow-lg transition-all hover:border-amber-500/50 hover:shadow-amber-900/20 hover:-translate-y-1"
        >
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-3xl shadow-[0_0_20px_rgba(245,158,11,0.2)] group-hover:scale-110 transition-transform">
            ⚠️
          </div>
          <div className="space-y-1">
            <p className="text-xs font-bold uppercase tracking-widest text-amber-500/80">Alerta Detectada</p>
            <p className="text-xl font-medium leading-snug text-amber-100">{alert}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

const TrendScene = ({ scene }) => {
  const trendInfo = scene.trend_info || {};
  const direction = trendInfo.direction || "upward";
  const strength = trendInfo.strength || "moderate";
  const rValue = trendInfo.r_value || 0;

  const isUp = direction === "upward";
  const colorClass = isUp ? "text-emerald-400" : "text-rose-400";
  const bgClass = isUp ? "bg-emerald-500/10" : "bg-rose-500/10";
  const borderClass = isUp ? "border-emerald-500/20" : "border-rose-500/20";

  return (
    <div className="flex flex-col items-center justify-center h-full gap-10">
      <div className={`relative flex h-56 w-56 items-center justify-center rounded-full border-[6px] ${borderClass} ${bgClass} shadow-[0_0_80px_rgba(0,0,0,0.4)] backdrop-blur-xl animate-pulse`}>
        {isUp ? (
          <svg className={`w-32 h-32 ${colorClass} drop-shadow-[0_0_25px_rgba(52,211,153,0.6)]`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
        ) : (
          <svg className={`w-32 h-32 ${colorClass} drop-shadow-[0_0_25px_rgba(251,113,133,0.6)]`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
          </svg>
        )}
      </div>

      <div className="text-center space-y-3">
        <h3 className="text-5xl lg:text-6xl font-black text-white tracking-tighter">
          Tendencia <span className={colorClass}>{isUp ? "Ascendente" : "Descendente"}</span>
        </h3>
        <div className="inline-flex items-center gap-3 rounded-full bg-slate-800/60 px-6 py-2 border border-slate-700">
          <span className="text-sm font-bold uppercase tracking-widest text-slate-400">Fuerza {strength === "strong" ? "Alta" : "Moderada"}</span>
          <span className="h-1 w-1 rounded-full bg-slate-500"></span>
          <span className="text-sm font-mono text-blue-300">R² = {(rValue ** 2).toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
};

const ConcentrationScene = ({ scene }) => {
  const concentrationInfo = scene.concentration_info || {};
  const topN = concentrationInfo.top_n || 3;
  const share = concentrationInfo.top_n_share || 0;

  return (
    <div className="rounded-2xl bg-slate-800/70 p-6 text-center shadow">
      <p className="text-6xl mb-4">🎯</p>
      <p className="text-3xl font-extrabold text-amber-400">
        {(share * 100).toFixed(0)}%
      </p>
      <p className="text-sm text-slate-300 mt-2">
        del total concentrado en solo {topN} entidades
      </p>
    </div>
  );
};

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
  comparison: {
    type: "comparison",
    label: "Comparativa",
    defaultMood: "focused",
    defaultDuration: 7,
    defaults: { data: {} },
    render: ({ scene }) => <ComparisonScene scene={scene} />,
  },
  distribution: {
    type: "distribution",
    label: "Distribución",
    defaultMood: "neutral",
    defaultDuration: 7,
    defaults: { stats: {}, chart_data: [] },
    render: ({ scene }) => <DistributionScene scene={scene} />,
  },
  correlation: {
    type: "correlation",
    label: "Correlación",
    defaultMood: "focused",
    defaultDuration: 8,
    defaults: { chart_data: [] },
    render: ({ scene }) => <CorrelationScene scene={scene} />,
  },
  anomalies: {
    type: "anomalies",
    label: "Anomalías",
    defaultMood: "warning",
    defaultDuration: 6,
    defaults: { alerts: [] },
    render: ({ scene }) => <AnomaliesScene scene={scene} />,
  },
  trend: {
    type: "trend",
    label: "Tendencia",
    defaultMood: "focused",
    defaultDuration: 7,
    defaults: { trend_info: {} },
    render: ({ scene }) => <TrendScene scene={scene} />,
  },
  concentration: {
    type: "concentration",
    label: "Concentración",
    defaultMood: "warning",
    defaultDuration: 6,
    defaults: { concentration_info: {} },
    render: ({ scene }) => <ConcentrationScene scene={scene} />,
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

// 🆕 Escena de Overview con KPIs de PYME
const PymeOverviewScene = ({ pymeInsights }) => {
  if (!pymeInsights || !pymeInsights.kpis) {
    return <p className="text-slate-300">Cargando insights...</p>;
  }

  const kpis = pymeInsights.kpis;
  const trends = pymeInsights.trends || {};
  const recommendations = pymeInsights.recommendations || [];
  const alerts = pymeInsights.alerts || [];

  // Mapeo de íconos según tipo de KPI
  const kpiIcons = {
    total_revenue: "💰",
    avg_ticket: "🎫",
    total_transactions: "📊",
    top_product: "🏆",
    total_skus: "📦",
    critical_stock: "⚠️",
    total_stock: "📈",
    total_value: "💎",
    total_rows: "📄"
  };

  return (
    <div className="space-y-6">
      {/* Grid de KPIs */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {Object.entries(kpis).map(([key, kpi]) => (
          <KPICard
            key={key}
            icon={kpiIcons[key] || "📌"}
            label={kpi.label}
            value={kpi.value}
            format={kpi.format}
            trend={trends.growth_rate && key === "total_revenue" ? trends.growth_rate : null}
            alert={kpi.alert}
            extra={kpi.extra}
          />
        ))}
      </div>

      {/* Recomendaciones */}
      {recommendations.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">💡 Insights</h4>
          <div className="grid gap-3 md:grid-cols-2">
            {recommendations.map((rec, idx) => (
              <div
                key={idx}
                className={`flex items-start gap-3 rounded-xl p-4 border ${rec.priority === "critical"
                  ? "bg-red-900/20 border-red-500/30"
                  : rec.priority === "high"
                    ? "bg-amber-900/20 border-amber-500/30"
                    : "bg-blue-900/20 border-blue-500/30"
                  }`}
              >
                <span className="text-2xl">{rec.icon}</span>
                <p className="text-sm text-slate-100 leading-relaxed">{rec.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Alertas */}
      {alerts.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">🚨 Alertas</h4>
          <div className="space-y-2">
            {alerts.map((alert, idx) => (
              <div
                key={idx}
                className={`flex items-start gap-3 rounded-xl p-3 border ${alert.severity === "critical"
                  ? "bg-red-900/30 border-red-500/50"
                  : "bg-amber-900/30 border-amber-500/50"
                  }`}
              >
                <span className="text-xl">{alert.icon}</span>
                <p className="text-sm text-slate-100">{alert.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const DataMoviePlayer = ({ dataMovie }) => {
  const scenes = useMemo(() => {
    const rawScenes = extractScenes(dataMovie);
    return normalizeSceneList(rawScenes, SCENE_REGISTRY);
  }, [dataMovie]);
  const [currentSceneIndex, setCurrentSceneIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
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
    setIsPlaying(false);
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
      className={`rounded-3xl bg-slate-900 p-6 shadow-2xl border border-slate-800 space-y-5 transition-all ${isFullscreen ? "fixed inset-0 z-50 m-0 h-screen w-screen overflow-auto rounded-none" : ""
        }`}
    >
      <style>{fadeInKeyframes}</style>

      {/* 🎬 Netflix Hero Section */}
      {!isPlaying && currentSceneIndex === 0 && (
        <NetflixHero
          title={dataMovie?.movie_title || "Película de Datos"}
          subtitle={dataMovie?.movie_subtitle || "Descubre la historia detrás de tus datos"}
          onPlay={() => setIsPlaying(true)}
          stats={dataMovie?.pyme_insights?.kpis ? Object.entries(dataMovie.pyme_insights.kpis).slice(0, 3).map(([key, kpi]) => ({
            icon: key === 'total_revenue' ? '💰' : key === 'total_transactions' ? '📊' : '🏆',
            value: kpi.format === 'currency' ? `$${(kpi.value / 1000).toFixed(0)}k` : kpi.value.toLocaleString(),
            label: kpi.label
          })) : []}
        />
      )}

      {/* Header with title */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h3 className="text-2xl font-bold text-white">{dataMovie?.movie_title || "Película de datos"}</h3>
          <p className="text-sm text-slate-300">{dataMovie?.movie_subtitle || "Presentación guiada"}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handleDownload("movie")}
            className={`rounded-full border border-slate-600 px-4 py-2 text-xs font-semibold text-slate-100 transition hover:border-blue-400 hover:text-white ${downloadStatus.state === "loading" ? "opacity-70" : ""
              }`}
            aria-label="Descargar película (.movie)"
          >
            {downloadStatus.state === "loading" ? "Preparando…" : "Descargar película (.movie)"}
          </button>
        </div>
      </div>

      {/* 🎬 Scene Timeline */}
      {hasScenes && scenes.length > 1 && (
        <SceneTimeline
          scenes={scenes}
          currentIndex={currentSceneIndex}
          onSceneClick={(idx) => goToScene(idx, false)}
        />
      )}

      {downloadStatus.message && (
        <div className="rounded-2xl border border-slate-700 bg-slate-800/60 px-4 py-3 text-xs text-slate-200" role="status">
          {downloadStatus.message}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[2fr,1fr] h-full">
        {/* Left Column: Visuals */}
        <div
          className="relative flex flex-col overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#0f172a] shadow-2xl"
          style={{ animation: "dataMovieFadeIn 0.5s ease-out" }}
        >
          {/* Scene Header inside Visual Area */}
          <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between bg-gradient-to-b from-black/60 to-transparent p-6 text-slate-200">
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600/20 text-sm font-bold text-blue-400 ring-1 ring-blue-500/50">
                {currentSceneIndex + 1}
              </span>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">ESCENA</p>
                <p className="text-sm font-semibold text-white tracking-wide">{currentDefinition.label}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={toggleFullscreen}
                className="rounded-full bg-white/10 p-2 text-white hover:bg-white/20 transition backdrop-blur-sm"
                title={isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
              >
                {isFullscreen ? "🗗" : "🗖"}
              </button>
            </div>
          </div>

          {/* Main Visual Content */}
          <div className="flex-1 flex items-center justify-center p-8 pt-20 min-h-[400px]">
            {renderSceneVisual()}
          </div>

          {/* Bottom Controls Overlay */}
          <div className="bg-slate-900/80 backdrop-blur-md border-t border-slate-800 p-4">
            <CinemaControls
              isPlaying={isPlaying}
              onPlayPause={() => setIsPlaying(!isPlaying)}
              onPrevious={() => goToScene(Math.max(currentSceneIndex - 1, 0), false)}
              onNext={() => goToScene(Math.min(currentSceneIndex + 1, scenes.length - 1), false)}
              onFullscreen={toggleFullscreen}
              currentScene={currentSceneIndex}
              totalScenes={scenes.length}
              compact
            />
            {/* Progress bar */}
            <div className="mt-3 flex items-center gap-3">
              <span className="text-xs font-medium text-slate-400 w-12 text-right">{(currentSceneIndex + 1).toString().padStart(2, '0')}</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-800/50">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 shadow-[0_0_10px_rgba(168,85,247,0.5)]"
                  style={{ width: `${progressPct}%`, transition: "width 500ms ease-out" }}
                />
              </div>
              <span className="text-xs font-medium text-slate-400 w-12">{scenes.length.toString().padStart(2, '0')}</span>
            </div>
          </div>
        </div>

        {/* Right Column: Narrative & Context */}
        <div
          className="flex flex-col gap-4 rounded-3xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl backdrop-blur-xl"
          style={{ animation: "dataMovieSlideIn 0.6s ease-out" }}
        >
          {/* Avatar & Mood */}
          <div className="flex flex-col items-center text-center space-y-4 pb-6 border-b border-slate-800">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-blue-500/20 blur-xl animate-pulse"></div>
              <AvatarPresenter
                mood={currentScene.avatar_mood || currentDefinition.defaultMood}
                narration={displayedNarration || currentScene.narration}
                size="lg"
              />
            </div>
            <div>
              <h4 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400">
                {sceneTitle}
              </h4>
              <p className="text-xs uppercase tracking-widest text-blue-400 mt-1">
                {currentScene.type === 'intro' ? 'Inicio' : currentScene.type === 'outro' ? 'Conclusión' : 'Análisis'}
              </p>
            </div>
          </div>

          {/* Narrative Text */}
          <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
            <div className="prose prose-invert prose-sm max-w-none">
              <p className="text-slate-300 leading-relaxed text-base font-light">
                {displayedNarration}
              </p>
            </div>

            {/* Highlights / Bullets */}
            {highlights.length > 0 && (
              <div className="mt-6 space-y-3">
                {highlights.slice(0, 4).map((item, idx) => (
                  <div
                    key={`${item}-${idx}`}
                    className="group flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-800/40 p-3 transition-all hover:border-blue-500/30 hover:bg-slate-800/60"
                    style={{ animation: "dataMovieFadeIn 0.5s ease forwards", animationDelay: `${idx * 100}ms`, opacity: 0 }}
                  >
                    <span className="mt-1 flex h-2 w-2 shrink-0 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.6)]"></span>
                    <span className="text-sm text-slate-200 group-hover:text-white transition-colors">{item}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Pyme Overview Specifics - Only if explicitly needed in narrative */}
            {currentSceneIndex === 0 && dataMovie?.pyme_insights && !currentScene.chart_data && (
              <div className="mt-6 pt-6 border-t border-slate-800">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">Resumen General</p>
                {/* We show a mini summary here if the main visual isn't covering it */}
                <PymeOverviewScene pymeInsights={dataMovie.pyme_insights} />
              </div>
            )}
          </div>
        </div>
      </div>


    </div>
  );
};

export default DataMoviePlayer;
