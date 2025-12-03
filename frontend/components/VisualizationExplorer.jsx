import React, { useEffect, useMemo, useState } from "react";
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
} from "recharts";

const ChartEmptyState = ({ message }) => (
  <div className="flex flex-col items-center justify-center h-full text-center p-6 text-gray-500 dark:text-slate-400">
    <p className="font-semibold mb-1">No se pudo construir el gráfico</p>
    <p className="text-sm">{message}</p>
  </div>
);

const initialFilterState = {
  dimensionValues: {},
  dateRange: { start: "", end: "" },
};

const VisualizationExplorer = ({ analysis }) => {
  const sampleData = analysis?.sample || [];
  const columnTypes = analysis?.column_types || {};

  const detectedTypes = useMemo(() => {
    if (Object.keys(columnTypes).length) return columnTypes;

    const inferred = {};
    if (!Array.isArray(sampleData) || sampleData.length === 0) return inferred;

    const keys = Object.keys(sampleData[0] || {});
    keys.forEach((key) => {
      const values = sampleData.map((row) => row?.[key]);
      const hasNumber = values.some((value) => typeof value === "number");
      const hasDate = values.some((value) => value && !Number.isNaN(Date.parse(value)));
      const hasString = values.some((value) => typeof value === "string");

      if (hasNumber && !hasString) {
        inferred[key] = "numeric";
      } else if (hasDate && !hasNumber) {
        inferred[key] = "date";
      } else {
        inferred[key] = "categorical";
      }
    });
    return inferred;
  }, [columnTypes, sampleData]);

  const allColumns = useMemo(() => Object.keys(detectedTypes), [detectedTypes]);

  const numericColumns = useMemo(
    () => Object.keys(detectedTypes).filter((col) => detectedTypes[col] === "numeric"),
    [detectedTypes]
  );

  const attributeColumns = useMemo(
    () => allColumns.filter((col) => detectedTypes[col] !== "numeric" && detectedTypes[col] !== "date"),
    [allColumns, detectedTypes]
  );

  const dateColumns = useMemo(
    () => Object.keys(detectedTypes).filter((col) => detectedTypes[col] === "date"),
    [detectedTypes]
  );

  const [selectedMetric, setSelectedMetric] = useState(null);
  const [selectedDimensions, setSelectedDimensions] = useState([]);
  const [selectedChartType, setSelectedChartType] = useState("bar");
  const [selectedDateColumn, setSelectedDateColumn] = useState(null);
  const [filters, setFilters] = useState(initialFilterState);

  useEffect(() => {
    setSelectedDimensions((prev) => {
      const nextDimensions = prev.filter((dimension) => attributeColumns.includes(dimension));
      if (nextDimensions.length === prev.length) return prev;

      setFilters((current) => {
        const updatedValues = Object.fromEntries(
          Object.entries(current.dimensionValues || {}).filter(([dimension]) => attributeColumns.includes(dimension))
        );

        return { ...current, dimensionValues: updatedValues };
      });

      return nextDimensions;
    });
  }, [attributeColumns]);

  useEffect(() => {
    if (!selectedMetric && numericColumns.length) {
      setSelectedMetric(numericColumns[0]);
    }
  }, [numericColumns, selectedMetric]);

  useEffect(() => {
    if (!selectedDateColumn && dateColumns.length) {
      setSelectedDateColumn(dateColumns[0]);
    }
  }, [dateColumns, selectedDateColumn]);

  const uniqueDimensionValues = useMemo(() => {
    if (!selectedDimensions.length || !sampleData.length) return {};

    return selectedDimensions.reduce((acc, dimension) => {
      const values = new Set();
      sampleData.forEach((row) => values.add(row?.[dimension] ?? "Sin dato"));
      acc[dimension] = Array.from(values)
        .filter((value) => value !== undefined && value !== null && value !== "")
        .slice(0, 20);
      return acc;
    }, {});
  }, [sampleData, selectedDimensions]);

  const applyFilters = useMemo(() => {
    return (rows) => {
      let filtered = rows;

      selectedDimensions.forEach((dimension) => {
        const selectedValues = filters.dimensionValues?.[dimension] || [];
        if (selectedValues.length) {
          const allowed = new Set(selectedValues);
          filtered = filtered.filter((row) =>
            allowed.has(row?.[dimension] ?? "Sin dato")
          );
        }
      });

      if (selectedDateColumn && (filters.dateRange.start || filters.dateRange.end)) {
        const { start, end } = filters.dateRange;
        filtered = filtered.filter((row) => {
          const value = row?.[selectedDateColumn];
          if (!value) return false;
          const dateValue = new Date(value);
          if (Number.isNaN(dateValue.getTime())) return false;
          const afterStart = start ? dateValue >= new Date(start) : true;
          const beforeEnd = end ? dateValue <= new Date(end) : true;
          return afterStart && beforeEnd;
        });
      }

      return filtered;
    };
  }, [filters.dateRange, filters.dimensionValues, selectedDateColumn, selectedDimensions]);

  const chartData = useMemo(() => {
    if (!selectedMetric || !sampleData.length) return [];
    const filteredRows = applyFilters(sampleData);
    if (!filteredRows.length) return [];

    if (selectedDimensions.length) {
      const grouped = filteredRows.reduce((acc, row) => {
        const key = selectedDimensions
          .map((dimension) => row?.[dimension] ?? "Sin dato")
          .join(" • ");
        const value = Number(row?.[selectedMetric]) || 0;
        acc[key] = (acc[key] || 0) + value;
        return acc;
      }, {});

      return Object.entries(grouped)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 30);
    }

    return filteredRows.map((row, index) => ({
      name: `Fila ${index + 1}`,
      value: Number(row?.[selectedMetric]) || 0,
    }));
  }, [applyFilters, sampleData, selectedDimensions, selectedMetric]);

  const stats = useMemo(() => {
    if (!chartData.length) return null;
    const values = chartData.map((d) => d.value);
    const total = values.reduce((acc, val) => acc + val, 0);
    const max = Math.max(...values);
    const min = Math.min(...values);
    const avg = total / values.length || 0;
    return { total, max, min, avg };
  }, [chartData]);

  const handleDimensionValueToggle = (dimension, value) => {
    setFilters((prev) => {
      const currentValues = prev.dimensionValues?.[dimension] || [];
      const exists = currentValues.includes(value);
      const updatedValues = exists
        ? currentValues.filter((v) => v !== value)
        : [...currentValues, value];

      return {
        ...prev,
        dimensionValues: {
          ...prev.dimensionValues,
          [dimension]: updatedValues,
        },
      };
    });
  };

  const handleDimensionToggle = (dimension) => {
    setSelectedDimensions((prev) => {
      if (prev.includes(dimension)) {
        const nextDimensions = prev.filter((d) => d !== dimension);
        setFilters((current) => {
          const updated = { ...current.dimensionValues };
          delete updated[dimension];
          return { ...current, dimensionValues: updated };
        });
        return nextDimensions;
      }

      return [...prev, dimension];
    });
  };

  const handleResetFilters = () => {
    setSelectedDimensions([]);
    setFilters(initialFilterState);
    setSelectedDateColumn(null);
  };

  const handleDateRangeChange = (field, value) => {
    setFilters((prev) => ({
      ...prev,
      dateRange: { ...prev.dateRange, [field]: value },
    }));
  };

  const chartTitle = selectedDimensions.length
    ? `${selectedMetric || "Métrica"} por ${selectedDimensions.join(" • ")}`
    : `Distribución de ${selectedMetric || "métrica"}`;

  const renderChart = () => {
    if (!chartData.length) {
      return <ChartEmptyState message="Selecciona otra métrica o elimina filtros." />;
    }

    if (selectedChartType === "pie") {
      return (
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={110}
              fill="#3b82f6"
              label={(entry) => `${entry.name}`}
            />
            <Tooltip formatter={(value) => Number(value).toLocaleString()} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      );
    }

    if (selectedChartType === "line") {
      return (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 10, right: 10, bottom: 10, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-12} textAnchor="end" height={60} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip formatter={(value) => Number(value).toLocaleString()} />
            <Legend />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#6366f1"
              strokeWidth={2.2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      );
    }

    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 10, right: 10, bottom: 10, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-12} textAnchor="end" height={60} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip formatter={(value) => Number(value).toLocaleString()} />
          <Legend />
          <Bar dataKey="value" fill="#0ea5e9" radius={[10, 10, 6, 6]} />
        </BarChart>
      </ResponsiveContainer>
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-blue-600 dark:text-blue-200">Explorador de visualizaciones</p>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Panel compacto de filtros + gráfico destacado</h3>
          <p className="text-sm text-gray-600 dark:text-slate-300">
            Configura métrica, tipo de gráfico y filtros rápidos en la franja superior; debajo queda la visualización amplia.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 bg-blue-50 dark:bg-slate-800/70 border border-blue-100 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-blue-700 dark:text-blue-200">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          Controles compactos · Gráfico expandido
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm p-4 sm:p-5 space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-gray-500 dark:text-slate-400">Controles rápidos</p>
            <p className="text-[12px] text-gray-500 dark:text-slate-400">Elige métrica, gráfico y resetea en un par de clics.</p>
          </div>
          <button
            onClick={handleResetFilters}
            className="text-xs inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-200 hover:border-blue-400 hover:text-blue-600 dark:hover:border-blue-400"
          >
            <span className="text-base">↺</span> Reset filtros
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-500 dark:text-slate-400">Métrica (numérica)</label>
            <select
              value={selectedMetric || ""}
              onChange={(e) => setSelectedMetric(e.target.value)}
              className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 px-3 py-2 text-sm"
            >
              <option value="" disabled>
                Selecciona una métrica
              </option>
              {numericColumns.map((col) => (
                <option key={col} value={col}>
                  {col}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-500 dark:text-slate-400">Tipo de gráfico</label>
            <div className="grid grid-cols-3 gap-2">
              {[{ id: "bar", label: "Barras" }, { id: "line", label: "Línea" }, { id: "pie", label: "Pizza" }].map((type) => (
                <button
                  key={type.id}
                  onClick={() => setSelectedChartType(type.id)}
                  className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                    selectedChartType === type.id
                      ? "border-blue-400 bg-blue-50 text-blue-700 dark:border-blue-600 dark:bg-blue-900/40 dark:text-blue-100"
                      : "border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-200"
                  }`}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>

          {dateColumns.length > 0 && (
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-500 dark:text-slate-400">Columna de fecha</label>
              <select
                value={selectedDateColumn || ""}
                onChange={(e) => setSelectedDateColumn(e.target.value)}
                className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 px-3 py-2 text-sm"
              >
                {dateColumns.map((col) => (
                  <option key={col} value={col}>
                    {col}
                  </option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  value={filters.dateRange.start}
                  onChange={(e) => handleDateRangeChange("start", e.target.value)}
                  className="rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 px-3 py-2 text-sm"
                />
                <input
                  type="date"
                  value={filters.dateRange.end}
                  onChange={(e) => handleDateRangeChange("end", e.target.value)}
                  className="rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 px-3 py-2 text-sm"
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-500 dark:text-slate-400">Filtros activos</label>
            {selectedDimensions.length ? (
              <div className="flex flex-wrap gap-2">
                {selectedDimensions.map((dimension) => (
                  <span
                    key={dimension}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs bg-blue-50 dark:bg-slate-800 text-blue-700 dark:text-blue-200 border border-blue-100 dark:border-slate-700"
                  >
                    {dimension}
                    <button
                      onClick={() => handleDimensionToggle(dimension)}
                      className="text-[11px] text-blue-600 dark:text-blue-300 hover:underline"
                      aria-label={`Quitar filtro ${dimension}`}
                    >
                      Quitar
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-[12px] text-gray-500 dark:text-slate-500">Aún no seleccionas filtros.</p>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.15em] text-gray-500 dark:text-slate-400">Campos disponibles</p>
            <div className="flex flex-wrap gap-2">
              {attributeColumns.map((col) => {
                const isActive = selectedDimensions.includes(col);
                return (
                  <button
                    key={col}
                    onClick={() => handleDimensionToggle(col)}
                    className={`px-3 py-1.5 rounded-full text-xs border transition ${
                      isActive
                        ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/40 dark:text-blue-100 dark:border-blue-700"
                        : "bg-gray-50 text-gray-600 border-gray-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
                    }`}
                  >
                    {col}
                    <span className="ml-2 text-[10px] uppercase tracking-[0.14em] text-gray-400 dark:text-slate-500">{detectedTypes[col]}</span>
                  </button>
                );
              })}
              {!attributeColumns.length && (
                <span className="text-[12px] text-gray-500 dark:text-slate-500">Sin campos categóricos detectados.</span>
              )}
            </div>
          </div>

          {selectedDimensions.map((dimension) => {
            const values = uniqueDimensionValues[dimension] || [];
            if (!values.length) return null;

            return (
              <div key={dimension} className="space-y-2">
                <p className="text-xs uppercase tracking-[0.15em] text-gray-500 dark:text-slate-400">Valores de {dimension}</p>
                <div className="flex flex-wrap gap-2 max-h-28 overflow-y-auto pr-1">
                  {values.map((value) => {
                    const isActive = filters.dimensionValues?.[dimension]?.includes(value);
                    return (
                      <button
                        key={`${dimension}-${value}`}
                        onClick={() => handleDimensionValueToggle(dimension, value)}
                        className={`px-3 py-1.5 rounded-full text-xs border transition ${
                          isActive
                            ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-300"
                            : "bg-gray-50 dark:bg-slate-800 text-gray-600 dark:text-slate-300 border-gray-200 dark:border-slate-700"
                        }`}
                      >
                        {value}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="space-y-3">
        <div className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-lg overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-slate-800 bg-gradient-to-r from-white to-slate-50 dark:from-slate-900 dark:to-slate-950">
            <div>
              <p className="text-xs uppercase tracking-[0.12em] text-gray-500 dark:text-slate-400">Vista activa</p>
              <h4 className="text-base font-semibold text-gray-900 dark:text-white">{chartTitle}</h4>
            </div>
            <div className="hidden sm:flex items-center gap-2 text-[11px] text-gray-500 dark:text-slate-400">
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-blue-50 dark:bg-slate-800 border border-blue-100 dark:border-slate-700 text-blue-600 dark:text-blue-200">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                Interactivo
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-50 dark:bg-slate-800 border border-emerald-100 dark:border-slate-700 text-emerald-700 dark:text-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Actualiza con filtros
              </span>
            </div>
          </div>
          <div className="h-[420px] p-4">{renderChart()}</div>
        </div>

        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[{ label: "Total", value: stats.total }, { label: "Máximo", value: stats.max }, { label: "Mínimo", value: stats.min }, { label: "Promedio", value: stats.avg }].map((item) => (
              <div
                key={item.label}
                className="rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 shadow-sm"
              >
                <p className="text-[11px] uppercase tracking-[0.15em] text-gray-500 dark:text-slate-400">{item.label}</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">
                  {Number(item.value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default VisualizationExplorer;
