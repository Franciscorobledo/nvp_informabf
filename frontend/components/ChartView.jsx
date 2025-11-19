import React from "react";
import {
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

const colors = [
  "#3b82f6",
  "#22c55e",
  "#f97316",
  "#a855f7",
  "#06b6d4",
  "#ef4444",
];

const categoryLabels = {
  time_series: "Series temporales",
  categorical: "Comparaciones por categoría",
  distribution: "Distribuciones",
  otros: "Otros",
};

const ChartCard = ({ chart }) => {
  if (!chart?.data?.length) return null;

  const renderChart = () => {
    if (chart.chart_type === "line") {
      return (
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={chart.data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={chart.x_column} tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Legend />
            {chart.y_columns?.map((y, idx) => (
              <Line
                key={`${chart.x_column}-${y}-${idx}`}
                type="monotone"
                dataKey={y}
                stroke={colors[idx % colors.length]}
                dot={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      );
    }

    if (chart.chart_type === "bar" || chart.chart_type === "histogram") {
      const xKey = chart.chart_type === "histogram" ? "bin" : chart.x_column;
      return (
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chart.data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={xKey} tick={{ fontSize: 12 }} interval={0} angle={-15} dy={10} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Legend />
            {chart.y_columns?.map((y, idx) => (
              <Bar
                key={`${xKey}-${y}-${idx}`}
                dataKey={y}
                fill={colors[idx % colors.length]}
                radius={[6, 6, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      );
    }

    return null;
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 flex flex-col gap-2">
      <div className="flex flex-col gap-1">
        <h4 className="text-gray-900 font-semibold text-base">{chart.description || chart.chart_type}</h4>
        <p className="text-gray-500 text-xs">
          {chart.x_column}
          {chart.y_columns?.length ? ` • ${chart.y_columns.join(", ")}` : ""}
        </p>
      </div>
      {renderChart() || (
        <p className="text-gray-400 text-sm italic">Sin datos suficientes para graficar.</p>
      )}
    </div>
  );
};

const ChartView = ({ charts = [] }) => {
  const validCharts = charts.filter((chart) => Array.isArray(chart?.data) && chart.data.length > 0);

  if (!validCharts.length) {
    return (
      <p className="text-gray-500 italic text-center">
        No hay gráficos disponibles.
      </p>
    );
  }

  const grouped = validCharts.reduce((acc, chart) => {
    const category = chart.category || "otros";
    acc[category] = acc[category] || [];
    acc[category].push(chart);
    return acc;
  }, {});

  return (
    <div className="space-y-8">
      {Object.entries(grouped).map(([category, chartsForCategory]) => (
        <div key={category} className="space-y-3">
          <h3 className="text-lg font-semibold text-gray-800">
            {categoryLabels[category] || category}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {chartsForCategory.map((chart, idx) => (
              <ChartCard key={`${category}-${idx}`} chart={chart} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default ChartView;
