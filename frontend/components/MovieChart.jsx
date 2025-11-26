import React, { useMemo } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const buildSeriesData = (data, xField, yField, groupField) => {
  if (!groupField) {
    return {
      rows: data.map((item) => ({
        x: item?.[xField] ?? item?.x,
        y: Number(item?.[yField] ?? item?.y) ?? 0,
      })),
      seriesKeys: [yField || "y"],
    };
  }

  const seriesKeys = new Set();
  const grouped = {};

  data.forEach((item) => {
    const xValue = item?.[xField] ?? item?.x;
    const group = item?.[groupField] ?? item?.group ?? "Serie";
    const yValue = Number(item?.[yField] ?? item?.y) ?? 0;

    if (xValue == null) return;

    seriesKeys.add(group);
    if (!grouped[xValue]) grouped[xValue] = { x: xValue };
    grouped[xValue][group] = yValue;
  });

  return {
    rows: Object.values(grouped),
    seriesKeys: Array.from(seriesKeys),
  };
};

const MovieChart = ({ scene }) => {
  const chartConfig = scene?.chart_config || scene?.chartConfig || {};
  const data = chartConfig.data || scene?.chart_data || [];
  const chartType = (chartConfig.type || scene?.chart_type || "line").toLowerCase();
  const xField = chartConfig.xField || "x";
  const yField = chartConfig.yField || "y";
  const groupField = chartConfig.groupField || chartConfig.seriesField || "group";

  const { rows, seriesKeys } = useMemo(
    () => buildSeriesData(Array.isArray(data) ? data : [], xField, yField, chartConfig.groupField ? groupField : null),
    [data, xField, yField, chartConfig.groupField, groupField]
  );

  if (!rows.length) {
    return (
      <div className="flex h-full min-h-[280px] items-center justify-center rounded-2xl border border-slate-800 bg-slate-900/60 px-6 py-8 text-sm text-slate-300">
        Sin datos disponibles para esta escena.
      </div>
    );
  }

  const renderLines = (colors) =>
    seriesKeys.map((key, idx) => (
      <Line
        key={key}
        type="monotone"
        dataKey={groupField ? key : "y"}
        stroke={colors[idx % colors.length]}
        strokeWidth={3}
        dot={{ r: 3, strokeWidth: 1, stroke: "#0f172a" }}
        isAnimationActive
      />
    ));

  const renderBars = (colors) =>
    seriesKeys.map((key, idx) => (
      <Bar key={key} dataKey={groupField ? key : "y"} fill={colors[idx % colors.length]} radius={[8, 8, 4, 4]} />
    ));

  const renderAreas = (colors) =>
    seriesKeys.map((key, idx) => (
      <Area
        key={key}
        type="monotone"
        dataKey={groupField ? key : "y"}
        stroke={colors[idx % colors.length]}
        strokeWidth={3}
        fillOpacity={0.15}
        fill={colors[idx % colors.length]}
        isAnimationActive
      />
    ));

  const colors = ["#60a5fa", "#22d3ee", "#a855f7", "#f59e0b", "#34d399"];

  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-950/70 p-4 shadow-inner">
      <ResponsiveContainer width="100%" height={360}>
        {chartType === "bar" ? (
          <BarChart data={rows} margin={{ top: 10, right: 24, bottom: 12, left: 0 }}>
            <CartesianGrid strokeDasharray="4 4" stroke="#1f2937" />
            <XAxis dataKey="x" stroke="#cbd5e1" tick={{ fontSize: 12 }} />
            <YAxis stroke="#cbd5e1" tick={{ fontSize: 12 }} />
            <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", color: "#e2e8f0" }} />
            <Legend wrapperStyle={{ color: "#e2e8f0" }} />
            {renderBars(colors)}
          </BarChart>
        ) : chartType === "area" ? (
          <AreaChart data={rows} margin={{ top: 10, right: 24, bottom: 12, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis dataKey="x" stroke="#cbd5e1" tick={{ fontSize: 12 }} />
            <YAxis stroke="#cbd5e1" tick={{ fontSize: 12 }} />
            <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", color: "#e2e8f0" }} />
            <Legend wrapperStyle={{ color: "#e2e8f0" }} />
            {renderAreas(colors)}
          </AreaChart>
        ) : (
          <LineChart data={rows} margin={{ top: 10, right: 24, bottom: 12, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis dataKey="x" stroke="#cbd5e1" tick={{ fontSize: 12 }} />
            <YAxis stroke="#cbd5e1" tick={{ fontSize: 12 }} />
            <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", color: "#e2e8f0" }} />
            <Legend wrapperStyle={{ color: "#e2e8f0" }} />
            {renderLines(colors)}
          </LineChart>
        )}
      </ResponsiveContainer>
      <p className="mt-3 text-xs text-slate-400">
        {chartConfig.helper_text || "Visual automático de la escena, con tooltip y leyenda interactiva."}
      </p>
    </div>
  );
};

export default MovieChart;
