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
import SceneTimeline from "./SceneTimeline";
import CinemaControls from "./CinemaControls";
import '../src/netflix-movie.css';

const DEFAULT_THUMBNAIL =
  "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=1600&q=80";

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
  const [hasStarted, setHasStarted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [downloadStatus, setDownloadStatus] = useState({ state: "idle", message: "", type: null });
  const playerRef = useRef(null);

  const goToScene = useCallback(
    (idx, shouldPlay = null) => {
      if (!scenes.length) return;
      const clamped = Math.min(Math.max(idx, 0), scenes.length - 1);
      setHasStarted(true);
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
    setHasStarted(false);
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
  const thumbnailUrl = dataMovie?.thumbnail_url || dataMovie?.cover_image || DEFAULT_THUMBNAIL;
  const quickStats = useMemo(() => {
    const kpis = dataMovie?.pyme_insights?.kpis;
    if (!kpis) return [];

    return Object.entries(kpis)
      .slice(0, 3)
      .map(([key, kpi]) => ({
        icon: key === "total_revenue" ? "💰" : key === "total_transactions" ? "📊" : "🏆",
        value: kpi.format === "currency" ? `$${(kpi.value / 1000).toFixed(0)}k` : kpi.value.toLocaleString(),
        label: kpi.label,
      }));
  }, [dataMovie]);

  const handleStartPlayback = () => {
    setHasStarted(true);
    setIsPlaying(true);
    setCurrentSceneIndex(0);
  };

  const handleSceneClick = (idx) => {
    setHasStarted(true);
    goToScene(idx, false);
  };

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
      className={`relative overflow-hidden rounded-[32px] border border-white/10 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-6 sm:p-8 shadow-[0_25px_90px_-40px_rgba(59,130,246,0.45)] transition-all ${
        isFullscreen ? "fixed inset-0 z-50 m-0 h-screen w-screen overflow-auto rounded-none" : ""
      }`}
    >
      <style>{fadeInKeyframes}</style>
      <div className="pointer-events-none absolute -left-16 -top-16 h-56 w-56 rounded-full bg-blue-500/15 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-72 w-72 rounded-full bg-purple-500/10 blur-3xl" />

      <div className="relative flex flex-col gap-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <p className="text-[11px] uppercase tracking-[0.32em] text-blue-300">Película de datos</p>
            <h3 className="text-3xl sm:text-4xl font-bold text-white leading-tight">
              {dataMovie?.movie_title || "Película de datos"}
            </h3>
            <p className="text-sm text-slate-200/90">{dataMovie?.movie_subtitle || "Presentación guiada"}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleDownload("movie")}
              className={`rounded-full border border-white/20 bg-white/5 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:-translate-y-[1px] hover:border-blue-300/70 hover:bg-white/10 ${
                downloadStatus.state === "loading" ? "opacity-70" : ""
              }`}
              aria-label="Descargar película (.movie)"
            >
              {downloadStatus.state === "loading" ? "Preparando…" : "Descargar película (.movie)"}
            </button>
            <button
              onClick={hasStarted ? () => setIsPlaying((prev) => !prev) : handleStartPlayback}
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-blue-500/25 transition hover:-translate-y-[1px]"
            >
              <span aria-hidden="true">{hasStarted ? (isPlaying ? "⏸" : "▶️") : "🎬"}</span>
              {hasStarted ? (isPlaying ? "Pausar" : "Reanudar") : "Reproducir ahora"}
            </button>
          </div>
        </div>

        {hasScenes && scenes.length > 1 && (
          <SceneTimeline scenes={scenes} currentIndex={currentSceneIndex} onSceneClick={handleSceneClick} />
        )}

        {downloadStatus.message && (
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-slate-100" role="status">
            {downloadStatus.message}
          </div>
        )}

        <div className="grid gap-6 xl:grid-cols-[1.4fr,1fr] items-stretch">
          <div className="group relative overflow-hidden rounded-[28px] border border-white/10 bg-white/5 backdrop-blur-2xl shadow-[0_20px_70px_-45px_rgba(59,130,246,0.65)]">
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/5 via-blue-500/5 to-purple-500/10 opacity-80" />
            {!hasStarted ? (
              <button
                type="button"
                onClick={handleStartPlayback}
                className="relative z-10 flex w-full flex-col gap-4 p-4 text-left transition duration-300 hover:scale-[1.01]"
              >
                <div className="relative aspect-video w-full overflow-hidden rounded-[22px] ring-1 ring-white/10 shadow-2xl">
                  <img
                    src={thumbnailUrl}
                    alt="Miniatura de la película de datos"
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/10" />
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-white">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/15 shadow-lg shadow-blue-500/30 backdrop-blur-md ring-1 ring-white/30">
                      <span className="text-2xl">▶</span>
                    </div>
                    <div className="text-center space-y-1">
                      <p className="text-sm uppercase tracking-[0.18em] text-slate-200">Miniatura</p>
                      <p className="text-lg font-semibold">Click para reproducir la película</p>
                    </div>
                  </div>
                </div>

                {quickStats.length > 0 && (
                  <div className="grid gap-3 sm:grid-cols-3">
                    {quickStats.map((stat) => (
                      <div
                        key={stat.label}
                        className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white/90 shadow-inner shadow-blue-900/20"
                      >
                        <p className="text-xs uppercase tracking-[0.16em] text-slate-200/70 flex items-center gap-2">
                          <span aria-hidden="true">{stat.icon}</span>
                          {stat.label}
                        </p>
                        <p className="text-xl font-bold tracking-tight">{stat.value}</p>
                      </div>
                    ))}
                  </div>
                )}
              </button>
            ) : (
              <div className="relative z-10 flex h-full flex-col">
                <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between bg-gradient-to-b from-black/70 to-transparent px-6 py-5 text-slate-100">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600/25 text-sm font-bold text-blue-100 ring-1 ring-blue-300/50">
                      {currentSceneIndex + 1}
                    </span>
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.3em] text-slate-300 font-semibold">Escena</p>
                      <p className="text-base font-semibold text-white leading-snug">{currentDefinition.label}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={toggleFullscreen}
                      className="rounded-full bg-white/10 p-2 text-white ring-1 ring-white/20 transition hover:bg-white/20"
                      title={isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
                    >
                      {isFullscreen ? "🗗" : "🗖"}
                    </button>
                  </div>
                </div>

                <div className="flex-1 flex items-center justify-center p-6 pt-20 min-h-[380px] sm:min-h-[420px]">
                  {renderSceneVisual()}
                </div>

                <div className="bg-slate-950/70 backdrop-blur-md border-t border-white/10 p-4">
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
                  <div className="mt-3 flex items-center gap-3 text-slate-200">
                    <span className="text-xs font-medium w-12 text-right">{(currentSceneIndex + 1).toString().padStart(2, '0')}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-sky-400 via-indigo-400 to-fuchsia-500 shadow-[0_0_18px_rgba(59,130,246,0.55)]"
                        style={{ width: `${progressPct}%`, transition: "width 500ms ease-out" }}
                      />
                    </div>
                    <span className="text-xs font-medium w-12">{scenes.length.toString().padStart(2, '0')}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-5 rounded-[28px] border border-white/10 bg-white/5 p-6 shadow-xl backdrop-blur-2xl">
            <div className="flex flex-col items-center text-center space-y-4 pb-4 border-b border-white/10">
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-blue-500/25 blur-2xl" />
                <AvatarPresenter
                  mood={currentScene.avatar_mood || currentDefinition.defaultMood}
                  narration={displayedNarration || currentScene.narration}
                  size="lg"
                />
              </div>
              <div className="space-y-1">
                <h4 className="text-xl font-semibold text-white drop-shadow-sm">{sceneTitle}</h4>
                <p className="text-[11px] uppercase tracking-[0.26em] text-blue-200">
                  {currentScene.type === "intro" ? "Inicio" : currentScene.type === "outro" ? "Conclusión" : "Análisis"}
                </p>
              </div>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto pr-2 custom-scrollbar">
              <p className="text-slate-200 leading-relaxed text-base font-light">{displayedNarration}</p>

              {highlights.length > 0 && (
                <div className="space-y-3">
                  {highlights.slice(0, 4).map((item, idx) => (
                    <div
                      key={`${item}-${idx}`}
                      className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-3 text-slate-100 transition hover:border-blue-300/40"
                      style={{ animation: "dataMovieFadeIn 0.5s ease forwards", animationDelay: `${idx * 100}ms`, opacity: 0 }}
                    >
                      <span className="mt-1 h-2 w-2 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.7)]"></span>
                      <span className="text-sm leading-relaxed">{item}</span>
                    </div>
                  ))}
                </div>
              )}

              {currentSceneIndex === 0 && dataMovie?.pyme_insights && !currentScene.chart_data && (
                <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-200">Resumen general</p>
                  <PymeOverviewScene pymeInsights={dataMovie.pyme_insights} />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DataMoviePlayer;
