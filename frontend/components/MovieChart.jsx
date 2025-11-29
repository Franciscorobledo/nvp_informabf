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
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/* ============================================================
   UTILIDADES: Tipos y detección automática
   ============================================================ */

const isDateLike = (value) => {
  if (!value) return false;
  if (value instanceof Date && !isNaN(value.getTime())) return true;

  // timestamps razonables en ms
  if (typeof value === "number" && value > 900000000000 && value < 5000000000000) {
    return true;
  }

  if (typeof value !== "string") return false;

  const parsed = Date.parse(value);
  if (!isNaN(parsed)) return true;

  // formato común de fecha
  if (/\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(value)) return true;

  return false;
};

const detectColumnTypes = (data) => {
  if (!Array.isArray(data) || !data.length) return {};

  const keys = Object.keys(data[0]);
  const stats = {};

  keys.forEach((k) => {
    stats[k] = {
      numericCount: 0,
      dateCount: 0,
      stringCount: 0,
      nonNull: 0,
    };
  });

  const sampleSize = Math.min(data.length, 50);

  for (let i = 0; i < sampleSize; i++) {
    const row = data[i];
    if (!row) continue;

    keys.forEach((k) => {
      let v = row[k];
      if (v === null || v === undefined) return;

      stats[k].nonNull++;

      // números puros
      if (typeof v === "number") {
        stats[k].numericCount++;
        return;
      }

      if (typeof v === "string") {
        const t = v.trim();

        if (!isNaN(Number(t))) {
          stats[k].numericCount++;
          return;
        }

        if (isDateLike(t)) {
          stats[k].dateCount++;
          return;
        }

        stats[k].stringCount++;
      }
    });
  }

  const result = {};

  keys.forEach((k) => {
    const s = stats[k];
    if (!s.nonNull) {
      result[k] = "unknown";
      return;
    }

    if (s.dateCount / s.nonNull > 0.6) {
      result[k] = "date";
      return;
    }

    if (s.numericCount / s.nonNull > 0.6) {
      result[k] = "number";
      return;
    }

    result[k] = "category";
  });

  return result;
};

const detectFields = (data, explicit = {}) => {
  const types = detectColumnTypes(data);
  const keys = Object.keys(types);

  const xExplicit = explicit.xField;
  const yExplicit = explicit.yField;
  const gExplicit = explicit.groupField || explicit.seriesField;

  // Prioridad a campos explícitos
  if (xExplicit && yExplicit) {
    return {
      xField: xExplicit,
      yField: yExplicit,
      groupField: gExplicit || null,
      types,
    };
  }

  const dateKeys = keys.filter((k) => types[k] === "date");
  const numberKeys = keys.filter((k) => types[k] === "number");
  const catKeys = keys.filter((k) => types[k] === "category");

  const xField = xExplicit || dateKeys[0] || catKeys[0] || keys[0];
  const yField =
    yExplicit ||
    numberKeys[0] ||
    keys.find((k) => k !== xField) ||
    keys[0];

  let groupField = gExplicit || null;
  if (!groupField) {
    const candidate = catKeys.find((k) => k !== xField);
    if (candidate) groupField = candidate;
  }

  return { xField, yField, groupField, types };
};

const suggestChartType = ({ xType, yType, seriesCount, requestedType }) => {
  if (requestedType) return requestedType.toLowerCase();

  if (xType === "date") return "line";
  if (seriesCount > 1) return "line";
  if (xType === "category" && yType === "number") return "bar";
  if (xType === "number" && yType === "number") return "scatter";

  return "line";
};

/* ============================================================
   Limpieza de datos reales (PYMEs suben archivos sucios)
   ============================================================ */

const cleanData = (data) => {
  if (!Array.isArray(data)) return [];

  return data
    .map((row) => {
      const cleaned = {};

      for (let k in row) {
        let v = row[k];

        if (v === "" || v === "-" || v === "NA" || v === "N/A") {
          cleaned[k] = null;
          continue;
        }

        if (typeof v === "string") {
          const t = v.trim();
          if (!t) {
            cleaned[k] = null;
            continue;
          }

          if (!isNaN(Number(t))) {
            cleaned[k] = Number(t);
            continue;
          }

          if (isDateLike(t)) {
            cleaned[k] = t;
            continue;
          }

          cleaned[k] = t;
          continue;
        }

        cleaned[k] = v;
      }

      return cleaned;
    })
    .filter((r) => Object.values(r).some((v) => v !== null && v !== undefined));
};

/* ============================================================
   Construcción de series dinámicas
   ============================================================ */

const buildSeriesData = (data, xField, yField, groupField) => {
  if (!groupField) {
    return {
      rows: data
        .map((item) => ({
          x: item?.[xField],
          y: Number(item?.[yField]) || 0,
        }))
        .filter((r) => r.x != null),
      seriesKeys: [yField],
    };
  }

  const grouped = {};
  const seriesKeys = new Set();

  data.forEach((row) => {
    const x = row?.[xField];
    if (x == null) return;

    const g = row?.[groupField] || "Serie";
    const y = Number(row?.[yField]) || 0;

    seriesKeys.add(g);

    if (!grouped[x]) grouped[x] = { x };
    grouped[x][g] = y;
  });

  return {
    rows: Object.values(grouped),
    seriesKeys: [...seriesKeys],
  };
};

/* ============================================================
   COMPONENTE PRINCIPAL
   ============================================================ */

const MovieChart = ({ scene }) => {
  const cfg = scene?.chart_config || scene?.chartConfig || {};
  const rawData = cfg.data || scene?.chart_data || [];

  const cleaned = useMemo(() => cleanData(rawData), [rawData]);
  const { xField, yField, groupField, types } = useMemo(
    () => detectFields(cleaned, cfg),
    [cleaned, cfg]
  );

  const { rows, seriesKeys } = useMemo(
    () => buildSeriesData(cleaned, xField, yField, groupField),
    [cleaned, xField, yField, groupField]
  );

  const chartType = useMemo(
    () =>
      suggestChartType({
        xType: types?.[xField],
        yType: types?.[yField],
        seriesCount: seriesKeys.length,
        requestedType: cfg.type || scene?.chart_type,
      }),
    [types, xField, yField, seriesKeys.length, cfg.type, scene?.chart_type]
  );

  if (!rows.length) {
    return (
      <div className="flex h-full min-h-[280px] items-center justify-center rounded-2xl border border-slate-800 bg-slate-900/60 px-6 py-8 text-sm text-slate-300">
        Sin datos disponibles.
      </div>
    );
  }

  const colors = ["#60a5fa", "#22d3ee", "#a855f7", "#f59e0b", "#34d399"];

  /* ----- Render lines ----- */
  const renderLines = () =>
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

  /* ----- Render bars ----- */
  const renderBars = () =>
    seriesKeys.map((key, idx) => (
      <Bar
        key={key}
        dataKey={groupField ? key : "y"}
        fill={colors[idx % colors.length]}
        radius={[8, 8, 4, 4]}
      />
    ));

  return (
    <div className="h-full w-full min-h-[400px]">
      <ResponsiveContainer width="100%" height="100%">
        {chartType === "bar" ? (
          <BarChart data={rows}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
            <XAxis dataKey="x" stroke="#94a3b8" />
            <YAxis stroke="#94a3b8" />
            <Tooltip />
            <Legend />
            {renderBars()}
          </BarChart>
        ) : chartType === "area" ? (
          <AreaChart data={rows}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="x" stroke="#94a3b8" />
            <YAxis stroke="#94a3b8" />
            <Tooltip />
            <Legend />
            {seriesKeys.map((key, idx) => (
              <Area
                key={key}
                type="monotone"
                dataKey={groupField ? key : "y"}
                stroke={colors[idx % colors.length]}
                fill={colors[idx % colors.length]}
                fillOpacity={0.2}
              />
            ))}
          </AreaChart>
        ) : chartType === "scatter" ? (
          <ScatterChart>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="x" stroke="#94a3b8" />
            <YAxis dataKey="y" stroke="#94a3b8" />
            <Tooltip />
            <Legend />
            <Scatter data={rows} fill="#60a5fa" />
          </ScatterChart>
        ) : (
          <LineChart data={rows}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
            <XAxis dataKey="x" stroke="#94a3b8" />
            <YAxis stroke="#94a3b8" />
            <Tooltip />
            <Legend />
            {renderLines()}
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
};

export default MovieChart;
