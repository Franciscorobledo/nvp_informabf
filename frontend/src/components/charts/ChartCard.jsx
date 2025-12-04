import React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell,
} from "recharts";
import SkeletonBlock from "../cards/SkeletonBlock";

const palette = [
  "#2563eb",
  "#16a34a",
  "#f59e0b",
  "#ec4899",
  "#0ea5e9",
  "#22c55e",
];

const ChartCard = ({ title, type, data = [], xKey = "label", series = [], height = 260 }) => {
  const resolvedType = type || "bar";

  const renderChart = () => {
    if (!data.length) return <SkeletonBlock className="h-48" />;

    if (resolvedType === "line") {
      return (
        <ResponsiveContainer width="100%" height={height}>
          <LineChart data={data} margin={{ left: 0, right: 12 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey={xKey} tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            {series.map((serie, idx) => (
              <Line
                key={serie.dataKey}
                type="monotone"
                dataKey={serie.dataKey}
                name={serie.name}
                stroke={serie.color || palette[idx % palette.length]}
                strokeWidth={2}
                dot={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      );
    }

    if (resolvedType === "pie") {
      return (
        <ResponsiveContainer width="100%" height={height}>
          <PieChart>
            <Tooltip />
            <Legend />
            <Pie
              data={data}
              dataKey={series[0]?.dataKey || "value"}
              nameKey={series[0]?.nameKey || "name"}
              innerRadius={60}
              outerRadius={90}
            >
              {data.map((entry, idx) => (
                <Cell key={`cell-${idx}`} fill={palette[idx % palette.length]} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      );
    }

    return (
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ left: 0, right: 12 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey={xKey} tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip />
          <Legend />
          {series.map((serie, idx) => (
            <Bar
              key={serie.dataKey}
              dataKey={serie.dataKey}
              name={serie.name}
              stackId={resolvedType === "stacked" ? "stack" : undefined}
              fill={serie.color || palette[idx % palette.length]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    );
  };

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/70 p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</h4>
        <span className="text-[11px] rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-1 text-slate-500 dark:text-slate-300">
          {resolvedType?.toUpperCase() || "N/A"}
        </span>
      </div>
      {renderChart()}
    </div>
  );
};

export default ChartCard;
